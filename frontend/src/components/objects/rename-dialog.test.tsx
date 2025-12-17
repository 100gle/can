import { describe, expect, it } from "vitest";

/**
 * Validation logic extracted from RenameDialog for testing.
 * This mirrors the `validate` function in rename-dialog.tsx
 */
const validate = (name: string, currentBasename: string): string | undefined => {
  const trimmed = name.trim();
  if (!trimmed) return "名称不能为空";
  if (trimmed.includes("/")) return "名称不能包含斜杠";
  if (trimmed === currentBasename) return "新名称与原名称相同";
  return undefined;
};

/**
 * Helper to extract basename from key (mirrors getBasename in component)
 */
const getBasename = (key: string, prefix: string): string => {
  const relativePath = prefix && key.startsWith(prefix) ? key.slice(prefix.length) : key;
  return relativePath.replace(/\/$/, "");
};

describe("RenameDialog validation logic", () => {
  describe("validate function", () => {
    it("rejects empty names", () => {
      expect(validate("", "file.txt")).toBe("名称不能为空");
      expect(validate("   ", "file.txt")).toBe("名称不能为空");
    });

    it("rejects names containing slashes", () => {
      expect(validate("folder/file.txt", "file.txt")).toBe("名称不能包含斜杠");
      expect(validate("/invalid", "file.txt")).toBe("名称不能包含斜杠");
      expect(validate("path/to/file", "file.txt")).toBe("名称不能包含斜杠");
    });

    it("rejects renaming to the same name", () => {
      expect(validate("file.txt", "file.txt")).toBe("新名称与原名称相同");
    });

    it("allows valid new names", () => {
      expect(validate("newfile.txt", "file.txt")).toBeUndefined();
      expect(validate("document.pdf", "file.txt")).toBeUndefined();
      expect(validate("文件.txt", "file.txt")).toBeUndefined();
    });

    it("trims whitespace before validation", () => {
      // Whitespace-only becomes empty
      expect(validate("  ", "file.txt")).toBe("名称不能为空");
      // Leading/trailing whitespace is trimmed, so this becomes a valid name
      expect(validate("  newfile.txt  ", "file.txt")).toBeUndefined();
    });

    it("handles unicode names correctly", () => {
      expect(validate("新文件.txt", "旧文件.txt")).toBeUndefined();
      expect(validate("文件/名.txt", "file.txt")).toBe("名称不能包含斜杠");
    });
  });

  describe("getBasename helper", () => {
    it("extracts filename from key without prefix", () => {
      expect(getBasename("file.txt", "")).toBe("file.txt");
      expect(getBasename("folder/file.txt", "")).toBe("folder/file.txt");
    });

    it("extracts relative path when prefix matches", () => {
      expect(getBasename("documents/file.txt", "documents/")).toBe("file.txt");
      expect(getBasename("a/b/c/file.txt", "a/b/")).toBe("c/file.txt");
    });

    it("removes trailing slash from directories", () => {
      expect(getBasename("folder/", "")).toBe("folder");
      expect(getBasename("documents/reports/", "documents/")).toBe("reports");
    });

    it("handles non-matching prefix", () => {
      expect(getBasename("other/file.txt", "documents/")).toBe("other/file.txt");
    });
  });
});
