import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { spawn } from "child_process";
import { copyDir, ensureEmptyDir, runCommand, updateEnvFile } from "../utils";
import { cfgDir, getCfgDefinitionsDir, isDev } from "../config";
import { k3d } from "../k3d";
import * as yaml from "yaml";
import { Cluster, Context } from "@kubernetes/client-node";
import { Command } from "commander";
import { postfix, planqtnDir } from "../config";
import { Client } from "pg";
import { buildAndPushImagesAndUpdateEnvFiles, getImageFromEnv } from "./images";

const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const RESET = "\x1b[0m";

function green(str: string): string {
  return GREEN + str + RESET;
}

function red(str: string): string {
  return RED + str + RESET;
}

export function setupKernelCommand(program: Command) {
  const kernelCommand = program.command("kernel");

  const startCommand = kernelCommand
    .command("start")
    .description("Start the local PlanqTN kernel")
    .option("--verbose", "Show detailed output");

  if (isDev) {
    startCommand.option(
      "--tag <tag>",
      "Tag to use for the images (dev mode only)"
    );
    startCommand.option(
      "--repo <repo>",
      "Docker repository to use for the images (dev mode only), default planqtn",
      "planqtn"
    );
  }
  startCommand.action(
    async (options: { verbose: boolean; tag?: string; repo: string }) => {
      try {
        // Step 1: Check Docker installation
        console.log("Checking Docker installation...");
        await runCommand("docker", ["--version"], {
          verbose: options.verbose
        });

        const supabaseDir = isDev
          ? path.join(getCfgDefinitionsDir(), "supabase")
          : path.join(planqtnDir, "supabase");

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
            path.join(getCfgDefinitionsDir(), "supabase", "config.toml.local"),
            path.join(supabaseDir, "config.toml")
          );

          fs.copyFileSync(
            path.join(getCfgDefinitionsDir(), "planqtn_api", "compose.yml"),
            path.join(apiDir, "compose.yml")
          );

          fs.copyFileSync(
            path.join(getCfgDefinitionsDir(), "planqtn_api", ".env.local"),
            path.join(apiDir, ".env")
          );

          // Stop edge runtime before recreating functions directory
          console.log("Stopping edge runtime container...");
          try {
            await runCommand(
              "docker",
              ["stop", `supabase_edge_runtime_planqtn${postfix}`],
              {
                verbose: options.verbose
              }
            );
          } catch {
            // Ignore error if container doesn't exist
          }

          // Always recreate functions directory to ensure updates
          ensureEmptyDir(path.join(supabaseDir, "functions"));

          // Copy directories
          await copyDir(
            path.join(getCfgDefinitionsDir(), "supabase", "functions"),
            path.join(supabaseDir, "functions"),
            { verbose: options.verbose }
          );

          fs.copyFileSync(
            path.join(
              getCfgDefinitionsDir(),
              "supabase",
              "functions",
              ".env.local"
            ),
            path.join(supabaseDir, "functions", ".env")
          );

          // Step 4: Copy k8s config
          await copyDir(path.join(getCfgDefinitionsDir(), "k8s"), k8sDir, {
            verbose: options.verbose
          });

          await copyDir(
            path.join(getCfgDefinitionsDir(), "migrations"),
            migrationsDir,
            { verbose: options.verbose }
          );
        } else {
          console.log(
            "Running in dev mode, skipping directory/config setup, using existing files in repo"
          );

          if (options.tag) {
            console.log("Using tag:", options.tag, "and repo:", options.repo);
            await buildAndPushImagesAndUpdateEnvFiles(
              false,
              options.repo,
              "https://localhost:54321",
              "placeholder",
              "dev-local",
              true,
              options.tag
            );
          }

          const jobImage = await getImageFromEnv("job");
          const apiImage = await getImageFromEnv("api");

          console.log("Job image:", jobImage || "missing");
          console.log("API image:", apiImage || "missing");

          if (!jobImage || !apiImage) {
            throw new Error(
              "Some images are missing, please build them first. Run 'hack/htn images <job/api> --build or run this command with --tag <tag> --repo <repo> to deploy from an existing image on DockerHub'."
            );
          }

          await updateEnvFile(
            path.join(supabaseDir, "functions", ".env"),
            "K8S_TYPE",
            "local-dev"
          );

          await updateEnvFile(
            path.join(supabaseDir, "functions", ".env"),
            "API_URL",
            "http://planqtn-api:5005"
          );

        }

        // Step 5: Check Supabase status and start if needed
        console.log("Checking Supabase status...");
        let supabaseRunning = false;
        try {
          const supabaseStatus = (await runCommand(
            "npx",
            ["supabase", "status", "-o", "json"],
            {
              cwd: supabaseDir,
              verbose: options.verbose,
              returnOutput: true
            }
          )) as string;

          try {
            const status = JSON.parse(supabaseStatus);
            supabaseRunning =
              "API_URL" in status && "SERVICE_ROLE_KEY" in status;
          } catch {
            // If we can't parse the status, assume it's not running
            supabaseRunning = false;
          }
        } catch {
          // If status check fails, assume it's not running
          supabaseRunning = false;
        }

        if (!supabaseRunning) {
          console.log("Starting Supabase in working directory:", cfgDir);
          await runCommand("npx", ["supabase", "start", "--workdir", cfgDir], {
            verbose: options.verbose
          });
        } else {
          console.log("Supabase is already running, starting edge runtime...");
          try {
            await runCommand(
              "docker",
              ["start", `supabase_edge_runtime_planqtn${postfix}`],
              {
                verbose: options.verbose
              }
            );
          } catch {
            console.log(
              "Edge runtime container not found, Supabase will create it"
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
                type: "module",
                private: true
              },
              null,
              2
            )
          );
        }

        // Run database migrations
        console.log("Running database migrations...");
        await runCommand("npx", ["node-pg-migrate", "up"], {
          verbose: options.verbose,
          cwd: isDev ? getCfgDefinitionsDir() : planqtnDir,
          env: {
            ...process.env,
            DATABASE_URL:
              "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
          }
        });
        // Run migrations for local kernel - this is, similar to no-verify-jwt, a loosening of security for local kernel
        if (!isDev) {
          const client = new Client({
            connectionString:
              "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
          });
          await client.connect();
          await client.query(
            "ALTER TABLE task_updates DISABLE ROW LEVEL SECURITY"
          );
          await client.end();
        }

        // Step 8: Check Docker network
        console.log("Checking Docker network...");
        await runCommand(
          "docker",
          ["network", "inspect", `supabase_network_planqtn${postfix}`],
          { verbose: options.verbose }
        );

        // Step 9: Install k3d

        // Step 12: Setup k3d cluster
        console.log("Setting up k3d cluster...");
        const clusterName = `planqtn${postfix}`;
        const kubeconfigPath = path.join(
          planqtnDir,
          `kubeconfig${postfix}.yaml`
        );

        try {
          const clusterStatus = (await k3d(["cluster", "get", clusterName], {
            verbose: options.verbose,
            returnOutput: true
          })) as string;

          // Check if servers are running (0/1 means not running)
          if (clusterStatus.includes("0/1")) {
            console.log("Starting k3d cluster...");
            await k3d(["cluster", "start", clusterName], {
              verbose: options.verbose
            });
          }
        } catch {
          // Cluster doesn't exist, create it
          await k3d(
            [
              "cluster",
              "create",
              clusterName,
              `--network=supabase_network_planqtn${postfix}`,
              "--kubeconfig-update-default=false"
            ],
            { verbose: options.verbose }
          );
        }

        if (isDev && !options.tag) {
          // load jobs image into k3d
          const jobImage = (await getImageFromEnv("job"))!;
          await k3d(["image", "import", jobImage, "-c", clusterName], {
            verbose: options.verbose
          });
        }

        await createKubeconfig(clusterName, kubeconfigPath, options.verbose);

        // Step 13: Setup k8sproxy
        console.log("Setting up k8sproxy...");
        try {
          await runCommand("docker", ["inspect", `k8sproxy${postfix}`], {
            verbose: options.verbose
          });
        } catch {
          // Container doesn't exist, create it
          await createProxy(
            kubeconfigPath,
            options.verbose,
            clusterName,
            postfix
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
            `k8sproxy${postfix}:8001/version`
          ],
          { verbose: options.verbose }
        );

        // Step 15: Setup job-monitor-rbac
        console.log("Setting up job-monitor-rbac...");
        await createRbac(
          kubeconfigPath,
          options.verbose,
          clusterName,
          path.join(cfgDir, "k8s", "job-monitor-rbac.yaml"),
          postfix
        );
        // Step 16: Setup API service
        console.log("Setting up API service...");
        const apiComposePath = path.join(cfgDir, "planqtn_api", "compose.yml");
        await runCommand(
          "docker",
          [
            "compose",
            "--env-file",
            path.join(cfgDir, "planqtn_api", ".env"),
            "-f",
            apiComposePath,
            "up",
            "-d"
          ],
          {
            verbose: options.verbose,
            env: {
              ...process.env,
              POSTFIX: postfix
            }
          }
        );

        console.log("PlanqTN kernel setup completed successfully!");
      } catch (err) {
        console.error(
          "Error:",
          err instanceof Error ? err.message : String(err)
        );
        process.exit(1);
      }
    }
  );

  kernelCommand
    .command("stop")
    .description("Stop the local PlanqTN kernel")
    .option("--verbose", "Show detailed output")
    .action(async (options: { verbose: boolean }) => {
      try {
        // Check if Supabase is running
        const postfix = isDev ? "-dev" : "-local";
        const planqtnDir = path.join(os.homedir(), ".planqtn");

        const cfgDir = isDev ? getCfgDefinitionsDir() : path.join(planqtnDir);

        const supabaseDir = isDev
          ? path.join(getCfgDefinitionsDir(), "supabase")
          : path.join(planqtnDir, "supabase");

        let supabaseRunning = false;
        try {
          const supabaseStatus = (await runCommand(
            "npx",
            ["supabase", "status", "-o", "json"],
            {
              cwd: supabaseDir,
              verbose: options.verbose,
              returnOutput: true
            }
          )) as string;

          try {
            const status = JSON.parse(supabaseStatus);
            supabaseRunning = "API_URL" in status;
          } catch {
            supabaseRunning = false;
          }
        } catch {
          supabaseRunning = false;
        }

        if (supabaseRunning) {
          console.log("Stopping Supabase...");
          await runCommand("npx", ["supabase", "stop"], {
            cwd: supabaseDir,
            verbose: options.verbose
          });
        }

        // Stop k8sproxy if it exists
        console.log("Stopping k8sproxy...");
        try {
          await runCommand("docker", ["stop", `k8sproxy${postfix}`], {
            verbose: options.verbose
          });
        } catch {
          // Ignore error if container doesn't exist
        }

        // Stop k3d cluster
        console.log("Stopping k3d cluster...");
        try {
          await k3d(["cluster", "stop", `planqtn${postfix}`], {
            verbose: options.verbose
          });
        } catch {
          // Ignore error if cluster doesn't exist
        }

        console.log("Stopping PlanqTN API...");
        try {
          const apiComposePath = path.join(
            cfgDir,
            "planqtn_api",
            "compose.yml"
          );
          await runCommand(
            "docker",
            [
              "compose",
              "--env-file",
              path.join(cfgDir, "planqtn_api", ".env"),
              "-f",
              apiComposePath,
              "down"
            ],
            {
              verbose: options.verbose,
              env: {
                ...process.env,
                POSTFIX: postfix
              }
            }
          );
        } catch {
          // Ignore error if container doesn't exist
        }

        console.log("PlanqTN kernel stopped successfully!");
      } catch (err) {
        console.error(
          "Error:",
          err instanceof Error ? err.message : String(err)
        );
        process.exit(1);
      }
    });

  kernelCommand
    .command("remove")
    .description("Delete everything related to the local PlanqTN kernel")
    .option("--verbose", "Show detailed output")
    .action(async (options: { verbose: boolean }) => {
      try {
        // First stop everything

        const postfix = isDev ? "-dev" : "-local";
        const planqtnDir = path.join(os.homedir(), ".planqtn");

        const cfgDir = isDev ? getCfgDefinitionsDir() : path.join(planqtnDir);

        console.log("Stopping all components...");

        if (fs.existsSync(path.join(os.homedir(), ".planqtn", "supabase"))) {
          const supabaseDir = path.join(os.homedir(), ".planqtn", "supabase");
          let supabaseRunning = false;
          try {
            const supabaseStatus = (await runCommand(
              "npx",
              ["supabase", "status", "-o", "json"],
              {
                cwd: supabaseDir,
                verbose: options.verbose,
                returnOutput: true
              }
            )) as string;

            try {
              const status = JSON.parse(supabaseStatus);
              supabaseRunning = "API_URL" in status;
            } catch {
              supabaseRunning = false;
            }
          } catch {
            supabaseRunning = false;
          }

          if (supabaseRunning) {
            console.log("Stopping Supabase...");
            await runCommand("npx", ["supabase", "stop"], {
              cwd: supabaseDir,
              verbose: options.verbose
            });
          }
        }

        // Stop k8sproxy if it exists
        console.log("Stopping k8sproxy...");
        try {
          await runCommand("docker", ["stop", `k8sproxy${postfix}`], {
            verbose: options.verbose
          });
        } catch {
          // Ignore error if container doesn't exist
        }

        console.log("Stopping PlanqTN API...");
        try {
          const apiComposePath = path.join(
            cfgDir,
            "planqtn_api",
            "compose.yml"
          );
          await runCommand(
            "docker",
            [
              "compose",
              "--env-file",
              path.join(cfgDir, "planqtn_api", ".env"),
              "-f",
              apiComposePath,
              "down"
            ],
            {
              verbose: options.verbose,
              env: {
                ...process.env,
                POSTFIX: postfix
              }
            }
          );
        } catch {
          // Ignore error if container doesn't exist
        }

        // Stop and delete k3d cluster
        console.log("Stopping and deleting k3d cluster...");
        try {
          await k3d(["cluster", "delete", `planqtn${postfix}`], {
            verbose: options.verbose
          });
        } catch {
          // Ignore error if cluster doesn't exist
        }

        console.log("Force removing supabase containers...");
        const containers = await runCommand(
          "docker",
          [
            "ps",
            "-a",
            "-q",
            "--filter",
            `label=com.supabase.cli.project=planqtn${postfix}`
          ],
          {
            verbose: options.verbose,
            returnOutput: true
          }
        );
        if (containers) {
          for (const container of containers.trim().split("\n")) {
            await runCommand("docker", ["rm", "-f", container], {
              verbose: options.verbose
            });
          }
        }

        // Delete Supabase volumes
        console.log("Deleting Supabase volumes...");
        try {
          const volumes = await new Promise<string>((resolve, reject) => {
            const proc = spawn(
              "docker",
              [
                "volume",
                "ls",
                "--filter",
                `label=com.supabase.cli.project=planqtn${postfix}`,
                "-q"
              ],
              {
                shell: true,
                stdio: ["pipe", "pipe", options.verbose ? "inherit" : "pipe"]
              }
            );

            let output = "";
            proc.stdout?.on("data", (data) => {
              output += data.toString();
            });

            proc.on("close", (code) => {
              if (code === 0) {
                resolve(output);
              } else {
                reject(new Error(`Command failed with exit code ${code}`));
              }
            });
          });

          if (volumes.trim()) {
            await runCommand(
              "docker",
              ["volume", "rm", ...volumes.trim().split("\n")],
              {
                verbose: options.verbose
              }
            );
          }
        } catch (err) {
          // Ignore error if no volumes exist
          console.log(
            "volume error:",
            err instanceof Error ? err.message : String(err)
          );
        }

        // remove network
        console.log("Removing network...");
        try {
          await runCommand(
            "docker",
            ["network", "rm", `supabase_network_planqtn${postfix}`],
            {
              verbose: options.verbose
            }
          );
        } catch {
          // Ignore error if network doesn't exist
        }

        console.log("PlanqTN kernel removed successfully!");
      } catch (err) {
        console.error(
          "Error:",
          err instanceof Error ? err.message : String(err)
        );
        process.exit(1);
      }
    });

  kernelCommand
    .command("monitor")
    .description("Monitor the local PlanqTN kernel")
    .option("--verbose", "Show detailed output")
    .action(async (options: { verbose: boolean }) => {
      try {
        const postfix = isDev ? "-dev" : "-local";
        const planqtnDir = path.join(os.homedir(), ".planqtn");
        const kubeconfigPath = path.join(
          planqtnDir,
          `kubeconfig${postfix}.yaml`
        );
        const clusterName = `planqtn${postfix}`;

        // Verify kubeconfig exists
        if (!fs.existsSync(kubeconfigPath)) {
          throw new Error(
            `Kubeconfig not found at ${kubeconfigPath}. Please run 'htn kernel start' first.`
          );
        }

        console.log("Starting k9s monitor...");
        await runCommand(
          "docker",
          [
            "run",
            "--rm",
            "--network",
            `supabase_network_planqtn${postfix}`,
            "-it",
            "-v",
            `${kubeconfigPath}:/root/.kube/config`,
            "quay.io/derailed/k9s",
            "--context",
            `${clusterName}-in-cluster`
          ],
          {
            verbose: options.verbose,
            tty: true
          }
        );
      } catch (err) {
        console.error(
          "Error:",
          err instanceof Error ? err.message : String(err)
        );
        process.exit(1);
      }
    });

  kernelCommand
    .command("status")
    .description("Check status of all PlanqTN kernel components")
    .option("--verbose", "Show detailed output")
    .action(async (options: { verbose: boolean }) => {
      try {
        const postfix = isDev ? "-dev" : "-local";
        const planqtnDir = path.join(os.homedir(), ".planqtn");
        const cfgDir = isDev ? getCfgDefinitionsDir() : path.join(planqtnDir);
        const supabaseDir = isDev
          ? path.join(getCfgDefinitionsDir(), "supabase")
          : path.join(planqtnDir, "supabase");

        let supabaseStatus = "Not running";
        let apiUrl = "";
        let anonKey = "";
        try {
          const status = JSON.parse(
            (await runCommand("npx", ["supabase", "status", "-o", "json"], {
              cwd: supabaseDir,
              verbose: options.verbose,
              returnOutput: true
            })) as string
          );
          if ("API_URL" in status && "ANON_KEY" in status) {
            supabaseStatus = "Running";
            apiUrl = status.API_URL;
            anonKey = status.ANON_KEY;
          }
        } catch {
          // Supabase not running
        }
        console.log(
          `Supabase: ${
            supabaseStatus === "Running"
              ? green(supabaseStatus)
              : red(supabaseStatus)
          }`
        );

        // Check k3d cluster
        let k3dStatus = "Not running";
        try {
          const clusterStatus = (await k3d(
            ["cluster", "get", `planqtn${postfix}`],
            {
              verbose: options.verbose,
              returnOutput: true
            }
          )) as string;
          if (clusterStatus.includes("1/1")) {
            k3dStatus = "Running";
          }
        } catch (err) {
          if (options.verbose) {
            console.log("k3d cluster not running");
            console.log(err);
          }
        }
        console.log(
          `k3d cluster: ${
            k3dStatus === "Running" ? green(k3dStatus) : red(k3dStatus)
          }`
        );

        // Check k8sproxy

        let proxyStatus = "Not running";
        try {
          await runCommand("docker", ["inspect", `k8sproxy${postfix}`], {
            verbose: options.verbose
          });
          proxyStatus = "Running";
        } catch {
          // Proxy not running
        }
        console.log(
          `k8sproxy: ${
            proxyStatus === "Running" ? green(proxyStatus) : red(proxyStatus)
          }`
        );

        // Check API service
        let apiStatus = "Not running";
        try {
          const apiComposePath = path.join(
            cfgDir,
            "planqtn_api",
            "compose.yml"
          );
          const result = await runCommand(
            "docker",
            [
              "compose",
              "--env-file",
              path.join(cfgDir, "planqtn_api", ".env"),
              "-f",
              apiComposePath,
              "ps",
              "--format",
              "json"
            ],
            {
              verbose: options.verbose,
              returnOutput: true,
              env: {
                ...process.env,
                POSTFIX: postfix
              }
            }
          );
          if (options.verbose) {
            console.log(result);
          }

          apiStatus = result ? "Running" : "Not running";
        } catch {
          // API not running
        }
        console.log(
          `API service: ${
            apiStatus === "Running" ? green(apiStatus) : red(apiStatus)
          }`
        );

        // Print connection details if Supabase is running
        if (supabaseStatus === "Running") {
          console.log("\nConnection details:");
          console.log(
            JSON.stringify({ API_URL: apiUrl, ANON_KEY: anonKey }, null, 2)
          );
        }
      } catch (err) {
        console.error(
          "Error:",
          err instanceof Error ? err.message : String(err)
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

async function createRbac(
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

async function createProxy(
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

async function createKubeconfig(
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
