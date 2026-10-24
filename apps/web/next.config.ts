import type { NextConfig } from 'next';
import path from 'node:path';

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // Self-contained build for the Docker image; trace from the monorepo root so workspace
  // packages are included.
  output: 'standalone',
  outputFileTracingRoot: path.join(import.meta.dirname, '../../'),
  turbopack: {
    rules: {
      '*.css': {
        loaders: ['@tailwindcss/turbopack'],
        as: '*.css',
      },
    },
  },
};

export default nextConfig;
