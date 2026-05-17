/** @type {import('next').NextConfig} */
import path from 'path';

const nextConfig = {
  turbopack: {
    root: process.cwd(),
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
