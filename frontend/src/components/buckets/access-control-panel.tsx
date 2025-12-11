import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { showError, showWarning } from "@/lib/toast";
import {
  bucketConfigStore,
  useBucketConfigStore,
  type ACLGrantModel,
  type BucketACLModel,
} from "@/state/bucketConfig";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

const CANNED_OPTIONS = [
  { label: "bucket.acl.canned.private", value: "private" },
  { label: "bucket.acl.canned.publicRead", value: "public-read" },
  { label: "bucket.acl.canned.publicReadWrite", value: "public-read-write" },
  { label: "bucket.acl.canned.authenticatedRead", value: "authenticated-read" },
];

const PERMISSION_OPTIONS = ["FULL_CONTROL", "READ", "WRITE", "READ_ACP", "WRITE_ACP"];

const GRANTEE_TYPES = [
  { label: "bucket.acl.grantee.canonicalUser", value: "CanonicalUser" },
  { label: "bucket.acl.grantee.group", value: "Group" },
  { label: "bucket.acl.grantee.email", value: "AmazonCustomerByEmail" },
];

const GROUP_URIS = [
  { label: "bucket.acl.groups.allUsers", value: "http://acs.amazonaws.com/groups/global/AllUsers" },
  {
    label: "bucket.acl.groups.authenticatedUsers",
    value: "http://acs.amazonaws.com/groups/global/AuthenticatedUsers",
  },
  {
    label: "bucket.acl.groups.logDelivery",
    value: "http://acs.amazonaws.com/groups/s3/LogDelivery",
  },
];

const createEmptyGrant = (): ACLGrantModel => ({
  granteeType: "CanonicalUser",
  grantee: "",
  permission: "READ",
});

type AccessControlPanelProps = {
  provider: string;
};

