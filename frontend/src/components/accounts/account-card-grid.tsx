import { AccountCard, type AccountCardStatus } from "./account-card";
import type { AccountModel } from "@/state/accounts";

type AccountCardGridProps = {
  accounts: AccountModel[];
  getStatus?: (account: AccountModel) => AccountCardStatus;
  onSelectAccount?: (account: AccountModel) => void;
  layout?: "cards" | "list";
};

export const AccountCardGrid = ({
  accounts,
  getStatus,
  onSelectAccount,
  layout = "cards",
}: AccountCardGridProps) => {
  if (!accounts.length) return null;
  if (layout === "list") {
    return (
      <div className="flex flex-col gap-4">
        {accounts.map((account) => (
          <div key={account.id} className="w-full">
            <AccountCard
              account={account}
              status={getStatus?.(account) ?? "pending"}
              onSelect={onSelectAccount}
            />
          </div>
        ))}
      </div>
    );
  }

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
