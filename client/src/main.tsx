import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import * as Sentry from "@sentry/react";
import "./index.css";
import App from "./App.tsx";

Sentry.init({
  dsn: "https://c057651951782bc03e732a8785083795@o4508526308622336.ingest.us.sentry.io/4508526358495232",
  environment: import.meta.env.MODE, // Will be 'development' locally and 'production' in prod build
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration(),
  ],
  // Tracing
  tracesSampleRate: 1.0, //  Capture 100% of the transactions
  // Set 'tracePropagationTargets' to control for which URLs distributed tracing should be enabled
  tracePropagationTargets: [
    "localhost",
    /^https:\/\/api-broken-bird-1053\.fly\.dev/,
  ],
  replaysSessionSampleRate: import.meta.env.DEV ? 1.0 : 1.0,
  replaysOnErrorSampleRate: 1.0,
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
