/**
 * Bucket name validation for different cloud providers using Zod.
 */
import { z } from "zod";

export type Provider = "aws" | "oss" | "cos" | "qiniu" | "r2" | "minio" | "custom";

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

// Provider-specific schemas
const basicBucketSchema = z
  .string()
  .min(3, "bucket.validation.tooShort")
  .max(63, "bucket.validation.tooLong")
  .refine((s) => /^[a-z0-9]/.test(s), "bucket.validation.invalidStart")
  .refine((s) => /[a-z0-9]$/.test(s), "bucket.validation.invalidEnd")
  .refine((s) => /^[a-z0-9][a-z0-9.-]*[a-z0-9]$/.test(s), "bucket.validation.invalidChars");

const awsBucketSchema = z
  .string()
  .min(3, "bucket.validation.tooShort")
  .max(63, "bucket.validation.tooLong")
  .refine((s) => /^[a-z0-9]/.test(s), "bucket.validation.invalidStart")
  .refine((s) => /[a-z0-9]$/.test(s), "bucket.validation.invalidEnd")
  .refine((s) => /^[a-z0-9.-]+$/.test(s), "bucket.validation.invalidChars")
  .refine((s) => !s.includes(".."), "bucket.validation.aws.adjacentPeriods")
  .refine((s) => !/^\d+\.\d+\.\d+\.\d+$/.test(s), "bucket.validation.aws.ipFormat")
  .refine(
    (s) => !["xn--", "sthree-", "amzn-s3-demo-"].some((p) => s.startsWith(p)),
    "bucket.validation.aws.prohibitedPrefix"
  )
  .refine(
    (s) => !["-s3alias", "--ol-s3", ".mrap", "--x-s3", "--table-s3"].some((x) => s.endsWith(x)),
    "bucket.validation.aws.prohibitedSuffix"
  );

const ossBucketSchema = z
  .string()
  .min(3, "bucket.validation.tooShort")
  .max(63, "bucket.validation.tooLong")
  .refine((s) => /^[a-z0-9]/.test(s), "bucket.validation.invalidStart")
  .refine((s) => /[a-z0-9]$/.test(s), "bucket.validation.invalidEnd")
  .refine((s) => /^[a-z0-9-]+$/.test(s), "bucket.validation.oss.invalidChars");

const cosBucketSchema = z
  .string()
  .min(1, "bucket.validation.empty")
  .max(50, "bucket.validation.cos.tooLong")
  .refine((s) => !s.startsWith("-"), "bucket.validation.cos.startsWithHyphen")
  .refine((s) => !s.endsWith("-"), "bucket.validation.cos.endsWithHyphen")
  .refine((s) => /^[a-z0-9-]+$/.test(s), "bucket.validation.cos.invalidChars");

const qiniuBucketSchema = z
  .string()
  .min(3, "bucket.validation.tooShort")
  .max(63, "bucket.validation.tooLong")
  .refine((s) => /^[a-z0-9]/.test(s), "bucket.validation.invalidStart")
  .refine((s) => /[a-z0-9]$/.test(s), "bucket.validation.invalidEnd")
  .refine((s) => /^[a-z0-9-]+$/.test(s), "bucket.validation.qiniu.invalidChars");

const r2BucketSchema = z
  .string()
  .min(3, "bucket.validation.tooShort")
  .max(63, "bucket.validation.tooLong")
  .refine((s) => !s.startsWith("-"), "bucket.validation.r2.startsWithHyphen")
  .refine((s) => !s.endsWith("-"), "bucket.validation.r2.endsWithHyphen")
  .refine((s) => /^[a-z0-9-]+$/.test(s), "bucket.validation.r2.invalidChars");

const schemaMap: Record<string, z.ZodType<string>> = {
  aws: awsBucketSchema,
  minio: awsBucketSchema,
  oss: ossBucketSchema,
  cos: cosBucketSchema,
  qiniu: qiniuBucketSchema,
  r2: r2BucketSchema,
};

/**
 * Validate bucket name according to provider-specific rules.
 */
export function validateBucketName(provider: string, name: string): ValidationResult {
  const trimmed = name.trim();

  if (!trimmed) {
    return { valid: false, error: "bucket.validation.empty" };
  }

  const schema = schemaMap[provider] ?? basicBucketSchema;
  const result = schema.safeParse(trimmed);

  if (result.success) {
    return { valid: true };
  }

  return { valid: false, error: result.error.issues[0]?.message };
}
