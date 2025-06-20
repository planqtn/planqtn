import * as fs from "fs";
import * as path from "path";
import {
  copyDir,
  ensureEmptyDir,
  runCommand,
  updateEnvFile
} from "../../utils";
import {
  cfgDir,
  getCfgDefinitionsDir,
  kernelMode,
  isExecutedFromSource
} from "../../config";
import { k3d } from "../../k3d";
import { Command } from "commander";
import { postfix, planqtnDir } from "../../config";
import { Client } from "pg";
import {
  buildAndPushImagesAndUpdateEnvFiles,
  getImageFromEnv
} from "../images";
import { createKubeconfig, createProxy, createRbac } from "../../k8s";

export function setupKernelStartCommand(kernelCommand: Command) {
  const startCommand = kernelCommand
    .command("start")
    .description("Start the local PlanqTN kernel")
    .option("--verbose", "Show detailed output");

  if (isExecutedFromSource) {
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
    async (options: {
      verbose: boolean;
      tag?: string;
      repo: string;
      local?: boolean;
    }) => {
      try {
        // Step 1: Check Docker installation
        console.log("Checking Docker installation...");
        await runCommand("docker", ["--version"], {
          verbose: options.verbose
        });

        const supabaseDir = kernelMode.isDev
          ? path.join(getCfgDefinitionsDir(), "supabase")
          : path.join(planqtnDir, "supabase");

        if (!kernelMode.isDev) {
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

        if (!kernelMode.isDev) {
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
          cwd: kernelMode.isDev ? getCfgDefinitionsDir() : planqtnDir,
          env: {
            ...process.env,
            DATABASE_URL:
              "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
          }
        });
        // Run migrations for local kernel - this is, similar to no-verify-jwt, a loosening of security for local kernel
        if (!kernelMode.isDev) {
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

        if (kernelMode.isDev && !options.tag) {
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
}
