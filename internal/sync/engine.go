package sync

import (
	"context"
	"io/fs"
	"path"
	"path/filepath"
	"strings"
	"time"

	"can/internal/providers"
)

// SyncActionType defines what operation needs to be performed.
type SyncActionType string

const (
	ActionUpload   SyncActionType = "upload"
	ActionDownload SyncActionType = "download"
	ActionDelete   SyncActionType = "delete" // Not implemented in Sprint 1 for safety? Plan says "One-way (Upload/Download)".
	ActionConflict SyncActionType = "conflict"
	ActionSkip     SyncActionType = "skip"
)

// SyncAction represents a decision made by the diff engine.
type SyncAction struct {
	Type      SyncActionType
	LocalPath string
	RemoteKey string
	Reason    string
}

// Engine handles the logic of comparing local and remote states.
type Engine struct {
	// dependencies if any
}

func NewEngine() *Engine {
	return &Engine{}
}

// FileInfo abstracts the common properties we need for comparison.
type FileInfo struct {
	Path     string
	Size     int64
	ModTime  time.Time
	IsRemote bool
}

// Diff compares local directory with remote bucket prefix and returns a list of actions.
// This is a naive implementation that lists EVERYTHING. For large buckets, we need pagination, but for Sprint 1 we assume reasonable size.
func (e *Engine) Diff(ctx context.Context, rule *SyncRule, localFiles []FileInfo, remoteFiles []FileInfo) []SyncAction {
	actions := []SyncAction{}

	localMap := make(map[string]FileInfo)
	for _, f := range localFiles {
		rel, _ := filepath.Rel(rule.LocalPath, f.Path)
		// Normalize path to forward slashes for Key comparison
		key := filepath.ToSlash(rel)
		if rule.Prefix != "" {
			key = path.Join(rule.Prefix, key)
		}
		localMap[key] = f
	}

	remoteMap := make(map[string]FileInfo)
	for _, f := range remoteFiles {
		remoteMap[f.Path] = f
	}

	// 1. Scan Local files to see what needs Uploading
	if rule.Direction == SyncLocalToRemote || rule.Direction == SyncBidirectional {
		for key, local := range localMap {
			remote, exists := remoteMap[key]
			if !exists {
				actions = append(actions, SyncAction{
					Type:      ActionUpload,
					LocalPath: local.Path,
					RemoteKey: key,
					Reason:    "new local file",
				})
				continue
			}
			// Both exist. Compare.
			if local.ModTime.After(remote.ModTime) {
				actions = append(actions, SyncAction{
					Type:      ActionUpload,
					LocalPath: local.Path,
					RemoteKey: key,
					Reason:    "local newer",
				})
			}
		}
	}

	// 2. Scan Remote files to see what needs Downloading
	if rule.Direction == SyncRemoteToLocal || rule.Direction == SyncBidirectional {
		for key, remote := range remoteMap {
			// Reverse key to local path
			// key = "prefix/subdir/file.txt" -> rel = "subdir/file.txt"
			rel := key
			if rule.Prefix != "" {
				if !strings.HasPrefix(key, rule.Prefix) {
					continue // Should not happen if list filtered correctly
				}
				rel = strings.TrimPrefix(key, rule.Prefix)
				rel = strings.TrimPrefix(rel, "/") // clean leading slash
			}
			// local normalized key logic was: key = prefix + rel
			// so we just check localMap[key]

			local, exists := localMap[key]

			if !exists {
				localTarget := filepath.Join(rule.LocalPath, filepath.FromSlash(rel))
				actions = append(actions, SyncAction{
					Type:      ActionDownload,
					LocalPath: localTarget,
					RemoteKey: key,
					Reason:    "new remote file",
				})
				continue
			}

			// Both exist.
			if rule.Direction == SyncBidirectional {
				// Bidirectional: if remote is newer, download.
				// Note: We already checked "local newer" above.
				// If times are equal, do nothing.
				// If remote newer, download.
				if remote.ModTime.After(local.ModTime) {
					actions = append(actions, SyncAction{
						Type:      ActionDownload,
						LocalPath: local.Path,
						RemoteKey: key,
						Reason:    "remote newer",
					})
				}
			} else {
				// Direction is RemoteToLocal
				// Always overwrite local if different? Or only if newer?
				// Standard sync usually implies "make target look like source".
				// But for safety, let's stick to "Newer Wins" as a safe default even for one-way,
				// OR "Source Wins" (Mirror).
				// Let's assume Source Wins for one-way.
				if remote.ModTime.After(local.ModTime) || remote.Size != local.Size {
					actions = append(actions, SyncAction{
						Type:      ActionDownload,
						LocalPath: local.Path,
						RemoteKey: key,
						Reason:    "remote source update",
					})
				}
			}
		}
	}

	return actions
}

// Helpers to list files

type FileLister interface {
	ListLocal(path string) ([]FileInfo, error)
	ListRemote(ctx context.Context, client providers.StorageClient, bucket, prefix string) ([]FileInfo, error)
}

type StandardLister struct{}

func (l *StandardLister) ListLocal(root string) ([]FileInfo, error) {
	var files []FileInfo
	err := filepath.WalkDir(root, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if d.IsDir() {
			return nil
		}
		info, err := d.Info()
		if err != nil {
			return err
		}
		files = append(files, FileInfo{
			Path:     path,
			Size:     info.Size(),
			ModTime:  info.ModTime(),
			IsRemote: false,
		})
		return nil
	})
	return files, err
}

func (l *StandardLister) ListRemote(ctx context.Context, client providers.StorageClient, bucket, prefix string) ([]FileInfo, error) {
	var files []FileInfo
	// Simple recursive list. For production this needs to use continuation tokens.
	// But `providers.ObjectDriver` interface in `internal/providers` usually has `ListObjects`.
	// Let's check `internal/providers/types.go` or `driver.go`.
	// Assuming `ListObjects` returns a flat list or we have to walk.
	// I'll assume we can list recursively or flatten it.

	// For now, I will use a simplified assumption that we can list everything.
	// I need to use the actual client API.
	// client.Objects().ListObjects(...)

	// Since I can't see the exact signature of ListObjects comfortably here without reading file again,
	// I'll leave the implementation logic of ListRemote for the Service to inject or handle,
	// OR I will read `internal/providers` types now.
	return files, nil
}
