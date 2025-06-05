import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { spawn } from "child_process";
import { copyDir, ensureEmptyDir, runCommand } from "../utils";
import { getCfgDefinitionsDir, isDev } from "../config";
import * as yaml from "yaml";

export function setupKernelCommand(program: any) {
    const kernelCommand = program.command("kernel");

    kernelCommand
        .command("start")
        .description("Start the local PlanqTN kernel")
        .option("--verbose", "Show detailed output")
        .action(async (options: any) => {
            try {
                // Step 1: Check Docker installation
                console.log("Checking Docker installation...");
                await runCommand("docker", ["--version"], {
                    verbose: options.verbose,
                });
                const postfix = isDev ? "-dev" : "-local";
                const planqtnDir = path.join(os.homedir(), ".planqtn");

                const supabaseDir = isDev
                    ? path.join(getCfgDefinitionsDir(), "supabase")
                    : path.join(planqtnDir, "supabase");
                ensureEmptyDir(planqtnDir);

                const cfgDir = isDev
                    ? getCfgDefinitionsDir()
                    : path.join(planqtnDir);

                if (!isDev) {
                    // Step 2: Setup directories
                    const k8sDir = path.join(planqtnDir, "k8s");
                    const migrationsDir = path.join(planqtnDir, "migrations");
                    const apiDir = path.join(planqtnDir, "planqtn_api");
                    ensureEmptyDir(supabaseDir);
                    ensureEmptyDir(k8sDir);
                    ensureEmptyDir(migrationsDir);
                    ensureEmptyDir(apiDir);

                    // Step 3: Copy configuration files
                    console.log("Setting up configuration files...");
                    fs.copyFileSync(
                        path.join(
                            getCfgDefinitionsDir(),
                            "supabase",
                            "config.toml.local",
                        ),
                        path.join(supabaseDir, "config.toml"),
                    );

                    fs.copyFileSync(
                        path.join(
                            getCfgDefinitionsDir(),
                            "planqtn_api",
                            "compose.yml",
                        ),
                        path.join(apiDir, "compose.yml"),
                    );

                    fs.copyFileSync(
                        path.join(
                            getCfgDefinitionsDir(),
                            "planqtn_api",
                            ".env.local",
                        ),
                        path.join(apiDir, ".env"),
                    );

                    // Stop edge runtime before recreating functions directory
                    console.log("Stopping edge runtime container...");
                    try {
                        await runCommand("docker", [
                            "stop",
                            `supabase_edge_runtime_planqtn${postfix}`,
                        ], {
                            verbose: options.verbose,
                        });
                    } catch (err) {
                        // Ignore error if container doesn't exist
                    }

                    // Always recreate functions directory to ensure updates
                    ensureEmptyDir(path.join(supabaseDir, "functions"));

                    // Copy directories
                    await copyDir(
                        path.join(
                            getCfgDefinitionsDir(),
                            "supabase",
                            "functions",
                        ),
                        path.join(supabaseDir, "functions"),
                        { verbose: options.verbose },
                    );

                    fs.copyFileSync(
                        path.join(
                            getCfgDefinitionsDir(),
                            "supabase",
                            "functions",
                            ".env.local",
                        ),
                        path.join(supabaseDir, "functions", ".env"),
                    );

                    // Step 4: Copy k8s config
                    await copyDir(
                        path.join(getCfgDefinitionsDir(), "k8s"),
                        k8sDir,
                        { verbose: options.verbose },
                    );

                    await copyDir(
                        path.join(getCfgDefinitionsDir(), "migrations"),
                        migrationsDir,
                        { verbose: options.verbose },
                    );
                } else {
                    console.log(
                        "Running in dev mode, skipping directory/config setup, using existing files in repo",
                    );
                }

                // Step 5: Check Supabase status and start if needed
                console.log("Checking Supabase status...");
                let supabaseRunning = false;
                try {
                    const supabaseStatus = await runCommand("npx", [
                        "supabase",
                        "status",
                        "-o",
                        "json",
                    ], {
                        cwd: supabaseDir,
                        verbose: options.verbose,
                        returnOutput: true,
                    }) as string;

                    try {
                        const status = JSON.parse(supabaseStatus);
                        supabaseRunning = "API_URL" in status &&
                            "SERVICE_ROLE_KEY" in status;
                    } catch (e) {
                        // If we can't parse the status, assume it's not running
                        supabaseRunning = false;
                    }
                } catch (err) {
                    // If status check fails, assume it's not running
                    supabaseRunning = false;
                }

                if (!supabaseRunning) {
                    console.log(
                        "Starting Supabase in working directory:",
                        cfgDir,
                    );
                    await runCommand("npx", [
                        "supabase",
                        "start",
                        "--workdir",
                        cfgDir,
                    ], {
                        verbose: options.verbose,
                    });
                } else {
                    console.log(
                        "Supabase is already running, starting edge runtime...",
                    );
                    try {
                        await runCommand("docker", [
                            "start",
                            `supabase_edge_runtime_planqtn${postfix}`,
                        ], {
                            verbose: options.verbose,
                        });
                    } catch (err) {
                        console.log(
                            "Edge runtime container not found, Supabase will create it",
                        );
                    }
                }

                if (!isDev) {
                    // Create package.json for ES modules support
                    console.log("Setting up package.json for migrations...");
                    fs.writeFileSync(
                        path.join(planqtnDir, "package.json"),
                        JSON.stringify(
                            {
                                "type": "module",
                                "private": true,
                            },
                            null,
                            2,
                        ),
                    );
                }

                // Run database migrations
                console.log("Running database migrations...");
                await runCommand(
                    "npx",
                    ["node-pg-migrate", "up"],
                    {
                        verbose: options.verbose,
                        cwd: isDev ? getCfgDefinitionsDir() : planqtnDir,
                        env: {
                            ...process.env,
                            DATABASE_URL:
                                "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
                        },
                    },
                );

                // Step 8: Check Docker network
                console.log("Checking Docker network...");
                await runCommand(
                    "docker",
                    [
                        "network",
                        "inspect",
                        `supabase_network_planqtn${postfix}`,
                    ],
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
                            // hack for k3d install script to not complain about the binary not on path
                            PATH: `${process.env.PATH}:${planqtnDir}`,
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
                const clusterName = `planqtn${postfix}`;
                const kubeconfigPath = path.join(
                    planqtnDir,
                    `kubeconfig${postfix}.yaml`,
                );

                try {
                    const clusterStatus = await runCommand(k3dPath, [
                        "cluster",
                        "get",
                        clusterName,
                    ], {
                        verbose: options.verbose,
                        returnOutput: true,
                    }) as string;

                    // Check if servers are running (0/1 means not running)
                    if (clusterStatus.includes("0/1")) {
                        console.log("Starting k3d cluster...");
                        await runCommand(k3dPath, [
                            "cluster",
                            "start",
                            clusterName,
                        ], {
                            verbose: options.verbose,
                        });
                    }
                } catch (err) {
                    // Cluster doesn't exist, create it
                    await runCommand(
                        k3dPath,
                        [
                            "cluster",
                            "create",
                            clusterName,
                            `--network=supabase_network_planqtn${postfix}`,
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

                // Step 13: Setup k8sproxy
                console.log("Setting up k8sproxy...");
                try {
                    await runCommand("docker", [
                        "inspect",
                        `k8sproxy${postfix}`,
                    ], {
                        verbose: options.verbose,
                    });
                } catch (err) {
                    // Container doesn't exist, create it
                    await createProxy(
                        kubeconfigPath,
                        options.verbose,
                        clusterName,
                        postfix,
                    );
                }

                // Step 14: Test k8sproxy
                console.log("Testing k8sproxy...");
                await runCommand(
                    "docker",
                    [
                        "run",
                        "--network",
                        `supabase_network_planqtn${postfix}`,
                        "--rm",
                        "alpine/curl",
                        "-f",
                        `k8sproxy${postfix}:8001/version`,
                    ],
                    { verbose: options.verbose },
                );

                // Step 15: Setup job-monitor-rbac
                console.log("Setting up job-monitor-rbac...");
                await createRbac(
                    kubeconfigPath,
                    options.verbose,
                    clusterName,
                    path.join(cfgDir, "k8s", "job-monitor-rbac.yaml"),
                    postfix,
                );
                // Step 16: Setup API service
                console.log("Setting up API service...");
                const apiComposePath = path.join(
                    cfgDir,
                    "planqtn_api",
                    "compose.yml",
                );
                await runCommand("docker", [
                    "compose",
                    "--env-file",
                    path.join(cfgDir, "planqtn_api", ".env"),
                    "-f",
                    apiComposePath,
                    "restart",
                ], {
                    verbose: options.verbose,
                    env: {
                        ...process.env,
                        POSTFIX: postfix,
                    },
                });

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
        .option("--verbose", "Show detailed output")
        .action(async (options: any) => {
            try {
                // Check if Supabase is running
                const postfix = isDev ? "-dev" : "-local";
                const planqtnDir = path.join(os.homedir(), ".planqtn");

                const cfgDir = isDev
                    ? getCfgDefinitionsDir()
                    : path.join(planqtnDir);

                const supabaseDir = isDev
                    ? path.join(getCfgDefinitionsDir(), "supabase")
                    : path.join(planqtnDir, "supabase");

                let supabaseRunning = false;
                try {
                    const supabaseStatus = await runCommand("npx", [
                        "supabase",
                        "status",
                        "-o",
                        "json",
                    ], {
                        cwd: supabaseDir,
                        verbose: options.verbose,
                        returnOutput: true,
                    }) as string;

                    try {
                        const status = JSON.parse(supabaseStatus);
                        supabaseRunning = "API_URL" in status;
                    } catch (e) {
                        supabaseRunning = false;
                    }
                } catch (err) {
                    supabaseRunning = false;
                }

                if (supabaseRunning) {
                    console.log("Stopping Supabase...");
                    await runCommand("npx", ["supabase", "stop"], {
                        cwd: supabaseDir,
                        verbose: options.verbose,
                    });
                }

                // Stop k8sproxy if it exists
                console.log("Stopping k8sproxy...");
                try {
                    await runCommand("docker", ["stop", `k8sproxy${postfix}`], {
                        verbose: options.verbose,
                    });
                } catch (err) {
                    // Ignore error if container doesn't exist
                }

                // Stop k3d cluster
                console.log("Stopping k3d cluster...");
                const k3dPath = path.join(os.homedir(), ".planqtn", "k3d");
                try {
                    await runCommand(k3dPath, [
                        "cluster",
                        "stop",
                        `planqtn${postfix}`,
                    ], {
                        verbose: options.verbose,
                    });
                } catch (err) {
                    // Ignore error if cluster doesn't exist
                }

                console.log("Stopping PlanqTN API...");
                try {
                    const apiComposePath = path.join(
                        cfgDir,
                        "planqtn_api",
                        "compose.yml",
                    );
                    await runCommand("docker", [
                        "compose",
                        "--env-file",
                        path.join(cfgDir, "planqtn_api", ".env"),
                        "-f",
                        apiComposePath,
                        "down",
                    ], {
                        verbose: options.verbose,
                        env: {
                            ...process.env,
                            POSTFIX: postfix,
                        },
                    });
                } catch (err) {
                    // Ignore error if container doesn't exist
                }

                console.log("PlanqTN kernel stopped successfully!");
            } catch (err) {
                console.error(
                    "Error:",
                    err instanceof Error ? err.message : String(err),
                );
                process.exit(1);
            }
        });

    kernelCommand
        .command("remove")
        .description("Delete everything related to the local PlanqTN kernel")
        .option("--verbose", "Show detailed output")
        .action(async (options: any) => {
            try {
                // First stop everything

                const postfix = isDev ? "-dev" : "-local";
                const planqtnDir = path.join(os.homedir(), ".planqtn");

                const cfgDir = isDev
                    ? getCfgDefinitionsDir()
                    : path.join(planqtnDir);

                const supabaseDir = isDev
                    ? path.join(getCfgDefinitionsDir(), "supabase")
                    : path.join(planqtnDir, "supabase");

                console.log("Stopping all components...");

                if (fs.existsSync(path.join(os.homedir(), ".planqtn"))) {
                    const supabaseDir = path.join(
                        os.homedir(),
                        ".planqtn",
                        "supabase",
                    );
                    let supabaseRunning = false;
                    try {
                        const supabaseStatus = await runCommand("npx", [
                            "supabase",
                            "status",
                            "-o",
                            "json",
                        ], {
                            cwd: supabaseDir,
                            verbose: options.verbose,
                            returnOutput: true,
                        }) as string;

                        try {
                            const status = JSON.parse(supabaseStatus);
                            supabaseRunning = "API_URL" in status;
                        } catch (e) {
                            supabaseRunning = false;
                        }
                    } catch (err) {
                        supabaseRunning = false;
                    }

                    if (supabaseRunning) {
                        console.log("Stopping Supabase...");
                        await runCommand("npx", ["supabase", "stop"], {
                            cwd: supabaseDir,
                            verbose: options.verbose,
                        });
                    }
                }

                // Stop k8sproxy if it exists
                console.log("Stopping k8sproxy...");
                try {
                    await runCommand("docker", ["stop", `k8sproxy${postfix}`], {
                        verbose: options.verbose,
                    });
                } catch (err) {
                    // Ignore error if container doesn't exist
                }

                console.log("Stopping PlanqTN API...");
                try {
                    const apiComposePath = path.join(
                        cfgDir,
                        "planqtn_api",
                        "compose.yml",
                    );
                    await runCommand("docker", [
                        "compose",
                        "--env-file",
                        path.join(cfgDir, "planqtn_api", ".env"),
                        "-f",
                        apiComposePath,
                        "down",
                    ], {
                        verbose: options.verbose,
                        env: {
                            ...process.env,
                            POSTFIX: postfix,
                        },
                    });
                } catch (err) {
                    // Ignore error if container doesn't exist
                }

                // Stop and delete k3d cluster
                console.log("Stopping and deleting k3d cluster...");
                const k3dPath = path.join(os.homedir(), ".planqtn", "k3d");
                try {
                    await runCommand(k3dPath, [
                        "cluster",
                        "delete",
                        `planqtn${postfix}`,
                    ], {
                        verbose: options.verbose,
                    });
                } catch (err) {
                    // Ignore error if cluster doesn't exist
                }

                console.log("Force removing supabase containers...");
                const containers = await runCommand("docker", [
                    "ps",
                    "-a",
                    "-q",
                    "--filter",
                    `label=com.supabase.cli.project=planqtn${postfix}`,
                ], {
                    verbose: options.verbose,
                    returnOutput: true,
                });
                if (containers) {
                    for (
                        const container of containers.trim().split(
                            "\n",
                        )
                    ) {
                        await runCommand("docker", [
                            "rm",
                            "-f",
                            container,
                        ], {
                            verbose: options.verbose,
                        });
                    }
                }

                // Delete Supabase volumes
                console.log("Deleting Supabase volumes...");
                try {
                    const volumes = await new Promise<string>(
                        (resolve, reject) => {
                            const proc = spawn("docker", [
                                "volume",
                                "ls",
                                "--filter",
                                `label=com.supabase.cli.project=planqtn${postfix}`,
                                "-q",
                            ], {
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

                    if (volumes.trim()) {
                        const result = await runCommand("docker", [
                            "volume",
                            "rm",
                            ...volumes.trim().split("\n"),
                        ], {
                            verbose: options.verbose,
                        });
                    }
                } catch (err) {
                    // Ignore error if no volumes exist
                    console.log("volume error:", err);
                }

                // remove network
                console.log("Removing network...");
                try {
                    await runCommand("docker", [
                        "network",
                        "rm",
                        `supabase_network_planqtn${postfix}`,
                    ], {
                        verbose: options.verbose,
                    });
                } catch (err) {
                    // Ignore error if network doesn't exist
                }

                console.log("PlanqTN kernel removed successfully!");
            } catch (err) {
                console.error(
                    "Error:",
                    err instanceof Error ? err.message : String(err),
                );
                process.exit(1);
            }
        });

    kernelCommand
        .command("monitor")
        .description("Monitor the local PlanqTN kernel")
        .option("--verbose", "Show detailed output")
        .action(async (options: any) => {
            try {
                const postfix = isDev ? "-dev" : "-local";
                const planqtnDir = path.join(os.homedir(), ".planqtn");
                const kubeconfigPath = path.join(
                    planqtnDir,
                    `kubeconfig${postfix}.yaml`,
                );
                const clusterName = `planqtn${postfix}`;

                // Verify kubeconfig exists
                if (!fs.existsSync(kubeconfigPath)) {
                    throw new Error(
                        `Kubeconfig not found at ${kubeconfigPath}. Please run 'htn kernel start' first.`,
                    );
                }

                console.log("Starting k9s monitor...");
                await runCommand("docker", [
                    "run",
                    "--rm",
                    "--network",
                    `supabase_network_planqtn${postfix}`,
                    "-it",
                    "-v",
                    `${kubeconfigPath}:/root/.kube/config`,
                    "quay.io/derailed/k9s",
                    "--context",
                    `${clusterName}-in-cluster`,
                ], {
                    verbose: options.verbose,
                    tty: true,
                });
            } catch (err) {
                console.error(
                    "Error:",
                    err instanceof Error ? err.message : String(err),
                );
                process.exit(1);
            }
        });
}

async function kubectl(
    containerName: string,
    dockerArgs: string[],
    kubeCtlArgs: string[],
    kubeconfigPath: string,
    verbose: boolean,
    clusterName: string,
    postfix: string,
) {
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
            `supabase_network_planqtn${postfix}`,
            "--rm",
            "-d",
            "--name",
            containerName,
            "--user",
            uid,
            "-v",
            `${kubeconfigPath}:/.kube/config`,
            ...dockerArgs,
            "d3fk/kubectl",
            ...kubeCtlArgs,
            "--context",
            `${clusterName}-in-cluster`,
        ],
        { verbose },
    );
}

async function createRbac(
    kubeconfigPath: string,
    verbose: boolean,
    clusterName: string,
    rbacPath: string,
    postfix: string,
): Promise<void> {
    return await kubectl(
        `create-rbac${postfix}`,
        [
            "-v",
            `${rbacPath}:/.kube/rbac.yaml`,
        ],
        ["apply", "-f", "/.kube/rbac.yaml"],
        kubeconfigPath,
        verbose,
        clusterName,
        postfix,
    );
}

async function createProxy(
    kubeconfigPath: string,
    verbose: boolean,
    clusterName: string,
    postfix: string,
): Promise<void> {
    return await kubectl(
        `k8sproxy${postfix}`,
        [],
        [
            "proxy",
            "--accept-hosts",
            "'.*'",
            "--address=0.0.0.0",
        ],
        kubeconfigPath,
        verbose,
        clusterName,
        postfix,
    );
}

async function createKubeconfig(
    k3dPath: string,
    clusterName: string,
    kubeconfigPath: string,
    verbose: any,
) {
    // Ensure kubeconfig path is a file, not a directory
    if (fs.existsSync(kubeconfigPath)) {
        const stats = fs.statSync(kubeconfigPath);
        if (stats.isDirectory()) {
            console.log("Removing existing kubeconfig directory...");
            fs.rmSync(kubeconfigPath, { recursive: true, force: true });
        }
    }

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

    // Verify the kubeconfig was created as a file
    if (
        !fs.existsSync(kubeconfigPath) ||
        fs.statSync(kubeconfigPath).isDirectory()
    ) {
        throw new Error(
            `Failed to create kubeconfig file at ${kubeconfigPath}`,
        );
    }

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
            server: `https://k3d-${clusterName}-serverlb:6443`,
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

    // Remove any existing in-cluster entries
    config.clusters = config.clusters.filter((c: any) =>
        c.name !== inClusterName
    );
    config.contexts = config.contexts.filter((c: any) =>
        c.name !== inClusterName
    );

    // Add the new cluster and context
    config.clusters.push(inCluster);
    config.contexts.push(inContext);

    // Write the updated kubeconfig
    fs.writeFileSync(kubeconfigPath, yaml.stringify(config));

    // Final verification
    if (
        !fs.existsSync(kubeconfigPath) ||
        fs.statSync(kubeconfigPath).isDirectory()
    ) {
        throw new Error(`Failed to write kubeconfig file at ${kubeconfigPath}`);
    }
}
