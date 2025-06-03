#!/usr/bin/env node

import { Command } from "commander";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { spawn } from "child_process";
import * as yaml from "js-yaml";

const program = new Command();

// Get the directory where the CLI is installed
const getCliRootDir = () => {
    // When running from npm package, __dirname points to the dist directory
    // When running in development, we need to go up one level
    const isDev = !fs.existsSync(path.join(__dirname, "config"));
    return isDev ? path.join(__dirname, "..") : path.join(__dirname, "config");
};

// Helper function to run commands with optional verbose output
const runCommand = async (
    command: string,
    args: string[],
    options: { cwd?: string; verbose?: boolean; env?: Record<string, string> } =
        {},
) => {
    return new Promise<void>((resolve, reject) => {
        const proc = spawn(command, args, {
            cwd: options.cwd,
            shell: true,
            stdio: options.verbose ? "inherit" : "pipe",
            env: { ...process.env, ...options.env },
        });

        if (!options.verbose) {
            proc.stdout?.on("data", (data) => {
                // Only log if there's actual output
                if (data.toString().trim()) {
                    console.log(data.toString().trim());
                }
            });
            proc.stderr?.on("data", (data) => {
                // Only log if there's actual output
                if (data.toString().trim()) {
                    console.error(data.toString().trim());
                }
            });
        }

        proc.on("close", (code) => {
            if (code === 0) {
                resolve();
            } else {
                reject(new Error(`Command failed with exit code ${code}`));
            }
        });
    });
};

// Helper function to copy directory using rsync
const copyDir = async (
    src: string,
    dest: string,
    options: { verbose?: boolean } = {},
) => {
    try {
        await runCommand("rsync", ["-av", "--delete", src + "/", dest + "/"], {
            verbose: options.verbose,
        });
    } catch (error: any) {
        throw new Error(
            `Failed to copy directory from ${src} to ${dest}: ${error.message}`,
        );
    }
};

// Helper function to ensure directory exists and is empty
const ensureEmptyDir = (dir: string) => {
    if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
    }
    fs.mkdirSync(dir, { recursive: true });
};

program
    .command("htn")
    .description("CLI tool for PlanqTN")
    .version("1.0.0");

const uiCommand = program.command("ui");

uiCommand
    .command("up")
    .description("Start the local PlanqTN UI")
    .action(async () => {
        console.log("Starting the local PlanqTN UI");
    });

uiCommand
    .command("stop")
    .description("Stop the local PlanqTN UI")
    .action(async () => {
        console.log("Stopping the local PlanqTN UI");
    });

const kernelCommand = program.command("kernel");

