"use client";
import { useParams } from "next/navigation";
import Link from "next/link";
import { MapPin, ArrowLeft, Award, Phone, ChevronLeft, ChevronRight, MessageCircle, Video, Play } from "lucide-react";
import { useState } from "react";
import Layout from "@/components/Layout";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { useFetch } from "@/hooks/useSupabaseData";
import { useTranslation } from "@/contexts/LanguageContext";
import { useLoginPrompt } from "@/components/LoginPromptModal";
import type { CategoryRow } from "@/types/database";
import { getPreferredPlaybackUrl, VIDEO_EXTENSIONS, getFileExtension } from "@/lib/video";

function isYouTube(url: string) {
  return url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]{11})/) ||
    url.match(/youtube\.com\/embed\/([A-Za-z0-9_-]{11})/);
}
function isVimeo(url: string) {
  return url.match(/vimeo\.com\/(\d+)/);
}
function isVideoFileUrl(url: string): boolean {
  if (!url) return false;
  const ext = getFileExtension(url);
  return VIDEO_EXTENSIONS.has(ext);
}

/**
 * Resolves the best image URL and best video playback URL for a product.
 * Handles the case where the video URL was accidentally saved into `image`
 * instead of `video_url` — in that case `imageUrl` is cleared and the video
 * URL is promoted to `playbackUrl`.
 */
function resolveProductMedia(p: any): {
  imageUrl: string;
  playbackUrl: string;
  hasVideo: boolean;
  transcodeStatus: string;
  transcodeError: string;
} {
  const rawImage = (p.image || "").trim();
  const imageIsVideo = Boolean(rawImage) && isVideoFileUrl(rawImage);

  // Prefer explicit video_url / playback_url; fall back to image field if
  // it turns out to be a video URL.
  const playbackUrl = getPreferredPlaybackUrl({
    videoUrl: (p.video_url || "").trim() || (imageIsVideo ? rawImage : ""),
    videoTranscodedUrl: (p.video_transcoded_url || "").trim(),
    videoPlaybackUrl: (p.video_playback_url || "").trim(),
  });

  return {
    imageUrl: imageIsVideo ? "" : rawImage,
    playbackUrl,
    hasVideo: Boolean(playbackUrl),
    transcodeStatus: (p.video_transcode_status || "").toString().trim().toLowerCase(),
    transcodeError: (p.video_transcode_error || "").toString().trim(),
  };
}

/**
 * Embeds a YouTube / Vimeo iframe or a native <video> for a direct video URL.
 *
 * For direct files the component uses a **click-to-play** pattern:
 *  1. Initially renders a dark poster with a large Play button — no network
 *     request is made so there is no premature error event.
 *  2. On click it swaps in the real <video> element with autoPlay.
 *  3. If the video still fails to load (bad URL, codec, server error) it
 *     falls back to a "Open in new tab" link so the user is never stranded.
 */
function ProductVideoEmbed({ url, className = "" }: { url: string; className?: string }) {
  const [playing, setPlaying] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);

  const ytMatch = isYouTube(url);
  if (ytMatch) {
    return (
      <div className={`aspect-video w-full overflow-hidden bg-black ${className}`}>
        <iframe
          src={`https://www.youtube.com/embed/${ytMatch[1]}`}
          allow="autoplay; encrypted-media"
          allowFullScreen
          className="w-full h-full"
        />
      </div>
    );
  }
  const vimeoMatch = isVimeo(url);
  if (vimeoMatch) {
    return (
      <div className={`aspect-video w-full overflow-hidden bg-black ${className}`}>
        <iframe
          src={`https://player.vimeo.com/video/${vimeoMatch[1]}`}
          allow="autoplay; fullscreen"
          allowFullScreen
          className="w-full h-full"
        />
      </div>
    );
  }

  if (loadFailed) {
    return (
      <div className={`aspect-video w-full bg-black/95 text-white/80 flex flex-col items-center justify-center gap-3 px-6 ${className}`}>
        <Play className="h-10 w-10 text-white/30" />
        <span className="text-sm text-center leading-relaxed">
          Video preview unavailable in this browser.
        </span>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs bg-white/10 hover:bg-white/20 transition-colors px-4 py-2 rounded-full text-white/90"
        >
          Open video in new tab ↗
        </a>
      </div>
    );
  }

  if (!playing) {
    return (
      <div
        className={`aspect-video w-full bg-black flex items-center justify-center cursor-pointer group ${className}`}
        onClick={() => setPlaying(true)}
        role="button"
        aria-label="Play video"
      >
        {/* Blurred first-frame hint: load only metadata, hidden behind overlay */}
        <video
          src={url}
          muted
          playsInline
          preload="metadata"
          className="absolute inset-0 w-full h-full object-cover opacity-60 pointer-events-none"
          style={{ filter: "blur(2px)" }}
        />
        <div className="relative z-10 bg-black/50 group-hover:bg-black/70 transition-colors rounded-full p-5 shadow-2xl">
          <Play className="h-10 w-10 text-white fill-white" />
        </div>
      </div>
    );
  }

  return (
    <video
      controls
      autoPlay
      playsInline
      preload="auto"
      onError={() => setLoadFailed(true)}
      className={`w-full bg-black ${className}`}
    >
      {/* No type= attribute: let the browser detect from Content-Type header */}
      <source src={url} />
    </video>
  );
}

