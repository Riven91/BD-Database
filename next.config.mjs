/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      allowedOrigins: ["localhost:3000"],
    },
  },

  // WICHTIG: damit wir echte Client-Fehler sehen
  productionBrowserSourceMaps: true,
};

export default nextConfig;
