/**
 * Bucket Service
 *
 * Handles all bucket-related operations including snapshots, versioning,
 * encryption, policies, and CORS configuration.
 */

import {
  CreateBucketSnapshot,
  DeleteBucketSnapshot,
  GetBucketCORS,
  GetBucketEncryption,
  GetBucketPolicy,
  GetBucketVersioning,
  ListBucketSnapshots,
} from "@wailsjs/go/app/App";
import type { backup, config } from "@wailsjs/go/models";
import { BaseService } from "./base";
import type { ServiceResult } from "./types";

/**
 * Bucket service singleton
 */
class BucketService extends BaseService {
  // ==================== Snapshot Management ====================

  /**
   * Create a new bucket snapshot
   */
  async createSnapshot(
    accountId: string,
    bucketId: string,
  ): Promise<ServiceResult<backup.BackupHeader>> {
    this.validateRequired({ accountId, bucketId });

    return this.callWithToast(() => CreateBucketSnapshot(accountId, bucketId), {
      loading: "正在创建快照...",
      success: "快照创建成功",
      error: "创建快照失败",
    });
  }

  /**
   * List all snapshots for a bucket
   */
  async listSnapshots(
    accountId: string,
    bucketId: string,
  ): Promise<ServiceResult<backup.BackupHeader[]>> {
    this.validateRequired({ accountId, bucketId });

    return this.callSilent(() => ListBucketSnapshots(accountId, bucketId));
  }

  /**
   * Delete a bucket snapshot
   */
  async deleteSnapshot(snapshotId: string): Promise<ServiceResult<void>> {
    this.validateRequired({ snapshotId });

    return this.callWithToast(() => DeleteBucketSnapshot(snapshotId), {
      loading: "正在删除快照...",
      success: "快照删除成功",
      error: "删除快照失败",
    });
  }

  // ==================== Configuration Management ====================

  /**
   * Get bucket versioning configuration
   */
  async getVersioning(
    accountId: string,
    bucketName: string,
  ): Promise<ServiceResult<config.BucketVersioning>> {
    this.validateRequired({ accountId, bucketName });

    return this.callSilent(() => GetBucketVersioning(accountId, bucketName));
  }

  /**
   * Get bucket encryption configuration
   */
  async getEncryption(
    accountId: string,
    bucketName: string,
  ): Promise<ServiceResult<config.BucketEncryption>> {
    this.validateRequired({ accountId, bucketName });

    return this.callSilent(() => GetBucketEncryption(accountId, bucketName));
  }

  /**
   * Get bucket policy
   */
  async getPolicy(
    accountId: string,
    bucketName: string,
  ): Promise<ServiceResult<config.BucketPolicy>> {
    this.validateRequired({ accountId, bucketName });

    return this.callSilent(() => GetBucketPolicy(accountId, bucketName));
  }

  /**
   * Get bucket CORS configuration
   */
  async getCORS(accountId: string, bucketName: string): Promise<ServiceResult<config.BucketCORS>> {
    this.validateRequired({ accountId, bucketName });

    return this.callSilent(() => GetBucketCORS(accountId, bucketName));
  }
}

// Export singleton instance
export const bucketService = new BucketService();
