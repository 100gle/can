import { cn } from "@/lib/utils";

export type CardProps = React.HTMLAttributes<HTMLDivElement>;

export const Card = ({ className, ...props }: CardProps) => (
  <div
    className={cn(
      "rounded-3xl border border-border/70 bg-card/80 p-6 text-card-foreground shadow-lg shadow-border/20",
      className,
    )}
    {...props}
  />
);
