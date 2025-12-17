import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";
import { type ReactNode } from "react";

interface SettingsSectionProps {
  title: string;
  description?: string;
  children: ReactNode;
}

export function SettingsSection({ title, description, children }: SettingsSectionProps) {
  return (
    <Card className="p-4">
      <CardContent className="flex flex-col items-baseline md:flex-row gap-6">
        {/* Left: Section Title and Description */}
        <div className="md:w-48 shrink-0 space-y-2 p-2">
          <CardTitle>{title}</CardTitle>
          {description && (
            <CardDescription className="text-xs leading-relaxed">{description}</CardDescription>
          )}
        </div>
        {/* Right: Settings Content */}
        <div className="flex-1 space-y-4 p-2">{children}</div>
      </CardContent>
    </Card>
  );
}
