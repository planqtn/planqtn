import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { ensureEmptyDir } from "./utils";

export const isDev = !fs.existsSync(path.join(__dirname, "cfg"));
// Get the directory where the config definitions are installed
export const getCfgDefinitionsDir = () => {
  // When running from npm package, __dirname points to the dist directory
  // When running in development, we need to go up one level
  return isDev ? path.join(__dirname, "..", "..") : path.join(__dirname, "cfg");
};

export const postfix = isDev ? "-dev" : "-local";
export const planqtnDir = path.join(os.homedir(), ".planqtn");

ensureEmptyDir(planqtnDir);

export const cfgDir = isDev ? getCfgDefinitionsDir() : path.join(planqtnDir);
