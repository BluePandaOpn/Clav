import { defineConfig } from "vite";

const apiProxy = {
  "/api": {
    target: "http://localhost:4000",
    changeOrigin: true
  }
};

export default defineConfig({
  server: {
    port: 5173,
    proxy: apiProxy
  },
  preview: {
    port: 4173,
    proxy: apiProxy
  }
});
