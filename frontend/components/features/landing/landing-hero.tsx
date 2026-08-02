"use client";

import Link from "next/link";
import { motion } from "framer-motion";

export function LandingHero() {
  return (
    <section className="mx-auto max-w-4xl px-6 text-center">
      <motion.h1
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6 text-5xl font-extrabold text-white md:text-6xl"
      >
        Advancing Hippocampus MRI through{" "}
        <span className="text-sky-400">Residual U-Net</span>
      </motion.h1>
      <p className="mb-10 text-lg text-slate-400">
        A research-driven pipeline integrating MONAI segmentation with immersive
        WebXR visualization to support hippocampus volume review and reporting.
      </p>
      <div className="flex justify-center gap-4">
        <Link
          href="/auth/signup"
          className="rounded-lg bg-primary px-8 py-3 font-semibold text-primary-foreground shadow-[0_4px_18px_rgba(2,132,199,0.35)] transition hover:bg-sky-500"
        >
          Explore Methodology
        </Link>
      </div>
    </section>
  );
}
