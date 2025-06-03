import { spawn } from "child_process";
import * as fs from "fs";

interface RunCommandOptions {
    verbose?: boolean;
    cwd?: string;
    env?: NodeJS.ProcessEnv;
}

export async function runCommand(
    command: string,
    args: string[],
    options: RunCommandOptions = {},
): Promise<void> {
    return new Promise((resolve, reject) => {
        const fullCommand = `${command} ${args.join(" ")}`;
        if (options.verbose) {
            console.log(`\nExecuting: ${fullCommand}`);
            if (options.cwd) {
                console.log(`Working directory: ${options.cwd}`);
            }
            if (options.env) {
                console.log("Environment variables:");
                Object.entries(options.env).forEach(([key, value]) => {
                    console.log(`  ${key}=${value}`);
                });
            }
        }

        const proc = spawn(command, args, {
            shell: true,
            cwd: options.cwd,
            env: options.env,
            stdio: [
                "pipe",
                options.verbose ? "inherit" : "pipe",
                options.verbose ? "inherit" : "pipe",
            ],
        });

        if (!options.verbose) {
            proc.stdout?.on("data", (data) => {
                if (data.toString().trim()) {
                    console.log(data.toString().trim());
                }
            });
            proc.stderr?.on("data", (data) => {
                if (data.toString().trim()) {
                    console.error(data.toString().trim());
                }
            });
        }

        proc.on("close", (code) => {
            if (code === 0) {
                if (options.verbose) {
                    console.log(
                        `\nCommand completed successfully: ${fullCommand}`,
                    );
                }
                resolve();
            } else {
                const error = new Error(
                    `Command failed with exit code ${code}: ${fullCommand}`,
                );
                if (options.verbose) {
                    console.error(`\n${error.message}`);
                }
                reject(error);
            }
        });
    });
}

export async function copyDir(
    src: string,
    dest: string,
    options: { verbose?: boolean } = {},
): Promise<void> {
    return new Promise((resolve, reject) => {
        const fullCommand = `rsync -av ${src}/ ${dest}/`;
        if (options.verbose) {
            console.log(`\nExecuting: ${fullCommand}`);
        }

        const proc = spawn("rsync", ["-av", src + "/", dest + "/"], {
            shell: true,
            stdio: [
                "pipe",
                options.verbose ? "inherit" : "pipe",
                options.verbose ? "inherit" : "pipe",
            ],
        });

        if (!options.verbose) {
            proc.stdout?.on("data", (data) => {
                if (data.toString().trim()) {
                    console.log(data.toString().trim());
                }
            });
            proc.stderr?.on("data", (data) => {
                if (data.toString().trim()) {
                    console.error(data.toString().trim());
                }
            });
        }

        proc.on("close", (code) => {
            if (code === 0) {
                if (options.verbose) {
                    console.log(
                        `\nCommand completed successfully: ${fullCommand}`,
                    );
                }
                resolve();
            } else {
                const error = new Error(
                    `rsync failed with exit code ${code}: ${fullCommand}`,
                );
                if (options.verbose) {
                    console.error(`\n${error.message}`);
                }
                reject(error);
            }
        });
    });
}

export function ensureEmptyDir(dir: string): void {
    if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
    }
    fs.mkdirSync(dir, { recursive: true });
}
