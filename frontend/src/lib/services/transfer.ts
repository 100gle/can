/**
 * Transfer Service
 * 
 * Handles transfer-related operations including access link history management.
 */

import { DeleteAccessLinkHistory, ListAccessLinkHistory } from "@wailsjs/go/app/App";
import type { objects } from "@wailsjs/go/models";
import { BaseService } from "./base";
import type { ServiceResult } from "./types";

/**
 * Transfer service singleton
 */
class TransferService extends BaseService {
  /**
   * List access link history
   */
  async listAccessLinkHistory(
    accountId: string,
    limit: number = 100,
  ): Promise<ServiceResult<objects.LinkHistoryEntry[]>> {
    this.validateRequired({ accountId });

    return this.callSilent(() => ListAccessLinkHistory(accountId, limit));
  }

  /**
   * Delete an access link history entry
   */
  async deleteAccessLinkHistory(
    accountId: string,
    id: string,
  ): Promise<ServiceResult<void>> {
    this.validateRequired({ accountId, id });

    return this.callWithToast(
      () => DeleteAccessLinkHistory(accountId, id),
      {
        success: "历史记录已删除",
        error: "删除历史记录失败",
      },
    );
  }
}

// Export singleton instance
export const transferService = new TransferService();
