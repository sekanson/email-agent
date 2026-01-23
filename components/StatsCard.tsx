import { ReactNode } from "react";

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: ReactNode;
  color?: "violet" | "green" | "amber" | "red" | "blue";
  trend?: { value: number; label: string };
}

const colorClasses = {
  violet: {
    bg: "bg-violet-500/10",
    text: "text-violet-400",
    glow: "shadow-violet-500/10",
  },
  green: {
    bg: "bg-emerald-500/10",
    text: "text-emerald-400",
    glow: "shadow-emerald-500/10",
  },
  amber: {
    bg: "bg-amber-500/10",
    text: "text-amber-400",
    glow: "shadow-amber-500/10",
  },
  red: {
    bg: "bg-red-500/10",
    text: "text-red-400",
    glow: "shadow-red-500/10",
  },
  blue: {
    bg: "bg-blue-500/10",
    text: "text-blue-400",
    glow: "shadow-blue-500/10",
  },
};

export default function StatsCard({
  title,
  value,
  icon,
  color = "violet",
  trend,
}: StatsCardProps) {
  const colors = colorClasses[color];

  return (
    <div className="glass-card group relative overflow-hidden p-5 transition-all duration-300 hover:border-[var(--border-hover)] hover:shadow-lg">
      {/* Subtle gradient overlay on hover */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[var(--accent)]/5 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

      <div className="relative flex items-start justify-between">
        <div className="space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            {title}
          </p>
          <div className="flex items-baseline gap-2">
            <p className="text-3xl font-bold tracking-tight text-[var(--text-primary)]">
              {value}
            </p>
            {trend && (
              <span
                className={`text-xs font-medium ${
                  trend.value >= 0 ? "text-emerald-400" : "text-red-400"
                }`}
              >
                {trend.value >= 0 ? "+" : ""}
                {trend.value}% {trend.label}
              </span>
            )}
          </div>
        </div>
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-xl ${colors.bg} ${colors.glow} shadow-lg`}
        >
          <div className={colors.text}>{icon}</div>
        </div>
      </div>
    </div>
  );
}
