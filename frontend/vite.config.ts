/// <reference types="vitest/config" />

import tailwindcss from "@tailwindcss/vite";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vite";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    TanStackRouterVite({
      autoCodeSplitting: true,
    }),
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@wailsjs": path.resolve(__dirname, "./wailsjs"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Monaco Editor (~600KB) - lazy load for preview modal
          monaco: ["monaco-editor", "@monaco-editor/react"],
          // Radix UI component library
          radix: [
            "@radix-ui/react-alert-dialog",
            "@radix-ui/react-checkbox",
            "@radix-ui/react-collapsible",
            "@radix-ui/react-context-menu",
            "@radix-ui/react-dialog",
            "@radix-ui/react-dropdown-menu",
            "@radix-ui/react-label",
            "@radix-ui/react-popover",
            "@radix-ui/react-progress",
            "@radix-ui/react-radio-group",
            "@radix-ui/react-select",
            "@radix-ui/react-slider",
            "@radix-ui/react-slot",
            "@radix-ui/react-switch",
            "@radix-ui/react-tabs",
            "@radix-ui/react-tooltip",
          ],
          // Router
          router: ["@tanstack/react-router"],
          // Table & Virtual scrolling
          table: ["@tanstack/react-table", "@tanstack/react-virtual"],
        },
      },
    },
  },
  test: {
    environment: "happy-dom",
    setupFiles: ["./vitest.setup.ts"],
  },
});
