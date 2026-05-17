import { createRoot } from "react-dom/client";
import * as Sentry from "@sentry/react";
import { trackEvent } from "@/lib/aptabase";
import App from "./App.tsx";
import "./index.css";

// Initialize Sentry only if DSN is provided
if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.MODE,
    integrations: [
      Sentry.browserTracingIntegration({
        shouldCreateSpanForRequest: (url) => {
          return !url.includes('ipc.localhost');
        },
      }),
      Sentry.replayIntegration({
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],
    tracesSampleRate: 1.0, // Adjust in production
    replaysSessionSampleRate: 0.1, 
    replaysOnErrorSampleRate: 1.0,
    beforeBreadcrumb(breadcrumb, hint) {
      if (breadcrumb.category === 'fetch' && breadcrumb.data?.url?.includes('ipc.localhost')) {
        return null;
      }
      return breadcrumb;
    },
  });
}

// Track app launch
trackEvent("app_launched");

const FallbackUI = () => (
  <div className="min-h-screen bg-aura-dark text-white flex flex-col items-center justify-center p-4">
    <div className="bg-aura-gray/30 p-8 rounded-lg border border-aura-gray/50 max-w-md text-center">
      <h1 className="text-2xl font-bold mb-4 text-red-400">Oops, something went wrong.</h1>
      <p className="text-gray-300 mb-6">
        An unexpected error occurred. This has been automatically reported to our team.
      </p>
      <button 
        onClick={() => window.location.reload()} 
        className="px-4 py-2 bg-aura-blue text-white rounded hover:bg-aura-blue/80 transition"
      >
        Reload Application
      </button>
    </div>
  </div>
);

createRoot(document.getElementById("root")!).render(
  <Sentry.ErrorBoundary fallback={<FallbackUI />}>
    <App />
  </Sentry.ErrorBoundary>
);
