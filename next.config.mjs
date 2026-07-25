/** @type {import('next').NextConfig} */
const nextConfig = {
  // resvg ships a native .node binary; keep it out of the webpack bundle and
  // require it at runtime (same treatment Next gives sharp). Without this the
  // server build fails trying to parse the binary.
  experimental: {
    serverComponentsExternalPackages: ['@resvg/resvg-js'],
  },
};
export default nextConfig;
