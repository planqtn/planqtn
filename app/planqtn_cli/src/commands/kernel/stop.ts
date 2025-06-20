import { Command } from "commander";
import * as path from "path";
import * as os from "os";
import { getCfgDefinitionsDir, kernelMode } from "../../config";
import { runCommand } from "../../utils";
import { k3d } from "../../k3d";

export function setupKernelStopCommand(kernelCommand: Command) {
  kernelCommand
    .command("stop")
    .description("Stop the local PlanqTN kernel")
    .option("--verbose", "Show detailed output")
    .action(async (options: { verbose: boolean }) => {
      try {
        // Check if Supabase is running
        const postfix = kernelMode.isDev ? "-dev" : "-local";
        const planqtnDir = path.join(os.homedir(), ".planqtn");

        const cfgDir = kernelMode.isDev
          ? getCfgDefinitionsDir()
          : path.join(planqtnDir);

        const supabaseDir = kernelMode.isDev
          ? path.join(getCfgDefinitionsDir(), "supabase")
          : path.join(planqtnDir, "supabase");

        let supabaseRunning = false;
        try {
          const supabaseStatus = (await runCommand(
            "npx",
            ["supabase", "status", "-o", "json"],
            {
              cwd: supabaseDir,
              verbose: options.verbose,
              returnOutput: true
            }
          )) as string;

          try {
            const status = JSON.parse(supabaseStatus);
            supabaseRunning = "API_URL" in status;
          } catch {
            supabaseRunning = false;
          }
        } catch {
          supabaseRunning = false;
        }

        if (supabaseRunning) {
          console.log("Stopping Supabase...");
          await runCommand("npx", ["supabase", "stop"], {
            cwd: supabaseDir,
            verbose: options.verbose
          });
        }

        // Stop k8sproxy if it exists
        console.log("Stopping k8sproxy...");
        try {
          await runCommand("docker", ["stop", `k8sproxy${postfix}`], {
            verbose: options.verbose
          });
        } catch {
          // Ignore error if container doesn't exist
        }

        // Stop k3d cluster
        console.log("Stopping k3d cluster...");
        try {
          await k3d(["cluster", "stop", `planqtn${postfix}`], {
            verbose: options.verbose
          });
        } catch {
          // Ignore error if cluster doesn't exist
        }

        console.log("Stopping PlanqTN API...");
        try {
          const apiComposePath = path.join(
            cfgDir,
            "planqtn_api",
            "compose.yml"
          );
          await runCommand(
            "docker",
            [
              "compose",
              "--env-file",
              path.join(cfgDir, "planqtn_api", ".env"),
              "-f",
              apiComposePath,
              "down"
            ],
            {
              verbose: options.verbose,
              env: {
                ...process.env,
                POSTFIX: postfix
              }
            }
          );
        } catch {
          // Ignore error if container doesn't exist
        }

        console.log("PlanqTN kernel stopped successfully!");
      } catch (err) {
        console.error(
          "Error:",
          err instanceof Error ? err.message : String(err)
        );
        process.exit(1);
      }
    });
}
