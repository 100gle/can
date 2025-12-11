import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useParams } from "@tanstack/react-router";
import { GetBucketWebsite, SetBucketWebsite } from "@wailsjs/go/app/App";
import { config } from "@wailsjs/go/models";
import { AlertCircle, Globe } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

export function WebsitePanel() {
  const { accountId, bucketId } = useParams({
    from: "/accounts/$accountId/buckets/$bucketId/settings",
  });
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [indexKey, setIndexKey] = useState("index.html");
  const [errorKey, setErrorKey] = useState("error.html");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!accountId || !bucketId) return;
    loadConfig();
  }, [accountId, bucketId]);

  const loadConfig = async () => {
    try {
      setLoading(true);
      const res = await GetBucketWebsite(accountId, bucketId);
      if (res) {
        setEnabled(res.enabled);
        if (res.indexKey) setIndexKey(res.indexKey);
        if (res.errorKey) setErrorKey(res.errorKey);
      }
    } catch (err) {
      console.error(err);
      // If it fails, likely no website config, keep defaults
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setError(null);
    try {
      setLoading(true);
      const cfg = new config.BucketWebsite({
        enabled: enabled,
        indexKey: indexKey,
        errorKey: errorKey,
      });
      await SetBucketWebsite(accountId, bucketId, cfg);
    } catch (err) {
      setError(t("bucket.website.errorUpdate", { error: String(err) }));
    } finally {
      setLoading(false);
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
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>{t("bucket.website.error")}</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <div className="flex items-center justify-between space-x-2">
          <Label htmlFor="website-mode" className="flex flex-col space-y-1">
            <span>{t("bucket.website.enable")}</span>
            <span className="font-normal text-muted-foreground">
              {t("bucket.website.enableDesc")}
            </span>
          </Label>
          <Switch
            id="website-mode"
            checked={enabled}
            onCheckedChange={setEnabled}
            disabled={loading}
          />
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
                disabled={loading}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="error-doc">{t("bucket.website.errorDoc")}</Label>
              <Input
                id="error-doc"
                value={errorKey}
                onChange={(e) => setErrorKey(e.target.value)}
                placeholder="error.html"
                disabled={loading}
              />
            </div>
          </div>
        )}

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={loading}>
            {t("bucket.website.save")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
