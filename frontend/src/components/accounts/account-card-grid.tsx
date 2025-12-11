import type { AccountModel, ConnectionProbe } from "@/state/accounts";
import { AccountCard } from "./account-card";

type AccountCardGridProps = {
  accounts: AccountModel[];
  connectionTests?: Record<string, ConnectionProbe>;
  onSelectAccount?: (account: AccountModel) => void;
  onEditAccount?: (account: AccountModel) => void;
  onDeleteAccount?: (account: AccountModel) => void;
  layout?: "cards" | "list";
};

export const AccountCardGrid = ({
  accounts,
  connectionTests,
  onSelectAccount,
  onEditAccount,
  onDeleteAccount,
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
              status={connectionTests?.[account.id]}
              onSelect={onSelectAccount}
              onEdit={onEditAccount}
              onDelete={onDeleteAccount}
              layout={layout}
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
          status={connectionTests?.[account.id]}
          onSelect={onSelectAccount}
          onEdit={onEditAccount}
          onDelete={onDeleteAccount}
          layout={layout}
        />
      ))}
    </div>
  );
};
