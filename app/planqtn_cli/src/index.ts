#!/usr/bin/env node

import { Command } from "commander";
import { setupKernelCommand } from "./commands/kernel";
import { setupUiCommand } from "./commands/ui";
import { setupPurgeCommand } from "./commands/purge";
import { setupImagesCommand } from "./commands/images";
import { setupCloudCommand } from "./commands/cloud";
import { getCfgDefinitionsDir, kernelMode } from "./config";
import * as path from "path";
import { execSync } from "child_process";
import fs from "fs";
import { setupVersionCommand } from "./commands/version";

const program = new Command();

setupVersionCommand(program);
setupUiCommand(program);
setupKernelCommand(program);
setupPurgeCommand(program);

// Check if we're in dev mode
if (kernelMode.isDev) {
  setupImagesCommand(program);
  setupCloudCommand(program);

  const appDir = getCfgDefinitionsDir();
  // ensure that node_modules exists in the app folder
  // if not, run npm install
  if (!fs.existsSync(path.join(appDir, "node_modules"))) {
    console.log("Installing dependencies...");
    execSync("npm install", { cwd: getCfgDefinitionsDir() });
  }
}

program.parseAsync();
