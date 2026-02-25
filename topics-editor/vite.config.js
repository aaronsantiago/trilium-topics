import tailwindcss from "@tailwindcss/vite";
import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";
import { SvelteKitPWA } from "@vite-pwa/sveltekit";

export default defineConfig({
  define: {
    'process.env.NODE_ENV': process.env.NODE_ENV === 'production'
      ? '"production"'
      : '"development"'
  },
  plugins: [
    tailwindcss(),
    sveltekit(),
    SvelteKitPWA({
      registerType: 'autoUpdate',
      trailingSlash: 'always',
      devOptions: {
        enabled: true
        /* other options */
      },
      manifest: {
        name: "topics editor",
        short_name: "topics-editor",
        description: "an editor for trilium-topics",
        theme_color: "#ffffff",
        screenshots: [
          {
            "src": "screenshot.png",
            "sizes": "1280x720",
            "type": "image/webp",
            "form_factor": "wide",
            "label": "note screenshot"
          },
          {
            "src": "screenshot-tall.png",
            "sizes": "720x1280",
            "type": "image/webp",
            "label": "note screenshot tall"
          },

        ],
        icons: [
            {
              "src": "pwa-64x64.png",
              "sizes": "64x64",
              "type": "image/png"
            },
            {
              "src": "pwa-192x192.png",
              "sizes": "192x192",
              "type": "image/png"
            },
            {
              "src": "pwa-512x512.png",
              "sizes": "512x512",
              "type": "image/png"
            },
            {
              "src": "maskable-icon-512x512.png",
              "sizes": "512x512",
              "type": "image/png",
              "purpose": "maskable"
            }
          ]
      }
    }),
  ],
});
