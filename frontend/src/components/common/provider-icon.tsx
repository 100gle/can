import { cn } from "@/lib/utils";
import { Cloud } from "lucide-react";

// Import SVG icons as URLs
import alibabacloudIcon from "@/assets/icons/alibabacloud-color.svg";
import awsIcon from "@/assets/icons/aws-color.svg";
import cloudflareIcon from "@/assets/icons/cloudflare-color.svg";
import minioIcon from "@/assets/icons/minio-color.svg";
import qiniuIcon from "@/assets/icons/qiniu-color.svg";
import tencentcloudIcon from "@/assets/icons/tencentcloud-color.svg";

const PROVIDER_ICONS: Record<string, string> = {
  aws: awsIcon,
  oss: alibabacloudIcon,
  cos: tencentcloudIcon,
  r2: cloudflareIcon,
  qiniu: qiniuIcon,
  minio: minioIcon,
};

type ProviderIconProps = {
  provider: string;
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
};

const SIZE_MAP = {
  sm: "h-5 w-5",
  md: "h-6 w-6",
  lg: "h-8 w-8",
  xl: "h-10 w-10",
};

export const ProviderIcon = ({ provider, className, size = "md" }: ProviderIconProps) => {
  const iconSrc = PROVIDER_ICONS[provider];
  const sizeClass = SIZE_MAP[size];

  // Use a fixed-size container to ensure consistent alignment
  const containerClass = cn(
    "inline-flex items-center justify-center shrink-0",
    sizeClass,
    className,
  );

  if (!iconSrc) {
    // Fallback for custom/unknown providers
    return (
      <span className={containerClass}>
        <Cloud className="h-full w-full text-muted-foreground" />
      </span>
    );
  }

  return (
    <img
      src={iconSrc}
      alt={`${provider} icon`}
      className={containerClass}
      style={{ objectFit: "contain" }}
      draggable={false}
    />
  );
};
