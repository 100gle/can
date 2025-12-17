/**
 * Bucket Service
 *
 * Handles all bucket-related operations including snapshots, versioning,
 * encryption, policies, and CORS configuration.
 */

import {
  GetBucketCORS,
  GetBucketEncryption,
  GetBucketPolicy,
  GetBucketVersioning,
} from "@wailsjs/go/app/App";
import type { config, storage } from "@wailsjs/go/models";
import { BaseService } from "./base";
import type { ServiceResult } from "./types";

/**
 * Bucket service singleton
 */
class BucketService extends BaseService {
  // Snapshot Management removed.

  // ==================== Configuration Management ====================

  /**
   * Get bucket versioning configuration
   */
  async getVersioning(
    accountId: string,
    bucketName: string,
  ): Promise<ServiceResult<storage.BucketVersioningConfiguration>> {
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
