import { Separator } from "@/components/ui/separator";
import { type ReactNode } from "react";

interface SettingsItemProps {
  label: string;
  description?: string;
  children: ReactNode;
  showSeparator?: boolean;
  /** When true, children takes full width below the label */
  fullWidth?: boolean;
}

export function SettingsItem({
  label,
  description,
  children,
  showSeparator = true,
  fullWidth = false,
}: SettingsItemProps) {
  return (
    <>
      {fullWidth ? (
        <div className="space-y-3">
          <div className="space-y-0.5">
            <p className="text-sm font-medium">{label}</p>
            {description && <p className="text-xs text-muted-foreground">{description}</p>}
          </div>
          <div>{children}</div>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-4 min-h-[40px]">
          <div className="space-y-0.5 min-w-0 flex-1">
            <p className="text-sm font-medium">{label}</p>
            {description && <p className="text-xs text-muted-foreground">{description}</p>}
          </div>
          <div className="flex-shrink-0">{children}</div>
        </div>
      )}
      {showSeparator && <Separator />}
    </>
  );
}
