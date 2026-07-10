import React from "react";
import ReactDOM from "react-dom/client";

import { AppQueryClientProvider } from "./app/providers/query-client";
import { AppRouterProvider } from "./routes/router";
import "./styles/globals.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AppQueryClientProvider>
      <AppRouterProvider />
    </AppQueryClientProvider>
  </React.StrictMode>
);
