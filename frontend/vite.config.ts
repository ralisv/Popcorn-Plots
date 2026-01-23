import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react-swc";
import { defineConfig } from "vite";
import ogPlugin from "vite-plugin-open-graph";
import { VitePWA } from "vite-plugin-pwa";
import svgr from "vite-plugin-svgr";
import tsconfigPaths from "vite-tsconfig-paths";
import packageJson from "./package.json" with { type: "json" };

const { BASE_URL = "/" } = process.env;

export default defineConfig({
  base: BASE_URL,
  plugins: [
    react(),
    tsconfigPaths(),
    tailwindcss(),
    svgr({ svgrOptions: { icon: true } }),
    ogPlugin({
      basic: {
        description: packageJson.description,
        siteName: packageJson.name,
        title: "Popcorn Plots",
        type: "website",
        url: packageJson.homepage,
      },
    }),
    VitePWA({
      devOptions: { enabled: false },
      filename: "sw.ts",
      injectManifest: {
        // Disable precaching - we only use runtime caching for parquet files
        globPatterns: [],
      },
      injectRegister: "auto", // Auto-inject registration script
      manifest: false, // We don't need a full PWA manifest
      registerType: "autoUpdate",
      srcDir: "src",
      strategies: "injectManifest",
    }),
  ],
});
