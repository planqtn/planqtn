import * as fs from "fs";
import * as path from "path";

// Get the directory where the CLI is installed
export const getCliRootDir = () => {
    // When running from npm package, __dirname points to the dist directory
    // When running in development, we need to go up one level
    const isDev = !fs.existsSync(path.join(__dirname, "cfg"));
    return isDev ? path.join(__dirname, "..") : path.join(__dirname, "cfg");
};
