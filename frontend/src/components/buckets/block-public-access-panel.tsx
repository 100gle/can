import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  bucketConfigStore,
  useBucketConfigStore,
  type PublicAccessBlockModel,
} from "@/state/bucketConfig";
import { useEffect, useState } from "react";

type BlockPublicAccessPanelProps = {
  provider: string;
};

const TOGGLES: Array<{
  key: keyof PublicAccessBlockModel;
  label: string;
  description: string;
}> = [
  {
    key: "blockPublicAcls",
    label: "阻止公共 ACL",
    description: "拒绝继续将 Objects/Bucket ACL 设为 public-read/public-read-write。",
  },
  {
    key: "ignorePublicAcls",
    label: "忽略公共 ACL",
    description: "即便历史上存在公共 ACL，也在评估权限时直接忽略。",
  },
  {
    key: "blockPublicPolicy",
    label: "阻止公共策略",
    description: "禁止通过 Bucket Policy 暴露匿名访问。",
  },
  {
    key: "restrictPublicBuckets",
    label: "限制公共 Bucket",
    description: "即使策略允许，也仅允许受信任的 AWS 账户访问。",
  },
];

export const BlockPublicAccessPanel = ({ provider }: BlockPublicAccessPanelProps) => {
  const block = useBucketConfigStore((state) => state.publicAccessBlock);
  const saving = useBucketConfigStore((state) => state.saving.publicAccess);
  const [draft, setDraft] = useState<PublicAccessBlockModel | undefined>(block);

  useEffect(() => {
    setDraft(block);
  }, [block]);

  if (!draft) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>阻止公共访问</CardTitle>
          <CardDescription>正在加载配置...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const handleToggle = (key: keyof PublicAccessBlockModel, value: boolean) => {
    setDraft((current) => (current ? { ...current, [key]: value } : current));
  };

  const handleSave = () => {
    void bucketConfigStore.savePublicAccessBlock(draft);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>阻止公共访问</CardTitle>
        <CardDescription>
          统一关闭公共访问入口，避免因策略/ACL 配置错误导致的数据外泄。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {TOGGLES.map((item) => (
          <div key={item.key} className="flex items-center justify-between gap-4 rounded-xl border p-4">
            <div>
              <p className="font-medium">{item.label}</p>
              <p className="text-sm text-muted-foreground">{item.description}</p>
            </div>
            <Switch
              checked={draft[item.key]}
              onCheckedChange={(value) => handleToggle(item.key, value)}
            />
          </div>
        ))}
        {provider !== "aws" && (
          <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900">
            当前供应商为 {provider.toUpperCase()}，部分开关可能由 API 模拟，实际效果以云厂商为准。
          </p>
        )}
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "保存中..." : "保存设置"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
