import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  experimental: {
    optimizePackageImports: ['@heroui/react', 'lucide-react', 'react-chartjs-2'],
  },
}

export default nextConfig
