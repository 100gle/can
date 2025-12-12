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
import { useState } from "react";
import { useTranslation } from "react-i18next";

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
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {/* Conditional rendering: content only mounts when open, auto-resets state */}
        {open && (
          <CreateBucketDialogContent
            accountId={accountId}
            defaultRegion={defaultRegion}
            isOSSProvider={isOSSProvider}
            isCOSProvider={isCOSProvider}
            onError={onError}
            onClose={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

type CreateBucketDialogContentProps = {
  accountId?: string;
  defaultRegion: string;
  isOSSProvider: boolean;
  isCOSProvider: boolean;
  onError?: (message: string) => void;
  onClose: () => void;
};

function CreateBucketDialogContent({
  accountId,
  defaultRegion,
  isOSSProvider,
  isCOSProvider,
  onError,
  onClose,
}: CreateBucketDialogContentProps) {
  const { t } = useTranslation();
  
  // Initialize state directly - no useEffect needed due to conditional rendering
  const [newBucketName, setNewBucketName] = useState("");
  const [newBucketRegion, setNewBucketRegion] = useState(defaultRegion);
  const [bucketACL, setBucketACL] = useState("private");
  const [bucketStorageClass, setBucketStorageClass] = useState(isOSSProvider ? "standard" : "");
  const [bucketCosMultiAz, setBucketCosMultiAz] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!accountId) {
      onError?.(t("bucket.create.error.noAccount"));
      return;
    }
    if (!newBucketName.trim()) {
      onError?.(t("bucket.create.error.nameRequired"));
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
      onClose();
    } catch (e) {
      const message = e instanceof Error ? e.message : t("bucket.create.error.createFailed");
      onError?.(message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t("bucket.create.title")}</DialogTitle>
        <DialogDescription>{t("bucket.create.description")}</DialogDescription>
      </DialogHeader>
      <div className="space-y-5 py-4">
        <div className="space-y-2">
          <Label>{t("bucket.create.name.label")}</Label>
          <Input
            placeholder={t("bucket.create.name.placeholder")}
            value={newBucketName}
            onChange={(e) => setNewBucketName(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">{t("bucket.create.name.helper")}</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>{t("bucket.create.region.label")}</Label>
            <Input
              placeholder={t("bucket.create.region.placeholder")}
              value={newBucketRegion}
              onChange={(e) => setNewBucketRegion(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              {t("bucket.create.region.helper", { region: defaultRegion })}
            </p>
          </div>
          <div className="space-y-2">
            <Label>{t("bucket.create.acl.label")}</Label>
            <Select value={bucketACL} onValueChange={setBucketACL}>
              <SelectTrigger>
                <SelectValue placeholder={t("bucket.create.acl.placeholder")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="private">{t("bucket.create.acl.options.private")}</SelectItem>
                <SelectItem value="public-read">
                  {t("bucket.create.acl.options.publicRead")}
                </SelectItem>
                <SelectItem value="public-read-write">
                  {t("bucket.create.acl.options.publicReadWrite")}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
          <div className="flex items-center justify-between rounded-md border border-dashed border-border/60 px-3 py-2">
            <div>
              <p className="text-sm font-medium">{t("bucket.create.advanced.title")}</p>
              <p className="text-xs text-muted-foreground">
                {t("bucket.create.advanced.description")}
              </p>
            </div>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-1">
                {advancedOpen
                  ? t("bucket.create.advanced.toggle.collapse")
                  : t("bucket.create.advanced.toggle.expand")}
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
                <Label>{t("bucket.create.oss.label")}</Label>
                <Select value={bucketStorageClass} onValueChange={setBucketStorageClass}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="standard">
                      {t("bucket.create.oss.options.standard")}
                    </SelectItem>
                    <SelectItem value="ia">{t("bucket.create.oss.options.ia")}</SelectItem>
                    <SelectItem value="archive">
                      {t("bucket.create.oss.options.archive")}
                    </SelectItem>
                    <SelectItem value="cold">{t("bucket.create.oss.options.cold")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {isCOSProvider && (
              <div className="flex items-start justify-between rounded-lg border border-border/40 bg-muted/10 p-3">
                <div>
                  <p className="text-sm font-medium">{t("bucket.create.cos.title")}</p>
                  <p className="text-xs text-muted-foreground">
                    {t("bucket.create.cos.description")}
                  </p>
                </div>
                <Switch checked={bucketCosMultiAz} onCheckedChange={setBucketCosMultiAz} />
              </div>
            )}

            {!isOSSProvider && !isCOSProvider && (
              <p className="text-xs text-muted-foreground">{t("bucket.create.advanced.none")}</p>
            )}
          </CollapsibleContent>
        </Collapsible>
      </div>
      <DialogFooter className="gap-2">
        <Button variant="outline" onClick={onClose}>
          {t("cancel")}
        </Button>
        <Button onClick={handleCreate} disabled={creating || !newBucketName.trim()}>
          {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {t("bucket.create.action.submit")}
        </Button>
      </DialogFooter>
    </>
  );
}

