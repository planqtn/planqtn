import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { spawn } from "child_process";
import { copyDir, ensureEmptyDir, runCommand } from "../utils";
import { getCliRootDir } from "../config";
import * as yaml from "yaml";

export function setupKernelCommand(program: any) {
    const kernelCommand = program.command("kernel");

    kernelCommand
        .command("up")
        .description("Start the local PlanqTN kernel")
        .option("--verbose", "Show detailed output")
        .option("--force-recreate", "Force recreation of existing resources")
        .action(async (options: any) => {
            try {
                // Step 1: Check Docker installation
                console.log("Checking Docker installation...");
                await runCommand("docker", ["--version"], {
                    verbose: options.verbose,
                });

                // Step 2: Setup directories
                const planqtnDir = path.join(os.homedir(), ".planqtn");
                ensureEmptyDir(planqtnDir);
                const supabaseDir = path.join(planqtnDir, "supabase");
                const k8sDir = path.join(planqtnDir, "k8s");
                ensureEmptyDir(supabaseDir);
                ensureEmptyDir(k8sDir);

                // Step 3: Copy configuration files
                console.log("Setting up configuration files...");
                fs.copyFileSync(
                    path.join(getCliRootDir(), "supabase", "config.toml.local"),
                    path.join(supabaseDir, "config.toml"),
                );
                ensureEmptyDir(path.join(supabaseDir, "functions"));
                fs.copyFileSync(
                    path.join(
                        getCliRootDir(),
                        "supabase",
                        "functions",
                        ".env.local",
                    ),
                    path.join(supabaseDir, "functions", ".env"),
                );

                // Copy directories
                await copyDir(
                    path.join(getCliRootDir(), "supabase", "functions"),
                    path.join(supabaseDir, "functions"),
                    { verbose: options.verbose },
                );

                // Step 4: Copy k8s config
                await copyDir(
                    path.join(getCliRootDir(), "k8s"),
                    k8sDir,
                    { verbose: options.verbose },
                );

                // Step 5: Install Supabase CLI
                console.log("Installing Supabase CLI...");
                await runCommand(
                    "npm",
                    ["install", "supabase", "--prefix", planqtnDir],
                    { verbose: options.verbose },
                );

                // Step 6: Start Supabase
                console.log("Starting Supabase...");
                await runCommand("npx", ["supabase", "start"], {
                    cwd: supabaseDir,
                    verbose: options.verbose,
                });

                // Step 7: Check Supabase status
                console.log("Checking Supabase status...");
                const supabaseStatus = await new Promise<string>(
                    (resolve, reject) => {
                        const proc = spawn("npx", [
                            "supabase",
                            "status",
                            "-o",
                            "json",
                        ], {
                            cwd: supabaseDir,
                            shell: true,
                            stdio: [
                                "pipe",
                                "pipe",
                                options.verbose ? "inherit" : "pipe",
                            ],
                        });

                        let output = "";
                        proc.stdout?.on("data", (data) => {
                            output += data.toString();
                        });

                        if (!options.verbose) {
                            proc.stderr?.on("data", (data) => {
                                if (data.toString().trim()) {
                                    console.error(data.toString().trim());
                                }
                            });
                        }

                        proc.on("close", (code) => {
                            if (code === 0) {
                                resolve(output);
                            } else {
                                reject(
                                    new Error(
                                        `Command failed with exit code ${code}`,
                                    ),
                                );
                            }
                        });
                    },
                );

                try {
                    JSON.parse(supabaseStatus);
                } catch (e) {
                    throw new Error("Invalid Supabase status JSON output");
                }

                // Step 8: Check Docker network
                console.log("Checking Docker network...");
                await runCommand(
                    "docker",
                    ["network", "inspect", "supabase_network_planqtn-local"],
                    { verbose: options.verbose },
                );

                // Step 9: Install k3d
                console.log("Installing k3d...");
                const k3dPath = path.join(planqtnDir, "k3d");

                if (!fs.existsSync(k3dPath)) {
                    const installScriptPath = path.join(
                        planqtnDir,
                        "install-k3d.sh",
                    );
                    await runCommand(
                        "curl",
                        [
                            "-s",
                            "https://raw.githubusercontent.com/k3d-io/k3d/main/install.sh",
                            "-o",
                            installScriptPath,
                        ],
                        { verbose: options.verbose },
                    );

                    // Step 10: Make k3d executable and install
                    fs.chmodSync(installScriptPath, 0o755);
                    await runCommand("bash", [installScriptPath, "--no-sudo"], {
                        verbose: options.verbose,
                        env: {
                            ...process.env,
                            K3D_INSTALL_DIR: planqtnDir,
                            USE_SUDO: "false",
                        },
                    });

                    // Step 11: Verify k3d installation
                    if (!fs.existsSync(k3dPath)) {
                        throw new Error(
                            "k3d installation failed - binary not found",
                        );
                    }
                    fs.chmodSync(k3dPath, 0o755);
                    fs.unlinkSync(installScriptPath);
                }

                // Step 12: Setup k3d cluster
                console.log("Setting up k3d cluster...");
                const clusterName = "planqtn-local";
                const kubeconfigPath = path.join(planqtnDir, "kubeconfig.yaml");

                try {
                    await runCommand(k3dPath, ["cluster", "get", clusterName], {
                        verbose: options.verbose,
                    });
                    if (options.forceRecreate) {
                        await runCommand(k3dPath, [
                            "cluster",
                            "delete",
                            clusterName,
                        ], {
                            verbose: options.verbose,
                        });
                        await runCommand(
                            k3dPath,
                            [
                                "cluster",
                                "create",
                                clusterName,
                                "--network=supabase_network_planqtn-local",
                                "--kubeconfig-update-default=false",
                            ],
                            { verbose: options.verbose },
                        );
                    }
                    await createKubeconfig(
                        k3dPath,
                        clusterName,
                        kubeconfigPath,
                        options.verbose,
                    );
                } catch (err) {
                    // Cluster doesn't exist, create it
                    await runCommand(
                        k3dPath,
                        [
                            "cluster",
                            "create",
                            clusterName,
                            "--network=supabase_network_planqtn-local",
                            "--kubeconfig-update-default=false",
                        ],
                        { verbose: options.verbose },
                    );
                }

                // Step 13: Setup k8sproxy
                console.log("Setting up k8sproxy...");
                try {
                    await runCommand("docker", ["inspect", "k8sproxy"], {
                        verbose: options.verbose,
                    });
                    if (options.forceRecreate) {
                        await runCommand("docker", ["stop", "k8sproxy"], {
                            verbose: options.verbose,
                        });
                        await createProxy(
                            kubeconfigPath,
                            options.verbose,
                            clusterName,
                        );
                    }
                } catch (err) {
                    // Container doesn't exist, create it
                    await createProxy(
                        kubeconfigPath,
                        options.verbose,
                        clusterName,
                    );
                }

                // Step 14: Test k8sproxy
                console.log("Testing k8sproxy...");
                await runCommand(
                    "docker",
                    [
                        "run",
                        "--network",
                        "supabase_network_planqtn-local",
                        "--rm",
                        "alpine/curl",
                        "-f",
                        "k8sproxy:8001/version",
                    ],
                    { verbose: options.verbose },
                );

                console.log("PlanqTN kernel setup completed successfully!");
            } catch (err) {
                console.error(
                    "Error:",
                    err instanceof Error ? err.message : String(err),
                );
                process.exit(1);
            }
        });

    kernelCommand
        .command("stop")
        .description("Stop the local PlanqTN kernel")
        .action(async () => {
            console.log("Stopping the local PlanqTN kernel");
        });

    kernelCommand
        .command("remove")
        .description("Delete everything related to the local PlanqTN kernel")
        .action(async () => {
            console.log("Deleting the local PlanqTN kernel");
        });
}

