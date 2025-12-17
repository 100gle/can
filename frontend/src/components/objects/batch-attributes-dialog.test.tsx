import { describe, expect, it } from "vitest";

/**
 * Helper function extracted from BatchAttributesDialog.
 * Converts tag entries array to a Record, filtering out empty entries.
 */
type KeyValue = { key: string; value: string; id: string };

const buildRecord = (entries: KeyValue[]): Record<string, string> => {
  const result: Record<string, string> = {};
  entries.forEach(({ key, value }) => {
    const trimmedKey = key.trim();
    const trimmedValue = value.trim();
    if (!trimmedKey || !trimmedValue) return;
    result[trimmedKey] = trimmedValue;
  });
  return result;
};

/**
 * Helper to create a KeyValue entry with a unique id
 */
const createEntry = (key: string, value: string): KeyValue => ({
  key,
  value,
  id: crypto.randomUUID(),
});

/**
 * canSubmit logic extracted from component
 */
const canSubmit = (
  selectedCount: number,
  activeTab: "tags" | "storage" | "acl",
  validTagEntriesCount: number,
): boolean => {
  if (selectedCount === 0) return false;
  if (activeTab === "tags") {
    return validTagEntriesCount > 0;
  }
  return true;
};

describe("BatchAttributesDialog logic", () => {
  describe("buildRecord helper", () => {
    it("converts valid entries to a record", () => {
      const entries = [createEntry("env", "production"), createEntry("team", "backend")];
      const result = buildRecord(entries);
      expect(result).toEqual({
        env: "production",
        team: "backend",
      });
    });

    it("filters out entries with empty keys", () => {
      const entries = [createEntry("", "value"), createEntry("valid", "data")];
      const result = buildRecord(entries);
      expect(result).toEqual({ valid: "data" });
    });

    it("filters out entries with empty values", () => {
      const entries = [createEntry("key", ""), createEntry("valid", "data")];
      const result = buildRecord(entries);
      expect(result).toEqual({ valid: "data" });
    });

    it("filters out entries with whitespace-only keys or values", () => {
      const entries = [
        createEntry("   ", "value"),
        createEntry("key", "   "),
        createEntry("valid", "data"),
      ];
      const result = buildRecord(entries);
      expect(result).toEqual({ valid: "data" });
    });

    it("trims whitespace from keys and values", () => {
      const entries = [createEntry("  env  ", "  prod  ")];
      const result = buildRecord(entries);
      expect(result).toEqual({ env: "prod" });
    });

    it("returns empty object for empty entries array", () => {
      expect(buildRecord([])).toEqual({});
    });

    it("returns empty object when all entries are invalid", () => {
      const entries = [createEntry("", ""), createEntry("  ", "value"), createEntry("key", "  ")];
      expect(buildRecord(entries)).toEqual({});
    });

    it("handles last entry wins for duplicate keys", () => {
      const entries = [createEntry("key", "first"), createEntry("key", "second")];
      const result = buildRecord(entries);
      expect(result).toEqual({ key: "second" });
    });
  });

  describe("canSubmit logic", () => {
    it("returns false when no objects are selected", () => {
      expect(canSubmit(0, "tags", 1)).toBe(false);
      expect(canSubmit(0, "storage", 0)).toBe(false);
      expect(canSubmit(0, "acl", 0)).toBe(false);
    });

    it("returns false for tags tab with no valid entries", () => {
      expect(canSubmit(5, "tags", 0)).toBe(false);
    });

    it("returns true for tags tab with valid entries", () => {
      expect(canSubmit(5, "tags", 1)).toBe(true);
      expect(canSubmit(1, "tags", 3)).toBe(true);
    });

    it("returns true for storage tab regardless of tag entries", () => {
      expect(canSubmit(5, "storage", 0)).toBe(true);
      expect(canSubmit(1, "storage", 5)).toBe(true);
    });

    it("returns true for acl tab regardless of tag entries", () => {
      expect(canSubmit(5, "acl", 0)).toBe(true);
      expect(canSubmit(1, "acl", 5)).toBe(true);
    });
  });

  describe("tag entry CRUD operations", () => {
    it("can add a new tag row", () => {
      const entries: KeyValue[] = [createEntry("", "")];
      const newEntries = [...entries, createEntry("", "")];
      expect(newEntries.length).toBe(2);
    });

    it("can update a tag row", () => {
      const entries: KeyValue[] = [createEntry("", "")];
      const id = entries[0].id;
      const updated = entries.map((entry) =>
        entry.id === id ? { ...entry, key: "newKey", value: "newValue" } : entry,
      );
      expect(updated[0].key).toBe("newKey");
      expect(updated[0].value).toBe("newValue");
    });

    it("can remove a tag row when more than one exists", () => {
      const entries: KeyValue[] = [createEntry("key1", "value1"), createEntry("key2", "value2")];
      const idToRemove = entries[0].id;
      const filtered = entries.filter((entry) => entry.id !== idToRemove);
      expect(filtered.length).toBe(1);
      expect(filtered[0].key).toBe("key2");
    });

    it("keeps at least one row when trying to remove the last one", () => {
      const entries: KeyValue[] = [createEntry("key", "value")];
      const filtered =
        entries.length === 1 ? entries : entries.filter((e) => e.id !== entries[0].id);
      expect(filtered.length).toBe(1);
    });
  });
});
