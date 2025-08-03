import React from "react";
import ReactDOM from "react-dom/client";
import { ChakraProvider, ColorModeScript, extendTheme } from "@chakra-ui/react";
import "./index.css";

import { BrowserRouter, Routes, Route } from "react-router";
import LegoStudioView from "./LegoStudio";
import AuthCallback from "./features/auth/AuthCallback";
import ErrorBoundary from "./components/ErrorBoundary";

// Create a custom theme that configures the portal container
const theme = extendTheme({
  config: {
    initialColorMode: "light",
    useSystemColorMode: false
  },
  zIndices: {
    modal: 100000 // Ensure modals have higher z-index than modal-root
  }
});

// While this is handled in serve.js in production time, for the dev server mode we need to handle it here

if (import.meta.env.VITE_ENV === "TEASER") {
  window.location.href = "/teaser.html";
} else if (import.meta.env.VITE_ENV === "DOWN") {
  window.location.href = "/down.html";
} else {
  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <ErrorBoundary>
        <ColorModeScript initialColorMode="light" />
        <ChakraProvider theme={theme}>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<LegoStudioView />} />
              <Route path="/auth-callback" element={<AuthCallback />} />
            </Routes>
          </BrowserRouter>
        </ChakraProvider>
      </ErrorBoundary>
    </React.StrictMode>
  );
}