async function createProxy(
    kubeconfigPath: string,
    verbose: boolean,
    clusterName: string,
): Promise<void> {
    const uid = await new Promise<string>((resolve, reject) => {
        const proc = spawn("id", ["-u"], { shell: true });
        let output = "";
        proc.stdout?.on("data", (data) => {
            output += data.toString();
        });
        proc.on("close", (code) => {
            if (code === 0) {
                resolve(output.trim());
            } else {
                reject(new Error(`Failed to get user ID: ${code}`));
            }
        });
    });

    await runCommand(
        "docker",
        [
            "run",
            "--network",
            "supabase_network_planqtn-local",
            "--rm",
            "-d",
            "--name",
            "k8sproxy-local",
            "--user",
            uid,
            "-v",
            `${kubeconfigPath}:/.kube/config`,
            "d3fk/kubectl",
            "proxy",
            "--accept-hosts",
            "'.*'",
            "--address=0.0.0.0",
            "--context",
            `${clusterName}-in-cluster`,
        ],
        { verbose },
    );
}

async function createKubeconfig(
    k3dPath: string,
    clusterName: string,
    kubeconfigPath: string,
    verbose: any,
) {
    await runCommand(
        k3dPath,
        [
            "kubeconfig",
            "write",
            clusterName,
            "--output",
            kubeconfigPath,
        ],
        { verbose: verbose },
    );

    // Read the generated kubeconfig
    const kubeconfig = fs.readFileSync(kubeconfigPath, "utf8");
    const config = yaml.parse(kubeconfig) as any;

    // Create a new cluster entry for in-cluster access
    const inClusterName = `${clusterName}-in-cluster`;
    const originalCluster = config.clusters[0];
    const inCluster = {
        ...originalCluster,
        name: inClusterName,
        cluster: {
            ...originalCluster.cluster,
            server: "https://k3d-planqtn-local-serverlb:6443",
        },
    };

    const originalContext = config.contexts[0];

    // Create a new context for in-cluster access
    const inContext = {
        name: inClusterName,
        context: {
            cluster: inClusterName,
            user: originalContext.context.user,
        },
    };

    // Add the new cluster and context
    config.clusters.push(inCluster);
    config.contexts.push(inContext);

    // Write the updated kubeconfig
    fs.writeFileSync(kubeconfigPath, yaml.stringify(config));
}
