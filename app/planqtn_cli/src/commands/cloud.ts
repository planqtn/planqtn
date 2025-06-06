import { Command } from "commander";
import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { promisify } from "util";
import { getImageFromEnv, handleImage } from "./images";
import promptSync from "prompt-sync";

const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);
const mkdir = promisify(fs.mkdir);
const exists = promisify(fs.exists);
const unlink = promisify(fs.unlink);

// Get the app directory path (one level up from planqtn_cli)
const APP_DIR = path.join(process.cwd(), "..");

interface CloudConfig {
    project_id: string;
    region: string;
    jobs_image: string;
    api_image: string;
    supabase_url: string;
    supabase_service_key: string;
    environment: string;
}

interface TerraformVars {
    project_id?: string;
    region?: string;
    zone?: string;
    [key: string]: string | undefined;
}

async function readTerraformVars(filePath: string): Promise<TerraformVars> {
    const content = await readFile(filePath, "utf8");
    const vars: TerraformVars = {};

    content.split("\n").forEach((line) => {
        const match = line.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*"([^"]*)"$/);
        if (match) {
            vars[match[1]] = match[2];
        }
    });

    return vars;
}

async function writeTerraformVars(
    filePath: string,
    vars: TerraformVars,
): Promise<void> {
    const content = Object.entries(vars)
        .filter(([_, value]) => value !== undefined)
        .map(([key, value]) => `${key} = "${value}"`)
        .join("\n");

    await writeFile(filePath, content);
}

async function setupSupabase(
    configDir: string,
    projectId: string,
    dbPassword: string,
    supabaseServiceKey: string,
): Promise<void> {
    // Update database connection string
    const dbConfig = {
        db: `postgresql://postgres.${projectId}:${dbPassword}@aws-0-us-east-2.pooler.supabase.com:6543/postgres`,
    };
    await writeFile(
        path.join(configDir, "db.json"),
        JSON.stringify(dbConfig, null, 2),
    );

    // Run migrations
    console.log("\nRunning database migrations...");
    execSync(
        `npx node-pg-migrate up --envPath=${configDir}/supa.db.env -m ${
            path.join(APP_DIR, "migrations")
        }`,
        { stdio: "inherit" },
    );

    // Link and deploy Supabase functions
    console.log("\nLinking and deploying Supabase functions...");
    const supabaseEnv = {
        ...process.env,
        SUPABASE_DB_PASSWORD: dbPassword,
    };
    execSync(
        `npx supabase --workdir ${APP_DIR} link --project-ref ${projectId}`,
        {
            stdio: "inherit",
            env: supabaseEnv,
        },
    );
    execSync(`npx supabase --workdir ${APP_DIR} functions deploy`, {
        stdio: "inherit",
    });

    // Save Supabase API URL
    await writeFile(
        path.join(configDir, "gcp_secret_data_api_url"),
        `https://${projectId}.supabase.co`,
    );
}

async function setupGCP(
    interactive: boolean,
    dockerRepo: string,
    supabaseProjectId: string,
    supabaseServiceKey: string,
    gcpProjectId: string,
    gcpRegion: string,
): Promise<{ apiUrl: string; serviceAccountKey: string }> {
    const tfvarsPath = path.join(APP_DIR, "gcp", "terraform.tfvars");
    const tfvars = await readTerraformVars(tfvarsPath);

    // Get image names from environment
    const jobsImage = await getImageFromEnv("job");
    const apiImage = await getImageFromEnv("api");

    if (!jobsImage || !apiImage) {
        throw new Error("Failed to get image names from environment");
    }

    // Write the tfvars file with all required variables
    await writeTerraformVars(tfvarsPath, {
        project_id: gcpProjectId,
        region: gcpRegion,
        jobs_image: jobsImage,
        api_image: apiImage,
        supabase_url: `https://${supabaseProjectId}.supabase.co`,
        supabase_service_key: supabaseServiceKey,
        environment: "dev",
    });

    // Apply Terraform configuration
    const gcpDir = path.join(APP_DIR, "gcp");
    execSync("terraform init", { cwd: gcpDir, stdio: "inherit" });
    execSync("terraform apply -auto-approve", {
        cwd: gcpDir,
        stdio: "inherit",
    });

    // Get Terraform outputs
    const apiUrl = execSync("terraform output -raw api_service_url", {
        cwd: gcpDir,
    }).toString().trim();
    const rawServiceAccountKey = execSync(
        "terraform output -raw api_service_account_key",
        { cwd: gcpDir },
    ).toString().trim();

    // Base64 encode the service account key using Buffer
    const serviceAccountKey = Buffer.from(rawServiceAccountKey).toString(
        "base64",
    );

    return { apiUrl, serviceAccountKey };
}

