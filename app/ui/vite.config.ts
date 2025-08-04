import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import fs from "fs";
import path from "path";
import tailwindcss from "@tailwindcss/vite";

// Custom plugin to handle docs routing and 404s
function docsPlugin() {
  return {
    name: "docs-plugin",
    configureServer(server) {
      // Intercept docs requests before history fallback
      server.middlewares.use((req, res, next) => {
        if (req.url && req.url.startsWith("/docs")) {
          // Remove the /docs prefix to get the file path
          const filePath = req.url.replace(/^\/docs/, "");
          const fullPath = path.join(process.cwd(), "public", "docs", filePath);

          // If it's a directory request, serve index.html
          if (filePath === "" || filePath === "/") {
            const indexPath = path.join(
              process.cwd(),
              "public",
              "docs",
              "index.html"
            );
            if (fs.existsSync(indexPath)) {
              res.setHeader("Content-Type", "text/html");
              res.end(fs.readFileSync(indexPath, "utf8"));
              return;
            }
          }

          // Try to serve the file directly
          if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
            const ext = path.extname(fullPath);
            const contentType =
              {
                ".html": "text/html",
                ".css": "text/css",
                ".js": "application/javascript",
                ".png": "image/png",
                ".jpg": "image/jpeg",
                ".jpeg": "image/jpeg",
                ".gif": "image/gif",
                ".svg": "image/svg+xml",
                ".ico": "image/x-icon",
                ".json": "application/json",
                ".xml": "application/xml"
              }[ext] || "text/plain";

            res.setHeader("Content-Type", contentType);
            res.end(fs.readFileSync(fullPath));
            return;
          }

          // If it's a directory request, serve index.html
          const indexPath = path.join(fullPath, "index.html");
          if (fs.existsSync(indexPath)) {
            res.setHeader("Content-Type", "text/html");
            res.end(fs.readFileSync(indexPath, "utf8"));
            return;
          }

          // If file doesn't exist, serve 404.html
          const notFoundPath = path.join(
            process.cwd(),
            "public",
            "docs",
            "404.html"
          );
          if (fs.existsSync(notFoundPath)) {
            res.statusCode = 404;
            res.setHeader("Content-Type", "text/html");
            res.end(fs.readFileSync(notFoundPath, "utf8"));
            return;
          }
        }
        next();
      });
    }
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd());
  return {
    plugins: [docsPlugin(), react(), tailwindcss()],
    preview: {
      allowedHosts: true
    },
    logLevel: "info",

    server: {
      host: "0.0.0.0", // Allow connections from any IP
      strictPort: true,
      port: env.VITE_PORT || 5173,
      allowedHosts: true
    },
    // Serve docs folder as static assets
    publicDir: "public",
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src")
      }
    }
  };
});
