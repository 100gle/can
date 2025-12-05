import { AccountCard, type AccountCardStatus } from "./account-card";
import type { AccountModel } from "@/state/accounts";

type AccountCardGridProps = {
  accounts: AccountModel[];
  getStatus?: (account: AccountModel) => AccountCardStatus;
  onSelectAccount?: (account: AccountModel) => void;
};

export const AccountCardGrid = ({ accounts, getStatus, onSelectAccount }: AccountCardGridProps) => {
  if (!accounts.length) return null;
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {accounts.map((account) => (
        <AccountCard
          key={account.id}
          account={account}
          status={getStatus?.(account) ?? "pending"}
          onSelect={onSelectAccount}
        />
      ))}
    </div>
  );
};
