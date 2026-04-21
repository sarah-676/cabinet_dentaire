/**
 * main.jsx — point d'entrée React
 * ==================================
 * Monte l'application dans le DOM.
 * App.jsx gère le routing et les providers de contexte.
 */

import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);