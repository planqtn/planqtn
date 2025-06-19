import { Command } from "commander";
import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { promisify } from "util";
import {
  buildAndPushImageAndUpdateEnvFile,
  getImageConfig,
  getImageFromEnv
} from "./images";
import promptSync from "prompt-sync";
import * as https from "https";
import * as os from "os";
import { Client } from "pg";
import { ensureEmptyDir } from "../utils";
import { PLANQTN_BIN_DIR } from "../config";

const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);
const mkdir = promisify(fs.mkdir);
const exists = promisify(fs.exists);
const unlink = promisify(fs.unlink);

// Get the app directory path (one level up from planqtn_cli)
const APP_DIR = path.join(process.cwd(), "..");
const CONFIG_DIR = path.join(process.env.HOME!, ".planqtn", ".config");
const GENERATED_DIR = path.join(CONFIG_DIR, "generated");

interface TerraformVars {
  project_id?: string;
  region?: string;
  zone?: string;
  [key: string]: string | undefined;
}

async function writeTerraformVars(
  filePath: string,
  vars: TerraformVars
): Promise<void> {
  const content = Object.entries(vars)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key} = "${value}"`)
    .join("\n");

  await writeFile(filePath, content);
}

async function setupSupabase(
  configDir: string,
  projectId: string,
  dbPassword: string,
  _supabaseServiceKey: string,
  nonInteractive: boolean
): Promise<void> {
  // Run migrations
  console.log("\nRunning database migrations...");
  // console.log(`DATABASE_URL: postgresql://postgres.${projectId}:${dbPassword}@aws-0-us-east-2.pooler.supabase.com:6543/postgres`);
  execSync(`npx node-pg-migrate up -m ${path.join(APP_DIR, "migrations")}`, {
    stdio: "inherit",
    env: {
      ...process.env,
      DATABASE_URL: `postgresql://postgres.${projectId}:${dbPassword}@aws-0-us-east-2.pooler.supabase.com:5432/postgres`
    }
  });

  // Link and deploy Supabase functions
  console.log("\nLinking and deploying Supabase functions...");
  const supabaseEnv = {
    ...process.env,
    SUPABASE_DB_PASSWORD: dbPassword
  };

  // Check for Supabase access token
  const accessTokenPath = path.join(os.homedir(), ".supabase", "access-token");
  if (!process.env.SUPABASE_ACCESS_TOKEN && !fs.existsSync(accessTokenPath)) {
    if (process.stdin.isTTY || !nonInteractive) {
      console.log(
        "Supabase access token not found. Please login to Supabase..."
      );
      execSync(`npx supabase --workdir ${APP_DIR} login`, {
        stdio: "inherit"
      });
    } else {
      throw new Error(
        "Supabase access token not found and not in interactive mode. Please run `supabase login` first."
      );
    }
  }

  execSync(
    `npx supabase --workdir ${APP_DIR} link --project-ref ${projectId}`,
    {
      stdio: "inherit",
      env: supabaseEnv
    }
  );
  execSync(`npx supabase --workdir ${APP_DIR} functions deploy`, {
    stdio: "inherit"
  });

  // Save Supabase API URL
  await writeFile(
    path.join(configDir, "gcp_secret_data_api_url"),
    `https://${projectId}.supabase.co`
  );
}

async function ensureTerraformInstalled(): Promise<string> {
  // Create bin directory if it doesn't exist
  if (!(await exists(PLANQTN_BIN_DIR))) {
    await mkdir(PLANQTN_BIN_DIR, { recursive: true });
  }

  const terraformPath = path.join(PLANQTN_BIN_DIR, "terraform");

  // Check if terraform is already installed
  if (await exists(terraformPath)) {
    return terraformPath;
  }

  console.log("Installing Terraform...");

  // Determine OS and architecture
  const platform = os.platform();
  const arch = os.arch();

  let osName: string;
  let archName: string;

  switch (platform) {
    case "linux":
      osName = "linux";
      break;
    case "darwin":
      osName = "darwin";
      break;
    default:
      throw new Error(`Unsupported OS: ${platform}`);
  }

  switch (arch) {
    case "x64":
      archName = "amd64";
      break;
    case "arm64":
      archName = "arm64";
      break;
    default:
      throw new Error(`Unsupported architecture: ${arch}`);
  }

  // Use a fixed version instead of fetching from API to avoid rate limiting issues
  const version = "1.7.4";
  const zipUrl = `https://releases.hashicorp.com/terraform/${version}/terraform_${version}_${osName}_${archName}.zip`;
  const zipPath = path.join(PLANQTN_BIN_DIR, "terraform.zip");

  // Download Terraform
  await new Promise<void>((resolve, reject) => {
    https
      .get(zipUrl, (res) => {
        if (res.statusCode !== 200) {
          reject(new Error(`Failed to download Terraform: ${res.statusCode}`));
          return;
        }
        const file = fs.createWriteStream(zipPath);
        res.pipe(file);
        file.on("finish", () => {
          file.close();
          resolve();
        });
        file.on("error", reject);
      })
      .on("error", reject);
  });

  // Unzip Terraform
  execSync(`unzip -o ${zipPath} -d ${PLANQTN_BIN_DIR}`);
  await unlink(zipPath);

  // Make terraform executable
  execSync(`chmod +x ${terraformPath}`);

  console.log("Terraform installed successfully.");
  return terraformPath;
}
async function ensureGcpSvcAccountKeyIsGenerated(): Promise<{
  gcpSvcAccountKeyPath: string;
  gcpSvcAccountKey: Record<string, string>;
} | null> {
  if (process.env.GCP_SVC_CREDENTIALS) {
    const decodedKey = Buffer.from(
      process.env.GCP_SVC_CREDENTIALS,
      "base64"
    ).toString("utf-8");
    const gcpSvcAccountKey = JSON.parse(decodedKey);
    const gcpSvcAccountKeyPath = path.join(
      GENERATED_DIR,
      "gcp-service-account-key.json"
    );
    await writeFile(
      gcpSvcAccountKeyPath,
      JSON.stringify(gcpSvcAccountKey, null, 2)
    );
    return {
      gcpSvcAccountKeyPath,
      gcpSvcAccountKey
    };
  }
  return null;
}
async function terraform(
  args: string,
  printOutput: boolean = false
): Promise<string | null> {
  const terraformPath = await ensureTerraformInstalled();

  const gcpSvcAccountResult = await ensureGcpSvcAccountKeyIsGenerated();
  const tfEnv = gcpSvcAccountResult
    ? {
        ...process.env,
        GOOGLE_APPLICATION_CREDENTIALS: gcpSvcAccountResult.gcpSvcAccountKeyPath
      }
    : process.env;

  // Apply Terraform configuration
  const gcpDir = path.join(APP_DIR, "gcp");

  const result = execSync(`${terraformPath} ${args}`, {
    cwd: gcpDir,
    stdio: printOutput ? "inherit" : "pipe",
    env: tfEnv
  });
  if (result) {
    return result.toString().trim();
  }
  return null;
}

