/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: ['localhost', '127.0.0.1', '192.168.1.239'],
  typescript: {
    ignoreBuildErrors: false,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'www.theaudiodb.com',
      },
      {
        protocol: 'https',
        hostname: 'r2.theaudiodb.com',
      },
      {
        protocol: 'https',
        hostname: 'cdn-images.dzcdn.net',
      },
      {
        protocol: 'https',
        hostname: 'cdns-images.dzcdn.net',
      },
      {
        protocol: 'https',
        hostname: 'coverartarchive.org',
      },
      {
        protocol: 'https',
        hostname: 'lastfm.freetls.fastly.net',
      },
      {
        protocol: 'https',
        hostname: 'lastfm-img2.akamaized.net',
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
    cpus: 1,
  },
  async headers() {
    const securityHeaders = [
      { key: 'X-DNS-Prefetch-Control', value: 'off' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
      ...(process.env.NODE_ENV === 'production'
        ? [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' }]
        : []),
    ];

    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
  // Performance optimizations
  compress: true,
  poweredByHeader: false,
  // Production source maps for error tracking
  productionBrowserSourceMaps: process.env.NODE_ENV === 'production',
}

export default nextConfig