/** Returns a preview thumbnail URL for YouTube / Vimeo links only. */
function getVideoThumbnail(url?: string): string | null {
  if (!url) return null;
  const ytMatch = isYouTube(url);
  if (ytMatch) return `https://img.youtube.com/vi/${ytMatch[1]}/hqdefault.jpg`;
  const vimeoMatch = isVimeo(url);
  if (vimeoMatch) return `https://vumbnail.com/${vimeoMatch[1]}.jpg`;
  return null;
}

/**
 * Thumbnail card for direct video URLs.
 * Always shows a dark card with play-icon overlay immediately so the card
 * never appears blank while the video preloads.  If the browser can load
 * metadata the first frame is shown behind the overlay.
 */
function VideoThumbnailCard({ url }: { url: string }) {
  return (
    <div className="aspect-[4/3] bg-gray-900 overflow-hidden relative">
      {/* Seek to first frame after metadata loads; hide on error */}
      <video
        src={url}
        muted
        playsInline
        preload="metadata"
        className="absolute inset-0 w-full h-full object-cover opacity-80"
        onLoadedMetadata={(e) => { e.currentTarget.currentTime = 0.001; }}
        onError={(e) => { (e.currentTarget as HTMLVideoElement).style.display = "none"; }}
      />
      {/* Play-icon overlay — always visible regardless of whether first frame loads */}
      <div className="absolute inset-0 flex items-center justify-center bg-black/30">
        <div className="bg-black/60 rounded-full p-2.5 shadow-lg">
          <Play className="h-6 w-6 text-white fill-white" />
        </div>
      </div>
    </div>
  );
}

function ProductCardMedia({ product, name }: { product: any; name: string }) {
  const [imageFailed, setImageFailed] = useState(false);
  const { imageUrl, playbackUrl } = resolveProductMedia(product);
  const videoThumb = getVideoThumbnail(playbackUrl);

  if (imageUrl && !imageFailed) {
    return (
      <img
        src={imageUrl}
        alt={name}
        className="w-full h-auto block"
        referrerPolicy="no-referrer"
        onError={() => setImageFailed(true)}
      />
    );
  }
  if (videoThumb) {
    return <img src={videoThumb} alt={name} className="w-full h-auto block" referrerPolicy="no-referrer" />;
  }
  if (playbackUrl) {
    return <VideoThumbnailCard url={playbackUrl} />;
  }
  return (
    <div className="aspect-[4/3] bg-muted flex items-center justify-center">
      <span className="text-muted-foreground text-xs">No image</span>
    </div>
  );
}

