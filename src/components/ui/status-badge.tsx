import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const statusBadgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        safe: "bg-success/10 text-success border border-success/20",
        warning: "bg-warning/10 text-warning border border-warning/20",
        risk: "bg-danger/10 text-danger border border-danger/20",
        present: "bg-success/10 text-success border border-success/20",
        absent: "bg-danger/10 text-danger border border-danger/20",
        late: "bg-warning/10 text-warning border border-warning/20",
        excused: "bg-muted text-muted-foreground border border-border",
        default: "bg-secondary text-secondary-foreground border border-border",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

interface StatusBadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof statusBadgeVariants> {
  dot?: boolean;
}

export function StatusBadge({
  className,
  variant,
  dot = true,
  children,
  ...props
}: StatusBadgeProps) {
  return (
    <span className={cn(statusBadgeVariants({ variant }), className)} {...props}>
      {dot && (
        <span
          className={cn(
            "h-1.5 w-1.5 rounded-full",
            variant === "safe" || variant === "present" ? "bg-success" : "",
            variant === "warning" || variant === "late" ? "bg-warning" : "",
            variant === "risk" || variant === "absent" ? "bg-danger" : "",
            variant === "excused" ? "bg-muted-foreground" : "",
            variant === "default" ? "bg-secondary-foreground" : ""
          )}
        />
      )}
      {children}
    </span>
  );
}
