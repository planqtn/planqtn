import React from "react";
import ReactDOM from "react-dom/client";
import { ChakraProvider } from "@chakra-ui/react";
import "./index.css";

import { BrowserRouter, Routes, Route } from "react-router";
import LegoStudioView from "./LegoStudio";
import TasksView from "./components/TasksView";
import ErrorBoundary from "./components/ErrorBoundary";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <ChakraProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<LegoStudioView />} />
            <Route path="/tasks" element={<TasksView />} />
          </Routes>
        </BrowserRouter>
      </ChakraProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);
