import { AccountModel } from "@/state/accounts";
import { createContext, useContext } from "react";

export type AccountLayoutContextType = {
  openDrawer: (mode: "create" | "edit", account?: AccountModel) => void;
};

export const AccountLayoutContext = createContext<AccountLayoutContextType | null>(null);

export const useAccountLayout = () => {
  const context = useContext(AccountLayoutContext);
  if (!context) {
    throw new Error("useAccountLayout must be used within AccountLayout");
  }
  return context;
};