export const AccessControlPanel = ({ provider }: AccessControlPanelProps) => {
  const { t } = useTranslation();
  const acl = useBucketConfigStore((state) => state.acl);
  const saving = useBucketConfigStore((state) => state.saving.acl);
  const error = useBucketConfigStore((state) => state.error);
  const [draft, setDraft] = useState<BucketACLModel | undefined>(acl);

  useEffect(() => {
    setDraft(acl);
  }, [acl]);

  const supportsCustomGrant = useMemo(() => provider === "aws" || provider === "cos", [provider]);

  if (!draft) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t("bucket.acl.title")}</CardTitle>
          <CardDescription>{t("bucket.acl.loading")}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const updateGrant = (index: number, patch: Partial<ACLGrantModel>) => {
    setDraft((current) => {
      if (!current) return current;
      const nextGrants = current.grants.map((grant, idx) =>
        idx === index ? { ...grant, ...patch } : grant,
      );
      return { ...current, grants: nextGrants };
    });
  };

  const addGrant = () => {
    setDraft((current) => {
      if (!current) return current;
      return { ...current, grants: [...current.grants, createEmptyGrant()] };
    });
  };

  const removeGrant = (index: number) => {
    setDraft((current) => {
      if (!current) return current;
      return { ...current, grants: current.grants.filter((_, idx) => idx !== index) };
    });
  };

  const handleSave = () => {
    if (!draft.ownerId) {
      showError(t("bucket.acl.error.missingOwner"));
      return;
    }
    const cleaned: BucketACLModel = {
      ...draft,
      grants: draft.grants
        .filter((grant) => grant.grantee && grant.permission)
        .map((grant) => ({
          ...grant,
          grantee: grant.grantee.trim(),
        })),
    };
    const hasCustomGrant = cleaned.grants.length > 0;
    if (!cleaned.canned && !hasCustomGrant) {
      showWarning(t("bucket.acl.warning.customRequired"));
      return;
    }
    if (hasCustomGrant && cleaned.canned) {
      showWarning(t("bucket.acl.warning.setCustom"));
      return;
    }
    if (!supportsCustomGrant && !cleaned.canned) {
      showWarning(t("bucket.acl.warning.unsupported"));
      return;
    }
    void bucketConfigStore.saveBucketACL(cleaned);
  };

  return (
    <Card className="space-y-6">
      <CardHeader>
        <CardTitle>{t("bucket.acl.title")}</CardTitle>
        <CardDescription>{t("bucket.acl.description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <section className="grid gap-4 md:grid-cols-2">
          <div>
            <Label className="text-xs uppercase text-muted-foreground">
              {t("bucket.acl.ownerId")}
            </Label>
            <p className="rounded-lg border bg-muted/40 px-3 py-2 text-sm font-mono">
              {draft.ownerId || t("bucket.acl.ownerUnknown")}
            </p>
          </div>
          <div>
            <Label className="text-xs uppercase text-muted-foreground">
              {t("bucket.acl.ownerName")}
            </Label>
            <p className="rounded-lg border bg-muted/40 px-3 py-2 text-sm">
              {draft.ownerDisplayName || t("bucket.acl.ownerUnreturned")}
            </p>
          </div>
        </section>
        <section>
          <Label>{t("bucket.acl.canned.label")}</Label>
          <p className="text-sm text-muted-foreground mb-2">{t("bucket.acl.canned.description")}</p>
          <Select
            value={draft.canned || ""}
            onValueChange={(value) =>
              setDraft((state) => (state ? { ...state, canned: value } : state))
            }
          >
            <SelectTrigger className="w-full md:w-1/2">
              <SelectValue placeholder={t("bucket.acl.canned.placeholder")} />
            </SelectTrigger>
            <SelectContent>
              {supportsCustomGrant && (
                <SelectItem value="">{t("bucket.acl.canned.custom")}</SelectItem>
              )}
              {CANNED_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {t(option.label)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </section>
        <section>
          <div className="flex items-center justify-between">
            <div>
              <Label>{t("bucket.acl.custom.label")}</Label>
              <p className="text-sm text-muted-foreground">{t("bucket.acl.custom.description")}</p>
            </div>
            <Button onClick={addGrant} variant="outline" disabled={!supportsCustomGrant}>
              {t("bucket.acl.addGrant")}
            </Button>
          </div>
          {!supportsCustomGrant && (
            <p className="mt-2 rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
              {t("bucket.acl.custom.unsupported")}
            </p>
          )}
          {supportsCustomGrant && (
            <div className="mt-4 space-y-4">
              {draft.grants.length === 0 && (
                <p className="text-sm text-muted-foreground">{t("bucket.acl.custom.empty")}</p>
              )}
              {draft.grants.map((grant, index) => (
                <div
                  key={`${grant.grantee}-${index}`}
                  className="rounded-xl border bg-card/50 p-4 shadow-sm space-y-3"
                >
                  <div className="grid gap-3 md:grid-cols-3">
                    <div>
                      <Label>{t("bucket.acl.grantee.label")}</Label>
                      <Select
                        value={grant.granteeType}
                        onValueChange={(value) => updateGrant(index, { granteeType: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {GRANTEE_TYPES.map((item) => (
                            <SelectItem key={item.value} value={item.value}>
                              {t(item.label)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>
                        {grant.granteeType === "Group"
                          ? t("bucket.acl.grantee.groupUri")
                          : t("bucket.acl.grantee.id")}
                      </Label>
                      {grant.granteeType === "Group" ? (
                        <Select
                          value={grant.grantee}
                          onValueChange={(value) =>
                            updateGrant(index, { grantee: value, uri: value })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder={t("bucket.acl.grantee.placeholder")} />
                          </SelectTrigger>
                          <SelectContent>
                            {GROUP_URIS.map((group) => (
                              <SelectItem key={group.value} value={group.value}>
                                {t(group.label)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input
                          value={grant.grantee}
                          onChange={(event) => updateGrant(index, { grantee: event.target.value })}
                          placeholder={
                            grant.granteeType === "AmazonCustomerByEmail"
                              ? "user@example.com"
                              : "Canonical User ID"
                          }
                        />
                      )}
                    </div>
                    <div>
                      <Label>{t("bucket.acl.permission")}</Label>
                      <Select
                        value={grant.permission}
                        onValueChange={(value) => updateGrant(index, { permission: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PERMISSION_OPTIONS.map((permission) => (
                            <SelectItem key={permission} value={permission}>
                              {permission}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <Button variant="ghost" size="sm" onClick={() => removeGrant(index)}>
                      {t("bucket.acl.remove")}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button
            onClick={() => setDraft(acl)}
            variant="outline"
            disabled={saving || draft === acl}
          >
            {t("bucket.acl.reset")}
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? t("bucket.acl.saving") : t("bucket.acl.save")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
