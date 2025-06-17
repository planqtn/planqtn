import { Command } from "commander";
import { runCommand, updateEnvFile } from "../utils";
import * as fs from "fs";
import * as path from "path";
import * as tty from "tty";
import * as dotenv from "dotenv";
import { k3d } from "../k3d";
import { getDockerRepo } from "./cloud";

async function getGitTag(): Promise<string> {
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

async function checkK3dRunning(cluster: string): Promise<boolean> {
  try {
    await k3d(["cluster", "get", `planqtn-${cluster}`], {
      verbose: false,
      returnOutput: true
    });
    return true;
  } catch {
    return false;
  }
}

async function checkSupabaseRunning(): Promise<boolean> {
  try {
    const result = (await runCommand(
      "docker",
      [
        "ps",
        "--filter",
        "name=supabase_edge_runtime_planqtn-dev",
        "--format",
        "{{.Names}}"
      ],
      { returnOutput: true }
    )) as string;
    return result.trim() === "supabase_edge_runtime_planqtn-dev";
  } catch {
    return false;
  }
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

interface ImageOptions {
  build?: boolean;
  load?: boolean;
  loadNoRestart?: boolean;
  k3dCluster?: string;
  push?: boolean;
}

export async function getImageConfig(
  image: string,
  dockerRepo: string,
  tagOverride?: string
): Promise<{
  imageName: string;
  dockerfile: string;
  envPath: string;
  envVar: string;
}> {
  const tag = tagOverride || (await getGitTag());
  let imageName = "";
  let dockerfile = "";
  let envPath = "";
  let envVar = "";

  switch (image) {
    case "job":
      imageName = `${dockerRepo}/planqtn_jobs:${tag}`;
      dockerfile = "../planqtn_jobs/Dockerfile";
      envPath = path.join(process.cwd(), "..", "supabase", "functions", ".env");
      envVar = "JOBS_IMAGE";
      break;
    case "api":
      imageName = `${dockerRepo}/planqtn_api:${tag}`;
      dockerfile = "../planqtn_api/Dockerfile";
      envPath = path.join(process.cwd(), "..", "planqtn_api", ".env");
      envVar = "API_IMAGE";
      break;
    case "ui":
      imageName = `${dockerRepo}/planqtn_ui:${tag}`;
      dockerfile = "../ui/Dockerfile";
      envPath = path.join(process.cwd(), "..", "ui", ".env");
      envVar = "VITE_UI_IMAGE";
      break;
    default:
      throw new Error(`Unknown image type: ${image}`);
  }

  return {
    imageName,
    dockerfile,
    envPath,
    envVar
  };
}

// This function builds, pushes and loads images and always updates the right environment file with the current image name
export async function buildAndPushImageAndUpdateEnvFile(
  image: string,
  options: ImageOptions,
  imageConfig: {
    imageName: string;
    dockerfile: string;
    envPath: string;
    envVar: string;
  }
): Promise<void> {
  const { imageName, dockerfile, envPath, envVar } = imageConfig;

  if (options.k3dCluster && !["dev", "local"].includes(options.k3dCluster)) {
    throw new Error("--k3d-cluster must be either 'dev' or 'local'");
  }

  if (options.build) {
    console.log(`Building ${imageName}...`);
    const isTTY =
      process.stdout instanceof tty.WriteStream && process.stdout.isTTY;
    const buildArgs = ["build", "-t", imageName, "--file", dockerfile];

    buildArgs.push("../..");

    await runCommand("docker", buildArgs, {
      verbose: true,
      tty: isTTY
    });
  }

  // the api image is used as part of deployment to the cloud run service and the local Docker implementation
  await updateEnvFile(envPath, envVar, imageName);

  if (options.load || options.loadNoRestart) {
    if (image !== "job") {
      throw new Error("--load option is only supported for job image");
    }

    const k3dRunning = await checkK3dRunning(options.k3dCluster || "dev");

    if (!k3dRunning) {
      throw new Error("k3d must be running for loading the image!");
    }

    console.log(`Loading ${imageName} into k3d...`);
    await k3d(
      [
        "image",
        "import",
        imageName,
        "-c",
        `planqtn-${options.k3dCluster || "dev"}`
      ],
      {
        verbose: false
      }
    );

    console.log("Updating Supabase environment...");

    if (!options.loadNoRestart) {
      await restartSupabase();
    }
  }

  if (options.push) {
    console.log(`Pushing ${imageName}...`);
    const isTTY =
      process.stdout instanceof tty.WriteStream && process.stdout.isTTY;
    const pushArgs = ["push"];

    pushArgs.push(imageName);

    await runCommand("docker", pushArgs, {
      verbose: true,
      tty: isTTY
    });
  }
}

export function setupImagesCommand(program: Command): void {
  const imagesCommand = program
    .command("images")
    .description("Manage Docker images (dev mode only)")
    .argument("<image>", "Image to manage (job, api, ui)")
    .option("--build", "Build the image")
    .option("--load", "Load the image into k3d and update Supabase")
    .option(
      "--load-no-restart",
      "Load the image into k3d and update Supabase without restarting Supabase"
    )
    .option(
      "--k3d-cluster <cluster>",
      "K3d cluster to load the image into (dev or local)",
      "dev"
    )
    .option("-q, --quiet", "non-interactive mode")
    .option("--push", "Push the image to registry")
    .option(
      "--tag <tag>",
      "Tag to use for the image, instead of the current git tag"
    )
    .action(async (image) => {
      const options = imagesCommand.opts();
      console.log("image", image);
      console.log("options", options);

      const dockerRepo = await getDockerRepo(options.quiet);
      const imageConfig = await getImageConfig(image, dockerRepo, options.tag);
      await buildAndPushImageAndUpdateEnvFile(image, options, imageConfig);
      process.exit(0);
    });
}

export async function getImageFromEnv(
  image: string
): Promise<string | undefined> {
  const imageConfig = await getImageConfig(image, "dummy");
  const { envPath, envVar } = imageConfig;

  if (!fs.existsSync(envPath)) {
    return undefined;
  }

  const envConfig = dotenv.parse(fs.readFileSync(envPath));
  return envConfig[envVar];
}
