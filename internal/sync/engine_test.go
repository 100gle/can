package sync

import (
	"context"
	"testing"
	"time"
)

func TestEngine_Diff_LocalToRemote(t *testing.T) {
	e := NewEngine()
	ctx := context.Background()
	rule := &SyncRule{
		ID:        "test-rule",
		LocalPath: "/local",
		Bucket:    "bucket",
		Direction: SyncLocalToRemote,
	}

	now := time.Now()

	localFiles := []FileInfo{
		{Path: "/local/file1.txt", Size: 100, ModTime: now},
		{Path: "/local/file2.txt", Size: 200, ModTime: now},
	}
	remoteFiles := []FileInfo{
		{Path: "file1.txt", Size: 100, ModTime: now.Add(-1 * time.Hour)}, // Older
	}

	actions := e.Diff(ctx, rule, localFiles, remoteFiles)

	if len(actions) != 2 {
		t.Fatalf("expected 2 actions, got %d", len(actions))
	}

	// Expect file1.txt upload (newer)
	// Expect file2.txt upload (new)

	actionMap := make(map[string]SyncAction)
	for _, a := range actions {
		actionMap[a.RemoteKey] = a
	}

	if a, ok := actionMap["file1.txt"]; !ok || a.Type != ActionUpload {
		t.Errorf("expected upload for file1.txt, got %v", a)
	}
	if a, ok := actionMap["file2.txt"]; !ok || a.Type != ActionUpload {
		t.Errorf("expected upload for file2.txt, got %v", a)
	}
}

func TestEngine_Diff_RemoteToLocal(t *testing.T) {
	e := NewEngine()
	ctx := context.Background()
	rule := &SyncRule{
		ID:        "test-rule",
		LocalPath: "/local",
		Bucket:    "bucket",
		Direction: SyncRemoteToLocal,
	}

	now := time.Now()

	localFiles := []FileInfo{
		{Path: "/local/file1.txt", Size: 100, ModTime: now.Add(-1 * time.Hour)},
	}
	remoteFiles := []FileInfo{
		{Path: "file1.txt", Size: 100, ModTime: now}, // Newer
		{Path: "file3.txt", Size: 300, ModTime: now}, // New
	}

	actions := e.Diff(ctx, rule, localFiles, remoteFiles)

	if len(actions) != 2 {
		t.Fatalf("expected 2 actions, got %d", len(actions))
	}

	actionMap := make(map[string]SyncAction)
	for _, a := range actions {
		actionMap[a.RemoteKey] = a
	}

	if a, ok := actionMap["file1.txt"]; !ok || a.Type != ActionDownload {
		t.Errorf("expected download for file1.txt, got %v", a)
	}
	if a, ok := actionMap["file3.txt"]; !ok || a.Type != ActionDownload {
		t.Errorf("expected download for file3.txt, got %v", a)
	}
}
