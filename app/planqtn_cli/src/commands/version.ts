import { execSync } from "child_process";
import { readFileSync } from "fs";
import { getCfgDefinitionsDir, kernelMode } from "../config";
import * as path from "path";
import { Command } from "commander";

export function setupVersionCommand(program: Command) {
  let version = "";
  if (!kernelMode.isDev) {
    version = readFileSync(path.join(getCfgDefinitionsDir(), "version.txt"))
      .toString()
      .trim();
  } else {
    const packageVersion = JSON.parse(
      readFileSync(path.join(__dirname, "..", "..", "package.json")).toString()
    ).version;
    const git_version = execSync(
      path.join(__dirname, "..", "..", "..", "..", "hack", "image_tag")
    )
      .toString()
      .trim();
    version = `${packageVersion} at git tag ${git_version}`;
  }
  program.command("htn").description("CLI tool for PlanqTN").version(version);

  program
    .command("version")
    .description("Show the version of the CLI")
    .action(() => {
      console.log(version);
    });
}
