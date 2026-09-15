/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  reactStrictMode: true,
  devIndicators: false,
  // Served next to /ez-form, /ez-form-containers and /ez-workflow on the same host,
  // so it shares the host's login cookie the way the other modules do.
  basePath: '/ez-contractor',
  images: {
    unoptimized: true,
  },
  // Standalone deploys (Vercel) have nothing at the host root, so send it to the app.
  async redirects() {
    return [{ source: '/', destination: '/ez-contractor', basePath: false, permanent: false }];
  },
};

module.exports = nextConfig;
