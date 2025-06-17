import * as path from "path";
import { ensureEmptyDir, runCommand } from "./utils";
import { PLANQTN_BIN_DIR, planqtnDir } from "./config";
import * as fs from "fs";

export async function k3d(
  args: string[],
  options: { verbose: boolean; returnOutput?: boolean }
) {
  ensureEmptyDir(PLANQTN_BIN_DIR);
  const k3dPath = path.join(PLANQTN_BIN_DIR, "k3d");

  if (!fs.existsSync(k3dPath)) {
    const installScriptPath = path.join(planqtnDir, "install-k3d.sh");
    await runCommand(
      "curl",
      [
        "-s",
        "https://raw.githubusercontent.com/k3d-io/k3d/main/install.sh",
        "-o",
        installScriptPath
      ],
      { verbose: options.verbose }
    );

    // Step 10: Make k3d executable and install
    fs.chmodSync(installScriptPath, 0o755);
    await runCommand("bash", [installScriptPath, "--no-sudo"], {
      verbose: options.verbose,
      env: {
        ...process.env,
        K3D_INSTALL_DIR: PLANQTN_BIN_DIR,
        USE_SUDO: "false",
        // hack for k3d install script to not complain about the binary not on path
        PATH: `${process.env.PATH}:${planqtnDir}`
      }
    });

    // Step 11: Verify k3d installation
    if (!fs.existsSync(k3dPath)) {
      throw new Error("k3d installation failed - binary not found");
    }
    fs.chmodSync(k3dPath, 0o755);
    fs.unlinkSync(installScriptPath);
  }
  return runCommand(k3dPath, args, {
    verbose: options.verbose,
    returnOutput: options.returnOutput
  });
}
