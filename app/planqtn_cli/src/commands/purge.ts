import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { runCommand } from "../utils";

export function setupPurgeCommand(program: any) {
    program
        .command("purge")
        .description("Force remove all PlanqTN and Supabase related resources")
        .option("--force", "Skip confirmation prompt")
        .action(async (options: any) => {
            try {
                // List resources that will be removed
                console.log("The following resources will be removed:");
                console.log("\nDocker Containers:");
                const containers = await runCommand("docker", [
                    "ps",
                    "-a",
                    "--format",
                    "{{.Names}}",
                    "--filter",
                    "name='supabase|planqtn'",
                ], { returnOutput: true }) as string;
                console.log(containers || "None found");

                console.log("\nDocker Networks:");
                const networks = await runCommand("docker", [
                    "network",
                    "ls",
                    "--format",
                    "{{.Name}}",
                    "--filter",
                    "name='supabase|planqtn'",
                ], { returnOutput: true }) as string;
                console.log(networks || "None found");

                console.log("\nDocker Volumes:");
                const volumes = await runCommand("docker", [
                    "volume",
                    "ls",
                    "--format",
                    "{{.Name}}",
                    "--filter",
                    "name='supabase|planqtn'",
                ], { returnOutput: true }) as string;
                console.log(volumes || "None found");

                console.log("\nK3D Clusters:");
                const k3dPath = path.join(os.homedir(), ".planqtn", "k3d");
                if (fs.existsSync(k3dPath)) {
                    const clusters = await runCommand(k3dPath, [
                        "cluster",
                        "list",
                        "--no-headers",
                    ], { returnOutput: true }) as string;
                    console.log(clusters || "None found");
                } else {
                    console.log("k3d not found");
                }

                console.log("\n~/.planqtn directory");
                const planqtnDir = path.join(os.homedir(), ".planqtn");
                if (fs.existsSync(planqtnDir)) {
                    console.log("Will be removed");
                } else {
                    console.log("Not found");
                }

                // Ask for confirmation
                if (!options.force) {
                    const readline = require("readline").createInterface({
                        input: process.stdin,
                        output: process.stdout,
                    });

                    const answer = await new Promise<string>((resolve) => {
                        readline.question(
                            "\nAre you sure you want to remove all these resources? (y/N) ",
                            resolve,
                        );
                    });
                    readline.close();

                    if (answer.toLowerCase() !== "y") {
                        console.log("Purge cancelled");
                        return;
                    }
                }

                // Remove resources
                console.log("\nRemoving resources...");

                // Remove containers
                if (containers) {
                    console.log("\nRemoving containers...");
                    await runCommand("docker", [
                        "rm",
                        "-f",
                        ...containers.trim().split("\n"),
                    ]);
                }

                // Remove networks
                if (networks) {
                    console.log("\nRemoving networks...");
                    await runCommand("docker", [
                        "network",
                        "rm",
                        ...networks.trim().split("\n"),
                    ]);
                }

                // Remove volumes
                if (volumes) {
                    console.log("\nRemoving volumes...");
                    await runCommand("docker", [
                        "volume",
                        "rm",
                        ...volumes.trim().split("\n"),
                    ]);
                }

                // Remove k3d clusters
                if (fs.existsSync(k3dPath)) {
                    console.log("\nRemoving k3d clusters...");
                    const clusters = await runCommand(k3dPath, [
                        "cluster",
                        "list",
                        "--no-headers",
                    ], { returnOutput: true }) as string;
                    if (clusters) {
                        for (const cluster of clusters.trim().split("\n")) {
                            const clusterName = cluster.split(" ")[0];
                            await runCommand(k3dPath, [
                                "cluster",
                                "delete",
                                clusterName,
                            ]);
                        }
                    }
                }

                // Remove ~/.planqtn directory
                if (fs.existsSync(planqtnDir)) {
                    console.log("\nRemoving ~/.planqtn directory...");
                    fs.rmSync(planqtnDir, { recursive: true, force: true });
                }

                console.log("\nPurge completed successfully!");
            } catch (err) {
                console.error(
                    "Error:",
                    err instanceof Error ? err.message : String(err),
                );
                process.exit(1);
            }
        });
}