kernelCommand
    .command("up")
    .description("Start the local PlanqTN kernel")
    .option("--verbose", "Show detailed output")
    .action(async (options) => {
        try {
            // Check Docker installation and functionality
            console.log("Checking Docker installation...");
            await runCommand("docker", ["--version"], {
                verbose: options.verbose,
            });
            await runCommand("docker", ["run", "--rm", "hello-world"], {
                verbose: options.verbose,
            });

            // Create ~/.planqtn directory if it doesn't exist
            const planqtnDir = path.join(os.homedir(), ".planqtn");
            ensureEmptyDir(planqtnDir);

            // Copy supabase directory
            const supabaseDir = path.join(planqtnDir, "supabase");
            try {
                console.log("Setting up Supabase directory...");
                ensureEmptyDir(supabaseDir);

                // Copy config.toml
                fs.copyFileSync(
                    path.join(getCliRootDir(), "supabase", "config.toml.local"),
                    path.join(supabaseDir, "config.toml"),
                );

                ensureEmptyDir(path.join(supabaseDir, "functions"));

                // Copy .env.local to .env
                fs.copyFileSync(
                    path.join(
                        getCliRootDir(),
                        "supabase",
                        "functions",
                        ".env.local",
                    ),
                    path.join(supabaseDir, "functions", ".env"),
                );

                // Copy functions directory
                await copyDir(
                    path.join(getCliRootDir(), "supabase", "functions"),
                    path.join(supabaseDir, "functions"),
                    { verbose: options.verbose },
                );
            } catch (error: any) {
                // Cleanup on failure
                if (fs.existsSync(supabaseDir)) {
                    fs.rmSync(supabaseDir, { recursive: true, force: true });
                }
                throw error;
            }

            // Copy k8s directory
            const k8sDir = path.join(planqtnDir, "k8s");
            try {
                console.log("Setting up k8s directory...");
                ensureEmptyDir(k8sDir);
                await copyDir(
                    path.join(getCliRootDir(), "k8s"),
                    k8sDir,
                    { verbose: options.verbose },
                );
            } catch (error: any) {
                // Cleanup on failure
                if (fs.existsSync(k8sDir)) {
                    fs.rmSync(k8sDir, { recursive: true, force: true });
                }
                throw error;
            }

            // Install supabase CLI locally
            console.log("Installing Supabase CLI...");
            await runCommand("npm", [
                "install",
                "supabase",
                "--prefix",
                planqtnDir,
            ], { verbose: options.verbose });

            // Start supabase
            console.log("Starting Supabase...");
            await runCommand("npx", ["supabase", "start"], {
                cwd: supabaseDir,
                verbose: options.verbose,
            });

            // Check supabase status
            console.log("Checking Supabase status...");
            const statusOutput = await new Promise<string>(
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
                            // Only log if there's actual output
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
                JSON.parse(statusOutput);
            } catch (e) {
                throw new Error("Invalid Supabase status JSON output");
            }

            // Check docker network
            console.log("Checking Docker network...");
            try {
                await runCommand("docker", [
                    "network",
                    "inspect",
                    "supabase_network_planqtn-local",
                ], { verbose: options.verbose });
            } catch (e) {
                throw new Error(
                    "Docker network supabase_network_planqtn-local does not exist",
                );
            }

            // Download and install k3d
            console.log("Installing k3d...");
            const k3dPath = path.join(planqtnDir, "k3d");
            try {
                if (!fs.existsSync(k3dPath)) {
                    // Download the install script
                    const installScriptPath = path.join(
                        planqtnDir,
                        "install-k3d.sh",
                    );
                    await runCommand("curl", [
                        "-s",
                        "https://raw.githubusercontent.com/k3d-io/k3d/main/install.sh",
                        "-o",
                        installScriptPath,
                    ], { verbose: options.verbose });

                    // Make the script executable
                    fs.chmodSync(installScriptPath, 0o755);

                    // Run the install script with explicit bash
                    await runCommand("bash", [installScriptPath, "--no-sudo"], {
                        verbose: options.verbose,
                        env: {
                            ...process.env,
                            K3D_INSTALL_DIR: planqtnDir,
                            USE_SUDO: "false",
                        },
                    });

                    // Clean up the install script
                    fs.unlinkSync(installScriptPath);

                    // Verify k3d was installed
                    if (!fs.existsSync(k3dPath)) {
                        throw new Error(
                            "k3d installation failed - binary not found",
                        );
                    }

                    // Make k3d executable
                    fs.chmodSync(k3dPath, 0o755);
                }
            } catch (error: any) {
                // Cleanup on failure
                if (fs.existsSync(k3dPath)) {
                    fs.unlinkSync(k3dPath);
                }
                throw error;
            }

            const clusterName = "planqtn-local";

            // Create k3d cluster
            console.log("Creating k3d cluster...");
            const kubeconfigPath = path.join(planqtnDir, "kubeconfig.yaml");
            try {
                await runCommand(k3dPath, [
                    "cluster",
                    "create",
                    clusterName,
                    "--network=supabase_network_planqtn-local",
                    "--kubeconfig-update-default=false",
                ], { verbose: options.verbose });

                await runCommand(k3dPath, [
                    "kubeconfig",
                    "write",
                    clusterName,
                    "--output",
                    kubeconfigPath,
                ], { verbose: options.verbose });
            } catch (error: any) {
                // Cleanup on failure
                try {
                    await runCommand(k3dPath, [
                        "cluster",
                        "delete",
                        clusterName,
                    ], { verbose: options.verbose });
                } catch (e) {
                    // Ignore cleanup errors
                }
                if (fs.existsSync(kubeconfigPath)) {
                    fs.unlinkSync(kubeconfigPath);
                }
                throw error;
            }

            console.log("PlanqTN kernel setup completed successfully!");
        } catch (error: any) {
            console.error("Error:", error.message);
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

program.parse();
