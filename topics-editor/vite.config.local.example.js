// Copy to vite.config.local.js (gitignored) for personal dev-server settings.
// It's merged into vite.config.js with Vite's mergeConfig, for `vite dev` only:
// not for `vite build`, and not when Playwright starts the server (PW_TEST).
export default {
  server: {
    // reach the dev server from other devices on the network
    host: true,
    allowedHosts: ["my-machine"],
    // forward /custom/* to a Trilium server, so the app's Trilium URL can be the dev server itself
    proxy: { "/custom": { target: "https://trilium.example.com", changeOrigin: true } },
  },
};