async function setupGCP(
  supabaseProjectId: string,
  supabaseServiceKey: string,
  supabaseAnonKey: string,
  gcpProjectId: string,
  gcpRegion: string,
  terraformStateBucket: string,
  terraformStatePrefix: string,
  loginCheck: boolean = false
): Promise<void> {
  const tfvarsPath = path.join(APP_DIR, "gcp", "terraform.tfvars");

  if (!(await exists(tfvarsPath))) {
    console.log("Creating empty terraform.tfvars file...");
    await writeFile(tfvarsPath, "");
  }

  // Get image names from environment
  const jobsImage = await getImageFromEnv("job");
  const apiImage = await getImageFromEnv("api");
  const uiImage = await getImageFromEnv("ui");

  if (!jobsImage || !apiImage || !uiImage) {
    if (!loginCheck) {
      throw new Error(
        "Failed to get image names from environment for GCP build!"
      );
    }
  }

  // Write the tfvars file with all required variables
  await writeTerraformVars(tfvarsPath, {
    project_id: gcpProjectId,
    region: gcpRegion,
    jobs_image: jobsImage,
    api_image: apiImage,
    ui_image: uiImage,
    supabase_url: `https://${supabaseProjectId}.supabase.co`,
    supabase_service_key: supabaseServiceKey,
    supabase_anon_key: supabaseAnonKey,
    environment: "dev"
  });

  await terraform(
    `init -reconfigure -backend-config="bucket=${terraformStateBucket}" -backend-config="prefix=${terraformStatePrefix}"`,
    true
  );

  if (!loginCheck) {
    await terraform(`apply -auto-approve`, true);
  } else {
    await terraform(`state list`, false);

    const gcpSvcAccountResult = await ensureGcpSvcAccountKeyIsGenerated();

    if (gcpSvcAccountResult) {
      const tfDeployerEmail = gcpSvcAccountResult.gcpSvcAccountKey.client_email;
      // this is a bit hacky, but we rely on the terraform call to have already placed this ...
      execSync(
        `gcloud auth activate-service-account ${tfDeployerEmail} --key-file=${gcpSvcAccountResult.gcpSvcAccountKeyPath} --project=${gcpProjectId}`
      );
      const policy = execSync(
        `gcloud projects get-iam-policy ${gcpProjectId} --flatten="bindings[].members" --format='table(bindings.role)' --filter="bindings.members:${tfDeployerEmail}"`
      );
      const roles = policy.toString().split("\n");
      console.log(roles);
      const missingRoles = [];
      for (const requiredRole of getRequiredTfDeployerRoles()) {
        if (!roles.includes(requiredRole)) {
          missingRoles.push(requiredRole);
        }
      }
      if (missingRoles.length > 0) {
        throw new Error(
          `Missing roles ${missingRoles.join(
            ", "
          )} for ${tfDeployerEmail}. Please add them manually.\n\n` +
            getRequiredTfDeployerRolesCommands(
              gcpProjectId,
              tfDeployerEmail,
              missingRoles
            )
        );
      }
    }
  }
}

async function setupSupabaseSecrets(
  configDir: string,
  jobsImage: string,
  gcpProjectId: string,
  serviceAccountKey: string,
  apiUrl: string
): Promise<void> {
  if (!serviceAccountKey) {
    throw new Error(
      "GCP service account key is required for Supabase secrets setup"
    );
  }
  if (!apiUrl) {
    throw new Error("API URL is required for Supabase secrets setup");
  }

  // Create a temporary .env file for Supabase secrets
  const envContent = [
    `JOBS_IMAGE=${jobsImage}`,
    `GCP_PROJECT=${gcpProjectId}`,
    `SVC_ACCOUNT=${serviceAccountKey}`,
    `API_URL=${apiUrl}`
  ].join("\n");

  const envPath = path.join(configDir, "supabase.env");
  await writeFile(envPath, envContent);

  // Deploy secrets to Supabase
  console.log("\nDeploying Supabase secrets...");
  execSync(
    `npx supabase --workdir ${APP_DIR} secrets set --env-file ${envPath}`,
    {
      stdio: "inherit"
    }
  );

  // Clean up the temporary env file
  await unlink(envPath);
}

