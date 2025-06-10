import { Command } from "commander";

export function setupUiCommand(program: Command) {
  const uiCommand = program.command("ui");

  uiCommand
    .command("up")
    .description("Start the local PlanqTN UI")
    .action(async () => {
      console.log("Starting the local PlanqTN UI");
      throw new Error("Not implemented yet, kick it off manually");
    });

  uiCommand
    .command("stop")
    .description("Stop the local PlanqTN UI")
    .action(async () => {
      console.log("Stopping the local PlanqTN UI");
      throw new Error("Not implemented yet, kick it off manually");
    });
}
