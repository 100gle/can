package sync

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"

	"can/internal/accounts"
	"can/internal/providers"
	"can/internal/transfer"
)

// service implements the Service interface.
type service struct {
	mu    sync.RWMutex
	rules map[string]*SyncRule
	jobs  map[string]context.CancelFunc

	accounts *accounts.Service
	transfer *transfer.Service
	pool     providers.ClientPool
	engine   *Engine
}

func NewService(acc *accounts.Service, tr *transfer.Service, pool providers.ClientPool) Service {
	return &service{
		rules:    make(map[string]*SyncRule),
		jobs:     make(map[string]context.CancelFunc),
		accounts: acc,
		transfer: tr,
		pool:     pool,
		engine:   NewEngine(),
	}
}

func (s *service) CreateRule(ctx context.Context, rule *SyncRule) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if rule.ID == "" {
		return errors.New("rule id required")
	}
	s.rules[rule.ID] = rule
	return nil
}

func (s *service) UpdateRule(ctx context.Context, rule *SyncRule) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, ok := s.rules[rule.ID]; !ok {
		return errors.New("rule not found")
	}
	s.rules[rule.ID] = rule
	// If running, restart? For Sprint 1, user must restart manually or we implement smart restart.
	// Let's assume manual restart or ignored for now to keep it simple as per spec "StartSync/StopSync".
	return nil
}

func (s *service) DeleteRule(ctx context.Context, id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.rules, id)
	return nil
}

func (s *service) ListRules(ctx context.Context) ([]*SyncRule, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	list := make([]*SyncRule, 0, len(s.rules))
	for _, r := range s.rules {
		list = append(list, r)
	}
	return list, nil
}

func (s *service) GetRule(ctx context.Context, id string) (*SyncRule, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	r, ok := s.rules[id]
	if !ok {
		return nil, errors.New("rule not found")
	}
	return r, nil
}

func (s *service) StartSync(ctx context.Context, ruleID string) (*SyncTask, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	rule, ok := s.rules[ruleID]
	if !ok {
		return nil, errors.New("rule not found")
	}

	if _, running := s.jobs[ruleID]; running {
		return nil, errors.New("sync already running")
	}

	// Create a new context for this job
	jobCtx, cancel := context.WithCancel(context.Background())
	s.jobs[ruleID] = cancel

	// Start daemon
	go s.runSyncDaemon(jobCtx, rule)

	// Return a stub task, since we don't track task persistence in Sync Service (yet)
	return &SyncTask{
		ID:        "job-" + ruleID, // persistent ID for the running job
		RuleID:    ruleID,
		Status:    "running",
		StartTime: time.Now(),
	}, nil
}

func (s *service) StopSync(ctx context.Context, ruleID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	cancel, ok := s.jobs[ruleID]
	if !ok {
		return nil // already stopped
	}
	cancel()
	delete(s.jobs, ruleID)
	return nil
}

func (s *service) ListTasks(ctx context.Context, ruleID string) ([]*SyncTask, error) {
	// Not implemented persistence for Sync Tasks in this iteration
	return []*SyncTask{}, nil
}

func (s *service) runSyncDaemon(ctx context.Context, rule *SyncRule) {
	if rule.Interval <= 0 {
		// Manual mode: run a single sync and exit without a ticker.
		s.performSync(ctx, rule)
		s.StopSync(context.Background(), rule.ID)
		return
	}

	ticker := time.NewTicker(time.Duration(rule.Interval) * time.Second)
	defer ticker.Stop()

	// Run immediately once
	s.performSync(ctx, rule)

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			s.performSync(ctx, rule)
		}
	}
}

func (s *service) performSync(ctx context.Context, rule *SyncRule) {
	fmt.Printf("Starting sync for rule %s\n", rule.ID)
	// 1. Get Client
	credSupplier := func(ctx context.Context) (providers.ConnectionCredentials, error) {
		return s.accounts.ConnectionCredentials(ctx, rule.AccountID)
	}
	client, _, err := s.pool.Get(ctx, rule.AccountID, credSupplier)
	if err != nil {
		fmt.Printf("Sync error: failed to get client: %v\n", err)
		return
	}

	// 2. List Remote
	remoteFiles, err := s.listRemoteFiles(ctx, client, rule.Bucket, rule.Prefix)
	if err != nil {
		fmt.Printf("Sync error: list remote failed: %v\n", err)
		return
	}

	// 3. List Local
	lister := &StandardLister{}
	localFiles, err := lister.ListLocal(rule.LocalPath)
	if err != nil {
		fmt.Printf("Sync error: list local failed: %v\n", err)
		return
	}

	// 4. Diff
	actions := s.engine.Diff(ctx, rule, localFiles, remoteFiles)

	// 5. Execute
	for _, action := range actions {
		if ctx.Err() != nil {
			return
		}
		switch action.Type {
		case ActionUpload:
			fmt.Printf("Sync Upload: %s -> %s\n", action.LocalPath, action.RemoteKey)
			_, err := s.transfer.EnqueueUpload(ctx, transfer.UploadRequest{
				AccountID: rule.AccountID,
				Bucket:    rule.Bucket,
				Key:       action.RemoteKey,
				FilePath:  action.LocalPath,
				Priority:  transfer.PriorityNormal,
			})
			if err != nil {
				fmt.Printf("Sync enqueue upload failed: %v\n", err)
			}
		case ActionDownload:
			fmt.Printf("Sync Download: %s -> %s\n", action.RemoteKey, action.LocalPath)
			// Ensure parent dir exists
			_ = os.MkdirAll(filepath.Dir(action.LocalPath), 0755)
			_, err := s.transfer.EnqueueDownload(ctx, transfer.DownloadRequest{
				AccountID: rule.AccountID,
				Bucket:    rule.Bucket,
				Key:       action.RemoteKey,
				SavePath:  action.LocalPath,
				Priority:  transfer.PriorityNormal,
			})
			if err != nil {
				fmt.Printf("Sync enqueue download failed: %v\n", err)
			}
		}
	}
	rule.LastSync = time.Now()
}

func (s *service) listRemoteFiles(ctx context.Context, client providers.StorageClient, bucket, prefix string) ([]FileInfo, error) {
	var files []FileInfo
	var marker string
	for {
		res, err := client.Objects().ListObjects(ctx, providers.ListObjectsInput{
			Bucket: bucket,
			Prefix: prefix,
			Marker: marker,
			Limit:  1000,
		})
		if err != nil {
			return nil, err
		}
		for _, obj := range res.Objects {
			if obj.IsDir {
				continue
			}
			files = append(files, FileInfo{
				Path:     obj.Key,
				Size:     obj.Size,
				ModTime:  obj.LastModified,
				IsRemote: true,
			})
		}
		if !res.Truncated {
			break
		}
		marker = res.NextMarker
	}
	return files, nil
}
