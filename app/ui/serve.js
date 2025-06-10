/* eslint-env node */
/* global process */
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import dotenv from "dotenv";
import history from "connect-history-api-fallback";

// Load environment variables
dotenv.config();

// ES module equivalents for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.FRONTEND_PORT || 5173;

// Support for HTML5 History API
app.use(history());

// Serve static files from dist
app.use(express.static(path.join(__dirname, "dist")));

// Fallback for SPA routing
app.get("*name", (req, res) => {
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});

// Start server
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