async function setupSupabaseSecrets(
    configDir: string,
    jobsImage: string,
    gcpProjectId: string,
    serviceAccountKey: string,
    apiUrl: string,
): Promise<void> {
    // Create a temporary .env file for Supabase secrets
    const envContent = [
        "ENV=development",
        `JOBS_IMAGE=${jobsImage}`,
        `GCP_PROJECT=${gcpProjectId}`,
        `SVC_ACCOUNT=${serviceAccountKey}`,
        `API_URL=${apiUrl}`,
    ].join("\n");

    const envPath = path.join(configDir, "supabase.env");
    await writeFile(envPath, envContent);

    // Deploy secrets to Supabase
    console.log("\nDeploying Supabase secrets...");
    execSync(`supabase secrets set --env-file ${envPath}`, {
        stdio: "inherit",
    });

    // Clean up the temporary env file
    await unlink(envPath);
}

async function buildAndPushImages(): Promise<void> {
    console.log("Building and pushing job image...");
    await handleImage("job", { build: true, push: true });

    console.log("Building and pushing api image...");
    await handleImage("api", { build: true, push: true });
}

interface VariableConfig {
    name: string;
    description: string;
    isSecret?: boolean;
    defaultValue?: string;
    requiredFor: ("images" | "supabase" | "supabase-secrets" | "gcp")[];
}

interface PhaseConfig {
    variables: VariableConfig[];
}

class VariableManager {
    private values: Record<string, string> = {};
    private configDir: string;
    private variables: VariableConfig[] = [
        {
            name: "dockerRepo",
            description:
                "Docker repository (e.g., Docker Hub username or repo)",
            defaultValue: "planqtn",
            requiredFor: ["images"],
        },
        {
            name: "supabaseProjectRef",
            description: "Supabase project ID",
            requiredFor: ["supabase"],
        },
        {
            name: "dbPassword",
            description: "Supabase database password",
            isSecret: true,
            requiredFor: ["supabase"],
        },
        {
            name: "environment",
            description: "Environment",
            defaultValue: "development",
            requiredFor: ["supabase-secrets", "gcp"],
        },
        {
            name: "jobsImage",
            description: "Jobs image name",
            requiredFor: ["supabase-secrets", "gcp"],
        },
        {
            name: "gcpProjectId",
            description: "GCP project ID",
            requiredFor: ["supabase-secrets", "gcp"],
        },
        {
            name: "apiUrl",
            description: "API URL",
            requiredFor: ["supabase-secrets"],
        },
        {
            name: "gcpSvcAccountKey",
            description: "GCP service account key",
            isSecret: true,
            requiredFor: ["supabase-secrets"],
        },
        {
            name: "gcpRegion",
            description: "GCP region",
            defaultValue: "us-east1",
            requiredFor: ["gcp"],
        },
        {
            name: "supabaseUrl",
            description: "Supabase URL",
            requiredFor: ["gcp"],
        },
        {
            name: "supabaseServiceKey",
            description: "Supabase service key",
            isSecret: true,
            requiredFor: ["gcp"],
        },
        {
            name: "apiImage",
            description: "API image name",
            requiredFor: ["gcp"],
        },
    ];

    constructor(configDir: string) {
        this.configDir = configDir;
    }

