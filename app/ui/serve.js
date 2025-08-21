/* eslint-env node */
/* global process */
import express from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { dirname } from "path";
import dotenv from "dotenv";
import history from "connect-history-api-fallback";

// ES module equivalents for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Function to recursively find all JS and CSS files
function findAssetFiles(dir) {
  let results = [];
  const files = fs.readdirSync(dir);
  
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      results = results.concat(findAssetFiles(filePath));
    } else if (file.endsWith('.js') || file.endsWith('.css')) {
      results.push(filePath);
    }
  }
  
  return results;
}

// Function to replace environment variables in a file
function replaceEnvVars(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  for (const [key, value] of Object.entries(process.env)) {
    if (key.startsWith("VITE_")) {
      const runtimeKey = `RUNTIME_${key}`;
      const newContent = content.replaceAll(runtimeKey, value);
      if (newContent !== content) {
        console.log(`Replacing ${runtimeKey} with ${value} in ${filePath}`);
        content = newContent;
        modified = true;
      } 
    }
  }

  if (modified) {
    console.log(`Modified ${filePath}`);
    try {
      fs.writeFileSync(filePath, content);
      console.log(`Successfully updated environment variables in ${filePath}`);
    } catch (error) {
      console.error(`Error writing to ${filePath}:`, error);
    }
  } 
}

// Find and process all asset files
const distPath = path.join(__dirname, 'dist', 'assets');
if (fs.existsSync(distPath)) {
  const assetFiles = findAssetFiles(distPath);
  for (const file of assetFiles) {
    try {
      replaceEnvVars(file);
    } catch (error) {
      console.error(`Error processing ${file}:`, error);
    }
  }
}

// Load environment variables
dotenv.config();

const app = express();
const port = process.env.PORT || 5173;

const env = process.env.VITE_ENV;
const entryPointFile = env === "TEASER" ? "teaser.html" : env === "DOWN" ? "down.html" : "index.html";

// Redirect www.planqtn.com to planqtn.com
app.use((req, res, next) => {
  const host = req.get('host');
  if (host && host.startsWith('www.')) {
    const newHost = host.replace(/^www\./, '');
    const protocol = req.get('x-forwarded-proto') || req.protocol;
    const redirectUrl = `${protocol}://${newHost}${req.url}`;
    return res.redirect(301, redirectUrl);
  }
  next();
});

app.use(express.static(path.join(__dirname, "dist"), {index: [entryPointFile]}));

// Serve docs folder - this must come before history fallback
app.use('/docs', express.static(path.join(__dirname, "dist", "docs"), {
  extensions: ['html'],
  index: ['index.html']
}));

// Custom 404 handler for docs routes
app.use('/docs', (req, res) => {
  const docs404Path = path.join(__dirname, "dist", "docs", "404.html");  
  res.sendFile(docs404Path);
   
});

app.use(history());

console.log("entryPointFile", entryPointFile);

app.get("*name", (req, res) => {
  res.sendFile(path.join(__dirname, "dist", entryPointFile));
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
