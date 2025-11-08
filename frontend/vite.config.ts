import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react-swc";
import { defineConfig } from "vite";
import ogPlugin from "vite-plugin-open-graph";
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
        title: packageJson.authors.map(({ name }) => name).join(" & "),
        type: "website",
        url: packageJson.homepage,
      },
    }),
  ],
});
