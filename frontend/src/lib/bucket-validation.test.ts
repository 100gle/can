import { describe, expect, it } from "vitest";

import { validateBucketName } from "@/lib/bucket-validation";

describe("validateBucketName", () => {
  it("rejects too short names for AWS", () => {
    expect(validateBucketName("aws", "ab").error).toBe("bucket.validation.tooShort");
  });

  it("rejects too long names for AWS", () => {
    const longName = "a".repeat(64);
    expect(validateBucketName("aws", longName).error).toBe("bucket.validation.tooLong");
  });

  it("rejects adjacent periods for AWS", () => {
    expect(validateBucketName("aws", "my..bucket").error).toBe(
      "bucket.validation.aws.adjacentPeriods",
    );
  });

  it("rejects IP formatted names for AWS", () => {
    expect(validateBucketName("aws", "192.168.1.1").error).toBe("bucket.validation.aws.ipFormat");
  });

  it("rejects invalid cos names", () => {
    const longName = "a".repeat(51);
    expect(validateBucketName("cos", longName).error).toBe("bucket.validation.cos.tooLong");
  });
});