    private getRequiredVariables(
        skipPhases: { images: boolean; supabase: boolean; gcp: boolean },
    ): VariableConfig[] {
        const activePhases:
            ("images" | "supabase" | "supabase-secrets" | "gcp")[] = [];

        if (!skipPhases.images) {
            activePhases.push("images");
        }
        if (!skipPhases.supabase) {
            activePhases.push("supabase");
            // If Supabase is not skipped, we need its secrets
            activePhases.push("supabase-secrets");
        }
        if (!skipPhases.gcp) {
            activePhases.push("gcp");
        }

        return this.variables.filter((variable) =>
            variable.requiredFor.some((phase) => activePhases.includes(phase))
        );
    }

    async loadExistingValues(): Promise<void> {
        // Load existing values from config files

        const dockerRepoPath = path.join(this.configDir, "docker-repo");
        const supabaseProjectPath = path.join(
            this.configDir,
            "supabase-project-id",
        );
        const dbPasswordPath = path.join(this.configDir, "db-password");
        const supabaseServiceKeyPath = path.join(
            this.configDir,
            "supabase-service-key",
        );
        const gcpProjectPath = path.join(this.configDir, "gcp-project-id");
        const gcpRegionPath = path.join(this.configDir, "gcp-region");

        if (await exists(dockerRepoPath)) {
            this.values.dockerRepo = await readFile(dockerRepoPath, "utf8");
        }
        if (await exists(supabaseProjectPath)) {
            this.values.supabaseProjectRef = await readFile(
                supabaseProjectPath,
                "utf8",
            );
            this.values.supabaseUrl =
                `https://${this.values.supabaseProjectRef}.supabase.co`;
        }
        if (await exists(dbPasswordPath)) {
            this.values.dbPassword = await readFile(dbPasswordPath, "utf8");
        }
        if (await exists(supabaseServiceKeyPath)) {
            this.values.supabaseServiceKey = await readFile(
                supabaseServiceKeyPath,
                "utf8",
            );
        }
        if (await exists(gcpProjectPath)) {
            this.values.gcpProjectId = await readFile(gcpProjectPath, "utf8");
        }
        if (await exists(gcpRegionPath)) {
            this.values.gcpRegion = await readFile(gcpRegionPath, "utf8");
        }

        const jobsImage = await getImageFromEnv("job");
        if (jobsImage) {
            this.values.jobsImage = jobsImage;
        }
        const apiImage = await getImageFromEnv("api");
        if (apiImage) {
            this.values.apiImage = apiImage;
        }

        // Try to load GCP-specific values from tfvars
        const tfvarsPath = path.join(APP_DIR, "gcp", "terraform.tfvars");
        if (await exists(tfvarsPath)) {
            const tfvars = await readTerraformVars(tfvarsPath);
            if (tfvars.api_service_url) {
                this.values.apiUrl = tfvars.api_service_url;
            }
            if (tfvars.api_service_account_key) {
                this.values.gcpSvcAccountKey = tfvars.api_service_account_key;
            }
        }
    }

    async prompt(
        skipPhases: { images: boolean; supabase: boolean; gcp: boolean },
    ): Promise<void> {
        const prompt = promptSync({ sigint: true });
        console.log("\n=== Collecting Configuration ===");

        const requiredVars = this.getRequiredVariables(skipPhases);

        for (const varConfig of requiredVars) {
            if (!this.values[varConfig.name]) {
                const promptText = `Enter ${varConfig.description}${
                    varConfig.defaultValue ? ` [${varConfig.defaultValue}]` : ""
                }: `;

                if (varConfig.isSecret) {
                    this.values[varConfig.name] = prompt(promptText, {
                        echo: "*",
                    });
                } else {
                    this.values[varConfig.name] = prompt(
                        promptText,
                        varConfig.defaultValue || "",
                    );
                }
            }
        }
    }

    async validatePhaseRequirements(
        phase: "images" | "supabase" | "gcp",
        skipPhases: { images: boolean; supabase: boolean; gcp: boolean },
    ): Promise<void> {
        const requiredVars = this.getRequiredVariables(skipPhases);
        const missingVars: string[] = [];

        for (const varConfig of requiredVars) {
            if (!this.values[varConfig.name]) {
                missingVars.push(varConfig.description);
            }
        }

        if (missingVars.length > 0) {
            throw new Error(
                `Missing required variables: ${missingVars.join(", ")}`,
            );
        }
    }

