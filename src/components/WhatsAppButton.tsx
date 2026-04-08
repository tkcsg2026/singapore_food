import { MessageCircle } from "lucide-react";

interface WhatsAppButtonProps {
  phone: string;
  message?: string;
  className?: string;
  size?: "sm" | "default" | "lg";
  fullWidth?: boolean;
  /** When set, records one analytics row + increments counter for this supplier (fire-and-forget). */
  trackSupplierId?: string;
  /** Optional fallback when supplier id is not a UUID (e.g. mock data). */
  trackSupplierSlug?: string;
}

const sizeClasses = {
  sm: "h-9 px-3 text-sm",
  default: "h-10 px-4 py-2",
  lg: "h-11 px-8 text-base",
};

export function WhatsAppButton({
  phone,
  message = "",
  className = "",
  size = "default",
  fullWidth = false,
  trackSupplierId,
  trackSupplierSlug,
}: WhatsAppButtonProps) {
  const encodedMessage = encodeURIComponent(message);
  const url = `https://wa.me/${phone}${message ? `?text=${encodedMessage}` : ""}`;

  const onClick = () => {
    if (!trackSupplierId && !trackSupplierSlug) return;
    const payload = JSON.stringify({
      supplierId: trackSupplierId,
      supplierSlug: trackSupplierSlug,
    });

    // sendBeacon survives tab/app handoff better on mobile.
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      const blob = new Blob([payload], { type: "application/json" });
      const ok = navigator.sendBeacon("/api/analytics/supplier-whatsapp-click", blob);
      if (ok) return;
    }

    void fetch("/api/analytics/supplier-whatsapp-click", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
      keepalive: true,
    }).catch(() => {});
  };

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={onClick}
      className={`group relative flex items-center justify-center gap-2 overflow-hidden rounded-xl font-semibold text-whatsapp-foreground whatsapp-gradient border-0 hover:opacity-95 hover:translate-y-0 hover:scale-100 transition-all duration-200 min-h-[44px] min-w-[44px] ${sizeClasses[size]} ${fullWidth ? "w-full" : ""} ${className}`}
      style={{ WebkitTapHighlightColor: "transparent" }}
    >
      {/* White barrier sweep: left → right on hover */}
      <span
        className="absolute inset-0 z-10 pointer-events-none bg-white/25 rounded-xl -translate-x-full group-hover:translate-x-full transition-transform duration-400 ease-out"
        aria-hidden
      />
      <MessageCircle className="relative z-0 h-4 w-4 shrink-0" />
      <span className="relative z-0">WhatsApp</span>
    </a>
  );
}
