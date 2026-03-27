"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Briefcase, CheckCircle2, ChevronDown, ChevronUp, ClipboardList, ListOrdered, MapPin, MessageCircle, RefreshCw } from "lucide-react";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTranslation } from "@/contexts/LanguageContext";
import { sanitizeWhatsAppDigits } from "@/lib/jobs-whatsapp";
import logoImage from "@/assets/logo.png";

type EmploymentKey = "fullTime" | "partTime" | "contract" | "temp" | "intern";
type RoleKey = "kitchen" | "service" | "management" | "ops" | "delivery" | "other";
type RegionKey = "central" | "east" | "west" | "north" | "northEast" | "islandwide" | "other";
type CompensationKey =
  | "negotiate"
  | "range1800_2500"
  | "range2500_4000"
  | "range4000plus"
  | "commission"
  | "undisclosed";
type ExperienceKey = "entry" | "y1_2" | "y3_5" | "y5plus";
type EligibilityKey = "scPr" | "open" | "inDesc";

interface JobNotice {
  id: string;
  title: string;
  company?: string;
  employment?: string;
  role_category?: string;
  region?: string;
  compensation?: string;
  experience?: string;
  eligibility?: string;
  description?: string;
  created_at: string;
  status: string;
}

const WA_MAX = 3800;

const HERO_IMAGE =
  "https://images.unsplash.com/photo-1556911220-bff31c812dba?w=1600&q=80";

function optLabel(record: Record<string, string>, key: string): string {
  return record[key] ?? key;
}

