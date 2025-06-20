import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { ensureEmptyDir } from "./utils";

export const isExecutedFromSource = !fs.existsSync(path.join(__dirname, "cfg"));

class KernelMode {
  isDev: boolean = isExecutedFromSource;
}

export const kernelMode = new KernelMode();

// Get the directory where the config definitions are installed
export const getCfgDefinitionsDir = () => {
  // When running from npm package, __dirname points to the dist directory
  // When running in development, we need to go up one level
  return isExecutedFromSource
    ? path.join(__dirname, "..", "..")
    : path.join(__dirname, "cfg");
};

export const postfix = isExecutedFromSource ? "-dev" : "-local";
export const planqtnDir = path.join(os.homedir(), ".planqtn");

ensureEmptyDir(planqtnDir);

export const cfgDir = isExecutedFromSource
  ? getCfgDefinitionsDir()
  : path.join(planqtnDir);

export const PLANQTN_BIN_DIR = path.join(process.env.HOME!, ".planqtn", "bin");
