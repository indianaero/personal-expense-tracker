import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  experimental: {
    optimizePackageImports: ['@heroui/react', 'lucide-react'],
  },
}

export default nextConfig