function JobListingCard({
  notice,
  j,
  phoneDigits,
}: {
  notice: JobNotice;
  j: ReturnType<typeof useTranslation>["t"]["jobs"];
  phoneDigits: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const desc = notice.description ?? "";
  const SHORT = 160;
  const isLong = desc.length > SHORT;

  const badges = [
    notice.employment ? optLabel(j.employmentOpts, notice.employment) : null,
    notice.region ? optLabel(j.regionOpts, notice.region) : null,
    notice.compensation ? optLabel(j.compensationOpts, notice.compensation) : null,
    notice.experience ? optLabel(j.experienceOpts, notice.experience) : null,
    notice.eligibility ? optLabel(j.eligibilityOpts, notice.eligibility) : null,
  ].filter(Boolean) as string[];

  const waText = [
    `[${j.msgHeader}]`,
    `${j.msgTitle}: ${notice.title}`,
    notice.company ? `${j.msgCompany}: ${notice.company}` : null,
    `${j.msgType}: ${optLabel(j.employmentOpts, notice.employment ?? "")}`,
    `${j.msgCategory}: ${optLabel(j.roleOpts ?? {}, notice.role_category ?? "")}`,
    `${j.msgRegion}: ${optLabel(j.regionOpts, notice.region ?? "")}`,
    `${j.msgPay}: ${optLabel(j.compensationOpts, notice.compensation ?? "")}`,
    "",
    desc,
  ]
    .filter((l) => l !== null)
    .join("\n");

  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-sm flex flex-col gap-3 transition-shadow hover:shadow-md">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-bold text-base leading-snug truncate">{notice.title}</h3>
          {notice.company && (
            <p className="text-sm text-muted-foreground mt-0.5 truncate">{notice.company}</p>
          )}
        </div>
        <span className="text-[11px] text-muted-foreground whitespace-nowrap flex-shrink-0 pt-0.5">
          {j.postedAt}: {new Date(notice.created_at).toLocaleDateString()}
        </span>
      </div>

      {badges.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {badges.map((b, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-primary/8 border border-primary/15 text-primary"
            >
              {i === 0 && <Briefcase className="h-3 w-3 opacity-70" />}
              {i === 1 && <MapPin className="h-3 w-3 opacity-70" />}
              {b}
            </span>
          ))}
        </div>
      )}

      {desc && (
        <div className="text-sm text-muted-foreground leading-relaxed">
          <p className="whitespace-pre-wrap break-words">
            {expanded || !isLong ? desc : `${desc.slice(0, SHORT)}…`}
          </p>
          {isLong && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              {expanded ? (
                <><ChevronUp className="h-3.5 w-3.5" />{j.collapseDesc}</>
              ) : (
                <><ChevronDown className="h-3.5 w-3.5" />{j.expandDesc}</>
              )}
            </button>
          )}
        </div>
      )}

      {phoneDigits.length >= 8 && (
        <div className="mt-1">
          <a
            href={`https://wa.me/${phoneDigits}?text=${encodeURIComponent(waText)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-xl bg-[#25D366]/10 border border-[#25D366]/30 text-[#1a9e4d] hover:bg-[#25D366]/20 transition-colors"
          >
            <MessageCircle className="h-3.5 w-3.5" />
            {j.applyViaWA}
          </a>
        </div>
      )}
    </div>
  );
}

export default function JobVacancies() {
  const { t } = useTranslation();
  const j = t.jobs;

  const [jobTitle, setJobTitle] = useState("");
  const [company, setCompany] = useState("");
  const [employment, setEmployment] = useState<EmploymentKey>("fullTime");
  const [roleCategory, setRoleCategory] = useState<RoleKey>("kitchen");
  const [region, setRegion] = useState<RegionKey>("islandwide");
  const [compensation, setCompensation] = useState<CompensationKey>("negotiate");
  const [experience, setExperience] = useState<ExperienceKey>("entry");
  const [eligibility, setEligibility] = useState<EligibilityKey>("open");
  const [description, setDescription] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);
  const [postSuccess, setPostSuccess] = useState(false);
  const successRef = useRef<HTMLDivElement>(null);

  const [phoneDigits, setPhoneDigits] = useState(() =>
    sanitizeWhatsAppDigits(process.env.NEXT_PUBLIC_JOBS_WHATSAPP ?? "")
  );

  const [listings, setListings] = useState<JobNotice[]>([]);
  const [listingsLoading, setListingsLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/settings?key=jobs_whatsapp")
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        const v = typeof d?.value === "string" ? d.value : "";
        const digits = sanitizeWhatsAppDigits(v);
        if (digits) setPhoneDigits(digits);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const fetchListings = useCallback(async () => {
    setListingsLoading(true);
    try {
      const res = await fetch("/api/job-notices?limit=50");
      if (res.ok) {
        const data = await res.json().catch(() => []);
        setListings(Array.isArray(data) ? data : []);
      }
    } catch {
      /* silent */
    } finally {
      setListingsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchListings();
  }, [fetchListings]);

  const lines = [
    j.msgHeader,
    `${j.msgTitle}: ${jobTitle.trim() || "—"}`,
    company.trim() ? `${j.msgCompany}: ${company.trim()}` : null,
    `${j.msgType}: ${optLabel(j.employmentOpts, employment)}`,
    `${j.msgCategory}: ${optLabel(j.roleOpts, roleCategory)}`,
    `${j.msgRegion}: ${optLabel(j.regionOpts, region)}`,
    `${j.msgPay}: ${optLabel(j.compensationOpts, compensation)}`,
    `${j.msgExp}: ${optLabel(j.experienceOpts, experience)}`,
    `${j.msgEligibility}: ${optLabel(j.eligibilityOpts, eligibility)}`,
    "",
    `${j.msgBody}:`,
    description.trim() || "—",
  ].filter(Boolean) as string[];

  const rawMessage = lines.join("\n");
  const whatsappMessage =
    rawMessage.length <= WA_MAX ? rawMessage : `${rawMessage.slice(0, WA_MAX - 20)}\n\n[…]`;

  const canSendBase = jobTitle.trim().length > 0 && description.trim().length > 0 && phoneDigits.length >= 8;
  const canSend = canSendBase && agreed && !posting;

  const consentText = useMemo(() => j.consentText ?? j.disclaimer, [j]);

  const handlePost = async () => {
    if (!canSendBase) return;
    if (!agreed) return;
    setPosting(true);
    setPostError(null);
    setPostSuccess(false);
    try {
      const res = await fetch("/api/job-notices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: jobTitle,
          company,
          employment,
          roleCategory,
          region,
          compensation,
          experience,
          eligibility,
          description,
          agreed: true,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        if (err?.code === "JOB_NOTICES_NOT_READY") {
          setPostError(j.postSetupPending);
        } else {
          setPostError(err?.error ?? j.postFailed);
        }
        return;
      }
      const encoded = encodeURIComponent(whatsappMessage);
      window.open(`https://wa.me/${phoneDigits}?text=${encoded}`, "_blank", "noopener,noreferrer");

      setJobTitle("");
      setCompany("");
      setEmployment("fullTime");
      setRoleCategory("kitchen");
      setRegion("islandwide");
      setCompensation("negotiate");
      setExperience("entry");
      setEligibility("open");
      setDescription("");
      setAgreed(false);
      setPostSuccess(true);
      fetchListings();
      setTimeout(() => {
        successRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 100);
    } catch {
      setPostError(j.postFailed);
    } finally {
      setPosting(false);
    }
  };

  const steps = [
    { n: 1, text: j.step1 },
    { n: 2, text: j.step2 },
    { n: 3, text: j.step3 },
  ];

  return (
    <Layout>
      <section className="relative overflow-hidden border-b border-border">
        <img src={HERO_IMAGE} alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/60 to-black/40" />
        <div className="relative container max-w-6xl py-10 md:py-14 text-white min-w-0">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-white/85 hover:text-white mb-6 font-medium break-words-safe"
          >
            <ArrowLeft className="h-4 w-4 flex-shrink-0" />
            <span className="min-w-0">{t.contact.backHome}</span>
          </Link>
          <div className="flex flex-wrap items-center gap-3 mb-3">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-wider backdrop-blur-sm border border-white/20">
              <ClipboardList className="h-3.5 w-3.5" />
              {j.bulletinLabel}
            </span>
          </div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight max-w-3xl drop-shadow-sm break-words-safe">
            {j.pageTitle}
          </h1>
          <p className="mt-3 text-sm md:text-base text-white/90 max-w-2xl leading-relaxed break-words-safe">
            {j.pageSubtitle}
          </p>
        </div>
      </section>

      <div className="container max-w-6xl py-10 md:py-14 min-w-0 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10">
          <aside className="lg:col-span-4 space-y-6 order-2 lg:order-1">
            <Card className="rounded-2xl border-border/80 shadow-sm overflow-hidden">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <ListOrdered className="h-5 w-5 text-primary" />
                  {j.howItWorks}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 pt-0">
                <ol className="space-y-4">
                  {steps.map(({ n, text }) => (
                    <li key={n} className="flex gap-3">
                      <span
                        className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-primary/10 text-sm font-black text-primary border border-primary/15"
                        aria-hidden
                      >
                        {n}
                      </span>
                      <p className="text-sm text-muted-foreground leading-relaxed pt-0.5">{text}</p>
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>

            <div className="rounded-2xl border border-border bg-muted/40 p-5">
              <p className="text-xs leading-relaxed text-muted-foreground border-l-4 border-primary/35 pl-3">
                {j.disclaimer}
              </p>
            </div>

            <div className="flex justify-center lg:justify-start pt-1">
              <Image
                src={logoImage}
                alt=""
                width={180}
                height={64}
                className="h-12 w-auto object-contain opacity-90"
              />
            </div>
          </aside>

          <div className="lg:col-span-8 order-1 lg:order-2 min-w-0">
            <Card className="rounded-2xl border-border shadow-sm overflow-hidden">
              <CardHeader className="border-b border-border bg-muted/30 pb-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <CardTitle className="text-xl font-black tracking-tight">{j.formCardTitle}</CardTitle>
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <MessageCircle className="h-3.5 w-3.5 text-[#25D366]" aria-hidden />
                    WhatsApp
                  </span>
                </div>
              </CardHeader>
              <CardContent className="p-5 sm:p-7 space-y-5 pt-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="job-title">{j.jobTitle}</Label>
                    <Input
                      id="job-title"
                      value={jobTitle}
                      onChange={(e) => setJobTitle(e.target.value)}
                      placeholder={j.jobTitlePh}
                      className="min-h-[44px] rounded-xl bg-background"
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="job-company">{j.company}</Label>
                    <Input
                      id="job-company"
                      value={company}
                      onChange={(e) => setCompany(e.target.value)}
                      placeholder={j.companyPh}
                      className="min-h-[44px] rounded-xl bg-background"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{j.employment}</Label>
                    <Select value={employment} onValueChange={(v) => setEmployment(v as EmploymentKey)}>
                      <SelectTrigger className="min-h-[44px] rounded-xl bg-background">
                        <SelectValue placeholder={j.selectPlaceholder} />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(j.employmentOpts) as EmploymentKey[]).map((k) => (
                          <SelectItem key={k} value={k}>
                            {j.employmentOpts[k]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>{j.roleCategory}</Label>
                    <Select value={roleCategory} onValueChange={(v) => setRoleCategory(v as RoleKey)}>
                      <SelectTrigger className="min-h-[44px] rounded-xl bg-background">
                        <SelectValue placeholder={j.selectPlaceholder} />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(j.roleOpts) as RoleKey[]).map((k) => (
                          <SelectItem key={k} value={k}>
                            {j.roleOpts[k]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{j.region}</Label>
                    <Select value={region} onValueChange={(v) => setRegion(v as RegionKey)}>
                      <SelectTrigger className="min-h-[44px] rounded-xl bg-background">
                        <SelectValue placeholder={j.selectPlaceholder} />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(j.regionOpts) as RegionKey[]).map((k) => (
                          <SelectItem key={k} value={k}>
                            {j.regionOpts[k]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>{j.compensation}</Label>
                    <Select value={compensation} onValueChange={(v) => setCompensation(v as CompensationKey)}>
                      <SelectTrigger className="min-h-[44px] rounded-xl bg-background">
                        <SelectValue placeholder={j.selectPlaceholder} />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(j.compensationOpts) as CompensationKey[]).map((k) => (
                          <SelectItem key={k} value={k}>
                            {j.compensationOpts[k]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{j.experience}</Label>
                    <Select value={experience} onValueChange={(v) => setExperience(v as ExperienceKey)}>
                      <SelectTrigger className="min-h-[44px] rounded-xl bg-background">
                        <SelectValue placeholder={j.selectPlaceholder} />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(j.experienceOpts) as ExperienceKey[]).map((k) => (
                          <SelectItem key={k} value={k}>
                            {j.experienceOpts[k]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>{j.eligibility}</Label>
                    <Select value={eligibility} onValueChange={(v) => setEligibility(v as EligibilityKey)}>
                      <SelectTrigger className="min-h-[44px] rounded-xl bg-background">
                        <SelectValue placeholder={j.selectPlaceholder} />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(j.eligibilityOpts) as EligibilityKey[]).map((k) => (
                          <SelectItem key={k} value={k}>
                            {j.eligibilityOpts[k]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="job-desc">{j.description}</Label>
                  <Textarea
                    id="job-desc"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder={j.descriptionPh}
                    rows={6}
                    className="rounded-xl bg-background resize-y min-h-[140px]"
                  />
                </div>

                <div className="rounded-xl border border-border bg-muted/25 p-4 space-y-2">
                  <p className="text-xs font-semibold text-foreground">{j.preview}</p>
                  <pre className="text-[11px] sm:text-xs whitespace-pre-wrap break-words rounded-lg bg-background border border-border p-3 max-h-44 overflow-y-auto text-muted-foreground">
                    {whatsappMessage}
                  </pre>
                  <p className="text-[11px] text-muted-foreground">{j.whatsappHelp}</p>
                </div>

                <div className="flex flex-col gap-3 pt-1">
                  {phoneDigits.length >= 8 ? (
                    <>
                      <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
                        <label className="flex items-start gap-3 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={agreed}
                            onChange={(e) => setAgreed(e.target.checked)}
                            className="mt-1 h-4 w-4 rounded border-border"
                          />
                          <span className="text-xs text-muted-foreground leading-relaxed">
                            {consentText}
                          </span>
                        </label>
                        <p className="text-[11px] text-muted-foreground">{j.consentHint}</p>
                      </div>

                      {canSendBase ? (
                        <Button
                          onClick={handlePost}
                          disabled={!canSend}
                          className="w-full rounded-xl min-h-[44px] font-bold"
                        >
                          {posting ? j.posting : j.postAndSend}
                        </Button>
                      ) : (
                        <div className="flex min-h-[44px] w-full items-center justify-center rounded-xl border border-dashed border-muted-foreground/35 bg-muted/30 px-4 text-sm text-muted-foreground text-center">
                          {j.requiredHint}
                        </div>
                      )}

                      {postError && (
                        <div className="text-sm text-destructive font-medium">
                          {postError}
                        </div>
                      )}

                      {postSuccess && (
                        <div
                          ref={successRef}
                          className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 font-medium shadow-sm"
                        >
                          <CheckCircle2 className="h-5 w-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                          <span>{j.postSuccess}</span>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="rounded-xl border border-dashed border-border bg-muted/20 p-4 text-sm text-muted-foreground space-y-3">
                      <p>{j.whatsappMissing}</p>
                      <Button variant="outline" asChild className="w-full rounded-xl">
                        <Link href="/contact">{j.contactInstead}</Link>
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* ── Job Listings ─────────────────────────────────────────────────── */}
      <section className="container max-w-6xl py-10 md:py-14 min-w-0 w-full border-t border-border">
        <div className="flex items-center justify-between gap-4 mb-6">
          <h2 className="text-xl md:text-2xl font-black tracking-tight flex items-center gap-2">
            <Briefcase className="h-5 w-5 text-primary flex-shrink-0" />
            {j.listingsTitle}
          </h2>
          <button
            onClick={fetchListings}
            disabled={listingsLoading}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${listingsLoading ? "animate-spin" : ""}`} />
            {listingsLoading ? t.common.loading : t.admin?.jobsRefresh ?? "Refresh"}
          </button>
        </div>

        {listingsLoading && listings.length === 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-border bg-card p-5 animate-pulse space-y-3">
                <div className="h-4 bg-muted rounded w-2/3" />
                <div className="h-3 bg-muted rounded w-1/3" />
                <div className="flex gap-2">
                  <div className="h-5 bg-muted rounded-full w-20" />
                  <div className="h-5 bg-muted rounded-full w-16" />
                </div>
                <div className="space-y-1.5">
                  <div className="h-2.5 bg-muted rounded w-full" />
                  <div className="h-2.5 bg-muted rounded w-4/5" />
                </div>
              </div>
            ))}
          </div>
        ) : listings.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-muted/20 py-12 text-center text-sm text-muted-foreground">
            {j.noListings}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {listings.map((notice) => (
                <JobListingCard
                  key={notice.id}
                  notice={notice}
                  j={j}
                  phoneDigits={phoneDigits}
                />
              ))}
            </div>
            <p className="mt-4 text-center text-xs text-muted-foreground">{j.listingsNote}</p>
          </>
        )}
      </section>
    </Layout>
  );
}
