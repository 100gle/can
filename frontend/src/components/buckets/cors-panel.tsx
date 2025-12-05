import { useEffect, useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { bucketConfigStore, useBucketConfigStore } from "@/state/bucketConfig";

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
        <h3 className="text-xl font-semibold">CORS 规则</h3>
        <p className="text-sm text-muted-foreground">
          管控跨域请求来源、方法和头部，保障对象访问安全。
        </p>
      </header>
      <div className="space-y-4">
        {rules.map((rule, index) => (
          <div key={index} className="space-y-3 rounded-lg border border-border/50 p-4">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-sm">规则 #{index + 1}</p>
              <Button variant="ghost" size="icon" onClick={() => handleDelete(index)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="text-sm font-medium">
                允许域名
                <textarea
                  className="mt-1 w-full rounded-md border border-border/50 bg-background px-3 py-2 text-sm"
                  rows={2}
                  value={rule.allowedOrigins}
                  onChange={(event) => updateRule(index, "allowedOrigins", event.target.value)}
                  placeholder="https://example.com, https://*.domain.com"
                />
              </label>
              <label className="text-sm font-medium">
                允许方法
                <input
                  className="mt-1 w-full rounded-md border border-border/50 bg-background px-3 py-2 text-sm"
                  value={rule.allowedMethods}
                  onChange={(event) => updateRule(index, "allowedMethods", event.target.value)}
                  placeholder="GET, PUT, POST"
                />
              </label>
              <label className="text-sm font-medium">
                允许头
                <input
                  className="mt-1 w-full rounded-md border border-border/50 bg-background px-3 py-2 text-sm"
                  value={rule.allowedHeaders}
                  onChange={(event) => updateRule(index, "allowedHeaders", event.target.value)}
                  placeholder="Authorization, Content-Type"
                />
              </label>
              <label className="text-sm font-medium">
                暴露头
                <input
                  className="mt-1 w-full rounded-md border border-border/50 bg-background px-3 py-2 text-sm"
                  value={rule.exposeHeaders}
                  onChange={(event) => updateRule(index, "exposeHeaders", event.target.value)}
                  placeholder="ETag, x-amz-meta-*"
                />
              </label>
              <label className="text-sm font-medium">
                Max-Age (秒)
                <input
                  type="number"
                  className="mt-1 w-full rounded-md border border-border/50 bg-background px-3 py-2 text-sm"
                  value={rule.maxAgeSeconds}
                  onChange={(event) => updateRule(index, "maxAgeSeconds", event.target.value)}
                />
              </label>
            </div>
          </div>
        ))}
        {rules.length === 0 ? (
          <p className="text-sm text-muted-foreground">暂未配置 CORS 规则。</p>
        ) : null}
        <Button variant="outline" onClick={handleAdd}>
          添加规则
        </Button>
      </div>
      <Button onClick={handleSave} disabled={Boolean(saving)} className="gap-2">
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        保存 CORS
      </Button>
    </div>
  );
};
