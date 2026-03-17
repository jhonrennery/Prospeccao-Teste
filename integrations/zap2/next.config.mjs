/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath: '/zap2',
  output: 'standalone',
  serverExternalPackages: ['baileys', 'jimp'],
};

export default nextConfig;
