"use client";

import type { LucideIcon } from "lucide-react";
import { Facebook, Instagram, Linkedin, Twitter, Youtube } from "lucide-react";
import { useTranslation } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

function isHttpUrl(s: string | undefined): s is string {
  if (!s?.trim()) return false;
  try {
    const u = new URL(s.trim());
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

/** When individual NEXT_PUBLIC_SOCIAL_* vars are unset, build URLs from this handle (no @). */
function defaultSocialUrls(handle: string) {
  const h = handle.replace(/^@/, "").trim();
  if (!h) return { facebook: undefined as string | undefined, instagram: undefined as string | undefined, x: undefined as string | undefined };
  return {
    facebook: `https://www.facebook.com/${encodeURIComponent(h)}`,
    instagram: `https://www.instagram.com/${encodeURIComponent(h)}/`,
    x: `https://x.com/${encodeURIComponent(h)}`,
  };
}

const iconBtn =
  "inline-flex h-10 w-10 min-h-[44px] min-w-[44px] items-center justify-center rounded-full border border-border bg-background/80 text-muted-foreground transition-colors duration-200";

/**
 * Footer: Facebook, Instagram, and X always visible.
 * URLs: NEXT_PUBLIC_SOCIAL_* env vars, or else NEXT_PUBLIC_SOCIAL_BRAND_HANDLE (default: thekitchenconnection).
 * LinkedIn / YouTube render only when configured.
 */
export function FooterSocialLinks({ className }: { className?: string }) {
  const { t } = useTranslation();

  const brandHandle =
    process.env.NEXT_PUBLIC_SOCIAL_BRAND_HANDLE?.trim() || "thekitchenconnection";
  const fromBrand = defaultSocialUrls(brandHandle);

  const facebook =
    process.env.NEXT_PUBLIC_SOCIAL_FACEBOOK?.trim() || fromBrand.facebook;
  const instagram =
    process.env.NEXT_PUBLIC_SOCIAL_INSTAGRAM?.trim() || fromBrand.instagram;
  const xUrl =
    process.env.NEXT_PUBLIC_SOCIAL_TWITTER?.trim() ||
    process.env.NEXT_PUBLIC_SOCIAL_X?.trim() ||
    fromBrand.x;

  const core: { id: string; href: string | undefined; Icon: LucideIcon; label: string }[] = [
    { id: "facebook", href: facebook, Icon: Facebook, label: "Facebook" },
    { id: "instagram", href: instagram, Icon: Instagram, label: "Instagram" },
    { id: "x", href: xUrl, Icon: Twitter, label: "X" },
  ];

  const extras: { id: string; href: string | undefined; Icon: LucideIcon; label: string }[] = [
    { id: "linkedin", href: process.env.NEXT_PUBLIC_SOCIAL_LINKEDIN, Icon: Linkedin, label: "LinkedIn" },
    { id: "youtube", href: process.env.NEXT_PUBLIC_SOCIAL_YOUTUBE, Icon: Youtube, label: "YouTube" },
  ].filter((e) => isHttpUrl(e.href));

  function SocialIcon({
    href,
    Icon,
    label,
  }: {
    href: string | undefined;
    Icon: LucideIcon;
    label: string;
  }) {
    const ok = isHttpUrl(href);
    if (ok) {
      return (
        <a
          href={href.trim()}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(iconBtn, "hover:border-primary/40 hover:bg-primary/10 hover:text-primary")}
          aria-label={label}
        >
          <Icon className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden />
        </a>
      );
    }
    return (
      <span
        className={cn(iconBtn, "cursor-default opacity-45 grayscale")}
        title={t.footer.socialAddUrlHint}
        aria-label={`${label} — ${t.footer.socialAddUrlHint}`}
      >
        <Icon className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden />
      </span>
    );
  }

  return (
    <div className={cn("mt-5", className)}>
      <p className="text-xs font-semibold uppercase tracking-wider text-primary/90 mb-2.5">{t.footer.followUs}</p>
      <ul className="flex flex-wrap gap-2 items-center" role="list">
        {core.map(({ id, href, Icon, label }) => (
          <li key={id}>
            <SocialIcon href={href} Icon={Icon} label={label} />
          </li>
        ))}
        {extras.map(({ id, href, Icon, label }) => (
          <li key={id}>
            <SocialIcon href={href} Icon={Icon} label={label} />
          </li>
        ))}
      </ul>
    </div>
  );
}