async function buildAndPushImagesAndUpdateEnvFiles(
  refuseDirtyBuilds: boolean,
  dockerRepo: string,
  supabaseUrl: string,
  supabaseAnonKey: string,
  ui_mode: string,
  onlyEnvFileUpdate: boolean = false,
  tagOverride: string | undefined = undefined
): Promise<void> {
  if (refuseDirtyBuilds) {
    if (tagOverride && tagOverride.includes("-dirty")) {
      // while this is not fool proof, it's a good enough sanity check to avoid deploying dirty images and incentivise reproducible builds
      throw new Error(
        "Refusing to setup images for deployment with dirty tags. Ensure to use a tag that is from a commit."
      );
    }
    if (!tagOverride) {
      console.log("Checking git status...");
      try {
        const status = execSync("git status --porcelain", { stdio: "pipe" })
          .toString()
          .trim();
        if (status) {
          throw new Error(
            "Git working directory is dirty, refusing to build and push images. Please commit or stash your changes before deploying. Changes:\n" +
              status
          );
        }
      } catch (error) {
        if (error instanceof Error) {
          throw error;
        }
        throw new Error("Failed to check git status: " + error);
      }
    }
  }
  if (onlyEnvFileUpdate) {
    console.log(
      "Using existing images from " + (tagOverride || "current tag") + "..."
    );
  }
  const actions = onlyEnvFileUpdate
    ? { build: false, push: false, load: false }
    : { build: true, push: true, load: false };

  let config = await getImageConfig("job", dockerRepo, tagOverride);
  console.log(` - ${config.imageName} ...`);

  await buildAndPushImageAndUpdateEnvFile("job", actions, config);

  config = await getImageConfig("api", dockerRepo, tagOverride);
  console.log(` - ${config.imageName} ...`);
  await buildAndPushImageAndUpdateEnvFile("api", actions, config);

  const uiImageConfig = await getImageConfig("ui", dockerRepo, tagOverride);
  const { imageName, envPath, envVar } = uiImageConfig;

  const envContent = [
    `VITE_TASK_STORE_URL=${supabaseUrl}`,
    `VITE_TASK_STORE_ANON_KEY=${supabaseAnonKey}`,
    `VITE_ENV=${ui_mode}`,
    `${envVar}=${imageName}`
  ].join("\n");

  await writeFile(envPath, envContent);

  console.log(` - ${uiImageConfig.imageName} ...`);
  await buildAndPushImageAndUpdateEnvFile("ui", actions, uiImageConfig);
}

interface VariableConfig {
  name: string;
  description: string;
  isSecret?: boolean;
  defaultValue?: string;
  notSetInGithubActions?: boolean;
  requiredFor: (
    | "images"
    | "supabase"
    | "supabase-secrets"
    | "gcp"
    | "github-actions"
    | "integration-test-config"
  )[];
  outputBy?: "images" | "supabase" | "gcp";
  hint?: string;
}

abstract class Variable {
  protected value: string | undefined;
  protected config: VariableConfig;

  constructor(config: VariableConfig) {
    this.config = config;
  }

  async loadFromSavedOrEnv(vars: Variable[]): Promise<void> {
    await this.load(vars);
    if (!this.getValue()) {
      await this.loadFromEnv(vars);
    }
  }

  abstract load(vars: Variable[]): Promise<void>;
  abstract save(): Promise<void>;

  getValue(): string | undefined {
    return this.value;
  }

  getRequiredValue(): string {
    if (!this.value) {
      throw new Error(
        `Required variable ${this.config.name} is not set. ${this.config.hint ? `Hint: ${this.config.hint}` : ""}`
      );
    }
    return this.value;
  }

  setValue(value: string): void {
    this.value = value;
  }

  getName(): string {
    return this.config.name;
  }

  getConfig(): VariableConfig {
    return this.config;
  }

  getEnvVarName(): string {
    // Convert camelCase to SCREAMING_SNAKE_CASE
    return this.config.name
      .replace(/([A-Z])/g, "_$1") // Add underscore before capital letters
      .replace(/^_/, "") // Remove leading underscore if present
      .toUpperCase();
  }

  async loadFromEnv(_vars: Variable[]): Promise<void> {
    const envVarName = this.getEnvVarName();
    const envValue = process.env[envVarName];
    if (envValue) {
      this.setValue(envValue);
    }
  }

  async prompt(prompt: promptSync.Prompt) {
    const config = this.getConfig();
    const currentValue = this.getValue();
    // Only skip prompting if the value is set AND it's output by a non-skipped phase
    if (!currentValue || (currentValue && !config.outputBy)) {
      const hintText = config.hint ? ` [? for help]` : "";
      const promptText = `Enter ${config.description} ${
        config.defaultValue ? ` [default: ${config.defaultValue}]` : ""
      }${
        currentValue && !config.isSecret
          ? ` (leave blank to keep current value: ${currentValue})`
          : currentValue && config.isSecret
            ? " (leave blank to keep current value)"
            : " (not set)"
      }${hintText}: `;

      let hint = true;
      let value: string | undefined;

      while (hint) {
        value = undefined;
        if (config.isSecret) {
          value = prompt(promptText, { echo: "*" });
        } else {
          value = prompt(promptText, currentValue || config.defaultValue || "");
        }
        hint = value === "?";
        if (hint) {
          console.log(config.hint);
        }
      }

      if (value) {
        this.setValue(value);
      }
    }
  }
}

class PlainFileVar extends Variable {
  private filePath: string;
  private configDir: string;

  constructor(config: VariableConfig, configDir: string, filename: string) {
    super(config);
    this.configDir = configDir;
    this.filePath = path.join(configDir, filename);
  }

  async load(_vars: Variable[]): Promise<void> {
    try {
      if (await exists(this.filePath)) {
        const content = await readFile(this.filePath, "utf8");
        if (content.trim()) {
          this.value = content.trim();
        }
      }
    } catch (error) {
      console.warn(`Warning: Could not load ${this.filePath}:`, error);
    }
  }

