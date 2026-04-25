import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: [
    '3000-firebase-hapjoo-1777126858431.cluster-isls3qj2gbd5qs4jkjqvhahfv6.cloudworkstations.dev',
  ],
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
