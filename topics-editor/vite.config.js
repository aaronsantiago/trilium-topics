import tailwindcss from "@tailwindcss/vite";
import { sveltekit } from "@sveltejs/kit/vite";
import { existsSync } from "node:fs";
import { defineConfig, mergeConfig } from "vite";
import { SvelteKitPWA } from "@vite-pwa/sveltekit";

const config = defineConfig({
  define: {
    "process.env.NODE_ENV":
      process.env.NODE_ENV === "production" ? '"production"' : '"development"',
  },
  plugins: [
    tailwindcss(),
    sveltekit(),
    SvelteKitPWA({
      registerType: "autoUpdate",
      trailingSlash: "always",
      includeAssets: ["robots.txt"],
      devOptions: {
        enabled: true,
        /* other options */
      },
      manifest: {
        name: "topics editor",
        short_name: "topics-editor",
        description: "an editor for trilium-topics",
        theme_color: "#ffead2",
        background_color: "#ffead2",
        display: "fullscreen",
        start_url: "/",
        scope: "/",
        screenshots: [
          {
            src: "screenshot.png",
            sizes: "1280x720",
            type: "image/webp",
            form_factor: "wide",
            label: "note screenshot",
          },
          {
            src: "screenshot-tall.png",
            sizes: "720x1280",
            type: "image/webp",
            label: "note screenshot tall",
          },
        ],
        icons: [
          {
            src: "pwa-64x64.png",
            sizes: "64x64",
            type: "image/png",
          },
          {
            src: "pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "maskable-icon-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
    }),
  ],
});

// Optional personal dev-server settings (proxy, allowedHosts, ...) live in the
// gitignored vite.config.local.js; see vite.config.local.example.js. Only used
// for `vite dev`, never for builds or Playwright runs (which set PW_TEST).
const localConfig = new URL("./vite.config.local.js", import.meta.url);

export default defineConfig(async ({ command }) => {
  if (command !== "serve" || process.env.PW_TEST || !existsSync(localConfig)) return config;
  const { default: local } = await import(localConfig.href);
  return mergeConfig(config, local);
});
