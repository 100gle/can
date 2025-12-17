import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, createRouter } from "@tanstack/react-router";
import React from "react";
import { createRoot } from "react-dom/client";
import { ThemeProvider } from "./components/providers/theme-provider";
import "./i18n/config";
import { logger } from "./lib/logger";
import { queryClient } from "./lib/queryClient";
import { routeTree } from "./routeTree.gen";
import "./style.css";

const router = createRouter({
  routeTree,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

const container = document.getElementById("root");

const root = createRoot(container!);

void logger.init();

root.render(
  <React.StrictMode>
    <ThemeProvider />
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </React.StrictMode>,
);
