import { Command } from "commander";
import { runCommand } from "../utils";
import * as fs from "fs";
import * as path from "path";
import { isDev } from "../config";

async function getGitTag(): Promise<string> {
    const commitHash = await runCommand(
        "git",
        ["rev-parse", "--short", "HEAD"],
        { returnOutput: true },
    ) as string;
    const status = await runCommand("git", ["status", "-s"], {
        returnOutput: true,
    }) as string;
    return status.trim() ? `${commitHash.trim()}-dirty` : commitHash.trim();
}

async function checkK3dRunning(cluster: string): Promise<boolean> {
    try {
        await runCommand("~/.planqtn/k3d", [
            "cluster",
            "get",
            `planqtn-${cluster}`,
        ], {
            returnOutput: true,
        });
        return true;
    } catch {
        return false;
    }
}

async function checkSupabaseRunning(): Promise<boolean> {
    try {
        const result = await runCommand("docker", [
            "ps",
            "--filter",
            "name=supabase_edge_runtime_planqtn-dev",
            "--format",
            "{{.Names}}",
        ], { returnOutput: true }) as string;
        return result.trim() === "supabase_edge_runtime_planqtn-dev";
    } catch {
        return false;
    }
}

async function updateEnvFile(
    envPath: string,
    key: string,
    value: string,
): Promise<void> {
    let envContent = "";

    if (fs.existsSync(envPath)) {
        envContent = fs.readFileSync(envPath, "utf-8");
    }

    // Replace or add JOBS_IMAGE line
    const jobsImageLine = `${key}=${value}`;
    if (envContent.includes(`${key}=`)) {
        envContent = envContent.replace(
            new RegExp(`${key}=.*`, "g"),
            jobsImageLine,
        );
    } else {
        envContent += `\n${jobsImageLine}\n`;
    }

    fs.writeFileSync(envPath, envContent);
}

async function restartSupabase(): Promise<void> {
    console.log("Restarting Supabase...");

    const supabaseRunning = await checkSupabaseRunning();
    if (supabaseRunning) {
        await runCommand("npx", ["supabase", "stop"]);
    }

    await runCommand("npx", ["supabase", "start"]);

    console.log("Restarted Supabase.");
}

export function setupImagesCommand(program: Command): void {
    const imagesCommand = program.command("images")
        .description("Manage Docker images (dev mode only)")
        .argument("<image>", "Image to manage (job, api, ui)")
        .option("--build", "Build the image")
        .option("--load", "Load the image into k3d and update Supabase")
        .option(
            "--load-no-restart",
            "Load the image into k3d and update Supabase without restarting Supabase",
        )
        .option(
            "--k3d-cluster <cluster>",
            "K3d cluster to load the image into (dev or local)",
            "dev",
        )
        .option("--push", "Push the image to registry")
        .option("--deploy-monitor", "Deploy to Cloud Run monitor service")
        .option("--deploy-job", "Deploy to Cloud Run jobs service")
        .action(async (image) => {
            const options = imagesCommand.opts();
            console.log("image", image);
            console.log("options", options);
            // Check if we're in dev mode
            if (!isDev) {
                throw new Error("Images command is only supported in dev mode");
            }

            if (
                options.k3dCluster &&
                !["dev", "local"].includes(options.k3dCluster)
            ) {
                throw new Error(
                    "--k3d-cluster must be either 'dev' or 'local'",
                );
            }

            const tag = await getGitTag();
            let imageName = "";
            let dockerfile = "";

            switch (image) {
                case "job":
                    imageName = `planqtn/planqtn_jobs:${tag}`;
                    dockerfile = "../planqtn_jobs/Dockerfile";
                    break;
                case "api":
                    imageName = `planqtn/planqtn_api:${tag}`;
                    dockerfile = "../planqtn_api/Dockerfile";
                    break;
                case "ui":
                    throw new Error(
                        "UI image management not implemented yet",
                    );
                default:
                    throw new Error(`Unknown image type: ${image}`);
            }

            console.log("options", options);
            console.log("image", image);
            if (options.build) {
                console.log(`Building ${imageName}...`);
                await runCommand("docker", [
                    "build",
                    "-t",
                    imageName,
                    "--file",
                    dockerfile,
                    "../..",
                ]);
                if (image === "api") {
                    await updateEnvFile(
                        path.join(
                            process.cwd(),
                            "..",
                            "planqtn_api",
                            ".env",
                        ),
                        "API_IMAGE",
                        imageName,
                    );
                }
            }

            if (options.load || options.loadNoRestart) {
                if (image !== "job") {
                    throw new Error(
                        "--load option is only supported for job image",
                    );
                }

                const k3dRunning = await checkK3dRunning(options.k3dCluster);

                if (!k3dRunning) {
                    throw new Error(
                        "k3d must be running for loading the image!",
                    );
                }

                console.log(`Loading ${imageName} into k3d...`);
                await runCommand("~/.planqtn/k3d", [
                    "image",
                    "import",
                    imageName,
                    "-c",
                    `planqtn-${options.k3dCluster}`,
                ]);

                console.log("Updating Supabase environment...");
                await updateEnvFile(
                    path.join(
                        process.cwd(),
                        "..",
                        "supabase",
                        "functions",
                        ".env",
                    ),
                    "JOBS_IMAGE",
                    imageName,
                );

                if (!options.loadNoRestart) {
                    await restartSupabase();
                }
            }

            if (options.push) {
                console.log(`Pushing ${imageName}...`);
                await runCommand("docker", ["push", imageName]);
            }

            if (options.deployMonitor) {
                if (image !== "job") {
                    throw new Error(
                        "--deploy-monitor option is only supported for job image",
                    );
                }
                console.log(
                    "Deploying to Cloud Run monitor service...",
                );
                await runCommand("gcloud", [
                    "run",
                    "deploy",
                    "planqtn-monitor",
                    "--image",
                    imageName,
                ]);
            }

            if (options.deployJob) {
                if (image !== "job") {
                    throw new Error(
                        "--deploy-job option is only supported for job image",
                    );
                }
                console.log("Deploying to Cloud Run jobs service...");
                await runCommand("gcloud", [
                    "run",
                    "jobs",
                    "deploy",
                    "planqtn-jobs",
                    "--image",
                    imageName,
                ]);
            }
            process.exit(0);
        });
}
