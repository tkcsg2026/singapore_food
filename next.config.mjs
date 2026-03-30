/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
    return {
      ...config,
      watchOptions: {
        ...(config.watchOptions || {}),
        ignored: "**/{System Volume Information,$RECYCLE.BIN}/**",
      },
    };
  },
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