  async save(): Promise<void> {
    try {
      if (this.value) {
        ensureEmptyDir(this.configDir);
        await writeFile(this.filePath, this.value);
      }
    } catch (error) {
      console.error(`Error saving ${this.filePath}:`, error);
      throw error;
    }
  }
}

class DerivedVar extends Variable {
  private computeFn: (vars: Variable[]) => string;

  constructor(config: VariableConfig, computeFn: (vars: Variable[]) => string) {
    super(config);
    this.computeFn = computeFn;
  }

  async load(vars: Variable[]): Promise<void> {
    this.compute(vars);
  }

  async save(): Promise<void> {
    // Derived vars don't save to storage
  }

  compute(vars: Variable[]): void {
    try {
      this.value = this.computeFn(vars);
    } catch {
      // fail silently
      // if (error instanceof Error) {
      //   console.warn(`Error deriving ${this.getName()}:`, error.message);
      // } else {
      //   console.warn(`Error deriving ${this.getName()}:`, error);
      // }
    }
  }

  async loadFromEnv(vars: Variable[]): Promise<void> {
    try {
      await this.load(vars);
    } catch {
      await super.loadFromEnv(vars);
    }
  }
}

class EnvFileVar extends Variable {
  private envFile: string;
  private envKey: string;

  constructor(config: VariableConfig, envFile: string, envKey: string) {
    super(config);
    this.envFile = envFile;
    this.envKey = envKey;
  }

  async load(_vars: Variable[]): Promise<void> {
    this.value = await getImageFromEnv(this.envKey);
  }

  async save(): Promise<void> {
    // Env vars don't save to storage
  }
}

function getRequiredTfDeployerRoles() {
  return [
    "roles/editor",
    "roles/secretmanager.secretVersionAdder",
    "roles/secretmanager.secretAccessor",
    "roles/resourcemanager.projectIamAdmin",
    "roles/iam.serviceAccountAdmin",
    "roles/logging.configWriter",
    "roles/pubsub.admin",
    "roles/run.admin"
  ];
}

function getRequiredTfDeployerRolesCommands(
  projectId: string,
  svcAccountEmail: string,
  missingRoles: string[] = getRequiredTfDeployerRoles()
) {
  const commands = missingRoles.map(
    (role) => `
  gcloud projects add-iam-policy-binding ${projectId} \
  --member="serviceAccount:${svcAccountEmail}" \
  --role="${role}"
  `
  );
  return commands.join("\n\n");
}

class VariableManager {
  private configDir: string;
  private generatedDir: string;
  private variables: Variable[];

  constructor(configDir: string) {
    this.configDir = configDir;
    this.generatedDir = path.join(this.configDir, "generated");
    ensureEmptyDir(this.generatedDir);
    this.variables = [
      new PlainFileVar(
        {
          name: "dockerRepo",
          description: "Docker repository (e.g., Docker Hub username or repo)",
          defaultValue: "planqtn",
          requiredFor: ["images"]
        },
        configDir,
        "docker-repo"
      ),
      new PlainFileVar(
        {
          name: "supabaseProjectRef",
          description: "Supabase project ID",
          requiredFor: ["supabase"],
          hint: `Get it from your supabase connection string, which is typically <project-ref>.supabase.co`
        },
        configDir,
        "supabase-project-id"
      ),
      new PlainFileVar(
        {
          name: "dbPassword",
          description: "Supabase database password",
          hint: `Get it from your supabase project settings. If you forgot it, then you can reset it in the supabase project settings dashboard.`,
          isSecret: true,
          requiredFor: ["supabase"]
        },
        configDir,
        "db-password"
      ),
      new PlainFileVar(
        {
          name: "uiMode",
          description:
            "UI mode (development, staging, production, TEASER, DOWN)",
          defaultValue: "development",
          requiredFor: ["gcp"],
          notSetInGithubActions: true
        },
        configDir,
        "ui-mode"
      ),
      new EnvFileVar(
        {
          name: "jobsImage",
          description: "Jobs image name",
          requiredFor: ["supabase-secrets", "gcp"],
          outputBy: "images"
        },
        "job",
        "job"
      ),
      new PlainFileVar(
        {
          name: "gcpProjectId",
          description: "GCP project ID",
          hint: `Get it from your GCP project settings. This is a string, not a number.`,
          requiredFor: ["supabase-secrets", "gcp"]
        },
        configDir,
        "gcp-project-id"
      ),
      new PlainFileVar(
        {
          name: "apiUrl",
          description: "Cloud Run PlanqTN API URL",
          requiredFor: ["supabase-secrets"],
          outputBy: "gcp"
        },
        configDir,
        "api-url"
      ),
      new PlainFileVar(
        {
          name: "gcpSvcAccountKey",
          description: "GCP service account key",
          isSecret: true,
          requiredFor: ["supabase-secrets"],
          outputBy: "gcp"
        },
        configDir,
        "gcp-service-account-key"
      ),
      new PlainFileVar(
        {
          name: "gcpRegion",
          description: "GCP region",
          defaultValue: "us-east1",
          requiredFor: ["gcp"],
          hint: `Typically everything lives in us-east1 for now.`
        },
        configDir,
        "gcp-region"
      ),
      new PlainFileVar(
        {
          name: "terraformStateBucket",
          description: "Terraform state bucket",
          requiredFor: ["gcp"],
          hint: `This is the name of the bucket that will be used to store the terraform state. It needs to be unique across all GCP projects globally.`
        },
        configDir,
        "terraform-state-bucket"
      ),
      new PlainFileVar(
        {
          name: "terraformStatePrefix",
          description: "Terraform state prefix",
          requiredFor: ["gcp"],
          hint: `This is the prefix that will be used to store the terraform state. Within the same project there could be a dev and a prod setup for example.`
        },
        configDir,
        "terraform-state-prefix"
      ),
      new DerivedVar(
        {
          name: "supabaseUrl",
          description: "Supabase URL",
          requiredFor: ["gcp"]
        },
        (vars) =>
          `https://${vars
            .find((v) => v.getName() === "supabaseProjectRef")
            ?.getRequiredValue()}.supabase.co`
      ),
      new PlainFileVar(
        {
          name: "supabaseServiceKey",
          description: "Supabase service key",
          isSecret: true,
          requiredFor: ["gcp", "integration-test-config"],
          hint: `Get it from your supabase Project Settings/API Keys section. Click Reveal on the Service Role Key input field.`
        },
        configDir,
        "supabase-service-key"
      ),

      new EnvFileVar(
        {
          name: "apiImage",
          description: "API image name",
          requiredFor: ["gcp"],
          outputBy: "images"
        },
        "api",
        "api"
      ),
      new PlainFileVar(
        {
          name: "supabaseAnonKey",
          description: "Supabase anonymous key",
          hint: `Get it from your supabase Project Settings/API Keys section. It should be under Anon Key input field.`,
          isSecret: true,
          requiredFor: ["integration-test-config", "gcp"]
        },
        configDir,
        "supabase-anon-key"
      ),

      new PlainFileVar(
        {
          name: "dockerhubToken",
          description: "DockerHub access token for GitHub Actions",
          isSecret: true,
          requiredFor: ["github-actions"],
          hint: `Get a personal access token from docker.io, ensure that it can read/write to your public repos.`
        },
        configDir,
        "dockerhub-token"
      ),
      new PlainFileVar(
        {
          name: "dockerhubUsername",
          description: "DockerHub username for GitHub Actions",
          requiredFor: ["github-actions"],
          hint: `Get it from your DockerHub account settings.`
        },
        configDir,
        "dockerhub-username"
      ),

      new PlainFileVar(
        {
          name: "supabaseAccessToken",
          description: "Supabase access token for GitHub Actions",
          hint: `Get a personal Supabase access token at https://supabase.com/dashboard/account/tokens`,
          isSecret: true,
          requiredFor: ["github-actions"]
        },
        configDir,
        "supabase-access-token"
      ),
      new PlainFileVar(
        {
          name: "gcpSvcCredentials",
          description: "GCP service account credentials for GitHub Actions",
          isSecret: true,
          hint: `This is a one time setup. Follow the steps below:
          
          1. Create a service account to manage the resources:

export PROJECT_ID=$(gcloud config get-value project)
gcloud iam service-accounts create tf-deployer --project=$PROJECT_ID

2. Add the necessary roles:

${getRequiredTfDeployerRolesCommands(
  "$PROJECT_ID",
  "tf-deployer@$PROJECT_ID.iam.gserviceaccount.com"
)}
 

3. Download a key for the service account:


gcloud iam service-accounts keys create ~/.planqtn/.config/tf-deployer-svc.json --iam-account=tf-deployer@$PROJECT_ID.iam.gserviceaccount.com

4. Copy the output of the following command and paste it here:

cat ~/.planqtn/.config/tf-deployer-svc.json | base64 -w 0`,
          requiredFor: ["github-actions"]
        },
        configDir,
        "gcp-svc-credentials"
      )
    ];
  }

