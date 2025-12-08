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
import {
  bucketConfigStore,
  useBucketConfigStore,
  type ACLGrantModel,
  type BucketACLModel,
} from "@/state/bucketConfig";
import { useEffect, useMemo, useState } from "react";

const CANNED_OPTIONS = [
  { label: "私有 (private)", value: "private" },
  { label: "公开读取 (public-read)", value: "public-read" },
  { label: "公开读写 (public-read-write)", value: "public-read-write" },
  { label: "认证用户可读 (authenticated-read)", value: "authenticated-read" },
];

const PERMISSION_OPTIONS = ["FULL_CONTROL", "READ", "WRITE", "READ_ACP", "WRITE_ACP"];
const GRANTEE_TYPES = [
  { label: "Canonical User", value: "CanonicalUser" },
  { label: "Group", value: "Group" },
  { label: "Email", value: "AmazonCustomerByEmail" },
];

const GROUP_URIS = [
  { label: "AllUsers (Public)", value: "http://acs.amazonaws.com/groups/global/AllUsers" },
  {
    label: "AuthenticatedUsers",
    value: "http://acs.amazonaws.com/groups/global/AuthenticatedUsers",
  },
  { label: "LogDelivery", value: "http://acs.amazonaws.com/groups/s3/LogDelivery" },
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
          <CardTitle>访问控制</CardTitle>
          <CardDescription>正在加载 ACL ...</CardDescription>
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
      window.alert?.("无法保存：缺少 Owner ID，稍后重试。");
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
      window.alert?.("请选择预设 ACL 或添加至少一个自定义授权。");
      return;
    }
    if (hasCustomGrant && cleaned.canned) {
      window.alert?.("若要使用自定义授权，请将预设 ACL 设置为“自定义（仅使用下方授权）”。");
      return;
    }
    if (!supportsCustomGrant && !cleaned.canned) {
      window.alert?.("当前供应商仅支持预设 ACL，请勿切换到自定义模式。");
      return;
    }
    void bucketConfigStore.saveBucketACL(cleaned);
  };

  return (
    <Card className="space-y-6">
      <CardHeader>
        <CardTitle>访问控制列表 (ACL)</CardTitle>
        <CardDescription>设置预设 ACL 或为特定用户/组授予权限。</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <section className="grid gap-4 md:grid-cols-2">
          <div>
            <Label className="text-xs uppercase text-muted-foreground">Owner ID</Label>
            <p className="rounded-lg border bg-muted/40 px-3 py-2 text-sm font-mono">
              {draft.ownerId || "未知"}
            </p>
          </div>
          <div>
            <Label className="text-xs uppercase text-muted-foreground">Owner 名称</Label>
            <p className="rounded-lg border bg-muted/40 px-3 py-2 text-sm">
              {draft.ownerDisplayName || "未返回"}
            </p>
          </div>
        </section>
        <section>
          <Label>预设 ACL</Label>
          <p className="text-sm text-muted-foreground mb-2">
            大多数场景下可直接使用官方预设，复杂场景再配置自定义授权。
          </p>
          <Select
            value={draft.canned || ""}
            onValueChange={(value) =>
              setDraft((state) => (state ? { ...state, canned: value } : state))
            }
          >
            <SelectTrigger className="w-full md:w-1/2">
              <SelectValue placeholder="选择预设 ACL" />
            </SelectTrigger>
            <SelectContent>
              {supportsCustomGrant ? (
                <SelectItem value="">自定义（仅使用下方授权）</SelectItem>
              ) : null}
              {CANNED_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </section>
        <section>
          <div className="flex items-center justify-between">
            <div>
              <Label>自定义授权</Label>
              <p className="text-sm text-muted-foreground">
                为 Canonical User 或常用 Group 授权，适用于 AWS/COS。
              </p>
            </div>
            <Button onClick={addGrant} variant="outline" disabled={!supportsCustomGrant}>
              新增授权
            </Button>
          </div>
          {!supportsCustomGrant && (
            <p className="mt-2 rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
              当前供应商仅支持预设 ACL。请在控制台修改更细粒度权限。
            </p>
          )}
          {supportsCustomGrant && (
            <div className="mt-4 space-y-4">
              {draft.grants.length === 0 && (
                <p className="text-sm text-muted-foreground">尚未添加任何自定义授权。</p>
              )}
              {draft.grants.map((grant, index) => (
                <div
                  key={`${grant.grantee}-${index}`}
                  className="rounded-xl border bg-card/50 p-4 shadow-sm space-y-3"
                >
                  <div className="grid gap-3 md:grid-cols-3">
                    <div>
                      <Label>授权对象类型</Label>
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
                              {item.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>{grant.granteeType === "Group" ? "Group URI" : "标识"}</Label>
                      {grant.granteeType === "Group" ? (
                        <Select
                          value={grant.grantee}
                          onValueChange={(value) =>
                            updateGrant(index, { grantee: value, uri: value })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="选择或手动输入" />
                          </SelectTrigger>
                          <SelectContent>
                            {GROUP_URIS.map((group) => (
                              <SelectItem key={group.value} value={group.value}>
                                {group.label}
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
                      <Label>权限</Label>
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
                      移除
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <div className="flex justify-end gap-2">
          <Button
            onClick={() => setDraft(acl)}
            variant="outline"
            disabled={saving || draft === acl}
          >
            重置
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "保存中..." : "保存 ACL"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
