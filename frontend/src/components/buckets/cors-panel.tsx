import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { bucketConfigStore, useBucketConfigStore } from "@/state/bucketConfig";
import { Loader2, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

type EditableCORSRule = {
  allowedOrigins: string;
  allowedMethods: string;
  allowedHeaders: string;
  exposeHeaders: string;
  maxAgeSeconds: number;
};

const parseList = (value: string) =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const formatList = (items?: string[]) => (items?.length ? items.join(", ") : "");

export const CORSPanel = () => {
  const { t } = useTranslation();
  const cors = useBucketConfigStore((state) => state.cors);
  const saving = useBucketConfigStore((state) => state.saving.cors);
  const [rules, setRules] = useState<EditableCORSRule[]>([]);

  useEffect(() => {
    setRules(
      cors?.rules?.length
        ? cors.rules.map((rule) => ({
            allowedOrigins: formatList(rule.allowedOrigins),
            allowedMethods: formatList(rule.allowedMethods),
            allowedHeaders: formatList(rule.allowedHeaders),
            exposeHeaders: formatList(rule.exposeHeaders),
            maxAgeSeconds: rule.maxAgeSeconds ?? 300,
          }))
        : [],
    );
  }, [cors?.rules]);

  const updateRule = (index: number, key: keyof EditableCORSRule, value: string) => {
    setRules((current) => {
      const next = [...current];
      next[index] = {
        ...next[index],
        [key]: key === "maxAgeSeconds" ? Number(value) : value,
      };
      return next;
    });
  };

  const handleAdd = () => {
    setRules((current) => [
      ...current,
      {
        allowedOrigins: "*",
        allowedMethods: "GET, HEAD",
        allowedHeaders: "*",
        exposeHeaders: "",
        maxAgeSeconds: 300,
      },
    ]);
  };

  const handleDelete = (index: number) => {
    setRules((current) => current.filter((_, idx) => idx !== index));
  };

  const handleSave = () => {
    void bucketConfigStore.saveCORS({
      rules: rules.map((rule) => ({
        allowedOrigins: parseList(rule.allowedOrigins),
        allowedMethods: parseList(rule.allowedMethods),
        allowedHeaders: parseList(rule.allowedHeaders),
        exposeHeaders: parseList(rule.exposeHeaders),
        maxAgeSeconds: rule.maxAgeSeconds,
      })),
    });
  };

  return (
    <div className="space-y-4">
      <header>
        <h3 className="text-xl font-semibold">{t("bucket.cors.title")}</h3>
        <p className="text-sm text-muted-foreground">{t("bucket.cors.description")}</p>
      </header>
      <div className="space-y-4">
        {rules.map((rule, index) => (
          <div key={index} className="space-y-4 rounded-lg border border-border/50 p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">
                {t("bucket.cors.ruleTitle", { index: index + 1 })}
              </p>
              <Button variant="ghost" size="icon" onClick={() => handleDelete(index)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label>{t("bucket.cors.allowedOrigins")}</Label>
                <Textarea
                  rows={2}
                  value={rule.allowedOrigins}
                  onChange={(event) => updateRule(index, "allowedOrigins", event.target.value)}
                  placeholder="https://example.com, https://*.domain.com"
                />
              </div>
              <div className="space-y-2">
                <Label>{t("bucket.cors.allowedMethods")}</Label>
                <Input
                  value={rule.allowedMethods}
                  onChange={(event) => updateRule(index, "allowedMethods", event.target.value)}
                  placeholder="GET, PUT, POST"
                />
              </div>
              <div className="space-y-2">
                <Label>{t("bucket.cors.allowedHeaders")}</Label>
                <Input
                  value={rule.allowedHeaders}
                  onChange={(event) => updateRule(index, "allowedHeaders", event.target.value)}
                  placeholder="Authorization, Content-Type"
                />
              </div>
              <div className="space-y-2">
                <Label>{t("bucket.cors.exposeHeaders")}</Label>
                <Input
                  value={rule.exposeHeaders}
                  onChange={(event) => updateRule(index, "exposeHeaders", event.target.value)}
                  placeholder="ETag, x-amz-meta-*"
                />
              </div>
              <div className="space-y-2">
                <Label>{t("bucket.cors.maxAge")}</Label>
                <Input
                  type="number"
                  min={0}
                  value={rule.maxAgeSeconds}
                  onChange={(event) => updateRule(index, "maxAgeSeconds", event.target.value)}
                />
              </div>
            </div>
          </div>
        ))}
        {rules.length === 0 && (
          <p className="text-sm text-muted-foreground">{t("bucket.cors.empty")}</p>
        )}
        <Button variant="outline" onClick={handleAdd}>
          {t("bucket.cors.addRule")}
        </Button>
      </div>
      <Button onClick={handleSave} disabled={Boolean(saving)} className="gap-2">
        {saving && <Loader2 className="h-4 w-4 animate-spin" />}
        {t("bucket.cors.save")}
      </Button>
    </div>
  );
};
