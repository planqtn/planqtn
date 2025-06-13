#!/usr/bin/env node

import { Command } from "commander";
import { setupKernelCommand } from "./commands/kernel";
import { setupUiCommand } from "./commands/ui";
import { setupPurgeCommand } from "./commands/purge";
import { setupImagesCommand } from "./commands/images";
import { setupCloudCommand } from "./commands/cloud";
import { isDev } from "./config";

const program = new Command();

program.command("htn").description("CLI tool for PlanqTN").version("1.0.0");

  // Check if we're in dev mode
if (isDev) {
    setupImagesCommand(program);
    setupCloudCommand(program);  
}

setupUiCommand(program);
setupKernelCommand(program);
setupPurgeCommand(program);

program.parseAsync();
