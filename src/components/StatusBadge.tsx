import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: string;
  className?: string;
}

const statusConfig: Record<string, { label: string; variant: string; className?: string }> = {
  submitted: { label: "Submitted", variant: "default" },
  approved: { label: "Approved", variant: "default", className: "bg-cyan-500 text-white hover:bg-cyan-500" },
  rejected: { label: "Rejected", variant: "destructive" },
  pending: { label: "Pending", variant: "warning" },
  funded: { label: "Funded", variant: "success" },
  active: { label: "Active", variant: "success" },
  cancelled: { label: "Cancelled", variant: "warning" },
  completed: { label: "Completed", variant: "secondary" },
  defaulted: { label: "Defaulted", variant: "destructive" },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status as keyof typeof statusConfig] || {
    label: status,
    variant: "default",
  };

  return (
    <Badge
      variant={config.variant as any}
      className={cn("font-medium", config.className, className)}
    >
      {config.label}
    </Badge>
  );
}
