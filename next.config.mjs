/** @type {import('next').NextConfig} */
const nextConfig = {
  images: { remotePatterns: [{ protocol: "https", hostname: "images.unsplash.com" }] },
  distDir: process.env.PLAYWRIGHT_TEST ? ".next-e2e" : ".next",
};

export default nextConfig;
