import "@/styles/globals.css";
import React from "react";
import ReactDOM from "react-dom/client";
import { Loader } from "./loader.tsx";

const root = document.getElementById("root");

if (!root) {
  throw new Error("Root element not found");
}

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <Loader />
  </React.StrictMode>,
);
