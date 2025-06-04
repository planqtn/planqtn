#!/usr/bin/env node

import { Command } from "commander";
import { setupKernelCommand } from "./commands/kernel";
import { setupUiCommand } from "./commands/ui";
import { setupPurgeCommand } from "./commands/purge";

const program = new Command();

program
    .command("htn")
    .description("CLI tool for PlanqTN")
    .version("1.0.0");

setupUiCommand(program);
setupKernelCommand(program);
setupPurgeCommand(program);

program.parse();
