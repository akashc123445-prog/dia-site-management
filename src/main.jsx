import React from "react";
import ReactDOM from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App.jsx";
import "./index.css";

/* A new deploy is offered rather than applied. Reloading the moment an update
   lands would discard whatever the person is part-way through writing, so the
   choice of when to take it stays with them. */
const updateSW = registerSW({
  onNeedRefresh() {
    window.dispatchEvent(new CustomEvent("dia:update-available", {
      detail: { apply: () => updateSW(true) },
    }));
  },
});

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
