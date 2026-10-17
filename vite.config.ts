import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: true,
    host: "0.0.0.0"
  },
  build: {
    target: "esnext",
    minify: !process.env.TAURI_DEBUG ? "esbuild" : false,
    sourcemap: !!process.env.TAURI_DEBUG,
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        audience: resolve(__dirname, "audience.html"),
        stage: resolve(__dirname, "stage.html"),
        stream: resolve(__dirname, "stream.html"),
        remote: resolve(__dirname, "remote.html")
      }
    }
  }
});
