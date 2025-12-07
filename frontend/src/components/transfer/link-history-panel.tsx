import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useObjectsStore } from "@/state/objects";
import { DeleteAccessLinkHistory, ListAccessLinkHistory } from "@wailsjs/go/app/App";
import { objects } from "@wailsjs/go/models";
import { Clipboard, History, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

type LinkHistoryPanelProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function LinkHistoryPanel({ open, onOpenChange }: LinkHistoryPanelProps) {
  const accountId = useObjectsStore((s) => s.accountId);
  const [links, setLinks] = useState<objects.LinkHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const loadHistory = async () => {
    if (!accountId) return;
    setLoading(true);
    try {
      const result = await ListAccessLinkHistory(accountId, 100);
      // Sort by creation time desc if not already
      setLinks(
        result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
      );
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      loadHistory();
    }
  }, [open, accountId]);

  const handleDelete = async (id: string) => {
    if (!accountId) return;
    try {
      await DeleteAccessLinkHistory(accountId, id);
      setLinks((prev) => prev.filter((l) => l.id !== id));
    } catch (e) {
      console.error(e);
    }
  };

  const handleCopy = (url: string) => {
    navigator.clipboard.writeText(url);
    // toast.success("已复制到剪贴板");
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[400px] sm:w-[540px]">
        <SheetHeader>
          <SheetTitle>分享链接历史</SheetTitle>
        </SheetHeader>

        <div className="mt-6 h-[calc(100vh-100px)]">
          {loading ? (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : links.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-muted-foreground">
              <History className="h-12 w-12 text-muted-foreground/40 mb-4" />
              <p className="text-sm font-medium">暂无历史记录</p>
              <p className="text-xs text-muted-foreground/70 mt-1">生成的分享链接将在此处显示</p>
            </div>
          ) : (
            <div className="h-full overflow-y-auto pr-2 space-y-4">
              {links.map((link) => {
                const isExpired = new Date(link.expiresAt) < new Date();
                return (
                  <div key={link.id} className="rounded-lg border p-4 text-sm relative group">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="font-medium truncate max-w-[200px]" title={link.key}>
                        {link.key}
                      </span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${isExpired ? "bg-red-100 text-red-800" : "bg-green-100 text-green-800"}`}
                      >
                        {isExpired ? "已过期" : "有效"}
                      </span>
                    </div>

                    <div className="text-xs text-muted-foreground mb-2">
                      <div>Bucket: {link.bucket}</div>
                      <div>过期时间: {new Date(link.expiresAt).toLocaleString()}</div>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-muted p-2 rounded truncate text-xs font-mono select-all">
                        {link.url}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleCopy(link.url)}
                      >
                        <Clipboard className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="mt-2 flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive h-7 px-2"
                        onClick={() => handleDelete(link.id)}
                      >
                        删除记录
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
