import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ExternalLink, Lock, ShieldAlert } from "lucide-react";

type SecurityTipsProps = {
  className?: string;
  variant?: "inline" | "card";
};

/**
 * Security tips component for sharing links.
 * Displays best practices and warnings for link sharing.
 */
export function SecurityTips({ className, variant = "inline" }: SecurityTipsProps) {
  const tips = [
    {
      icon: <Lock className="h-4 w-4" />,
      title: "链接过期时间",
      description: "建议设置较短的过期时间，降低链接泄露风险。",
    },
    {
      icon: <ShieldAlert className="h-4 w-4" />,
      title: "敏感数据",
      description: "不要通过预签名链接分享包含敏感信息的文件。",
    },
    {
      icon: <ExternalLink className="h-4 w-4" />,
      title: "安全传输",
      description: "仅通过安全渠道（如加密邮件）分享链接。",
    },
  ];

  if (variant === "card") {
    return (
      <Alert className={className}>
        <ShieldAlert className="h-4 w-4" />
        <AlertTitle>安全提示</AlertTitle>
        <AlertDescription>
          <ul className="mt-2 space-y-2 text-sm">
            {tips.map((tip, index) => (
              <li key={index} className="flex items-start gap-2">
                <span className="text-muted-foreground mt-0.5">{tip.icon}</span>
                <div>
                  <span className="font-medium">{tip.title}:</span>{" "}
                  <span className="text-muted-foreground">{tip.description}</span>
                </div>
              </li>
            ))}
          </ul>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className={className}>
      <p className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
        <ShieldAlert className="h-4 w-4" />
        安全提示
      </p>
      <ul className="space-y-1.5 text-xs text-muted-foreground">
        {tips.map((tip, index) => (
          <li key={index} className="flex items-start gap-1.5">
            <span className="mt-0.5">{tip.icon}</span>
            <span>
              <span className="font-medium">{tip.title}:</span> {tip.description}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
