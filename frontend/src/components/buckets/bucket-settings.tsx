import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

export type BucketSettingsSection = {
  id: string;
  label: string;
  description?: string;
  render: () => ReactNode;
};

type BucketSettingsProps = {
  sections: BucketSettingsSection[];
  activeSection: string;
  onSectionChange: (sectionId: string) => void;
};

export const BucketSettings = ({
  sections,
  activeSection,
  onSectionChange,
}: BucketSettingsProps) => {
  const { t } = useTranslation();
  return (
    <Tabs
      value={activeSection}
      onValueChange={onSectionChange}
      className="grid gap-6 lg:grid-cols-[240px_1fr]"
    >
      <TabsList className="h-fit flex-col items-stretch rounded-xl border border-border/50 bg-card/60 p-3">
        <p className="px-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          {t("bucket.settings.nav")}
        </p>
        <div className="mt-3 flex flex-col gap-2">
          {sections.map((section) => (
            <TabsTrigger
              key={section.id}
              value={section.id}
              className="items-start justify-start rounded-lg border border-transparent bg-transparent px-3 py-2 text-left hover:border-border data-[state=active]:border-border data-[state=active]:bg-primary/10"
            >
              <div>
                <p className="text-sm font-medium">{section.label}</p>
                {section.description && (
                  <p className="text-xs text-muted-foreground">{section.description}</p>
                )}
              </div>
            </TabsTrigger>
          ))}
        </div>
      </TabsList>
      {sections.map((section) => (
        <TabsContent
          key={section.id}
          value={section.id}
          className="rounded-xl border border-border/50 bg-card/40 p-6 shadow-sm"
        >
          {section.render()}
        </TabsContent>
      ))}
    </Tabs>
  );
};
