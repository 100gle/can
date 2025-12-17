import { cn } from "@/lib/utils";
import { ObjectModel } from "@/state/objects";
import { BucketItem } from "./bucket-item";
import { FileItem } from "./file-item";

export type GridViewProps = {
  level: "buckets" | "objects";
  items: Array<any>;
  // Object handling
  prefix?: string;
  selectedKeys?: Set<string>;
  onToggleSelect?: (key: string) => void;
  onEnterFolder: (key: string) => void;
  onPreview: (key: string) => void;
  onDownload: (key: string) => void;
  onCopyLink: (key: string) => void;
  onDelete: (key: string) => void;
  // Bucket handling
  onEnterBucket?: (name: string) => void;
  onBucketSettings?: (name: string) => void;
  onDeleteBucket?: (name: string) => void;
  className?: string;
};

export function GridView({
  level,
  items,
  // Object props
  prefix = "",
  selectedKeys,
  onToggleSelect,
  onEnterFolder,
  onPreview,
  onDownload,
  onCopyLink,
  onDelete,
  // Bucket props
  onEnterBucket,
  onBucketSettings,
  onDeleteBucket,
  className,
}: GridViewProps) {
  return (
    <div
      className={cn("grid gap-3 p-1", "grid-cols-[repeat(auto-fill,minmax(120px,1fr))]", className)}
    >
      {level === "buckets" &&
        items.map((item) => (
          <BucketItem
            key={item.name}
            bucket={item}
            viewMode="grid"
            onEnter={onEnterBucket!}
            onSettings={onBucketSettings}
            onDelete={onDeleteBucket!}
          />
        ))}

      {level === "objects" &&
        items.map((item: ObjectModel) => (
          <FileItem
            key={item.key}
            object={item}
            prefix={prefix}
            viewMode="grid"
            selected={selectedKeys?.has(item.key)}
            onToggleSelect={onToggleSelect}
            onEnterFolder={onEnterFolder}
            onPreview={onPreview}
            onDownload={onDownload}
            onCopyLink={onCopyLink}
            onDelete={onDelete}
          />
        ))}
    </div>
  );
}
