// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Les auteurs de NutriMaison
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import { installTheme } from "./shared.jsx";

installTheme(); // avant le premier affichage : pas de flash blanc en mode sombre

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
