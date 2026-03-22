/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.supabase.co", pathname: "/storage/v1/object/public/**" },
    ],
  },
  async headers() {
    const revalidate = [
      { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
    ];
    return [
      { source: "/favicon.ico", headers: revalidate },
      { source: "/icon", headers: revalidate },
      { source: "/icon.png", headers: revalidate },
      { source: "/apple-icon", headers: revalidate },
      { source: "/apple-icon.png", headers: revalidate },
    ];
  },
};

export default nextConfig;
