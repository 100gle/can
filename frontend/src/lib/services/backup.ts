/**
 * Backup Service
 * 
 * Handles application backup and restore operations,
 * including encrypted backups.
 */

import {
    CreateAppBackup,
    RestoreAppBackup,
} from "@wailsjs/go/app/App";
import type { backup } from "@wailsjs/go/models";
import { BaseService } from "./base";
import type { ServiceResult } from "./types";

/**
 * Backup service singleton
 */
class BackupService extends BaseService {
  /**
   * Create a regular backup
   */
  async createBackup(): Promise<ServiceResult<backup.BackupHeader>> {
    return this.callWithToast(
      () => CreateAppBackup(false, ""),
      {
        loading: "正在创建备份...",
        success: "备份创建成功",
        error: "备份失败",
      },
    );
  }

  /**
   * Create an encrypted backup
   */
  async createEncryptedBackup(password: string): Promise<ServiceResult<backup.BackupHeader>> {
    this.validateRequired({ password });

    return this.callWithToast(
      () => CreateAppBackup(true, password),
      {
        loading: "正在创建加密备份...",
        success: "加密备份创建成功，请妥善保管密码",
        error: "备份失败",
      },
    );
  }

  /**
   * Restore from a backup file
   */
  async restoreBackup(filePath: string): Promise<ServiceResult<void>> {
    this.validateRequired({ filePath });

    return this.callWithToast(
      () => RestoreAppBackup(filePath),
      {
        loading: "正在恢复备份...",
        success: "恢复成功",
        error: "恢复失败",
      },
    );
  }

  /**
   * Restore from an encrypted backup (not currently implemented in backend)
   * Note: Backend RestoreAppBackup takes a file path, password validation would need to be handled there
   */
  async restoreEncryptedBackup(filePath: string): Promise<ServiceResult<void>> {
    this.validateRequired({ filePath });

    return this.callWithToast(
      () => RestoreAppBackup(filePath),
      {
        loading: "正在恢复加密备份...",
        success: "恢复成功",
        error: "恢复失败",
      },
    );
  }
}

// Export singleton instance
export const backupService = new BackupService();
