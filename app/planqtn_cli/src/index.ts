#!/usr/bin/env node

import { Command } from "commander";
import { setupKernelCommand } from "./commands/kernel";
import { setupUiCommand } from "./commands/ui";
import { setupPurgeCommand } from "./commands/purge";
import { setupImagesCommand } from "./commands/images";
import { setupCloudCommand } from "./commands/cloud";
import { getCfgDefinitionsDir, isDev } from "./config";
import { readFileSync } from "fs";
import * as path from "path";
import { execSync } from "child_process";
import fs from "fs";

const program = new Command();

let version = "";
if (!isDev) {
  version = readFileSync(path.join(getCfgDefinitionsDir(), "version.txt"))
    .toString()
    .trim();
} else {
  const packageVersion = JSON.parse(
    readFileSync(path.join(__dirname, "..", "package.json")).toString()
  ).version;
  const git_version = execSync(__dirname + "/../../../hack/image_tag")
    .toString()
    .trim();
  version = `${packageVersion}-${git_version}`;
}
program.command("htn").description("CLI tool for PlanqTN").version(version);

program
  .command("version")
  .description("Show the version of the CLI")
  .action(() => {
    console.log(version);
  });

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
