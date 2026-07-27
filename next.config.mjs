/** @type {import('next').NextConfig} */
const nextConfig = {
  // Native/WASM packages Next must NOT try to bundle — it requires them at
  // runtime from node_modules instead. resvg ships a native .node binary;
  // heic-convert → heic-decode → libheif-js ships a multi-MB .wasm module, and
  // bundling either one breaks the server build.
  experimental: {
    serverComponentsExternalPackages: ['@resvg/resvg-js', 'heic-convert', 'heic-decode', 'libheif-js', 'sharp'],
  },
};
export default nextConfig;