  async loadExistingValues(): Promise<void> {
    for (const variable of this.variables) {
      await variable.load(this.variables);
      if (!variable.getValue()) {
        await variable.loadFromEnv(this.variables);
      }
    }
    await this.loadGcpOutputs();
  }

  async loadFromEnv(): Promise<void> {
    for (const variable of this.variables) {
      await variable.loadFromEnv(this.variables);
    }
  }

  async saveValues(): Promise<void> {
    // Update derived variables
    for (const variable of this.variables) {
      if (variable instanceof DerivedVar) {
        variable.compute(this.variables);
      }
    }

    // Save all variables
    for (const variable of this.variables) {
      await variable.save();
    }
  }

  getVariable(name: string): Variable {
    const variable = this.variables.find((v) => v.getName() === name);
    if (!variable) {
      throw new Error(`Variable ${name} not found`);
    }
    return variable;
  }

  getRequiredValue(key: string): string {
    return this.getVariable(key).getRequiredValue();
  }

  getValue(key: string): string | undefined {
    return this.getVariable(key).getValue();
  }

  async loadGcpOutputs(): Promise<void> {
    try {
      // Get Terraform outputs
      const apiUrl = await terraform(`output -raw api_service_url`);
      const rawServiceAccountKey = await terraform(
        `output -raw api_service_account_key`
      );
      // Set values on the Variable instances
      const apiUrlVar = this.variables.find((v) => v.getName() === "apiUrl");
      const gcpSvcAccountKeyVar = this.variables.find(
        (v) => v.getName() === "gcpSvcAccountKey"
      );

      if (apiUrlVar) {
        apiUrlVar.setValue(apiUrl!);
      }
      if (gcpSvcAccountKeyVar) {
        gcpSvcAccountKeyVar.setValue(rawServiceAccountKey!);
      }
    } catch {
      // Ignore error
    }
  }

  private getRequiredVariables(
    skipPhases: {
      images: boolean;
      supabase: boolean;
      gcp: boolean;
      "supabase-secrets": boolean;
      "integration-test-config": boolean;
      "github-actions": boolean;
    },
    phase?:
      | "images"
      | "supabase"
      | "gcp"
      | "supabase-secrets"
      | "integration-test-config"
      | "github-actions"
  ): Variable[] {
    return this.variables.filter((variable) => {
      const config = variable.getConfig();
      // Skip derived variables as they are computed
      if (variable instanceof DerivedVar) {
        return false;
      }
      // Skip variables that are output by non-skipped phases
      if (config.outputBy && !skipPhases[config.outputBy]) {
        return false;
      }
      // If phase is specified, only include variables required for that phase
      if (phase) {
        return config.requiredFor.includes(phase) && !skipPhases[phase];
      }
      // Otherwise include variables required for any non-skipped phase
      return config.requiredFor.some(
        (p) => !skipPhases[p as keyof typeof skipPhases]
      );
    });
  }

