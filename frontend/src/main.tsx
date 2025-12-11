import { RouterProvider, createRouter } from "@tanstack/react-router";
import React from "react";
import { createRoot } from "react-dom/client";
import "./i18n/config";
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
    <RouterProvider router={router} />
  </React.StrictMode>,
);
