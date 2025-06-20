import { Command } from "commander";
import { setupKernelStopCommand } from "./kernel/stop";
import { setupKernelStartCommand } from "./kernel/start";
import { setupKernelRemoveCommand } from "./kernel/remove";
import { setupKernelMonitorCommand } from "./kernel/monitor";
import { setupKernelStatusCommand } from "./kernel/status";

export function setupKernelCommand(program: Command) {
  const kernelCommand = program.command("kernel");

  setupKernelStartCommand(kernelCommand);
  setupKernelStopCommand(kernelCommand);
  setupKernelRemoveCommand(kernelCommand);
  setupKernelMonitorCommand(kernelCommand);
  setupKernelStatusCommand(kernelCommand);
}
