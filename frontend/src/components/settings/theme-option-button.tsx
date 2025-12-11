import type { ThemePreference } from "@/state/preferences";
import type { ReactNode } from "react";

interface ThemeOptionButtonProps {
  value: ThemePreference;
  isSelected: boolean;
  label: string;
  onClick: () => void;
  children: ReactNode;
}

export function ThemeOptionButton({
  value,
  isSelected,
  label,
  onClick,
  children,
}: ThemeOptionButtonProps) {
  return (
    <button
      type="button"
      className={`group cursor-pointer rounded-xl border-2 p-1 transition-all ${
        isSelected ? "border-primary ring-2 ring-primary/20" : "border-transparent"
      }`}
      onClick={onClick}
      aria-label={`Select ${label} theme`}
      aria-pressed={isSelected}
    >
      {children}
      <div className="mt-2 text-center text-sm font-medium">{label}</div>
    </button>
  );
}
