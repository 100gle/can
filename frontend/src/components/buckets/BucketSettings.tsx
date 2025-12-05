import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

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

export const BucketSettings = ({ sections, activeSection, onSectionChange }: BucketSettingsProps) => {
  const active = sections.find((section) => section.id === activeSection) ?? sections[0];
  return (
    <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
      <nav className="rounded-xl border border-border/50 bg-card/60 p-3">
        <p className="px-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          设置导航
        </p>
        <ul className="mt-3 space-y-1">
          {sections.map((section) => (
            <li key={section.id}>
              <button
                className={cn(
                  "w-full rounded-lg px-3 py-2 text-left text-sm transition hover:bg-primary/10",
                  section.id === activeSection ? "bg-primary/10 font-semibold" : "text-muted-foreground",
                )}
                onClick={() => onSectionChange(section.id)}
              >
                <span className="block text-sm">{section.label}</span>
                {section.description ? (
                  <span className="block text-xs text-muted-foreground">{section.description}</span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      </nav>
      <section className="rounded-xl border border-border/50 bg-card/40 p-6 shadow-sm">
        {active ? active.render() : null}
      </section>
    </div>
  );
};
