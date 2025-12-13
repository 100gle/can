import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold",
  {
    variants: {
      variant: {
        default: "border-transparent bg-secondary/70 text-secondary-foreground",
        outline: "border-border/70 text-foreground",
        success: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
        destructive: "border-red-500/30 bg-red-500/10 text-red-400",
        secondary: "border-yellow-500/30 bg-yellow-500/10 text-yellow-500",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>;

export const Badge = ({ className, variant, ...props }: BadgeProps) => (
  <span className={cn(badgeVariants({ variant }), className)} {...props} />
);
