import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  serverExternalPackages: ["@whiskeysockets/baileys", "qrcode", "pino", "nodemailer"],
};

export default nextConfig;
