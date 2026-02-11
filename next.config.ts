import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // @ts-ignore
  server: {
    allowedDevOrigins: ["localhost:3000", "10.45.37.87:3000"],
  },
};

export default nextConfig;