  async prompt(skipPhases: {
    images: boolean;
    supabase: boolean;
    gcp: boolean;
    "supabase-secrets": boolean;
    "integration-test-config": boolean;
    "github-actions": boolean;
  }): Promise<void> {
    const prompt = promptSync({ sigint: true });
    console.log("\n=== Collecting Configuration ===");

    const requiredVars = this.getRequiredVariables(skipPhases);

    for (const variable of requiredVars) {
      await variable.prompt(prompt);
      await this.saveValues();
    }

    await this.saveValues();
  }

  async validatePhaseRequirements(
    phase:
      | "images"
      | "supabase"
      | "gcp"
      | "supabase-secrets"
      | "integration-test-config"
      | "github-actions",
    skipPhases: {
      images: boolean;
      supabase: boolean;
      gcp: boolean;
      "supabase-secrets": boolean;
      "integration-test-config": boolean;
      "github-actions": boolean;
    }
  ): Promise<void> {
    const requiredVars = this.getRequiredVariables(skipPhases, phase);
    const missingVars: string[] = [];

    for (const variable of requiredVars) {
      if (!variable.getValue()) {
        await variable.loadFromSavedOrEnv(this.variables);
      }
      if (!variable.getValue()) {
        missingVars.push(variable.getConfig().description);
      }
    }

    if (missingVars.length > 0) {
      throw new Error(`Missing required variables: ${missingVars.join(", ")}`);
    }
  }

  async generateIntegrationTestConfig(): Promise<void> {
    const config = {
      ANON_KEY: this.getValue("supabaseAnonKey"),
      API_URL: this.getValue("supabaseUrl"),
      SERVICE_ROLE_KEY: this.getValue("supabaseServiceKey")
    };

    const configPath = path.join(this.generatedDir, "supabase_config.json");
    await writeFile(configPath, JSON.stringify(config, null, 2));
    console.log("Integration test config generated at:", configPath);
  }

  getUserVariables(): Variable[] {
    return this.variables.filter((variable) => {
      const config = variable.getConfig();
      // Only include variables that don't have outputBy (user-only variables)
      return !config.outputBy && !(variable instanceof DerivedVar);
    });
  }
}

async function checkCredentials(
  skipPhases: {
    images: boolean;
    supabase: boolean;
    gcp: boolean;
    "supabase-secrets": boolean;
    "integration-test-config": boolean;
    "github-actions": boolean;
  },
  variableManager: VariableManager
): Promise<void> {
  console.log("\n=== Checking Credentials ===");

  // Check Docker Hub credentials (needed for images phase)
  if (!skipPhases.images) {
    console.log("Checking Docker Hub credentials...");
    try {
      execSync("docker login", { stdio: "pipe" });
    } catch {
      throw new Error(
        "Not logged in to Docker Hub. Please run 'docker login' first."
      );
    }
  }

  // Check Supabase credentials (needed for supabase and supabase-secrets phases)
  if (!skipPhases.supabase || !skipPhases["supabase-secrets"]) {
    console.log("Checking Supabase credentials...");
    try {
      // Test database connection using pg client
      const projectId = variableManager.getValue("supabaseProjectRef");
      const dbPassword = variableManager.getValue("dbPassword");
      // `postgresql://postgres.jzyljfwifghyqglsflcj:[YOUR-PASSWORD]@aws-0-us-east-2.pooler.supabase.com:5432/postgres
      const connectionString = `postgresql://postgres.${projectId}:${dbPassword}@aws-0-us-east-2.pooler.supabase.com:5432/postgres`;

      const client = new Client({ connectionString });
      await client.connect();
      await client.query("SELECT 1");
      await client.end();
    } catch (error) {
      throw new Error(
        "Failed to verify Supabase credentials. Please ensure that you have the correct database credentials: " +
          error
      );
    }
  }

  // Check GCP credentials (needed for gcp phase)
  if (!skipPhases.gcp) {
    console.log("Checking GCP credentials...");
    try {
      await setupGCP(
        variableManager.getRequiredValue("supabaseProjectRef"),
        variableManager.getRequiredValue("supabaseServiceKey"),
        variableManager.getRequiredValue("supabaseAnonKey"),
        variableManager.getRequiredValue("gcpProjectId"),
        variableManager.getRequiredValue("gcpRegion"),
        variableManager.getRequiredValue("terraformStateBucket"),
        variableManager.getRequiredValue("terraformStatePrefix"),
        true
      );
    } catch (error) {
      throw new Error(
        "Not logged in to GCP or missing project access. Please run 'gcloud auth login' and verify project access. " +
          error
      );
    }
  }

  // Check GitHub credentials (needed for github-actions phase)
  if (!skipPhases["github-actions"]) {
    console.log("Checking GitHub credentials...");
    try {
      execSync("gh auth status", { stdio: "pipe" });
    } catch {
      throw new Error(
        "Not logged in to GitHub. Please run 'gh auth login' first."
      );
    }
  }

  console.log("All required credentials are valid.");
}

