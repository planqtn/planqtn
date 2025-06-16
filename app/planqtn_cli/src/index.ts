#!/usr/bin/env node

import { Command } from "commander";
import { setupKernelCommand } from "./commands/kernel";
import { setupUiCommand } from "./commands/ui";
import { setupPurgeCommand } from "./commands/purge";
import { setupImagesCommand } from "./commands/images";
import { setupCloudCommand } from "./commands/cloud";
import { getCfgDefinitionsDir, isDev } from "./config";
import { execSync } from "child_process";
import path from "path";
import fs from "fs";

const program = new Command();

program.command("htn").description("CLI tool for PlanqTN").version("1.0.0");

// Check if we're in dev mode
if (isDev) {
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



setupUiCommand(program);
setupKernelCommand(program);
setupPurgeCommand(program);

program.parseAsync();
