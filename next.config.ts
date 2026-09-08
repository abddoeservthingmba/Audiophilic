import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.audius.co' },
      { protocol: 'https', hostname: '**.audiuscdn.com' },
      { protocol: 'https', hostname: 'creativecommons.org' },
      { protocol: 'https', hostname: 'freemusicarchive.org' },
      { protocol: 'https', hostname: '**.archive.org' },
      { protocol: 'https', hostname: 'www.bensound.com' },
      { protocol: 'https', hostname: 'placehold.co' },
    ],
  },
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type' },
        ],
      },
    ]
  },
}

export default nextConfig
