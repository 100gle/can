import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  bucketConfigStore,
  useBucketConfigStore,
  type BucketRefererModel,
} from "@/state/bucketConfig";
import { useEffect, useState } from "react";

type RefererProtectionPanelProps = {
  provider: string;
};

export const RefererProtectionPanel = ({ provider }: RefererProtectionPanelProps) => {
  const referer = useBucketConfigStore((state) => state.referer);
  const saving = useBucketConfigStore((state) => state.saving.referer);
  const [draft, setDraft] = useState<BucketRefererModel | undefined>(referer);

  useEffect(() => {
    setDraft(referer);
  }, [referer?.updated]);

  if (!draft) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Referer 防盗链</CardTitle>
          <CardDescription>正在加载配置...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const handleSave = () => {
    const whitelist = draft.whitelist.map((item) => item.trim()).filter(Boolean);
    void bucketConfigStore.saveReferer({ ...draft, whitelist });
  };

  const textareaValue = draft.whitelist.join("\n");

  return (
    <Card>
      <CardHeader>
        <CardTitle>Referer 防盗链</CardTitle>
        <CardDescription>仅允许白名单来源访问静态资源，降低盗链风险。</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between rounded-xl border p-4">
          <div>
            <p className="font-medium">启用 Referer 白名单</p>
            <p className="text-sm text-muted-foreground">
              关闭后将允许所有来源访问（不建议在生产环境关闭）。
            </p>
          </div>
          <Switch
            checked={draft.enabled}
            onCheckedChange={(value) => setDraft((state) => (state ? { ...state, enabled: value } : state))}
          />
        </div>
        <div className="flex items-center justify-between rounded-xl border p-4">
          <div>
            <p className="font-medium">允许空 Referer</p>
            <p className="text-sm text-muted-foreground">部分客户端不会携带 Referer，必要时可放行。</p>
          </div>
          <Switch
            checked={draft.allowEmpty}
            onCheckedChange={(value) =>
              setDraft((state) => (state ? { ...state, allowEmpty: value } : state))
            }
          />
        </div>
        <div className="space-y-2">
          <Label>白名单列表（每行一个，可使用 www.example.com 或 *.example.com）</Label>
          <Textarea
            rows={6}
            disabled={!draft.enabled}
            value={textareaValue}
            onChange={(event) =>
              setDraft((state) =>
                state
                  ? {
                      ...state,
                      whitelist: event.target.value.split("\n").map((item) => item.trim()),
                    }
                  : state,
              )
            }
            placeholder="https://www.example.com&#10;https://*.internal.example.com"
          />
        </div>
        {provider === "aws" && (
          <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900">
            AWS S3 原生不支持 Bucket Referer 白名单，本设置主要用于 OSS/COS，AWS
            将忽略此配置。
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => setDraft(referer)}
            disabled={saving || referer === draft}
          >
            重置
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "保存中..." : "保存配置"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
