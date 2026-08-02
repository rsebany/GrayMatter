import type { ReactNode } from "react";

export function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description: string;
}) {
    return (
      <div className="group rounded-3xl border border-white/5 bg-white/5 p-8 transition-all hover:border-blue-500/50 hover:bg-white/10">
        <div className="mb-4 inline-flex rounded-2xl bg-white/5 p-3 ring-1 ring-white/10">
          {icon}
        </div>
        <h3 className="mb-2 text-xl font-bold text-white">{title}</h3>
        <p className="text-muted-foreground leading-relaxed">
          {description}
        </p>
      </div>
    );
  }