import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { bucketConfigStore, useBucketConfigStore } from "@/state/bucketConfig";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

export const PolicyPanel = () => {
  const { t } = useTranslation();
  const policy = useBucketConfigStore((state) => state.policy);
  const saving = useBucketConfigStore((state) => state.saving.policy);
  const storeError = useBucketConfigStore((state) => state.error);

  // Local state for the text editor
  const [json, setJson] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (policy?.raw) {
      setJson(policy.raw);
    } else if (policy?.statement) {
      setJson(JSON.stringify({ Version: policy.version, Statement: policy.statement }, null, 2));
    } else {
      setJson("");
    }
  }, [policy]);

  const handleSave = async () => {
    setLocalError(null);
    try {
      await bucketConfigStore.setPolicy(json);
    } catch (err) {
      console.error(err);
      setLocalError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleClear = async () => {
    setLocalError(null);
    try {
      await bucketConfigStore.deletePolicy();
      setJson("");
    } catch (err) {
      console.error(err);
      setLocalError(err instanceof Error ? err.message : String(err));
    }
    setShowDeleteConfirm(false);
  };

  const displayError = localError || storeError;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">{t("bucket.policy.title")}</h3>
          <p className="text-sm text-muted-foreground">{t("bucket.policy.description")}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowDeleteConfirm(true)} disabled={!!saving}>
            {t("bucket.policy.clear")}
          </Button>
          <Button onClick={handleSave} disabled={!!saving} className="gap-2">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {t("bucket.policy.save")}
          </Button>
        </div>
      </div>

      {displayError && (
        <div className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">
          {displayError}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="policy-editor">{t("bucket.policy.editorLabel")}</Label>
        <Textarea
          id="policy-editor"
          value={json}
          onChange={(e) => setJson(e.target.value)}
          className="font-mono text-sm min-h-[300px]"
          placeholder='{"Version": "2012-10-17", "Statement": []}'
        />
        <p className="text-xs text-muted-foreground">{t("bucket.policy.hint")}</p>
      </div>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("bucket.policy.deleteConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("bucket.policy.deleteConfirmDesc")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("actions.cancel", "取消")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleClear}>
              {t("common.delete", "删除")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
