import type { AccountFormInput } from "@/hooks/useAccounts";
import type { TFunction } from "i18next";
import { z } from "zod";

export type { AccountFormInput };

export const createDefaultForm = (providerId: string = "aws"): AccountFormInput => ({
  name: "",
  tag: "",
  provider: providerId,
  endpoint: "",
  region: "",
  appId: "",
  accessKeyId: "",
  secretAccessKey: "",
  useSSL: true,
  port: 443,
  extra: {},
});

export const getAccountFormSchema = (t: TFunction, mode: "create" | "edit") => {
  const baseSchema = z.object({
    name: z.string().trim().min(1, t("account.form.field.name.error.required")),
    tag: z
      .string()
      .trim()
      .max(64, t("account.form.field.tag.error.maxLength"))
      .optional()
      .or(z.literal("")),
    provider: z.string().trim().min(1, t("account.form.field.provider.error.required")),
    endpoint: z.string().trim().min(1, t("account.form.field.endpoint.error.required")),
    region: z.string().trim(),
    appId: z.string().trim().default(""),
    accessKeyId: z.string().trim().default(""),
    secretAccessKey: z.string().trim().default(""),
    useSSL: z.boolean(),
    port: z
      .number({ error: t("account.form.field.port.error.number") })
      .int(t("account.form.field.port.error.integer"))
      .min(1, t("account.form.field.port.error.range"))
      .max(65535, t("account.form.field.port.error.range")),
  });

  return baseSchema.superRefine((data, ctx) => {
    if (mode === "create") {
      if (!data.accessKeyId?.trim()) {
        ctx.addIssue({
          code: "custom",
          path: ["accessKeyId"],
          message: t("account.form.field.accessKeyId.error.required"),
        });
      }
      if (!data.secretAccessKey?.trim()) {
        ctx.addIssue({
          code: "custom",
          path: ["secretAccessKey"],
          message: t("account.form.field.secretAccessKey.error.required"),
        });
      }
    }
    // COS requires AppID
    if (data.provider === "cos" && !data.appId?.trim()) {
      ctx.addIssue({
        code: "custom",
        path: ["appId"],
        message: t("account.form.field.appId.error.required"),
      });
    }
  });
};

export const defaultProviderOptions = [
  { id: "aws", label: "AWS S3", description: "" },
  { id: "oss", label: "Aliyun OSS", description: "" },
  { id: "cos", label: "Tencent COS", description: "" },
  { id: "r2", label: "Cloudflare R2", description: "" },
  { id: "qiniu", label: "Qiniu Kodo", description: "" },
  { id: "minio", label: "MinIO", description: "" },
  { id: "custom", label: "Generic S3", description: "" },
];
