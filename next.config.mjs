/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'www.theaudiodb.com',
      },
      {
        protocol: 'https',
        hostname: 'e-cdns-images.dzcdn.net',
      },
      {
        protocol: 'https',
        hostname: 'hebbkx1anhila5yf.public.blob.vercel-storage.com',
      },
    ],
    formats: ['image/webp'],
  },
  experimental: {
    optimizePackageImports: ['@/components', '@/lib'],
  },
  // Performance optimizations
  compress: true,
  poweredByHeader: false,
  // Production source maps for error tracking
  productionBrowserSourceMaps: process.env.NODE_ENV === 'production',
}

export default nextConfig
