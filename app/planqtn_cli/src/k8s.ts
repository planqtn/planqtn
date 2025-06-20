import { spawn } from "child_process";
import { runCommand } from "./utils";
import * as fs from "fs";
import * as yaml from "yaml";
import { Cluster, Context } from "@kubernetes/client-node";
import { k3d } from "./k3d";

export async function kubectl(
  containerName: string,
  dockerArgs: string[],
  kubeCtlArgs: string[],
  kubeconfigPath: string,
  verbose: boolean,
  clusterName: string,
  postfix: string
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
      `${clusterName}-in-cluster`
    ],
    { verbose }
  );
}

export async function createRbac(
  kubeconfigPath: string,
  verbose: boolean,
  clusterName: string,
  rbacPath: string,
  postfix: string
): Promise<void> {
  return await kubectl(
    `create-rbac${postfix}`,
    ["-v", `${rbacPath}:/.kube/rbac.yaml`],
    ["apply", "-f", "/.kube/rbac.yaml"],
    kubeconfigPath,
    verbose,
    clusterName,
    postfix
  );
}

export async function createProxy(
  kubeconfigPath: string,
  verbose: boolean,
  clusterName: string,
  postfix: string
): Promise<void> {
  return await kubectl(
    `k8sproxy${postfix}`,
    [],
    ["proxy", "--accept-hosts", "'.*'", "--address=0.0.0.0"],
    kubeconfigPath,
    verbose,
    clusterName,
    postfix
  );
}

export async function createKubeconfig(
  clusterName: string,
  kubeconfigPath: string,
  verbose: boolean
) {
  // Ensure kubeconfig path is a file, not a directory
  if (fs.existsSync(kubeconfigPath)) {
    const stats = fs.statSync(kubeconfigPath);
    if (stats.isDirectory()) {
      console.log("Removing existing kubeconfig directory...");
      fs.rmSync(kubeconfigPath, { recursive: true, force: true });
    }
  }

  await k3d(["kubeconfig", "write", clusterName, "--output", kubeconfigPath], {
    verbose: verbose
  });

  // Verify the kubeconfig was created as a file
  if (
    !fs.existsSync(kubeconfigPath) ||
    fs.statSync(kubeconfigPath).isDirectory()
  ) {
    throw new Error(`Failed to create kubeconfig file at ${kubeconfigPath}`);
  }

  // Read the generated kubeconfig
  const kubeconfig = fs.readFileSync(kubeconfigPath, "utf8");
  const config = yaml.parse(kubeconfig);

  // Create a new cluster entry for in-cluster access
  const inClusterName = `${clusterName}-in-cluster`;
  const originalCluster = config.clusters[0];
  const inCluster = {
    ...originalCluster,
    name: inClusterName,
    cluster: {
      ...originalCluster.cluster,
      server: `https://k3d-${clusterName}-serverlb:6443`
    }
  };

  const originalContext = config.contexts[0];

  // Create a new context for in-cluster access
  const inContext = {
    name: inClusterName,
    context: {
      cluster: inClusterName,
      user: originalContext.context.user
    }
  };

  // Remove any existing in-cluster entries
  config.clusters = config.clusters.filter(
    (c: Cluster) => c.name !== inClusterName
  );
  config.contexts = config.contexts.filter(
    (c: Context) => c.name !== inClusterName
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
