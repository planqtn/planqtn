import { Command } from "commander";
import * as path from "path";
import * as os from "os";
import { kernelMode } from "../../config";
import { runCommand } from "../../utils";
import * as fs from "fs";

export function setupKernelMonitorCommand(kernelCommand: Command) {
  kernelCommand
    .command("monitor")
    .description("Monitor the local PlanqTN kernel")
    .option("--verbose", "Show detailed output")
    .action(async (options: { verbose: boolean }) => {
      try {
        const postfix = kernelMode.isDev ? "-dev" : "-local";
        const planqtnDir = path.join(os.homedir(), ".planqtn");
        const kubeconfigPath = path.join(
          planqtnDir,
          `kubeconfig${postfix}.yaml`
        );
        const clusterName = `planqtn${postfix}`;

        // Verify kubeconfig exists
        if (!fs.existsSync(kubeconfigPath)) {
          throw new Error(
            `Kubeconfig not found at ${kubeconfigPath}. Please run 'htn kernel start' first.`
          );
        }

        console.log("Starting k9s monitor...");
        await runCommand(
          "docker",
          [
            "run",
            "--rm",
            "--network",
            `supabase_network_planqtn${postfix}`,
            "-it",
            "-v",
            `${kubeconfigPath}:/root/.kube/config`,
            "quay.io/derailed/k9s",
            "--context",
            `${clusterName}-in-cluster`
          ],
          {
            verbose: options.verbose,
            tty: true
          }
        );
      } catch (err) {
        console.error(
          "Error:",
          err instanceof Error ? err.message : String(err)
        );
        process.exit(1);
      }
    });
}
