/// <reference types="vite/client" />
/// <reference types="vite-plugin-svgr/client" />

declare module "*.parquet?url" {
  const src: string;
  export default src;
}
