import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  serverExternalPackages: ["@whiskeysockets/baileys", "qrcode", "pino"],
};

export default nextConfig;
