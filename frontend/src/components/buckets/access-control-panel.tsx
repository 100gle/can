import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useBucketACL, useUpdateACL } from "@/hooks/useBucketConfig";
import { showError } from "@/lib/toast";
import { useBucketConfigStore } from "@/state/bucketConfig";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

type GranteeType = "CanonicalUser" | "Group";

type EditableGrant = {
  granteeType: GranteeType;
  granteeId: string;
  granteeDisplayName?: string;
  permission: "READ" | "WRITE" | "FULL_CONTROL";
};

const ACL_CANNED: Record<string, string> = {
  private: "private",
  "public-read": "public-read",
  "public-read-write": "public-read-write",
  "authenticated-read": "authenticated-read",
};

export const AccessControlPanel = () => {
  const { t } = useTranslation();
  const accountId = useBucketConfigStore((state) => state.accountId);
  const bucket = useBucketConfigStore((state) => state.bucket);

  const { data: acl } = useBucketACL(accountId!, bucket!);
  const updateMutation = useUpdateACL();

  const [canned, setCanned] = useState("private");
  const [grants, setGrants] = useState<EditableGrant[]>([]);
  const [mode, setMode] = useState<"canned" | "custom">("canned");

  useEffect(() => {
    if (acl) {
      setCanned(acl.canned || "private");
      setGrants(
        acl.grants?.map((g: any) => ({
          granteeType: g.Grantee?.Type || "CanonicalUser",
          granteeId: g.Grantee?.ID || g.Grantee?.URI || "",
          granteeDisplayName: g.Grantee?.DisplayName,
          permission: g.Permission || "READ",
        })) || [],
      );
      // Heuristic to detect if custom mode should be active
      if (!acl.canned && acl.grants?.length > 0) {
        setMode("custom");
      }
    }
  }, [acl]);

  const handleAddGrant = () => {
    setGrants((current) => [
      ...current,
      { granteeType: "CanonicalUser", granteeId: "", permission: "READ" },
    ]);
  };

  const handleRemoveGrant = (index: number) => {
    setGrants((current) => current.filter((_, i) => i !== index));
  };

  const updateGrant = (index: number, key: keyof EditableGrant, value: string) => {
    setGrants((current) => {
      const next = [...current];
      next[index] = { ...next[index], [key]: value };
      return next;
    });
  };

  const handleSave = async () => {
    if (!accountId || !bucket) return;
    try {
      const config = {
        ownerId: acl?.ownerId || "",
        ownerDisplayName: acl?.ownerDisplayName || "",
        canned: mode === "canned" ? canned : "",
        grants:
          mode === "custom"
            ? grants.map((g) => ({
                Grantee: {
                  Type: g.granteeType,
                  ID: g.granteeType === "CanonicalUser" ? g.granteeId : undefined,
                  URI: g.granteeType === "Group" ? g.granteeId : undefined,
                  DisplayName: g.granteeDisplayName,
                },
                Permission: g.permission,
              }))
            : [],
      };
      await updateMutation.mutateAsync({ accountId, bucket, acl: config });
    } catch (e) {
      showError(e instanceof Error ? e.message : t("common.error"));
    }
  };

  return (
    <div className="space-y-6">
      <header>
        <h3 className="text-xl font-semibold">{t("bucket.acl.title")}</h3>
        <p className="text-sm text-muted-foreground">{t("bucket.acl.description")}</p>
      </header>

      <div className="space-y-4">
        <RadioGroup
          value={mode}
          onValueChange={(v) => setMode(v as "canned" | "custom")}
          className="flex gap-4"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="canned" id="mode-canned" />
            <Label htmlFor="mode-canned">{t("bucket.acl.modeCanned")}</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="custom" id="mode-custom" />
            <Label htmlFor="mode-custom">{t("bucket.acl.modeCustom")}</Label>
          </div>
        </RadioGroup>
      </div>

      {mode === "canned" ? (
        <div className="space-y-4 rounded-lg border border-border/50 p-4">
          <Label>{t("bucket.acl.cannedHash")}</Label>
          <Select value={canned} onValueChange={setCanned}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.keys(ACL_CANNED).map((key) => (
                <SelectItem key={key} value={key}>
                  {t(`bucket.acl.canned.${key}`, key)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-medium">{t("bucket.acl.grants")}</h4>
            <Button variant="outline" size="sm" onClick={handleAddGrant}>
              <Plus className="mr-2 h-4 w-4" />
              {t("bucket.acl.addGrant")}
            </Button>
          </div>

          <div className="space-y-3">
            {grants.map((grant, index) => (
              <div
                key={index}
                className="flex gap-3 items-start rounded-lg border border-border/50 p-3"
              >
                <div className="grid gap-3 flex-1 md:grid-cols-3">
                  <div className="space-y-1">
                    <Label>{t("bucket.acl.granteeType")}</Label>
                    <Select
                      value={grant.granteeType}
                      onValueChange={(v) => updateGrant(index, "granteeType", v)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="CanonicalUser">Canonical User</SelectItem>
                        <SelectItem value="Group">Group</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>{t("bucket.acl.granteeId")}</Label>
                    <Input
                      value={grant.granteeId}
                      onChange={(e) => updateGrant(index, "granteeId", e.target.value)}
                      placeholder={
                        grant.granteeType === "Group"
                          ? "http://acs.amazonaws.com/groups/..."
                          : "Canonical ID"
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>{t("bucket.acl.permission")}</Label>
                    <Select
                      value={grant.permission}
                      onValueChange={(v) => updateGrant(index, "permission", v)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="READ">READ</SelectItem>
                        <SelectItem value="WRITE">WRITE</SelectItem>
                        <SelectItem value="FULL_CONTROL">FULL_CONTROL</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="mt-6"
                  onClick={() => handleRemoveGrant(index)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
            {grants.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                {t("bucket.acl.noGrants")}
              </p>
            )}
          </div>
        </div>
      )}

      <Button onClick={handleSave} disabled={updateMutation.isPending} className="gap-2">
        {updateMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
        {t("bucket.acl.save")}
      </Button>
    </div>
  );
};
