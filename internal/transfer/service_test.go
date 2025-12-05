package transfer

import (
	"context"
	"testing"
	"time"
)

func TestServiceCreateAndProgress(t *testing.T) {
	svc := NewService(nil, nil)

	upload := svc.CreateUploadTask("acc-1", "bucket", "key.txt", 100)
	if upload.ID == "" {
		t.Fatal("expected generated upload task id")
	}

	svc.MarkTaskRunning(upload.ID)
	svc.UpdateTaskProgress(upload.ID, 40)
	svc.UpdateTaskProgress(upload.ID, 60)
	svc.CompleteTask(upload.ID)

	snapshot, err := svc.GetTaskProgress(context.Background(), upload.ID)
	if err != nil {
		t.Fatalf("progress lookup failed: %v", err)
	}
	if snapshot.Status != TaskCompleted {
		t.Fatalf("expected completed status, got %s", snapshot.Status)
	}
	if snapshot.Progress != 100 {
		t.Fatalf("expected 100 bytes transferred, got %d", snapshot.Progress)
	}

	tasks, err := svc.ListTasks(context.Background())
	if err != nil {
		t.Fatalf("list tasks failed: %v", err)
	}
	if len(tasks) != 1 {
		t.Fatalf("expected 1 task, got %d", len(tasks))
	}
}

func TestServiceCancelTask(t *testing.T) {
	svc := NewService(nil, nil)
	download := svc.CreateDownloadTask("acc-2", "bucket", "video.mp4", 2048)
	svc.MarkTaskRunning(download.ID)

	_, cancel := context.WithCancel(context.Background())
	defer cancel()
	triggered := make(chan struct{}, 1)
	svc.BindTaskContext(download.ID, func() {
		cancel()
		select {
		case triggered <- struct{}{}:
		default:
		}
	})

	if err := svc.CancelTask(context.Background(), download.ID); err != nil {
		t.Fatalf("cancel task failed: %v", err)
	}

	select {
	case <-triggered:
	case <-time.After(time.Second):
		t.Fatal("expected cancel func to be invoked")
	}

	snapshot, err := svc.GetTaskProgress(context.Background(), download.ID)
	if err != nil {
		t.Fatalf("progress lookup failed: %v", err)
	}
	if snapshot.Status != TaskCanceled {
		t.Fatalf("expected canceled status, got %s", snapshot.Status)
	}
	if snapshot.EndTime == nil {
		t.Fatal("expected end time after cancellation")
	}
}
