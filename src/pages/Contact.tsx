"use client";
import { useState } from "react";
import Link from "next/link";
import { Mail, Send, CheckCircle, ArrowLeft, Phone, MapPin } from "lucide-react";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/contexts/LanguageContext";

const Contact = () => {
  const { t } = useTranslation();
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (field: string, value: string) => setForm((p) => ({ ...p, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setSuccess(true);
        setForm({ name: "", email: "", subject: "", message: "" });
      } else {
        setError(t.contact.errorMsg);
      }
    } catch {
      setError(t.contact.errorMsg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Layout>
      <div className="container max-w-4xl py-8 sm:py-10 md:py-14 min-w-0 overflow-hidden w-full">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-8 font-medium break-words-safe">
          <ArrowLeft className="h-4 w-4 flex-shrink-0" /> <span className="min-w-0">{t.contact.backHome}</span>
        </Link>

        <div className="mb-10 min-w-0">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight break-words-safe">{t.contact.pageTitle}</h1>
          <p className="text-muted-foreground mt-3 max-w-xl break-words-safe">{t.contact.pageSubtitle}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 min-w-0">
          {/* Contact info sidebar */}
          <div className="space-y-6">
            <div className="bg-card border p-5 space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Mail className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold">Email</p>
                  <p className="text-xs text-muted-foreground mt-0.5">info@fbportal.sg</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <MapPin className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold">Location</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Singapore</p>
                </div>
              </div>
            </div>
          </div>

          {/* Contact form */}
          <div className="md:col-span-2">
            {success ? (
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-8 text-center">
                <CheckCircle className="h-12 w-12 text-emerald-500 mx-auto mb-4" />
                <h2 className="text-xl font-bold text-emerald-700 mb-2">{t.contact.successTitle}</h2>
                <p className="text-sm text-emerald-600">{t.contact.successMsg}</p>
                <Button className="mt-6 rounded-xl" onClick={() => setSuccess(false)}>
                  {t.contact.backHome}
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="bg-card border p-6 space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium block mb-1.5">{t.contact.name} *</label>
                    <input
                      type="text"
                      value={form.name}
                      onChange={(e) => handleChange("name", e.target.value)}
                      className="w-full min-h-[44px] h-11 px-4 rounded-lg border bg-background text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium block mb-1.5">{t.contact.email} *</label>
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => handleChange("email", e.target.value)}
                      className="w-full min-h-[44px] h-11 px-4 rounded-lg border bg-background text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium block mb-1.5">{t.contact.subject} *</label>
                  <input
                    type="text"
                    value={form.subject}
                    onChange={(e) => handleChange("subject", e.target.value)}
                    className="w-full min-h-[44px] h-11 px-4 rounded-lg border bg-background text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-medium block mb-1.5">{t.contact.message} *</label>
                  <textarea
                    value={form.message}
                    onChange={(e) => handleChange("message", e.target.value)}
                    rows={6}
                    className="w-full min-h-[120px] p-4 rounded-lg border bg-background text-base sm:text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20"
                    required
                  />
                </div>
                {error && (
                  <p className="text-sm text-destructive bg-destructive/10 px-4 py-3 rounded-lg">{error}</p>
                )}
                <Button type="submit" className="w-full h-12 rounded-xl font-bold text-base gap-2" disabled={submitting}>
                  <Send className="h-4 w-4" />
                  {submitting ? t.contact.submitting : t.contact.submit}
                </Button>
              </form>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Contact;