function ProductModalMedia({ product }: { product: any }) {
  const [imageFailed, setImageFailed] = useState(false);
  const { imageUrl, playbackUrl, transcodeStatus, transcodeError } = resolveProductMedia(product);
  const hasImage = Boolean(imageUrl) && !imageFailed;

  return (
    <>
      {imageUrl && !imageFailed && (
        <img
          src={imageUrl}
          alt={product.name}
          className="w-full h-auto block"
          referrerPolicy="no-referrer"
          onError={() => setImageFailed(true)}
        />
      )}
      {playbackUrl && (
        <ProductVideoEmbed
          url={playbackUrl}
          className={hasImage ? "border-t" : "rounded-t-2xl sm:rounded-t-2xl"}
        />
      )}
      {!playbackUrl && transcodeStatus === "processing" && (
        <div className="aspect-video w-full bg-black/95 text-white/80 flex items-center justify-center text-sm px-4 text-center rounded-t-2xl sm:rounded-t-2xl">
          Video is being processed — please refresh in a moment.
        </div>
      )}
      {!playbackUrl && transcodeStatus === "failed" && (
        <div className="aspect-video w-full bg-black/95 text-white/80 flex items-center justify-center text-sm px-4 text-center rounded-t-2xl sm:rounded-t-2xl">
          {transcodeError || "Video processing failed."}
        </div>
      )}
    </>
  );
}