    getValue(key: string): string {
        const value = this.values[key];
        if (!value) {
            throw new Error(`Required variable ${key} is not set`);
        }
        return value;
    }

    setValue(key: string, value: string): void {
        this.values[key] = value;
    }
}

export function setupCloudCommand(program: Command): void {
    program
        .command("cloud")
        .description("Deploy to cloud")
        .option("-i, --interactive", "Run in interactive mode", true)
        .option("--skip-images", "Skip building and pushing images")
        .option("--skip-supabase", "Skip Supabase deployment")
        .option("--skip-supabase-secrets", "Skip Supabase secrets deployment")
        .option("--skip-gcp", "Skip GCP deployment")
        .action(async (options: CloudOptions) => {
            try {
                const configDir = path.join(
                    process.env.HOME || "",
                    ".planqtn",
                    ".config",
                );

                // Create config directory if it doesn't exist
                if (!await exists(configDir)) {
                    await mkdir(configDir, { recursive: true });
                }

                // Copy example config if it doesn't exist
                const exampleConfig = path.join(APP_DIR, ".config.example");
                if (!await exists(path.join(configDir, "docker-repo"))) {
                    execSync(`cp -r ${exampleConfig}/* ${configDir}/`);
                }

                const variableManager = new VariableManager(configDir);
                await variableManager.loadExistingValues();

                const skipPhases = {
                    images: options.skipImages,
                    supabase: options.skipSupabase,
                    gcp: options.skipGcp,
                    supabaseSecrets: options.skipSupabaseSecrets,
                };

                if (options.interactive) {
                    await variableManager.prompt(skipPhases);
                }

                // Now proceed with the setup using the collected variables
                console.log("\n=== Starting Setup ===");

                // Build images if needed
                if (!skipPhases.images) {
                    await variableManager.validatePhaseRequirements(
                        "images",
                        skipPhases,
                    );
                    console.log("\nBuilding and pushing images...");
                    await buildAndPushImages();
                }

                // Setup Supabase if needed
                if (!skipPhases.supabase) {
                    await variableManager.validatePhaseRequirements(
                        "supabase",
                        skipPhases,
                    );
                    await setupSupabase(
                        configDir,
                        variableManager.getValue("supabaseProjectRef"),
                        variableManager.getValue("dbPassword"),
                        variableManager.getValue("supabaseServiceKey"),
                    );
                }

                // Setup GCP if needed
                if (!skipPhases.gcp) {
                    await variableManager.validatePhaseRequirements(
                        "gcp",
                        skipPhases,
                    );
                    const { apiUrl, serviceAccountKey } = await setupGCP(
                        options.interactive,
                        variableManager.getValue("dockerRepo"),
                        variableManager.getValue("supabaseProjectRef"),
                        variableManager.getValue("supabaseServiceKey"),
                        variableManager.getValue("gcpProjectId"),
                        variableManager.getValue("gcpRegion"),
                    );

                    // Store the GCP outputs in the variable manager
                    variableManager.setValue("apiUrl", apiUrl);
                    variableManager.setValue(
                        "gcpSvcAccountKey",
                        serviceAccountKey,
                    );
                }

                if (!skipPhases.supabaseSecrets) {
                    const jobsImage = await getImageFromEnv("job");
                    if (!jobsImage) {
                        throw new Error(
                            "Failed to get jobs image from environment",
                        );
                    }
                    await setupSupabaseSecrets(
                        configDir,
                        jobsImage,
                        variableManager.getValue("gcpProjectId"),
                        variableManager.getValue("gcpSvcAccountKey"),
                        variableManager.getValue("apiUrl"),
                    );
                }
            } catch (error) {
                console.error("Error:", error);
                process.exit(1);
            }
        });
}

interface CloudOptions {
    interactive: boolean;
    skipImages: boolean;
    skipSupabase: boolean;
    skipSupabaseSecrets: boolean;
    skipGcp: boolean;
}
