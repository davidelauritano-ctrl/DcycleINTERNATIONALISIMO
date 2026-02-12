"use client";

import { cn } from "@/lib/utils";

interface KpiCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon?: React.ReactNode;
  trend?: { value: number; label: string };
  className?: string;
}

export function KpiCard({
  title,
  value,
  subtitle,
  icon,
  trend,
  className,
}: KpiCardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card p-5 flex flex-col gap-2",
        className
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          {title}
        </span>
        {icon && <span className="text-muted-foreground">{icon}</span>}
      </div>
      <p className="text-2xl font-bold tracking-tight">{value}</p>
      {(subtitle || trend) && (
        <div className="flex items-center gap-2">
          {trend && (
            <span
              className={cn(
                "text-xs font-medium px-1.5 py-0.5 rounded",
                trend.value >= 0
                  ? "text-emerald-400 bg-emerald-400/10"
                  : "text-red-400 bg-red-400/10"
              )}
            >
              {trend.value >= 0 ? "+" : ""}
              {trend.value}% {trend.label}
            </span>
          )}
          {subtitle && (
            <span className="text-xs text-muted-foreground">{subtitle}</span>
          )}
        </div>
      )}
    </div>
  );
}
