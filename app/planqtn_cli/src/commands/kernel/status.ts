import * as path from "path";
import * as os from "os";
import { kernelMode } from "../../config";
import { green, red, runCommand } from "../../utils";
import { k3d } from "../../k3d";
import { getCfgDefinitionsDir } from "../../config";

import { Command } from "commander";
import * as fs from "fs";

export function setupKernelStatusCommand(kernelCommand: Command) {
  kernelCommand
    .command("status")
    .description("Check status of all PlanqTN kernel components")
    .option("--verbose", "Show detailed output")
    .action(async (options: { verbose: boolean }) => {
      try {
        const postfix = kernelMode.isDev ? "-dev" : "-local";
        const planqtnDir = path.join(os.homedir(), ".planqtn");
        const cfgDir = kernelMode.isDev
          ? getCfgDefinitionsDir()
          : path.join(planqtnDir);
        const supabaseDir = kernelMode.isDev
          ? path.join(getCfgDefinitionsDir(), "supabase")
          : path.join(planqtnDir, "supabase");

        if (!fs.existsSync(supabaseDir)) {
          console.log(
            "Supabase directory is missing, please rerun `htn kernel start` to recreate it."
          );
          process.exit(1);
        }

        let supabaseStatus = "Not running";
        let apiUrl = "";
        let anonKey = "";
        try {
          const status = JSON.parse(
            (await runCommand("npx", ["supabase", "status", "-o", "json"], {
              cwd: supabaseDir,
              verbose: options.verbose,
              returnOutput: true
            })) as string
          );
          if ("API_URL" in status && "ANON_KEY" in status) {
            supabaseStatus = "Running";
            apiUrl = status.API_URL;
            anonKey = status.ANON_KEY;
          }
        } catch {
          // Supabase not running
        }
        console.log(
          `Supabase: ${
            supabaseStatus === "Running"
              ? green(supabaseStatus)
              : red(supabaseStatus)
          }`
        );

        // Check k3d cluster
        let k3dStatus = "Not running";
        try {
          const clusterStatus = (await k3d(
            ["cluster", "get", `planqtn${postfix}`],
            {
              verbose: options.verbose,
              returnOutput: true
            }
          )) as string;
          if (clusterStatus.includes("1/1")) {
            k3dStatus = "Running";
          }
        } catch (err) {
          if (options.verbose) {
            console.log("k3d cluster not running");
            console.log(err);
          }
        }
        console.log(
          `k3d cluster: ${
            k3dStatus === "Running" ? green(k3dStatus) : red(k3dStatus)
          }`
        );

        // Check k8sproxy

        let proxyStatus = "Not running";
        try {
          await runCommand("docker", ["inspect", `k8sproxy${postfix}`], {
            verbose: options.verbose
          });
          proxyStatus = "Running";
        } catch {
          // Proxy not running
        }
        console.log(
          `k8sproxy: ${
            proxyStatus === "Running" ? green(proxyStatus) : red(proxyStatus)
          }`
        );

        // Check API service
        let apiStatus = "Not running";
        try {
          const apiComposePath = path.join(
            cfgDir,
            "planqtn_api",
            "compose.yml"
          );
          const result = await runCommand(
            "docker",
            [
              "compose",
              "--env-file",
              path.join(cfgDir, "planqtn_api", ".env"),
              "-f",
              apiComposePath,
              "ps",
              "--format",
              "json"
            ],
            {
              verbose: options.verbose,
              returnOutput: true,
              env: {
                ...process.env,
                POSTFIX: postfix
              }
            }
          );
          if (options.verbose) {
            console.log(result);
          }

          apiStatus = result ? "Running" : "Not running";
        } catch {
          // API not running
        }
        console.log(
          `API service: ${
            apiStatus === "Running" ? green(apiStatus) : red(apiStatus)
          }`
        );

        // Print connection details if Supabase is running
        if (supabaseStatus === "Running") {
          console.log("\nConnection details:");
          console.log(
            JSON.stringify({ API_URL: apiUrl, ANON_KEY: anonKey }, null, 2)
          );
        }
      } catch (err) {
        console.error(
          "Error:",
          err instanceof Error ? err.message : String(err)
        );
        process.exit(1);
      }
    });
}
