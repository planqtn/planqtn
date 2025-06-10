import React from "react";
import ReactDOM from "react-dom/client";
import { ChakraProvider } from "@chakra-ui/react";
import "./index.css";

import { BrowserRouter, Routes, Route } from "react-router";
import LegoStudioView from "./LegoStudio";
import ErrorBoundary from "./components/ErrorBoundary";

if (import.meta.env.VITE_ENV === "TEASER") {
  window.location.href = "/teaser.html";
} else if (import.meta.env.VITE_ENV === "DOWN") {
  window.location.href = "/down.html";
} else {
  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <ErrorBoundary>
        <ChakraProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<LegoStudioView />} />
            </Routes>
          </BrowserRouter>
        </ChakraProvider>
      </ErrorBoundary>
    </React.StrictMode>
  );
}
