// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Les auteurs de NutriMaison
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import { installTheme } from "./shared.jsx";
import { installI18n } from "./i18n.js";

installTheme(); // avant le premier affichage : pas de flash blanc en mode sombre
installI18n(); // en anglais : traduit l'affichage (ne fait rien en français)

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
