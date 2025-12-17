import { describe, expect, it } from "vitest";

/**
 * Validation logic extracted from CreateFolderDialog for testing.
 * This mirrors the `validate` function in create-folder-dialog.tsx
 */
const validate = (name: string, existingFolders: string[], prefix: string): string | undefined => {
  const trimmed = name.trim();
  if (!trimmed) return "文件夹名称不能为空";
  if (trimmed.includes("/")) return "文件夹名称不能包含斜杠";
  if (trimmed === "." || trimmed === "..") return "无效的文件夹名称";

  const normalized = trimmed.replace(/\/$/, "");
  const duplicateExists = existingFolders.some((folder) => {
    if (!folder.startsWith(prefix)) return false;
    const relative = folder.slice(prefix.length).replace(/\/$/, "");
    return relative === normalized;
  });
  if (duplicateExists) return "当前目录已存在同名文件夹";
  return undefined;
};

describe("CreateFolderDialog validation logic", () => {
  describe("validate function", () => {
    it("rejects empty folder names", () => {
      expect(validate("", [], "")).toBe("文件夹名称不能为空");
      expect(validate("   ", [], "")).toBe("文件夹名称不能为空");
      expect(validate("\t\n", [], "")).toBe("文件夹名称不能为空");
    });

    it("rejects folder names containing slashes", () => {
      expect(validate("folder/subfolder", [], "")).toBe("文件夹名称不能包含斜杠");
      expect(validate("/root", [], "")).toBe("文件夹名称不能包含斜杠");
      expect(validate("a/b/c", [], "")).toBe("文件夹名称不能包含斜杠");
    });

    it("rejects dot and double-dot names", () => {
      expect(validate(".", [], "")).toBe("无效的文件夹名称");
      expect(validate("..", [], "")).toBe("无效的文件夹名称");
    });

    it("allows valid folder names", () => {
      expect(validate("documents", [], "")).toBeUndefined();
      expect(validate("新文件夹", [], "")).toBeUndefined();
      expect(validate("folder-name", [], "")).toBeUndefined();
      expect(validate("folder_name", [], "")).toBeUndefined();
      expect(validate("folder.backup", [], "")).toBeUndefined();
    });

    it("detects duplicate folders in current directory", () => {
      const existing = ["documents/", "photos/", "videos/"];
      expect(validate("documents", existing, "")).toBe("当前目录已存在同名文件夹");
      expect(validate("photos", existing, "")).toBe("当前目录已存在同名文件夹");
      expect(validate("newFolder", existing, "")).toBeUndefined();
    });

    it("respects prefix when checking duplicates", () => {
      const existing = ["root/docs/", "root/images/", "root/data/"];
      const prefix = "root/";
      expect(validate("docs", existing, prefix)).toBe("当前目录已存在同名文件夹");
      expect(validate("images", existing, prefix)).toBe("当前目录已存在同名文件夹");
      expect(validate("newFolder", existing, prefix)).toBeUndefined();
    });

    it("ignores folders outside current prefix", () => {
      const existing = ["other/documents/", "root/photos/"];
      const prefix = "root/";
      // "documents" exists but in a different prefix, so it should be allowed
      expect(validate("documents", existing, prefix)).toBeUndefined();
      expect(validate("photos", existing, prefix)).toBe("当前目录已存在同名文件夹");
    });

    it("handles trailing slash normalization", () => {
      const existing = ["folder/"];
      // Input "folder" should match "folder/"
      expect(validate("folder", existing, "")).toBe("当前目录已存在同名文件夹");
      // Input "folder/" (with slash) is rejected for containing slash
      expect(validate("folder/", existing, "")).toBe("文件夹名称不能包含斜杠");
    });

    it("trims whitespace before validation", () => {
      expect(validate("  newFolder  ", [], "")).toBeUndefined();
      const existing = ["trimmed/"];
      expect(validate("  trimmed  ", existing, "")).toBe("当前目录已存在同名文件夹");
    });

    it("handles unicode folder names correctly", () => {
      expect(validate("文档", [], "")).toBeUndefined();
      expect(validate("Ñoño", [], "")).toBeUndefined();
      const existing = ["中文文件夹/"];
      expect(validate("中文文件夹", existing, "")).toBe("当前目录已存在同名文件夹");
    });
  });
});
