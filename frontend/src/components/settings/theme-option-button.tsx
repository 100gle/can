import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

interface ThemeOptionButtonProps {
  isSelected: boolean;
  label: string;
  onClick: () => void;
  children: ReactNode;
}

export function ThemeOptionButton({
  isSelected,
  label,
  onClick,
  children,
}: ThemeOptionButtonProps) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      className={`group cursor-pointer rounded-xl border-2 p-1 transition-all ${
        isSelected ? "border-primary ring-2 ring-primary/20" : "border-transparent"
      }`}
      onClick={onClick}
      aria-label={t("settings.theme.selectAria", { label })}
      aria-pressed={isSelected}
    >
      {children}
      <div className="mt-2 text-center text-sm font-medium">{label}</div>
    </button>
  );
}
