import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { bucketConfigStore, useBucketConfigStore } from "@/state/bucketConfig";
import { Loader2, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

type EditableRule = {
  id: string;
  prefix: string;
  status: "Enabled" | "Disabled";
  expirationDays: number;
  transitionDays: number;
  noncurrentDays: number;
};

const createRule = (): EditableRule => ({
  id: `rule-${Date.now()}`,
  prefix: "",
  status: "Enabled",
  expirationDays: 30,
  transitionDays: 0,
  noncurrentDays: 0,
});

export const LifecyclePanel = () => {
  const { t } = useTranslation();
  const lifecycle = useBucketConfigStore((state) => state.lifecycle);
  const saving = useBucketConfigStore((state) => state.saving.lifecycle);
  const [rules, setRules] = useState<EditableRule[]>([]);

  useEffect(() => {
    setRules(
      lifecycle?.length
        ? lifecycle.map((rule) => ({
            id: rule.id || `rule-${Date.now()}`,
            prefix: rule.prefix || "",
            status: (rule.status as "Enabled" | "Disabled") || "Enabled",
            expirationDays: rule.expirationDays || 0,
            transitionDays: rule.transitionDays || 0,
            noncurrentDays: rule.noncurrentDays || 0,
          }))
        : [],
    );
  }, [lifecycle]);

  const updateRule = (index: number, key: keyof EditableRule, value: string) => {
    setRules((current) => {
      const next = [...current];
      next[index] = {
        ...next[index],
        [key]: key.includes("Days") ? Number(value) : value,
      } as EditableRule;
      return next;
    });
  };

  const handleAdd = () => {
    setRules((current) => [...current, createRule()]);
  };

  const handleDelete = (index: number) => {
    setRules((current) => current.filter((_, idx) => idx !== index));
  };

  const handleSave = () => {
    void bucketConfigStore.saveLifecycle(rules);
  };

  return (
    <div className="space-y-4">
      <header>
        <h3 className="text-xl font-semibold">{t("bucket.lifecycle.title")}</h3>
        <p className="text-sm text-muted-foreground">{t("bucket.lifecycle.description")}</p>
      </header>
      <div className="space-y-4">
        {rules.map((rule, index) => (
          <div key={rule.id} className="space-y-4 rounded-lg border border-border/50 p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">
                {t("bucket.lifecycle.ruleTitle", { index: index + 1 })}
              </p>
              <Button variant="ghost" size="icon" onClick={() => handleDelete(index)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>{t("bucket.lifecycle.id")}</Label>
                <Input
                  value={rule.id}
                  onChange={(event) => updateRule(index, "id", event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>{t("bucket.lifecycle.prefix")}</Label>
                <Input
                  placeholder={t("bucket.lifecycle.prefixPlaceholder")}
                  value={rule.prefix}
                  onChange={(event) => updateRule(index, "prefix", event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>{t("bucket.lifecycle.expirationDays")}</Label>
                <Input
                  type="number"
                  min={0}
                  value={rule.expirationDays}
                  onChange={(event) => updateRule(index, "expirationDays", event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>{t("bucket.lifecycle.transitionDays")}</Label>
                <Input
                  type="number"
                  min={0}
                  value={rule.transitionDays}
                  onChange={(event) => updateRule(index, "transitionDays", event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>{t("bucket.lifecycle.noncurrentDays")}</Label>
                <Input
                  type="number"
                  min={0}
                  value={rule.noncurrentDays}
                  onChange={(event) => updateRule(index, "noncurrentDays", event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>{t("bucket.lifecycle.status")}</Label>
                <Select
                  value={rule.status}
                  onValueChange={(value) => updateRule(index, "status", value)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Enabled">{t("bucket.lifecycle.status.enabled")}</SelectItem>
                    <SelectItem value="Disabled">
                      {t("bucket.lifecycle.status.disabled")}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        ))}
        {rules.length === 0 && (
          <p className="text-sm text-muted-foreground">{t("bucket.lifecycle.empty")}</p>
        )}
        <Button variant="outline" onClick={handleAdd}>
          {t("bucket.lifecycle.addRule")}
        </Button>
      </div>
      <Button onClick={handleSave} disabled={Boolean(saving)} className="gap-2">
        {saving && <Loader2 className="h-4 w-4 animate-spin" />}
        {t("bucket.lifecycle.save")}
      </Button>
    </div>
  );
};
