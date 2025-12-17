import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useBucketWebsite, useUpdateWebsite } from "@/hooks/useBucketConfig";
import { showError } from "@/lib/toast";
import { useBucketConfigStore } from "@/state/bucketConfig";
import { AlertCircle, Globe, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

export function WebsitePanel() {
  const accountId = useBucketConfigStore((state) => state.accountId);
  const bucketId = useBucketConfigStore((state) => state.bucket);

  const { t } = useTranslation();

  const { data: website } = useBucketWebsite(accountId!, bucketId!);
  const updateMutation = useUpdateWebsite();

  const [enabled, setEnabled] = useState(false);
  const [indexKey, setIndexKey] = useState("index.html");
  const [errorKey, setErrorKey] = useState("error.html");

  useEffect(() => {
    if (website) {
      setEnabled(website.enabled);
      if (website.indexKey) setIndexKey(website.indexKey);
      if (website.errorKey) setErrorKey(website.errorKey);
    }
  }, [website]);

  const handleSave = async () => {
    if (!accountId || !bucketId) return;
    try {
      const config = {
        enabled: enabled,
        indexKey: indexKey,
        errorKey: errorKey,
      };
      await updateMutation.mutateAsync({ accountId, bucket: bucketId, config });
    } catch (err) {
      showError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="h-5 w-5" />
          {t("bucket.website.title")}
        </CardTitle>
        <CardDescription>{t("bucket.website.description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {updateMutation.isError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>{t("bucket.website.error")}</AlertTitle>
            <AlertDescription>
              {updateMutation.error instanceof Error
                ? updateMutation.error.message
                : String(updateMutation.error)}
            </AlertDescription>
          </Alert>
        )}
        <div className="flex items-center justify-between space-x-2">
          <Label htmlFor="website-mode" className="flex flex-col space-y-1">
            <span>{t("bucket.website.enable")}</span>
            <span className="font-normal text-muted-foreground">
              {t("bucket.website.enableDesc")}
            </span>
          </Label>
          <Switch id="website-mode" checked={enabled} onCheckedChange={setEnabled} />
        </div>

        {enabled && (
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="index-doc">{t("bucket.website.indexDoc")}</Label>
              <Input
                id="index-doc"
                value={indexKey}
                onChange={(e) => setIndexKey(e.target.value)}
                placeholder="index.html"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="error-doc">{t("bucket.website.errorDoc")}</Label>
              <Input
                id="error-doc"
                value={errorKey}
                onChange={(e) => setErrorKey(e.target.value)}
                placeholder="error.html"
              />
            </div>
          </div>
        )}

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={updateMutation.isPending} className="gap-2">
            {updateMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {t("bucket.website.save")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
