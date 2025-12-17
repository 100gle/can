/**
 * Account Service
 *
 * Handles account-related operations including import/export functionality.
 */

import { ExportAccounts, ImportAccounts } from "@wailsjs/go/app/App";
import type { accounts } from "@wailsjs/go/models";
import { BaseService } from "./base";
import type { ServiceResult } from "./types";

/**
 * Account service singleton
 */
class AccountService extends BaseService {
  /**
   * Export all accounts to a file
   */
  async exportAccounts(): Promise<ServiceResult<accounts.ExportSummary>> {
    return this.callWithToast(() => ExportAccounts(), {
      loading: "正在导出账户...",
      error: "导出账户失败",
    });
  }

  /**
   * Import accounts from a file
   */
  async importAccounts(): Promise<ServiceResult<accounts.ImportSummary>> {
    return this.callWithToast(() => ImportAccounts(), {
      loading: "正在导入账户...",
      error: "导入账户失败",
    });
  }
}

// Export singleton instance
export const accountService = new AccountService();