const SupplierDetail = () => {
  const params = useParams();
  const slug = typeof params?.slug === "string" ? params.slug : "";
  const { data: supplier, loading } = useFetch<any>(`/api/suppliers/${slug}`, [slug]);
  const { data: tagCategories } = useFetch<(CategoryRow & { type: "tag"; label_ja?: string | null })[]>("/api/categories?type=tag");
  const [activeTab, setActiveTab] = useState("about");
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const { t, lang } = useTranslation();
  const { requireLogin, loginPromptModal, isLoggedIn } = useLoginPrompt();

  const tabs = [
    { id: "about",          label: t.supplierDetail.tabAbout },
    { id: "products",       label: t.supplierDetail.tabProducts },
    { id: "certifications", label: t.supplierDetail.tabCertifications },
    { id: "contact",        label: t.supplierDetail.tabContact },
  ];

  const displayName = lang === "ja" ? (supplier?.name_ja || supplier?.name) : (supplier?.name || supplier?.name_ja);
  const catLabels = (t.suppliers as { categories?: Record<string, string> }).categories;
  const displayCategories = [
    lang === "ja" ? (supplier?.category_ja || supplier?.category) : (catLabels?.[supplier?.category ?? ""] ?? supplier?.category ?? ""),
    lang === "ja" ? (supplier?.category_2_ja || supplier?.category_2) : (catLabels?.[supplier?.category_2 ?? ""] ?? supplier?.category_2 ?? ""),
    lang === "ja" ? (supplier?.category_3_ja || supplier?.category_3) : (catLabels?.[supplier?.category_3 ?? ""] ?? supplier?.category_3 ?? ""),
  ].filter(Boolean) as string[];
  const displayArea = lang === "ja" ? (supplier?.area_ja || supplier?.area) : (supplier?.area || supplier?.area_ja);
  const tagMap = (t.suppliers as { tagMap?: Record<string, string> }).tagMap ?? {};
  const dynamicTagMap = new Map<string, string>(
    (tagCategories || []).flatMap((cat) => {
      const labelEn = cat.label?.trim();
      const labelJa = cat.label_ja?.trim();
      if (!labelEn) return [];
      const pairs: Array<[string, string]> = [[labelEn, labelEn]];
      if (labelJa) pairs.push([labelJa, labelEn]);
      if (cat.value) pairs.push([cat.value, labelEn]);
      return pairs;
    })
  );
  const translateTag = (tag: string) => dynamicTagMap.get(tag) ?? tagMap[tag] ?? tag;
  const galleryImages = [supplier?.logo, supplier?.image_2, supplier?.image_3].filter(Boolean) as string[];
  const catalogUrl = supplier?.catalog_url?.trim();
  const contactName = supplier?.whatsapp_contact_name?.trim();
  const contactMsg = `Supply.\n\nName :\nCompany :\nMessage :`;
  const labels = lang === "ja"
    ? { origin: "原産国", weight: "重量", quantity: "入数", storage: "保存方法", temp: "温度帯", size: "サイズ（W×D×H）" }
    : { origin: "Country of Origin", weight: "Weight", quantity: "Quantity", storage: "Storage Condition", temp: "Temperature", size: "Size (W×D×H)" };

  if (loading) {
    return <Layout><div className="container py-16 text-center text-muted-foreground">{t.common.loading}</div></Layout>;
  }

  if (!supplier || supplier.error) {
    return (
      <Layout>
        <div className="container py-16 text-center">
          <p className="text-muted-foreground">{t.supplierDetail.notFound}</p>
          <Link href="/suppliers" className="text-primary hover:underline mt-4 inline-block">{t.supplierDetail.backToList}</Link>
        </div>
      </Layout>
    );
  }

  const products = supplier.products || [];
  const product = products.find((p: any) => p.id === selectedProduct);

  return (
    <Layout>
      <div className="container py-4 sm:py-6 overflow-x-hidden min-w-0 w-full">
        <Link href="/suppliers" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 font-medium">
          <ArrowLeft className="h-4 w-4" /> {t.supplierDetail.backToList}
        </Link>
        <div className="bg-card p-6 sm:p-8">
          <div className="flex flex-col lg:flex-row gap-6 items-start">
            {/* Gallery */}
            {galleryImages.length > 0 && (
              <div className="flex-shrink-0 w-full lg:w-[28rem]">
                {/* Main image */}
                <div className="relative rounded-2xl overflow-hidden" style={{ aspectRatio: "4/3" }}>
                  <img
                    src={galleryImages[activeImageIndex]}
                    alt={`${displayName} ${activeImageIndex + 1}`}
                    className="w-full h-full object-cover transition-opacity duration-300"
                    referrerPolicy="no-referrer"
                  />
                  {galleryImages.length > 1 && (
                    <>
                      <button
                        onClick={() => setActiveImageIndex((activeImageIndex - 1 + galleryImages.length) % galleryImages.length)}
                        className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-1.5 transition-colors"
                        aria-label="Previous image"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setActiveImageIndex((activeImageIndex + 1) % galleryImages.length)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-1.5 transition-colors"
                        aria-label="Next image"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
                        {galleryImages.map((_, i) => (
                          <button
                            key={i}
                            onClick={() => setActiveImageIndex(i)}
                            className={`w-1.5 h-1.5 rounded-full transition-colors ${i === activeImageIndex ? "bg-white" : "bg-white/50"}`}
                            aria-label={`Go to image ${i + 1}`}
                          />
                        ))}
                      </div>
                    </>
                  )}
                </div>
                {/* Thumbnails */}
                {galleryImages.length > 1 && (
                  <div className="flex gap-2 mt-2">
                    {galleryImages.map((src, i) => (
                      <button
                        key={i}
                        onClick={() => setActiveImageIndex(i)}
                        className={`flex-1 rounded-xl overflow-hidden border-2 transition-colors ${i === activeImageIndex ? "border-primary" : "border-transparent"}`}
                        style={{ aspectRatio: "1/1" }}
                        aria-label={`View image ${i + 1}`}
                      >
                        <img src={src} alt={`${displayName} ${i + 1}`} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            <div className="flex-1">
              <h1 className="text-2xl font-black tracking-tight">{displayName}</h1>
              <p className="text-sm text-muted-foreground mt-1">{lang === "ja" ? supplier.name : supplier.name_ja}</p>
              <div className="flex flex-wrap gap-2 mt-3">
                {displayCategories.map((cat) => (
                  <span key={cat} className="tag-badge">{cat}</span>
                ))}
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin className="h-3 w-3" /> {displayArea}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-3">
                {(supplier.tags || []).map((tag: string) => <span key={tag} className="tag-badge">{translateTag(tag)}</span>)}
              </div>
              {contactName && <p className="text-xs text-muted-foreground mt-1">{t.supplierDetail.contactLabel}{contactName}</p>}
            </div>
            <div className="hidden sm:block">
              {isLoggedIn ? (
                <WhatsAppButton phone={supplier.whatsapp} message={contactMsg} size="lg" />
              ) : (
                <button onClick={() => requireLogin()} className="group relative flex items-center justify-center gap-2 overflow-hidden rounded-xl font-semibold text-whatsapp-foreground whatsapp-gradient border-0 hover:opacity-95 transition-all duration-200 min-h-[44px] h-10 px-4 py-2">
                  <MessageCircle className="h-4 w-4 shrink-0" /><span>WhatsApp</span>
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="mt-8 border-b overflow-hidden">
          <div className="flex gap-0 overflow-x-auto scrollbar-hide touch-pan-x">
            {tabs.map((tab) => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex-shrink-0 min-h-[48px] px-4 sm:px-5 py-3.5 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${activeTab === tab.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="py-8">
          {activeTab === "about" && (
            <div className="max-w-2xl">
              <p className="text-sm leading-relaxed text-muted-foreground">
                {lang === "ja" ? (supplier.about_ja || supplier.about) : (supplier.about || supplier.about_ja)}
              </p>
            </div>
          )}
          {activeTab === "products" && (
            <div className="space-y-4">
              {catalogUrl && (
                <div className="p-3 bg-muted/50 rounded-xl border">
                  <a href={catalogUrl} target="_blank" rel="noopener noreferrer" className="text-primary font-semibold hover:underline inline-flex items-center gap-2 text-sm">
                    {t.supplierDetail.catalogLink} ↗
                  </a>
                </div>
              )}
              {products.length === 0 && (
                <p className="text-sm text-muted-foreground py-4">{lang === "ja" ? "商品が登録されていません。" : "No products registered."}</p>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-4">
                {products.map((p: any) => (
                  <div key={p.id} role="button" tabIndex={0} onClick={() => setSelectedProduct(p.id)} onKeyDown={(e) => e.key === "Enter" && setSelectedProduct(p.id)} className="bg-card border text-left active:opacity-80 w-full cursor-pointer select-none">
                    <div className="relative">
                      <ProductCardMedia product={p} name={p.name} />
                      {resolveProductMedia(p).hasVideo && (
                        <span className="absolute bottom-1.5 right-1.5 inline-flex items-center gap-1 bg-black/70 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded-full">
                          <Video className="h-2.5 w-2.5" />
                          {lang === "ja" ? "動画" : "Video"}
                        </span>
                      )}
                    </div>
                    <div className="p-2 sm:p-3">
                      <div className="text-xs sm:text-sm font-semibold leading-snug break-words">{p.name}</div>
                      {p.name_en && <div className="text-xs text-muted-foreground break-words">{p.name_en}</div>}
                      {p.temperature && <div className="text-xs text-primary font-medium mt-0.5">{p.temperature}</div>}
                      {(lang === "ja" ? p.country_of_origin : (p.country_of_origin_en || p.country_of_origin)) && (
                        <div className="text-xs text-muted-foreground">
                          {labels.origin}: {lang === "ja" ? p.country_of_origin : (p.country_of_origin_en || p.country_of_origin)}
                        </div>
                      )}
                      {p.weight && <div className="text-xs text-muted-foreground">{labels.weight}: {p.weight}</div>}
                      {p.quantity && <div className="text-xs text-muted-foreground">{labels.quantity}: {p.quantity}</div>}
                      {(p.size_w || p.size_d || p.size_h) && (
                        <div className="text-xs text-muted-foreground">
                          {labels.size}: {[p.size_w, p.size_d, p.size_h].filter(Boolean).join(" × ")}{p.size_unit ? ` ${p.size_unit}` : ""}
                        </div>
                      )}
                      {p.storage_condition && <div className="text-xs text-muted-foreground">{labels.storage}: {p.storage_condition}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {activeTab === "certifications" && (
            <div className="space-y-3 max-w-md">
              {(supplier.certifications || []).map((cert: string) => (
                <div key={cert} className="flex items-center gap-3 p-4 bg-card border">
                  <Award className="h-5 w-5 text-secondary" /><span className="text-sm font-semibold">{cert}</span>
                </div>
              ))}
            </div>
          )}
          {activeTab === "contact" && (
            <div className="max-w-md space-y-4">
              <div className="flex items-center gap-3 p-5 bg-card border">
                <Phone className="h-5 w-5 text-muted-foreground" />
                <div>
                  {contactName && <p className="text-xs text-muted-foreground">{t.supplierDetail.contactLabel}</p>}
                  {contactName && <p className="text-sm font-semibold">{contactName}</p>}
                  <p className="text-xs text-muted-foreground mt-1">WhatsApp</p>
                  <p className="text-sm font-semibold">+{supplier.whatsapp}</p>
                </div>
              </div>
              {isLoggedIn ? (
                <WhatsAppButton phone={supplier.whatsapp} message={contactMsg} fullWidth size="lg" />
              ) : (
                <button onClick={() => requireLogin()} className="group relative flex items-center justify-center gap-2 overflow-hidden rounded-xl font-semibold text-whatsapp-foreground whatsapp-gradient border-0 hover:opacity-95 transition-all duration-200 min-h-[44px] w-full h-11 px-8 text-base">
                  <MessageCircle className="h-4 w-4 shrink-0" /><span>WhatsApp</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Product detail modal — same on all devices (bottom sheet on mobile, centered on desktop) */}
        {selectedProduct && product && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center overflow-hidden p-0 sm:p-4">
            <div className="absolute inset-0 bg-foreground/40" onClick={() => setSelectedProduct(null)} />
            <div className="relative bg-background rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[90dvh] overflow-y-auto shadow-2xl">
              <ProductModalMedia product={product} />
              <div className="p-4">
                <h3 className="text-base font-bold">{product.name}</h3>
                {product.name_en && <p className="text-sm text-muted-foreground">{product.name_en}</p>}
                <div className="mt-3 space-y-2">
                  {product.temperature && (
                    <span className="inline-block bg-primary/10 text-primary text-xs font-semibold px-2 py-1 rounded-md">{product.temperature}</span>
                  )}
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-2 mt-2">
                    <div><dt className="text-xs text-muted-foreground">{labels.origin}</dt><dd className="text-sm font-medium">{lang === "ja" ? (product.country_of_origin || "—") : (product.country_of_origin_en || product.country_of_origin || "—")}</dd></div>
                    <div><dt className="text-xs text-muted-foreground">{labels.weight}</dt><dd className="text-sm font-medium">{product.weight || "—"}</dd></div>
                    <div><dt className="text-xs text-muted-foreground">{labels.quantity}</dt><dd className="text-sm font-medium">{product.quantity || "—"}</dd></div>
                    <div><dt className="text-xs text-muted-foreground">{labels.storage}</dt><dd className="text-sm font-medium">{product.storage_condition || "—"}</dd></div>
                    <div><dt className="text-xs text-muted-foreground">{labels.temp}</dt><dd className="text-sm font-medium">{product.temperature || "—"}</dd></div>
                    {(product.size_w || product.size_d || product.size_h) && (
                      <div className="col-span-2">
                        <dt className="text-xs text-muted-foreground">{labels.size}</dt>
                        <dd className="text-sm font-medium">
                          {[product.size_w, product.size_d, product.size_h].filter(Boolean).join(" × ")}{product.size_unit ? ` ${product.size_unit}` : ""}
                        </dd>
                      </div>
                    )}
                  </dl>
                </div>
                <div className="mt-4">
                  {isLoggedIn ? (
                    <WhatsAppButton phone={supplier.whatsapp} message={lang === "ja" ? `${product.name}について問い合わせです。` : `I'd like to inquire about ${product.name}.`} fullWidth size="lg" />
                  ) : (
                    <button onClick={() => requireLogin()} className="group relative flex items-center justify-center gap-2 overflow-hidden rounded-xl font-semibold text-whatsapp-foreground whatsapp-gradient border-0 hover:opacity-95 transition-all duration-200 min-h-[44px] w-full h-11 px-8 text-base">
                      <MessageCircle className="h-4 w-4 shrink-0" /><span>WhatsApp</span>
                    </button>
                  )}
                </div>
                <button onClick={() => setSelectedProduct(null)} className="mt-3 w-full py-3 text-sm text-muted-foreground border rounded-xl active:opacity-70">
                  {lang === "ja" ? "閉じる" : "Close"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/95 backdrop-blur-md border-t sm:hidden z-40">
        {isLoggedIn ? (
          <WhatsAppButton phone={supplier.whatsapp} message={contactMsg} fullWidth size="lg" />
        ) : (
          <button onClick={() => requireLogin()} className="group relative flex items-center justify-center gap-2 overflow-hidden rounded-xl font-semibold text-whatsapp-foreground whatsapp-gradient border-0 hover:opacity-95 transition-all duration-200 min-h-[44px] w-full h-11 px-8 text-base">
            <MessageCircle className="h-4 w-4 shrink-0" /><span>WhatsApp</span>
          </button>
        )}
      </div>
      {loginPromptModal}
    </Layout>
  );
};

export default SupplierDetail;
