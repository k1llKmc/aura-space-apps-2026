import type { NextConfig } from 'next';
import path from 'node:path';

const nextConfig: NextConfig = {
  output: process.env.NEXT_PUBLIC_DEMO_MODE === 'true' ? 'export' : 'standalone',
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || '',
  trailingSlash: process.env.NEXT_PUBLIC_DEMO_MODE === 'true',
  outputFileTracingRoot: path.join(__dirname, '../..'),
  async rewrites() {
    if (process.env.NEXT_PUBLIC_DEMO_MODE === 'true') return [];
    return [{ source: '/api/v1/:path*', destination: `${process.env.API_PROXY_TARGET || 'http://127.0.0.1:3001'}/api/v1/:path*` }];
  },
};

export default nextConfig;
