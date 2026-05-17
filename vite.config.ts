import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "node:path";
import { VitePWA } from "vite-plugin-pwa";

import { sentryVitePlugin } from "@sentry/vite-plugin";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    server: {
      host: "::",
      port: 8080,
    },
    base: "./",
    build: {
      outDir: "dist",
      sourcemap: true, // Required for Sentry
      chunkSizeWarningLimit: 2000, // Increased for desktop build
      rollupOptions: {
        onwarn(warning, warn) {
          // Silence specific dynamic import warnings from Tauri APIs
          if (
            warning.code === 'DYNAMIC_IMPORT_WARN' &&
            warning.message?.includes('@tauri-apps')
          ) {
            return;
          }
          warn(warning);
        }
      }
    },
    plugins: [
      react(),
      sentryVitePlugin({
        org: env.SENTRY_ORG || "aura-oi",
        project: env.SENTRY_PROJECT || "javascript-react",
        authToken: env.SENTRY_AUTH_TOKEN,
        telemetry: false,
      }),
      // VitePWA disabled for Tauri desktop build to prevent Webview2 service worker interception crashes
    ].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
