/**
 * Bucket name validation for different cloud providers.
 */

export type Provider = "aws" | "oss" | "cos" | "qiniu" | "r2" | "minio" | "custom";

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validate bucket name according to provider-specific rules.
 */
export function validateBucketName(provider: string, name: string): ValidationResult {
  const trimmed = name.trim();

  if (!trimmed) {
    return { valid: false, error: "bucket.validation.empty" };
  }

  switch (provider) {
    case "aws":
    case "minio":
      return validateAWSBucketName(trimmed);
    case "oss":
      return validateOSSBucketName(trimmed);
    case "cos":
      return validateCOSBucketName(trimmed);
    case "qiniu":
      return validateQiniuBucketName(trimmed);
    case "r2":
      return validateR2BucketName(trimmed);
    default:
      return validateBasicBucketName(trimmed);
  }
}

function isAlphanumericLower(char: string): boolean {
  const code = char.charCodeAt(0);
  return (code >= 97 && code <= 122) || (code >= 48 && code <= 57); // a-z or 0-9
}

function validateBasicBucketName(name: string): ValidationResult {
  if (name.length < 3) {
    return { valid: false, error: "bucket.validation.tooShort" };
  }
  if (name.length > 63) {
    return { valid: false, error: "bucket.validation.tooLong" };
  }
  if (!isAlphanumericLower(name[0])) {
    return { valid: false, error: "bucket.validation.invalidStart" };
  }
  if (!isAlphanumericLower(name[name.length - 1])) {
    return { valid: false, error: "bucket.validation.invalidEnd" };
  }
  // Only allow lowercase, numbers, dots, hyphens
  if (!/^[a-z0-9][a-z0-9.-]*[a-z0-9]$/.test(name) && name.length >= 3) {
    return { valid: false, error: "bucket.validation.invalidChars" };
  }
  return { valid: true };
}

function validateAWSBucketName(name: string): ValidationResult {
  if (name.length < 3) {
    return { valid: false, error: "bucket.validation.tooShort" };
  }
  if (name.length > 63) {
    return { valid: false, error: "bucket.validation.tooLong" };
  }
  if (!isAlphanumericLower(name[0])) {
    return { valid: false, error: "bucket.validation.invalidStart" };
  }
  if (!isAlphanumericLower(name[name.length - 1])) {
    return { valid: false, error: "bucket.validation.invalidEnd" };
  }
  // Only lowercase letters, numbers, dots, hyphens
  if (!/^[a-z0-9.-]+$/.test(name)) {
    return { valid: false, error: "bucket.validation.invalidChars" };
  }
  // No adjacent periods
  if (name.includes("..")) {
    return { valid: false, error: "bucket.validation.aws.adjacentPeriods" };
  }
  // No IP address format
  if (/^\d+\.\d+\.\d+\.\d+$/.test(name)) {
    return { valid: false, error: "bucket.validation.aws.ipFormat" };
  }
  // Prohibited prefixes
  const prohibitedPrefixes = ["xn--", "sthree-", "amzn-s3-demo-"];
  for (const prefix of prohibitedPrefixes) {
    if (name.startsWith(prefix)) {
      return { valid: false, error: "bucket.validation.aws.prohibitedPrefix" };
    }
  }
  // Prohibited suffixes
  const prohibitedSuffixes = ["-s3alias", "--ol-s3", ".mrap", "--x-s3", "--table-s3"];
  for (const suffix of prohibitedSuffixes) {
    if (name.endsWith(suffix)) {
      return { valid: false, error: "bucket.validation.aws.prohibitedSuffix" };
    }
  }
  return { valid: true };
}

function validateOSSBucketName(name: string): ValidationResult {
  if (name.length < 3) {
    return { valid: false, error: "bucket.validation.tooShort" };
  }
  if (name.length > 63) {
    return { valid: false, error: "bucket.validation.tooLong" };
  }
  if (!isAlphanumericLower(name[0])) {
    return { valid: false, error: "bucket.validation.invalidStart" };
  }
  if (!isAlphanumericLower(name[name.length - 1])) {
    return { valid: false, error: "bucket.validation.invalidEnd" };
  }
  // Only lowercase letters, numbers, hyphens (no dots)
  if (!/^[a-z0-9-]+$/.test(name)) {
    return { valid: false, error: "bucket.validation.oss.invalidChars" };
  }
  return { valid: true };
}

function validateCOSBucketName(name: string): ValidationResult {
  if (name.length < 1) {
    return { valid: false, error: "bucket.validation.empty" };
  }
  if (name.length > 50) {
    return { valid: false, error: "bucket.validation.cos.tooLong" };
  }
  if (name.startsWith("-")) {
    return { valid: false, error: "bucket.validation.cos.startsWithHyphen" };
  }
  if (name.endsWith("-")) {
    return { valid: false, error: "bucket.validation.cos.endsWithHyphen" };
  }
  // Only lowercase letters, numbers, hyphens
  if (!/^[a-z0-9-]+$/.test(name)) {
    return { valid: false, error: "bucket.validation.cos.invalidChars" };
  }
  return { valid: true };
}

function validateQiniuBucketName(name: string): ValidationResult {
  if (name.length < 3) {
    return { valid: false, error: "bucket.validation.tooShort" };
  }
  if (name.length > 63) {
    return { valid: false, error: "bucket.validation.tooLong" };
  }
  if (!isAlphanumericLower(name[0])) {
    return { valid: false, error: "bucket.validation.invalidStart" };
  }
  if (!isAlphanumericLower(name[name.length - 1])) {
    return { valid: false, error: "bucket.validation.invalidEnd" };
  }
  // Only lowercase letters, numbers, hyphens
  if (!/^[a-z0-9-]+$/.test(name)) {
    return { valid: false, error: "bucket.validation.qiniu.invalidChars" };
  }
  return { valid: true };
}

function validateR2BucketName(name: string): ValidationResult {
  if (name.length < 3) {
    return { valid: false, error: "bucket.validation.tooShort" };
  }
  if (name.length > 63) {
    return { valid: false, error: "bucket.validation.tooLong" };
  }
  if (name.startsWith("-")) {
    return { valid: false, error: "bucket.validation.r2.startsWithHyphen" };
  }
  if (name.endsWith("-")) {
    return { valid: false, error: "bucket.validation.r2.endsWithHyphen" };
  }
  // Only lowercase letters, numbers, hyphens
  if (!/^[a-z0-9-]+$/.test(name)) {
    return { valid: false, error: "bucket.validation.r2.invalidChars" };
  }
  return { valid: true };
}
