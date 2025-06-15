import { spawn } from "child_process";
import * as fs from "fs";

interface RunCommandOptions {
  verbose?: boolean;
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  returnOutput?: boolean;
  tty?: boolean;
  is_background?: boolean;
}


export async function getGitTag(): Promise<string> {
  // First try to get the tag for the current commit
  try {
    const tag = (await runCommand(
      "git",
      ["describe", "--exact-match", "--tags", "HEAD"],
      { returnOutput: true }
    )) as string;

    if (tag.trim()) {
      return tag.trim();
    }
  } catch {
    // If git describe fails, fall back to commit hash
  }

  // If no tag exists, fall back to commit hash
  const commitHash = (await runCommand(
    "git",
    ["rev-parse", "--short", "HEAD"],
    { returnOutput: true }
  )) as string;
  const status = (await runCommand("git", ["status", "-s"], {
    returnOutput: true
  })) as string;
  return status.trim() ? `${commitHash.trim()}-dirty` : commitHash.trim();
}


export async function runCommand(
  command: string,
  args: string[],
  options: RunCommandOptions = {}
): Promise<string | void> {
  return new Promise((resolve, reject) => {
    const fullCommand = `${command} ${args.join(" ")}`;
    if (options.verbose) {
      console.log(`\nExecuting: ${fullCommand}`);
      if (options.cwd) {
        console.log(`Working directory: ${options.cwd}`);
      }
      // if (options.env) {
      //     console.log("Environment variables:");
      //     Object.entries(options.env).forEach(([key, value]) => {
      //         console.log(`  ${key}=${value}`);
      //     });
      // }
    }

    const proc = spawn(command, args, {
      shell: true,

      cwd: options.cwd,
      env: options.env,
      stdio: options.tty
        ? "inherit"
        : [
            "pipe",
            options.verbose && !options.returnOutput ? "inherit" : "pipe",
            options.verbose && !options.returnOutput ? "inherit" : "pipe"
          ],
      detached: options.is_background
    });

    if (options.is_background) {
      proc.unref();
      resolve();
      return;
    }

    let output = "";
    let errorOutput = "";

    if (!options.tty && (!options.verbose || options.returnOutput)) {
      proc.stdout?.on("data", (data) => {
        const dataStr = data.toString();
        output += dataStr;
        if (!options.returnOutput && dataStr.trim()) {
          console.log(dataStr.trim());
        }
      });
      proc.stderr?.on("data", (data) => {
        const dataStr = data.toString();
        errorOutput += dataStr;
        if (!options.returnOutput && dataStr.trim()) {
          console.error(dataStr.trim());
        }
      });
    }

    proc.on("close", (code) => {
      if (code === 0) {
        if (options.verbose) {
          console.log(`\nCommand completed successfully: ${fullCommand}`);
        }
        if (options.returnOutput) {
          resolve(output);
        } else {
          resolve();
        }
      } else {
        const error = new Error(
          `Command failed with exit code ${code}: ${fullCommand}`
        );
        if (options.verbose) {
          console.error(`\n${error.message}`);
        }
        if (options.returnOutput) {
          reject(
            new Error(
              `${error.message}\nOutput: ${output}\nError: ${errorOutput}`
            )
          );
        } else {
          reject(error);
        }
      }
    });
  });
}

export async function copyDir(
  src: string,
  dest: string,
  options: { verbose?: boolean } = {}
): Promise<void> {
  return new Promise((resolve, reject) => {
    const fullCommand = `rsync -av --delete ${src}/ ${dest}/`;
    if (options.verbose) {
      console.log(`\nExecuting: ${fullCommand}`);
    }

    const proc = spawn("rsync", ["-av", "--delete", src + "/", dest + "/"], {
      shell: true,
      stdio: [
        "pipe",
        options.verbose ? "inherit" : "pipe",
        options.verbose ? "inherit" : "pipe"
      ]
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
          console.log(`\nCommand completed successfully: ${fullCommand}`);
        }
        resolve();
      } else {
        const error = new Error(
          `rsync failed with exit code ${code}: ${fullCommand}`
        );
        if (options.verbose) {
          console.error(`\n${error.message}`);
        }
        reject(error);
      }
    });
  });
}

export function ensureEmptyDir(
  dir: string,
  forceRecreate: boolean = false
): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  } else if (forceRecreate) {
    // Only remove and recreate if explicitly requested
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
  }
}
