import { SessionGuard } from "@/components/security/session-guard";
import { RouterProvider, createRouter } from "@tanstack/react-router";
import React from "react";
import { createRoot } from "react-dom/client";
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

root.render(
  <React.StrictMode>
    <SessionGuard>
      <RouterProvider router={router} />
    </SessionGuard>
  </React.StrictMode>,
);
