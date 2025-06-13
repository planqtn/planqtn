import { Command } from "commander";
import path from "path";
import { cfgDir, isDev, postfix } from "../config";
import { runCommand } from "../utils";

export function setupUiCommand(program: Command) {
  const uiCommand = program.command("ui");

  const startUiCommand = uiCommand
    .command("start")
    .description("Start the local PlanqTN UI")
    .option("--verbose", "Show detailed output")
    
  if (isDev) {
    startUiCommand.option("--dev", "Run in dev mode")
  }
  
 startUiCommand
    .action(async (options: { verbose: boolean, dev: boolean }) => {
      console.log("Starting the local PlanqTN UI");
      
      if (options.dev) {
        console.log("Running in dev mode, you can exit by pressing Ctrl+C");
        await runCommand("npm", ["run", "dev"], {
          cwd: path.join(cfgDir, "ui")
        });
      } else {
      const uiComposePath = path.join(cfgDir, "ui", "compose.yml");
      await runCommand(
        "docker",
        [
          "compose",
          "--env-file",
          path.join(cfgDir, "ui", ".env"),
          "-f",
          uiComposePath,
          "up",
          "-d"
        ],
        {
          verbose: options.verbose,
          env: {
            ...process.env,
            POSTFIX: postfix
          }
        }
      );

      }
    });

  uiCommand
    .command("stop")
    .description("Stop the local PlanqTN UI")
    .action(async () => {
      console.log("Stopping the local PlanqTN UI");
      console.log("Stopping PlanqTN API...");
      try {
        const apiComposePath = path.join(
          cfgDir,
          "ui",
          "compose.yml"
        );
        await runCommand(
          "docker",
          [
            "compose",
            "--env-file",
            path.join(cfgDir, "ui", ".env"),
            "-f",
            apiComposePath,
            "down"
          ],
          {
            env: {
              ...process.env,
              POSTFIX: postfix
            }
          }
        );
      } catch {
        // Ignore error if container doesn't exist
      }
    });
}
