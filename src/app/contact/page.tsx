import type { Metadata } from "next";
import Contact from "@/pages/Contact";

export const metadata: Metadata = {
  title: "Contact Us",
  description:
    "Get in touch with Singapore F&B Portal. Send us a message for enquiries about supplier listings, marketplace, advertising, or general support.",
  alternates: {
    canonical: `${process.env.NEXT_PUBLIC_SITE_URL || "https://fbportal.sg"}/contact`,
  },
  openGraph: {
    title: "Contact Singapore F&B Portal",
    description:
      "Get in touch for enquiries about supplier listings, marketplace, advertising, or general support.",
    type: "website",
    url: `${process.env.NEXT_PUBLIC_SITE_URL || "https://fbportal.sg"}/contact`,
  },
  robots: { index: true, follow: false },
};

export default Contact;
