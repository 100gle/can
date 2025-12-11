import { Label } from "@/components/ui/label";
import { RadioGroupItem } from "@/components/ui/radio-group";
import { type ThemePreference } from "@/state/preferences";
import type { ReactNode } from "react";

interface ThemeOptionButtonProps {
  value: ThemePreference;
  isSelected: boolean;
  label: string;
  children: ReactNode;
  onSelect?: () => void;
}

export function ThemeOptionButton({
  value,
  isSelected,
  label,
  children,
  onSelect,
}: ThemeOptionButtonProps) {
  const radioId = `theme-${value}`;

  return (
    <div className="space-y-2">
      <div
        onClick={() => onSelect?.()}
        className={`cursor-pointer rounded-xl border-2 p-1 transition-all ${
          isSelected ? "border-primary ring-2 ring-primary/20" : "border-transparent"
        }`}
      >
        {children}
      </div>
      <div className="flex items-center justify-center gap-2">
        <RadioGroupItem value={value} id={radioId} />
        <Label htmlFor={radioId} className="cursor-pointer text-sm font-medium">
          {label}
        </Label>
      </div>
    </div>
  );
}
