import type { AccountModel } from "@/state/accounts";
import { AccountCard } from "./account-card";

type AccountCardGridProps = {
  accounts: AccountModel[];
  onSelectAccount?: (account: AccountModel) => void;
  onEditAccount?: (account: AccountModel) => void;
  onDeleteAccount?: (account: AccountModel) => void;
  layout?: "card" | "list";
};

export const AccountCardGrid = ({
  accounts,
  onSelectAccount,
  onEditAccount,
  onDeleteAccount,
  layout = "card",
}: AccountCardGridProps) => {
  if (!accounts.length) return null;
  if (layout === "list") {
    return (
      <div className="flex flex-col gap-4">
        {accounts.map((account) => (
          <div key={account.id} className="w-full">
            <AccountCard
              account={account}
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
          onSelect={onSelectAccount}
          onEdit={onEditAccount}
          onDelete={onDeleteAccount}
          layout={layout}
        />
      ))}
    </div>
  );
};
