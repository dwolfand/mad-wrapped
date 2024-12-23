import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  // Use different GA IDs based on mode
  console.log("mode", mode);
  const gaId = mode === "production" ? "G-6ZDDETM27H" : "G-DEVELOPMENT";

  // Only include GA script if ID is provided
  const gaScript = gaId
    ? `
    <script async src="https://www.googletagmanager.com/gtag/js?id=${gaId}"></script>
    <script>
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      gtag('config', '${gaId}');
    </script>
  `
    : "";

  return {
    plugins: [
      react(),
      {
        name: "html-transform",
        transformIndexHtml(html) {
          return html.replace("%ENV_GOOGLE_ANALYTICS%", gaScript);
        },
      },
    ],
    base: "/",
  };
});
