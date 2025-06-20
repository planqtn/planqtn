import { Command } from "commander";
import * as path from "path";
import * as os from "os";
import { getCfgDefinitionsDir, kernelMode } from "../../config";
import { runCommand } from "../../utils";
import { k3d } from "../../k3d";
import * as fs from "fs";
import { spawn } from "child_process";

export function setupKernelRemoveCommand(kernelCommand: Command) {
  kernelCommand
    .command("remove")
    .description("Delete everything related to the local PlanqTN kernel")
    .option("--verbose", "Show detailed output")
    .action(async (options: { verbose: boolean }) => {
      try {
        // First stop everything

        const postfix = kernelMode.isDev ? "-dev" : "-local";
        const planqtnDir = path.join(os.homedir(), ".planqtn");

        const cfgDir = kernelMode.isDev
          ? getCfgDefinitionsDir()
          : path.join(planqtnDir);

        console.log("Stopping all components...");

        if (fs.existsSync(path.join(os.homedir(), ".planqtn", "supabase"))) {
          const supabaseDir = path.join(os.homedir(), ".planqtn", "supabase");
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

        // Stop and delete k3d cluster
        console.log("Stopping and deleting k3d cluster...");
        try {
          await k3d(["cluster", "delete", `planqtn${postfix}`], {
            verbose: options.verbose
          });
        } catch {
          // Ignore error if cluster doesn't exist
        }

        console.log("Force removing supabase containers...");
        const containers = await runCommand(
          "docker",
          [
            "ps",
            "-a",
            "-q",
            "--filter",
            `label=com.supabase.cli.project=planqtn${postfix}`
          ],
          {
            verbose: options.verbose,
            returnOutput: true
          }
        );
        if (containers) {
          for (const container of containers.trim().split("\n")) {
            await runCommand("docker", ["rm", "-f", container], {
              verbose: options.verbose
            });
          }
        }

        // Delete Supabase volumes
        console.log("Deleting Supabase volumes...");
        try {
          const volumes = await new Promise<string>((resolve, reject) => {
            const proc = spawn(
              "docker",
              [
                "volume",
                "ls",
                "--filter",
                `label=com.supabase.cli.project=planqtn${postfix}`,
                "-q"
              ],
              {
                shell: true,
                stdio: ["pipe", "pipe", options.verbose ? "inherit" : "pipe"]
              }
            );

            let output = "";
            proc.stdout?.on("data", (data) => {
              output += data.toString();
            });

            proc.on("close", (code) => {
              if (code === 0) {
                resolve(output);
              } else {
                reject(new Error(`Command failed with exit code ${code}`));
              }
            });
          });

          if (volumes.trim()) {
            await runCommand(
              "docker",
              ["volume", "rm", ...volumes.trim().split("\n")],
              {
                verbose: options.verbose
              }
            );
          }
        } catch (err) {
          // Ignore error if no volumes exist
          console.log(
            "volume error:",
            err instanceof Error ? err.message : String(err)
          );
        }

        // remove network
        console.log("Removing network...");
        try {
          await runCommand(
            "docker",
            ["network", "rm", `supabase_network_planqtn${postfix}`],
            {
              verbose: options.verbose
            }
          );
        } catch {
          // Ignore error if network doesn't exist
        }

        console.log("PlanqTN kernel removed successfully!");
      } catch (err) {
        console.error(
          "Error:",
          err instanceof Error ? err.message : String(err)
        );
        process.exit(1);
      }
    });
}
