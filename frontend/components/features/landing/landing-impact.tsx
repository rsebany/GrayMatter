"use client";

import { RESEARCH_PILLARS } from "./landing-data";

export function LandingImpact() {
  return (
    <section className="mx-auto mt-24 max-w-6xl rounded-3xl border border-white/5 bg-white/5 px-6 py-16">
      <h2 className="mb-10 text-center text-2xl font-bold text-white">
        Clinical Impact
      </h2>
      <div className="grid gap-8 md:grid-cols-3">
        {RESEARCH_PILLARS.map((pillar) => (
          <div key={pillar.title} className="p-6">
            <h3 className="text-sm font-bold uppercase tracking-wider text-sky-400">
              {pillar.title}
            </h3>
            <p className="mt-2 text-slate-300">{pillar.hint}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
