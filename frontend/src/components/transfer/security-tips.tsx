import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ExternalLink, Lock, ShieldAlert } from "lucide-react";
import { useTranslation } from "react-i18next";

type SecurityTipsProps = {
  className?: string;
  variant?: "inline" | "card";
};

/**
 * Security tips component for sharing links.
 * Displays best practices and warnings for link sharing.
 */
export function SecurityTips({ className, variant = "inline" }: SecurityTipsProps) {
  const { t } = useTranslation();
  const tips = [
    {
      icon: <Lock className="h-4 w-4" />,
      title: t("security.tip.expiry.title"),
      description: t("security.tip.expiry.desc"),
    },
    {
      icon: <ShieldAlert className="h-4 w-4" />,
      title: t("security.tip.sensitive.title"),
      description: t("security.tip.sensitive.desc"),
    },
    {
      icon: <ExternalLink className="h-4 w-4" />,
      title: t("security.tip.secure.title"),
      description: t("security.tip.secure.desc"),
    },
  ];

  if (variant === "card") {
    return (
      <Alert className={className}>
        <ShieldAlert className="h-4 w-4" />
        <AlertTitle>{t("security.title")}</AlertTitle>
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
        {t("security.title")}
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
