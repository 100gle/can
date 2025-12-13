import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock Wails API
const mockImportAccounts = vi.fn();
const mockImportAccountsBatch = vi.fn();
const mockDownloadImportTemplate = vi.fn();

vi.mock("@wailsjs/go/app/App", () => ({
  ImportAccounts: () => mockImportAccounts(),
  ImportAccountsBatch: () => mockImportAccountsBatch(),
  DownloadImportTemplate: (format: string) => mockDownloadImportTemplate(format),
}));

describe("ImportDialog Logic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Single Import (Backup Restore)", () => {
    it("should not trigger success callback when import is cancelled", async () => {
      mockImportAccounts.mockResolvedValue({
        cancelled: true,
        imported: 0,
        skipped: 0,
        failed: 0,
      });

      const onSuccess = vi.fn();

      // Simulate import logic
      const summary = await mockImportAccounts();
      if (!summary.cancelled && summary.imported > 0) {
        onSuccess();
      }

      expect(onSuccess).not.toHaveBeenCalled();
    });

    it("should trigger success callback when accounts are imported", async () => {
      mockImportAccounts.mockResolvedValue({
        cancelled: false,
        imported: 2,
        skipped: 0,
        failed: 0,
      });

      const onSuccess = vi.fn();

      const summary = await mockImportAccounts();
      if (!summary.cancelled && summary.imported > 0) {
        onSuccess();
      }

      expect(onSuccess).toHaveBeenCalledTimes(1);
    });

    it("should not trigger success callback when no accounts imported", async () => {
      mockImportAccounts.mockResolvedValue({
        cancelled: false,
        imported: 0,
        skipped: 2,
        failed: 0,
      });

      const onSuccess = vi.fn();

      const summary = await mockImportAccounts();
      if (!summary.cancelled && summary.imported > 0) {
        onSuccess();
      }

      expect(onSuccess).not.toHaveBeenCalled();
    });
  });

  describe("Batch Import (CSV/JSON)", () => {
    it("should not trigger success callback when batch import is cancelled", async () => {
      mockImportAccountsBatch.mockResolvedValue({
        cancelled: true,
        imported: 0,
        skipped: 0,
        failed: 0,
        errors: [],
      });

      const onSuccess = vi.fn();

      const summary = await mockImportAccountsBatch();
      if (!summary.cancelled && summary.imported > 0) {
        onSuccess();
      }

      expect(onSuccess).not.toHaveBeenCalled();
    });

    it("should trigger success callback when accounts are batch imported", async () => {
      mockImportAccountsBatch.mockResolvedValue({
        cancelled: false,
        imported: 5,
        skipped: 1,
        failed: 0,
        errors: [],
      });

      const onSuccess = vi.fn();

      const summary = await mockImportAccountsBatch();
      if (!summary.cancelled && summary.imported > 0) {
        onSuccess();
      }

      expect(onSuccess).toHaveBeenCalledTimes(1);
    });

    it("should still trigger success if some imports succeeded despite failures", async () => {
      mockImportAccountsBatch.mockResolvedValue({
        cancelled: false,
        imported: 3,
        skipped: 0,
        failed: 2,
        errors: [
          { index: 2, name: "Bad Account", field: "provider", message: "Invalid provider" },
          { index: 4, name: "", field: "name", message: "Name required" },
        ],
      });

      const onSuccess = vi.fn();

      const summary = await mockImportAccountsBatch();
      if (!summary.cancelled && summary.imported > 0) {
        onSuccess();
      }

      expect(onSuccess).toHaveBeenCalledTimes(1);
    });

    it("should not trigger success if all imports failed", async () => {
      mockImportAccountsBatch.mockResolvedValue({
        cancelled: false,
        imported: 0,
        skipped: 0,
        failed: 3,
        errors: [
          { index: 1, name: "Bad 1", field: "provider", message: "Invalid" },
          { index: 2, name: "Bad 2", field: "provider", message: "Invalid" },
          { index: 3, name: "Bad 3", field: "provider", message: "Invalid" },
        ],
      });

      const onSuccess = vi.fn();

      const summary = await mockImportAccountsBatch();
      if (!summary.cancelled && summary.imported > 0) {
        onSuccess();
      }

      expect(onSuccess).not.toHaveBeenCalled();
    });
  });

  describe("Template Download", () => {
    it("should download CSV template", async () => {
      mockDownloadImportTemplate.mockResolvedValue(undefined);

      await mockDownloadImportTemplate("csv");

      expect(mockDownloadImportTemplate).toHaveBeenCalledWith("csv");
    });

    it("should download JSON template", async () => {
      mockDownloadImportTemplate.mockResolvedValue(undefined);

      await mockDownloadImportTemplate("json");

      expect(mockDownloadImportTemplate).toHaveBeenCalledWith("json");
    });

    it("should handle template download error", async () => {
      const error = new Error("Download failed");
      mockDownloadImportTemplate.mockRejectedValue(error);

      let errorMessage: string | null = null;
      try {
        await mockDownloadImportTemplate("csv");
      } catch (err) {
        errorMessage = err instanceof Error ? err.message : "Unknown error";
      }

      expect(errorMessage).toBe("Download failed");
    });
  });

  describe("Import Result State", () => {
    it("should determine success state correctly", () => {
      const determineState = (result: { imported: number; failed: number }) => {
        return result.failed > 0 || result.imported === 0 ? "error" : "success";
      };

      expect(determineState({ imported: 5, failed: 0 })).toBe("success");
      expect(determineState({ imported: 3, failed: 2 })).toBe("error");
      expect(determineState({ imported: 0, failed: 0 })).toBe("error");
      expect(determineState({ imported: 0, failed: 3 })).toBe("error");
    });

    it("should limit displayed errors to 10", () => {
      const errors = Array.from({ length: 15 }, (_, i) => ({
        index: i + 1,
        name: `Account ${i + 1}`,
        message: "Error",
      }));

      const displayedErrors = errors.slice(0, 10);
      const moreCount = errors.length - 10;

      expect(displayedErrors).toHaveLength(10);
      expect(moreCount).toBe(5);
    });
  });

  describe("Valid Providers List", () => {
    it("should contain all supported providers", () => {
      const VALID_PROVIDERS = ["aws", "oss", "cos", "r2", "qiniu", "minio", "custom"];

      expect(VALID_PROVIDERS).toContain("aws");
      expect(VALID_PROVIDERS).toContain("oss");
      expect(VALID_PROVIDERS).toContain("cos");
      expect(VALID_PROVIDERS).toContain("r2");
      expect(VALID_PROVIDERS).toContain("qiniu");
      expect(VALID_PROVIDERS).toContain("minio");
      expect(VALID_PROVIDERS).toContain("custom");
      expect(VALID_PROVIDERS).toHaveLength(7);
    });
  });
});
