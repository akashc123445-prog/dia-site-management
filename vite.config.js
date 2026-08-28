import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig({
  // The management app is served at /portal/ — the site root is the public
  // marketing site (a separate static index.html + images/fonts, copied in
  // during the build — see the "build" script in package.json).
  base: "/portal/",
  build: {
    outDir: "dist/portal",
    emptyOutDir: true,
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "apple-touch-icon.png"],
      manifest: {
        name: "Dia Site Management",
        short_name: "Dia Sites",
        description: "Project, expense, design, and site-reporting workspace for Dia Retail Solutions.",
        theme_color: "#3F1216",
        background_color: "#FBF7EE",
        display: "standalone",
        orientation: "portrait-primary",
        start_url: "/portal/",
        scope: "/portal/",
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icons/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        // Cache the app shell; data itself always comes from Supabase (network),
        // never served stale from the cache.
        globPatterns: ["**/*.{js,css,html,svg,png,ico}"],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.hostname.endsWith("supabase.co"),
            handler: "NetworkOnly",
          },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
  },
});
