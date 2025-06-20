import { Command } from "commander";
import path from "path";
import { cfgDir, kernelMode, postfix } from "../config";
import { runCommand, updateEnvFile } from "../utils";
import { execSync } from "child_process";

async function setupDevUserContext() {
  console.log(
    "Using the dev runtime kernel as the user context, getting details from the dev runtime kernel"
  );
  const envFile = path.join(cfgDir, "ui", ".env");
  try {
    const supabaseStatus = execSync("npx supabase status -o json", {
      cwd: path.join(cfgDir)
    });
    const supabaseStatusJson = JSON.parse(supabaseStatus.toString());
    console.log("API_URL: ", supabaseStatusJson["API_URL"]);
    console.log("ANON_KEY: ", supabaseStatusJson["ANON_KEY"]);

    // Update each environment variable, backing up old values if they exist
    await updateEnvFile(
      envFile,
      "VITE_TASK_STORE_URL",
      supabaseStatusJson["API_URL"],
      true
    );
    await updateEnvFile(
      envFile,
      "VITE_TASK_STORE_ANON_KEY",
      supabaseStatusJson["ANON_KEY"],
      true
    );
    await updateEnvFile(envFile, "VITE_ENV", "development", true);
    console.log("Updated .env file with new values");
  } catch (error) {
    console.error("Error getting supabase status", error);
    throw error;
  }
}

async function runDevUi(options: {
  devUserContext: boolean;
  verbose: boolean;
}) {
  console.log("Running in dev mode, you can exit by pressing Ctrl+C");
  await runCommand("npm", ["install"], {
    cwd: path.join(cfgDir, "ui"),
    verbose: true
  });

  if (options.devUserContext) {
    await setupDevUserContext();
  }

  await runCommand("npm", ["run", "dev"], {
    cwd: path.join(cfgDir, "ui"),
    verbose: true
  });
}

export function setupUiCommand(program: Command) {
  const uiCommand = program.command("ui");

  const startUiCommand = uiCommand
    .command("start")
    .description("Start the local PlanqTN UI")
    .option("--verbose", "Show detailed output");

  if (kernelMode.isDev) {
    startUiCommand.option("--dev", "Run in dev mode");
    startUiCommand.option(
      "--dev-user-context",
      "Use the dev runtime kernel as the user context"
    );
  }

  startUiCommand.action(
    async (options: {
      verbose: boolean;
      dev: boolean;
      devUserContext: boolean;
    }) => {
      console.log("Starting the local PlanqTN UI");

      if (options.dev) {
        await runDevUi(options);
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
            verbose: true,
            env: {
              ...process.env,
              POSTFIX: postfix
            }
          }
        );
      }
    }
  );

  uiCommand
    .command("stop")
    .description("Stop the local PlanqTN UI")
    .action(async () => {
      console.log("Stopping the local PlanqTN UI");
      console.log("Stopping PlanqTN API...");
      try {
        const apiComposePath = path.join(cfgDir, "ui", "compose.yml");
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
