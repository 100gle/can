package app

import "can/internal/transfer"

// ListTransferTasks returns current transfer queue snapshot.
func (a *App) ListTransferTasks() ([]*transfer.TransferTask, error) {
	ctx, cancel := a.backgroundContext()
	defer cancel()
	return a.transfers.ListTasks(ctx)
}

// CancelTransferTask stops an in-progress transfer.
func (a *App) CancelTransferTask(taskID string) error {
	ctx, cancel := a.backgroundContext()
	defer cancel()
	return a.transfers.CancelTask(ctx, taskID)
}

// PauseTransferTask requests the transfer to pause.
func (a *App) PauseTransferTask(taskID string) error {
	ctx, cancel := a.backgroundContext()
	defer cancel()
	return a.transfers.PauseTask(ctx, taskID)
}

// ResumeTransferTask marks a paused transfer as running again.
func (a *App) ResumeTransferTask(taskID string) error {
	ctx, cancel := a.backgroundContext()
	defer cancel()
	return a.transfers.ResumeTask(ctx, taskID)
}

// SetTransferSpeedLimit sets the global transfer speed limit in bytes per second.
// A value of 0 or negative disables rate limiting.
func (a *App) SetTransferSpeedLimit(bytesPerSec int64) {
	a.transfers.SetGlobalSpeedLimit(bytesPerSec)
}

// GetTransferSpeedLimit returns the current global speed limit in bytes per second.
func (a *App) GetTransferSpeedLimit() int64 {
	return a.transfers.GetGlobalSpeedLimit()
}

// DeleteTransferTask removes a specific task from the transfer queue.
// Only completed, failed, or canceled tasks can be deleted.
func (a *App) DeleteTransferTask(taskID string) error {
	ctx, cancel := a.backgroundContext()
	defer cancel()
	return a.transfers.DeleteTask(ctx, taskID)
}

// ClearCompletedTransfers removes all completed tasks from the transfer queue.
// Returns the number of tasks cleared.
func (a *App) ClearCompletedTransfers() (int, error) {
	ctx, cancel := a.backgroundContext()
	defer cancel()
	return a.transfers.ClearCompletedTasks(ctx)
}
