import "@/styles/globals.css";
import React from "react";
import ReactDOM from "react-dom/client";
import { Loader } from "./loader.tsx";
import { registerServiceWorker } from "./serviceWorkerRegistration.ts";

void (async () => {
  try {
    await registerServiceWorker();
  } catch (error) {
    console.error("Service Worker registration failed:", error);
  }
})();

const root = document.getElementById("root");

if (!root) {
  throw new Error("Root element not found");
}

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <Loader />
  </React.StrictMode>,
);
