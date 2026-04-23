import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { VitePWA } from "vite-plugin-pwa";
import { sentryVitePlugin } from "@sentry/vite-plugin";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  base: "./",
  build: {
    outDir: "dist",
    sourcemap: true, // Required for Sentry
  },
  plugins: [
    react(),
    sentryVitePlugin({
      org: process.env.SENTRY_ORG || "aura-oi",
      project: process.env.SENTRY_PROJECT || "javascript-react",
      authToken: process.env.SENTRY_AUTH_TOKEN,
      telemetry: false,
    }),
    // VitePWA disabled for Tauri desktop build to prevent Webview2 service worker interception crashes
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
