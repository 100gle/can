import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { bucketsStore } from "@/state/buckets";
import { ChevronDown, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

export type CreateBucketDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId?: string;
  defaultRegion?: string;
  isOSSProvider?: boolean;
  isCOSProvider?: boolean;
  onError?: (message: string) => void;
};

export function CreateBucketDialog({
  open,
  onOpenChange,
  accountId,
  defaultRegion = "us-east-1",
  isOSSProvider = false,
  isCOSProvider = false,
  onError,
}: CreateBucketDialogProps) {
  const [newBucketName, setNewBucketName] = useState("");
  const [newBucketRegion, setNewBucketRegion] = useState(defaultRegion);
  const [bucketACL, setBucketACL] = useState("private");
  const [bucketStorageClass, setBucketStorageClass] = useState("standard");
  const [bucketCosMultiAz, setBucketCosMultiAz] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!open) {
      setAdvancedOpen(false);
      setBucketACL("private");
      setBucketStorageClass(isOSSProvider ? "standard" : "");
      setBucketCosMultiAz(false);
      setNewBucketName("");
      setNewBucketRegion(defaultRegion);
    }
  }, [open, defaultRegion, isOSSProvider]);

  const handleCreate = async () => {
    if (!accountId) {
      onError?.("请先选择账户");
      return;
    }
    if (!newBucketName.trim()) {
      onError?.("存储桶名称不能为空");
      return;
    }
    setCreating(true);
    try {
      const payload = {
        name: newBucketName.trim(),
        region: newBucketRegion.trim(),
        acl: bucketACL,
        storageClass: isOSSProvider ? bucketStorageClass : "",
        cosMultiAz: isCOSProvider ? bucketCosMultiAz : false,
      };
      await bucketsStore.createBucket(accountId, payload);
      onOpenChange(false);
    } catch (e) {
      const message = e instanceof Error ? e.message : "创建存储桶失败";
      onError?.(message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>新建存储桶 · Create Bucket</DialogTitle>
          <DialogDescription>命名遵循 S3 规则，Region/ACL 与提供商保持一致。</DialogDescription>
        </DialogHeader>
        <div className="space-y-5 py-4">
          <div className="space-y-2">
            <Label>名称 / Name</Label>
            <Input
              placeholder="my-team-bucket"
              value={newBucketName}
              onChange={(e) => setNewBucketName(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">仅限小写字母、数字、`-`，长度 3-63。</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>区域 / Region</Label>
              <Input
                placeholder="cn-hangzhou / us-east-1"
                value={newBucketRegion}
                onChange={(e) => setNewBucketRegion(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                留空将使用账户默认区域：{defaultRegion}。
              </p>
            </div>
            <div className="space-y-2">
              <Label>访问策略 / Access Control</Label>
              <Select value={bucketACL} onValueChange={setBucketACL}>
                <SelectTrigger>
                  <SelectValue placeholder="选择 ACL" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="private">私有 · Private</SelectItem>
                  <SelectItem value="public-read">公共读 · Public Read</SelectItem>
                  <SelectItem value="public-read-write">公共读写 · Public RW</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
            <div className="flex items-center justify-between rounded-md border border-dashed border-border/60 px-3 py-2">
              <div>
                <p className="text-sm font-medium">高级配置</p>
                <p className="text-xs text-muted-foreground">供应商特有的参数</p>
              </div>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-1">
                  {advancedOpen ? "收起" : "展开"}
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 transition-transform",
                      advancedOpen ? "rotate-180" : "rotate-0",
                    )}
                  />
                </Button>
              </CollapsibleTrigger>
            </div>
            <CollapsibleContent className="space-y-4 pt-4">
              {isOSSProvider && (
                <div className="space-y-2 rounded-lg border border-border/40 bg-muted/10 p-3">
                  <Label>OSS 存储类型</Label>
                  <Select value={bucketStorageClass} onValueChange={setBucketStorageClass}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="standard">标准 · Standard</SelectItem>
                      <SelectItem value="ia">低频 · IA</SelectItem>
                      <SelectItem value="archive">归档 · Archive</SelectItem>
                      <SelectItem value="cold">冷归档 · Cold</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {isCOSProvider && (
                <div className="flex items-start justify-between rounded-lg border border-border/40 bg-muted/10 p-3">
                  <div>
                    <p className="text-sm font-medium">多可用区冗余 · MAZ</p>
                    <p className="text-xs text-muted-foreground">在同一区域内复制到多个 AZ</p>
                  </div>
                  <Switch checked={bucketCosMultiAz} onCheckedChange={setBucketCosMultiAz} />
                </div>
              )}

              {!isOSSProvider && !isCOSProvider && (
                <p className="text-xs text-muted-foreground">当前供应商暂无额外创建参数。</p>
              )}
            </CollapsibleContent>
          </Collapsible>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={handleCreate} disabled={creating || !newBucketName.trim()}>
            {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            创建
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
