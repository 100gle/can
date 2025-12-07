import { useCallback, useEffect, useRef } from "react";

type ShortcutAction = "selectAll" | "delete" | "search" | "copy" | "paste" | "refresh" | "escape";

type ShortcutHandlers = {
  [K in ShortcutAction]?: () => void;
};

type UseKeyboardShortcutsOptions = {
  enabled?: boolean;
  handlers: ShortcutHandlers;
};

/**
 * Hook for registering global keyboard shortcuts.
 * Supports common operations in the Object Browser.
 *
 * Shortcuts:
 * - Ctrl/Cmd + A: Select All
 * - Delete/Backspace: Delete selected
 * - Ctrl/Cmd + F: Focus search
 * - Ctrl/Cmd + C: Copy (key to clipboard)
 * - Ctrl/Cmd + V: Paste
 * - Ctrl/Cmd + R / F5: Refresh
 * - Escape: Clear selection / close dialog
 */
export function useKeyboardShortcuts({ enabled = true, handlers }: UseKeyboardShortcutsOptions) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return;

      // Skip if typing in an input, textarea, or contenteditable
      const target = event.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) {
        // Only allow Escape in inputs
        if (event.key === "Escape" && handlersRef.current.escape) {
          handlersRef.current.escape();
        }
        return;
      }

      const isMod = event.metaKey || event.ctrlKey;
      const key = event.key.toLowerCase();

      // Ctrl/Cmd + A: Select All
      if (isMod && key === "a") {
        event.preventDefault();
        handlersRef.current.selectAll?.();
        return;
      }

      // Delete / Backspace: Delete
      if ((key === "delete" || key === "backspace") && !isMod) {
        event.preventDefault();
        handlersRef.current.delete?.();
        return;
      }

      // Ctrl/Cmd + F: Search
      if (isMod && key === "f") {
        event.preventDefault();
        handlersRef.current.search?.();
        return;
      }

      // Ctrl/Cmd + C: Copy
      if (isMod && key === "c") {
        // Only prevent default if we have a handler and something is selected
        if (handlersRef.current.copy) {
          event.preventDefault();
          handlersRef.current.copy();
        }
        return;
      }

      // Ctrl/Cmd + V: Paste
      if (isMod && key === "v") {
        if (handlersRef.current.paste) {
          event.preventDefault();
          handlersRef.current.paste();
        }
        return;
      }

      // Ctrl/Cmd + R / F5: Refresh
      if ((isMod && key === "r") || key === "f5") {
        event.preventDefault();
        handlersRef.current.refresh?.();
        return;
      }

      // Escape: Clear / Cancel
      if (key === "escape") {
        handlersRef.current.escape?.();
        return;
      }
    },
    [enabled],
  );

  useEffect(() => {
    if (!enabled) return;

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [enabled, handleKeyDown]);
}

/**
 * Helper to get shortcut key display text based on platform
 */
export function getShortcutKey(action: ShortcutAction): string {
  const isMac =
    typeof navigator !== "undefined" && navigator.platform.toUpperCase().includes("MAC");
  const mod = isMac ? "⌘" : "Ctrl";

  const shortcuts: Record<ShortcutAction, string> = {
    selectAll: `${mod}+A`,
    delete: "Delete",
    search: `${mod}+F`,
    copy: `${mod}+C`,
    paste: `${mod}+V`,
    refresh: `${mod}+R`,
    escape: "Esc",
  };

  return shortcuts[action];
}

/**
 * All available shortcuts for help display
 */
export const KEYBOARD_SHORTCUTS = [
  { action: "selectAll" as const, label: "全选", description: "选中当前页面所有文件" },
  { action: "delete" as const, label: "删除", description: "删除选中的文件" },
  { action: "search" as const, label: "搜索", description: "聚焦到搜索框" },
  { action: "copy" as const, label: "复制", description: "复制选中文件的 Key" },
  { action: "paste" as const, label: "粘贴", description: "从剪贴板粘贴" },
  { action: "refresh" as const, label: "刷新", description: "刷新当前目录" },
  { action: "escape" as const, label: "取消", description: "清除选择或关闭对话框" },
];
