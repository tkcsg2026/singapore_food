"use client";
import { useState, useEffect } from "react";
import { useTranslation } from "@/contexts/LanguageContext";

interface BannerConfig {
  text_en: string;
  text_ja: string;
  is_active: boolean;
  speed: number;
}

export function ScrollingBanner() {
  const { lang } = useTranslation();
  const [config, setConfig] = useState<BannerConfig | null>(null);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    fetch("/api/scrolling-banner")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setConfig(d))
      .catch(() => {});
  }, []);

  if (!config || !config.is_active) return null;

  const text = lang === "ja" ? config.text_ja : config.text_en;
  if (!text.trim()) return null;

  const separator = "\u00a0\u00a0\u00a0\u25cf\u00a0\u00a0\u00a0"; // · · ● · ·
  // Two identical copies so the -50% translate snaps back seamlessly
  const content = `${text}${separator}${text}${separator}`;

  return (
    <div
      className="w-full bg-primary overflow-hidden flex items-center sticky top-20 md:top-[4.55rem] z-40"
      style={{ height: "36px" }}
      aria-live="polite"
      aria-label="Site announcement"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div
        className="inline-flex shrink-0"
        style={{
          animation: `marquee-scroll ${config.speed}s linear infinite`,
          animationPlayState: paused ? "paused" : "running",
          willChange: "transform",
        }}
      >
        {/* Two identical copies for seamless looping: animation moves -50% */}
        <span className="text-primary-foreground text-[13px] font-medium tracking-wide whitespace-nowrap px-8 select-none">
          {content}
        </span>
        <span className="text-primary-foreground text-[13px] font-medium tracking-wide whitespace-nowrap px-8 select-none" aria-hidden>
          {content}
        </span>
      </div>
    </div>
  );
}
