import { ContextMenu, ContextMenuContent, ContextMenuTrigger } from "@/components/ui/context-menu";
import { cn } from "@/lib/utils";
import { memo, useCallback } from "react";

export type BaseItemProps = {
  // 布局控制
  viewMode: "grid" | "list";
  label: string;

  // 视觉控制
  icon: React.ReactNode;
  iconBackground?: string;
  badge?: React.ReactNode;
  overlay?: React.ReactNode;
  selected?: boolean;

  // 交互控制
  onClick?: (e?: React.MouseEvent) => void;
  onDoubleClick?: () => void;
  clickable?: boolean;

  // 菜单控制
  menuItems: React.ReactNode;
};

export const BaseItem = memo(function BaseItem({
  viewMode,
  label,
  icon,
  iconBackground = "bg-primary/10",
  badge,
  overlay,
  selected = false,
  onClick,
  onDoubleClick,
  clickable = true,
  menuItems,
}: BaseItemProps) {
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (clickable && (e.key === "Enter" || e.key === " ")) {
        e.preventDefault();
        onClick?.(e as unknown as React.MouseEvent);
      }
    },
    [clickable, onClick],
  );
  return (
    <ContextMenu>
      <ContextMenuTrigger>
        <div
          role="button"
          tabIndex={clickable ? 0 : undefined}
          onClick={onClick}
          onDoubleClick={onDoubleClick}
          onKeyDown={handleKeyDown}
          className={cn(
            "group relative flex items-center justify-center rounded-md transition-all text-center",
            "hover:bg-accent/60",
            viewMode === "grid"
              ? "flex-col gap-1.5 aspect-square w-full mt-2"
              : "flex-row gap-3 px-3 py-2 w-full border-b border-border/30",
            !clickable && "cursor-default",
            selected && "ring-2 ring-primary bg-accent/80",
            clickable && "focus:outline-none focus:ring-2 focus:ring-primary",
          )}
        >
          {overlay}
          <div
            className={cn(
              "relative flex items-center justify-center rounded-md transition-opacity shrink-0 overflow-hidden group-hover:opacity-90",
              iconBackground,
              viewMode === "grid" ? "size-20" : "size-8",
            )}
          >
            {icon}
            {badge}
          </div>
          <p
            className={cn(
              "truncate text-sm font-medium max-w-full",
              viewMode === "grid" ? "w-full px-1" : "flex-1 text-left",
            )}
          >
            {label}
          </p>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>{menuItems}</ContextMenuContent>
    </ContextMenu>
  );
});
