import { defineConfig } from "electron-vite";
import { resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  build: {
    outDir: resolve(__dirname, "out")
  },
  main: {
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, "src/main/index.js")
        },
        external: ["electron", "serialport"]
      }
    }
  },
  preload: {
    build: {
      ssr: true,
      rollupOptions: {
        input: {
          "main.preload": resolve(__dirname, "src/preload/main.preload.js")
        },
        external: ["electron"],
        output: {
          format: "cjs",
          entryFileNames: "[name].js"
        }
      }
    }
  },
  renderer: {
    root: resolve(__dirname, "src/renderer"),
    build: {
      rollupOptions: {
        input: {
          main: resolve(__dirname, "src/renderer/pages/main/index.html")
        }
      }
    }
  }
});