export function setupCloudCommand(program: Command): void {
  const cloudCommand = program.command("cloud").description("Deploy to cloud");

  cloudCommand
    .command("deploy")
    .description("Deploy to cloud")
    .option("-q, --non-interactive", "Run in non-interactive mode", false)
    .option("--skip-images", "Skip building and pushing images")
    .option(
      "--tag <tag>",
      "Tag to use for the image, instead of the current git tag"
    )
    .option("--skip-supabase", "Skip Supabase deployment")
    .option("--skip-supabase-secrets", "Skip Supabase secrets deployment")
    .option("--skip-gcp", "Skip GCP deployment")
    .option("--only <phase>", "Only deploy the specified phase")
    .option(
      "--skip-integration-test-config",
      "Skip integration test config generation"
    )
    .option(
      "--refuse-dirty-builds <boolean>",
      "Fail if git working directory is dirty (default: true)",
      true
    )
    .action(async (options: CloudOptions) => {
      console.log("options", options);
      try {
        // Create config directory if it doesn't exist
        if (!(await exists(CONFIG_DIR))) {
          await mkdir(CONFIG_DIR, { recursive: true });
        }

        const variableManager = new VariableManager(CONFIG_DIR);
        await variableManager.loadExistingValues();

        const skipPhases = {
          images: options.skipImages,
          supabase: options.skipSupabase,
          gcp: options.skipGcp,
          "supabase-secrets": options.skipSupabaseSecrets,
          "integration-test-config": options.skipIntegrationTestConfig,
          "github-actions": true
        };

        if (options.only) {
          console.log("options.only", options.only);
          if (skipPhases[options.only]) {
            throw new Error(
              `Cannot use --only ${options.only} together with --skip-${options.only}.`
            );
          }
          skipPhases[options.only] = false;
          for (const phase of Object.keys(
            skipPhases
          ) as (keyof typeof skipPhases)[]) {
            if (phase !== options.only) {
              skipPhases[phase] = true;
            }
          }
        }

        // Load GCP outputs if GCP is not skipped
        if (!skipPhases.gcp) {
          await variableManager.loadGcpOutputs();
        }

        if (!options.nonInteractive) {
          await variableManager.prompt(skipPhases);
        } else {
          await variableManager.loadFromEnv();
        }

        // Check credentials before proceeding with deployment
        await checkCredentials(skipPhases, variableManager);

        // Now proceed with the setup using the collected variables
        console.log("\n=== Starting Setup ===");

        // Build images if needed
        if (!skipPhases.images) {
          await variableManager.validatePhaseRequirements("images", skipPhases);
          console.log("\nBuilding and pushing images...");
          await buildAndPushImagesAndUpdateEnvFiles(
            options.refuseDirtyBuilds,
            variableManager.getRequiredValue("dockerRepo"),
            variableManager.getRequiredValue("supabaseUrl"),
            variableManager.getRequiredValue("supabaseAnonKey"),
            variableManager.getRequiredValue("uiMode"),
            false,
            options.tag
          );
        } else {
          await buildAndPushImagesAndUpdateEnvFiles(
            options.refuseDirtyBuilds,
            variableManager.getRequiredValue("dockerRepo"),
            variableManager.getRequiredValue("supabaseUrl"),
            variableManager.getRequiredValue("supabaseAnonKey"),
            variableManager.getRequiredValue("uiMode"),
            true,
            options.tag
          );
        }

        // Setup Supabase if needed
        if (!skipPhases.supabase) {
          await variableManager.validatePhaseRequirements(
            "supabase",
            skipPhases
          );
          await setupSupabase(
            CONFIG_DIR,
            variableManager.getRequiredValue("supabaseProjectRef"),
            variableManager.getRequiredValue("dbPassword"),
            variableManager.getRequiredValue("supabaseServiceKey"),
            options.nonInteractive
          );
        }

        // Setup GCP if needed
        if (!skipPhases.gcp) {
          await variableManager.validatePhaseRequirements("gcp", skipPhases);
          await setupGCP(
            variableManager.getRequiredValue("supabaseProjectRef"),
            variableManager.getRequiredValue("supabaseServiceKey"),
            variableManager.getRequiredValue("supabaseAnonKey"),
            variableManager.getRequiredValue("gcpProjectId"),
            variableManager.getRequiredValue("gcpRegion"),
            variableManager.getRequiredValue("terraformStateBucket"),
            variableManager.getRequiredValue("terraformStatePrefix")
          );
          // Reload outputs after GCP setup
          await variableManager.loadGcpOutputs();
        }

        if (!skipPhases["supabase-secrets"]) {
          await variableManager.validatePhaseRequirements(
            "supabase-secrets",
            skipPhases
          );

          const jobsImage = await getImageFromEnv("job");
          if (!jobsImage) {
            throw new Error("Failed to get jobs image from environment");
          }
          await setupSupabaseSecrets(
            CONFIG_DIR,
            jobsImage,
            variableManager.getRequiredValue("gcpProjectId"),
            variableManager.getRequiredValue("gcpSvcAccountKey"),
            variableManager.getRequiredValue("apiUrl")
          );
        }

        // Generate integration test config if needed
        if (!skipPhases["integration-test-config"]) {
          await variableManager.generateIntegrationTestConfig();
        }
      } catch (error) {
        console.error("Error:", error);
        process.exit(1);
      }
    });

  cloudCommand
    .command("generate-integration-test-config")
    .description("Generate configuration for integration tests")
    .action(async () => {
      try {
        const configDir = path.join(
          process.env.HOME || "",
          ".planqtn",
          ".config"
        );

        // Create config directory if it doesn't exist
        if (!(await exists(configDir))) {
          await mkdir(configDir, { recursive: true });
        }

        const variableManager = new VariableManager(configDir);
        await variableManager.loadExistingValues();

        // Only prompt for variables needed for integration test config
        const skipPhases = {
          images: true,
          supabase: true,
          gcp: true,
          "supabase-secrets": true,
          "integration-test-config": false,
          "github-actions": true
        };

        await variableManager.prompt(skipPhases);
        await variableManager.generateIntegrationTestConfig();
      } catch (error) {
        console.error("Error:", error);
        process.exit(1);
      }
    });

  cloudCommand
    .command("print-env-vars")
    .option(
      "--with-current-value",
      "Print current value of the variable",
      false
    )
    .description(
      "Print required environment variables for non-interactive mode"
    )
    .action(async (options: { withCurrentValue: boolean }) => {
      try {
        const configDir = path.join(
          process.env.HOME || "",
          ".planqtn",
          ".config"
        );

        const variableManager = new VariableManager(configDir);
        const userVars = variableManager.getUserVariables();

        const secrets = [];
        const vars = [];
        for (const variable of userVars) {
          const config = variable.getConfig();
          let varText = `# Description: ${config.description}`;

          if (options.withCurrentValue) {
            await variable.load(userVars);
            varText += `\n${variable.getEnvVarName()}=${variable.getValue()}`;
          } else {
            varText += `\n${variable.getEnvVarName()}: \${{ ${
              config.isSecret ? "secrets" : "vars"
            }.${variable.getEnvVarName()} }}`;
          }
          if (config.isSecret) {
            secrets.push(varText);
          } else {
            vars.push(varText);
          }
        }

        console.log("\n# Secrets:");
        console.log(secrets.join("\n"));
        console.log("\n# Vars:");
        console.log(vars.join("\n"));
      } catch (error) {
        console.error("Error:", error);
        process.exit(1);
      }
    });

  cloudCommand
    .command("setup-github-actions")
    .option(
      "--repo-name <repo-name>",
      "Name of the repository, [HOST/]OWNER/REPO, default uses the current repository in the repo"
    )
    .option(
      "--repo-env <repo-env>",
      "Environment of the repository, default uses no environment"
    )
    .description("Sets up github actions environment variables for the project")
    .action(async (options: { repoName: string; repoEnv: string }) => {
      try {
        const repoWithName = options.repoName
          ? options.repoName
          : execSync(`gh repo view --json nameWithOwner --jq '.nameWithOwner'`)
              .toString()
              .trim();

        console.log("--------------------------------");
        console.log(
          `We'll be setting up github actions for repo ${repoWithName} in ${
            options.repoEnv || "no specific environment"
          }`
        );
        console.log("--------------------------------");

        const configDir = path.join(
          process.env.HOME || "",
          ".planqtn",
          ".config"
        );
        const variableManager = new VariableManager(configDir);
        await variableManager.loadExistingValues();
        const userVars = variableManager
          .getUserVariables()
          .filter((v) => !v.getConfig().notSetInGithubActions);
        const prompt = promptSync({ sigint: true });
        for (const variable of userVars) {
          await variable.prompt(prompt);

          while (variable.getValue() === undefined) {
            await variable.prompt(prompt);
            if (variable.getValue() === undefined) {
              console.log("Please enter a value for the variable");
            }
          }
          await variableManager.saveValues();
        }

        let readyToCheckCredentials = "";
        while (
          readyToCheckCredentials !== "y" &&
          readyToCheckCredentials !== "n"
        ) {
          readyToCheckCredentials = prompt(
            `==========================
Ready to check credentials?
===========================
(y/n) `
          );
          if (readyToCheckCredentials === "n") {
            console.log("Aborting...");
            process.exit(0);
          }
        }

        if (!process.env.GCP_SVC_CREDENTIALS) {
          process.env.GCP_SVC_CREDENTIALS =
            variableManager.getValue("gcpSvcCredentials");
        }

        await checkCredentials(
          {
            images: false,
            supabase: false,
            gcp: false,
            "supabase-secrets": false,
            "integration-test-config": false,
            "github-actions": false
          },
          variableManager
        );

        const answer = prompt(
          `================================================================================
Are you sure you want to set these up in Github Actions on repo ${repoWithName}?
This will set the following variables:
${userVars.map((v) => `- ${v.getEnvVarName()}: ${v.getConfig().isSecret ? "***" : v.getValue()}`).join("\n")}
${options.repoEnv ? `in environment ${options.repoEnv}` : ""}
${options.repoName ? `on repo ${options.repoName}` : ""}
=================================================================================
(y/n)`
        );
        if (answer !== "y") {
          console.log("Aborting...");
          process.exit(0);
        }

        const gh =
          "gh" +
          (options.repoName ? ` -R ${options.repoName}` : "") +
          (options.repoEnv ? ` -e ${options.repoEnv}` : "");

        for (const variable of userVars) {
          const config = variable.getConfig();
          const val = variable.getValue();

          if (config.isSecret) {
            console.log(`Setting secret ${variable.getEnvVarName()}...`);
            execSync(
              `${gh} secret set ${variable.getEnvVarName()} --body "${val}"`
            );
          } else {
            console.log(`Setting var ${variable.getEnvVarName()}...`);
            execSync(
              `${gh} variable set ${variable.getEnvVarName()} --body "${val}"`
            );
          }
        }
      } catch (error) {
        console.error("Error:", error);
        process.exit(1);
      }
    });
}

type CloudDeploymentPhase =
  | "images"
  | "supabase"
  | "gcp"
  | "supabase-secrets"
  | "integration-test-config"
  | "github-actions";

interface CloudOptions {
  nonInteractive: boolean;
  skipImages: boolean;
  skipSupabase: boolean;
  skipSupabaseSecrets: boolean;
  skipGcp: boolean;
  skipUi: boolean;
  skipIntegrationTestConfig: boolean;
  refuseDirtyBuilds: boolean;
  tag: string | undefined;
  only: CloudDeploymentPhase;
}

export async function getDockerRepo(quiet: boolean = false): Promise<string> {
  const variableManager = new VariableManager(CONFIG_DIR);
  const dockerRepo = variableManager.getVariable("dockerRepo");
  await dockerRepo.loadFromSavedOrEnv([]);

  if (!quiet) {
    dockerRepo.prompt(promptSync({ sigint: true }));
    dockerRepo.save();
  }
  return dockerRepo.getRequiredValue();
}
