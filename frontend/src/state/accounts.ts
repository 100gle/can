import {
  ACCOUNTS_KEY,
  exportAccounts,
  getAccountsSnapshot,
  importAccounts,
  invalidateAccounts,
  prefetchAccounts,
  setActiveAccount,
  useAccounts,
} from "@/hooks/useAccounts";
import { queryClient } from "@/lib/queryClient";
import { CreateAccount, DeleteAccount, UpdateAccount } from "@wailsjs/go/app/App";
import type { accounts as AccountModels } from "@wailsjs/go/models";

export type {
  AccountFormInput,
  AccountModel,
  ProviderFeature,
  ProviderMetadata,
} from "@/hooks/useAccounts";

export const useAccountsStore = useAccounts;

const buildExtraParams = (input: AccountModels.CreateAccountInput): Record<string, string> => {
  const extra = { ...input.extra };
  if ((input as any).appId?.trim()) {
    extra.appId = (input as any).appId.trim();
  }
  return extra;
};

export const accountsStore = {
  bootstrap: prefetchAccounts,
  refresh: invalidateAccounts,
  setActiveAccount,
  async createAccount(input: AccountModels.CreateAccountInput) {
    const payload: AccountModels.CreateAccountInput = {
      ...input,
      extra: buildExtraParams(input),
    };
    const serverAccount = await CreateAccount(payload);
    await setActiveAccount(serverAccount.id);
    await invalidateAccounts();
    return serverAccount;
  },
  async updateAccount(accountId: string, input: Partial<AccountModels.UpdateAccountInput>) {
    const payload: Partial<AccountModels.UpdateAccountInput> = {
      ...input,
      extra: buildExtraParams(input as any),
    };
    const result = await UpdateAccount(accountId, payload as any);
    await invalidateAccounts();
    return result;
  },
  async deleteAccount(accountId: string) {
    if (!accountId) return;
    await DeleteAccount(accountId);
    await invalidateAccounts();
  },
  exportAccounts,
  importAccounts,
  getState: () => {
    const snapshot =
      getAccountsSnapshot() ??
      queryClient.getQueryData<import("@/hooks/useAccounts").AccountsQueryResult>(ACCOUNTS_KEY);
    return {
      accounts: snapshot?.accounts ?? [],
      providers: snapshot?.providers ?? [],
      features: snapshot?.features ?? [],
      activeAccountId: snapshot?.activeAccountId ?? null,
      dialStatus: {},
    };
  },
};
