import { Command } from "commander";
import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { promisify } from "util";
import { getImageFromEnv, handleImage } from "./images";
import promptSync from "prompt-sync";
import * as https from "https";
import * as os from "os";

const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);
const mkdir = promisify(fs.mkdir);
const exists = promisify(fs.exists);
const unlink = promisify(fs.unlink);

// Get the app directory path (one level up from planqtn_cli)
const APP_DIR = path.join(process.cwd(), "..");
const PLANQTN_BIN_DIR = path.join(process.env.HOME || "", ".planqtn", "bin");

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
    // Run migrations
    console.log("\nRunning database migrations...");
    execSync(
        `npx node-pg-migrate up -m ${path.join(APP_DIR, "migrations")}`,
        {
            stdio: "inherit",
            env: {
                ...process.env,
                DATABASE_URL:
                    `postgresql://postgres.${projectId}:${dbPassword}@aws-0-us-east-2.pooler.supabase.com:6543/postgres`,
            },
        },
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

async function ensureTerraformInstalled(): Promise<string> {
    // Create bin directory if it doesn't exist
    if (!await exists(PLANQTN_BIN_DIR)) {
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
    const zipUrl =
        `https://releases.hashicorp.com/terraform/${version}/terraform_${version}_${osName}_${archName}.zip`;
    const zipPath = path.join(PLANQTN_BIN_DIR, "terraform.zip");

    // Download Terraform
    await new Promise<void>((resolve, reject) => {
        https.get(zipUrl, (res) => {
            if (res.statusCode !== 200) {
                reject(
                    new Error(
                        `Failed to download Terraform: ${res.statusCode}`,
                    ),
                );
                return;
            }
            const file = fs.createWriteStream(zipPath);
            res.pipe(file);
            file.on("finish", () => {
                file.close();
                resolve();
            });
            file.on("error", reject);
        }).on("error", reject);
    });

    // Unzip Terraform
    execSync(`unzip -o ${zipPath} -d ${PLANQTN_BIN_DIR}`);
    await unlink(zipPath);

    // Make terraform executable
    execSync(`chmod +x ${terraformPath}`);

    console.log("Terraform installed successfully.");
    return terraformPath;
}

async function setupGCP(
    interactive: boolean,
    dockerRepo: string,
    supabaseProjectId: string,
    supabaseServiceKey: string,
    gcpProjectId: string,
    gcpRegion: string,
): Promise<void> {
    const terraformPath = await ensureTerraformInstalled();
    const tfvarsPath = path.join(APP_DIR, "gcp", "terraform.tfvars");

    if (!(await exists(tfvarsPath))) {
        console.log("Creating empty terraform.tfvars file...");
        await writeFile(tfvarsPath, "");
    }

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
    execSync(`${terraformPath} init`, { cwd: gcpDir, stdio: "inherit" });
    execSync(`${terraformPath} apply -auto-approve`, {
        cwd: gcpDir,
        stdio: "inherit",
    });
}

async function setupSupabaseSecrets(
    configDir: string,
    jobsImage: string,
    gcpProjectId: string,
    serviceAccountKey: string,
    apiUrl: string,
): Promise<void> {
    if (!serviceAccountKey) {
        throw new Error(
            "GCP service account key is required for Supabase secrets setup",
        );
    }
    if (!apiUrl) {
        throw new Error("API URL is required for Supabase secrets setup");
    }

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
    requiredFor: (
        | "images"
        | "supabase"
        | "supabase-secrets"
        | "gcp"
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

    abstract load(vars: Variable[]): Promise<void>;
    abstract save(): Promise<void>;

    getValue(): string | undefined {
        return this.value;
    }

    getRequiredValue(): string {
        if (!this.value) {
            throw new Error(
                `Required variable ${this.config.name} is not set. Hint: ${this.config.hint}`,
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
        return `PLANQTN_${this.config.name.toUpperCase()}`;
    }

    async loadFromEnv(vars: Variable[]): Promise<void> {
        const envVarName = this.getEnvVarName();
        const envValue = process.env[envVarName];
        if (envValue) {
            this.setValue(envValue);
        }
    }
}

class PlainFileVar extends Variable {
    private filePath: string;

    constructor(config: VariableConfig, configDir: string, filename: string) {
        super(config);
        this.filePath = path.join(configDir, filename);
    }

    async load(vars: Variable[]): Promise<void> {
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

    constructor(
        config: VariableConfig,
        computeFn: (vars: Variable[]) => string,
    ) {
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
        } catch (error) {
            if (error instanceof Error) {
                console.warn(
                    `Error deriving ${this.getName()}:`,
                    error.message,
                );
            } else {
                console.warn(`Error deriving ${this.getName()}:`, error);
            }
        }
    }

    async loadFromEnv(vars: Variable[]): Promise<void> {
        try {
            await this.load(vars);
        } catch (error) {
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

    async load(vars: Variable[]): Promise<void> {
        this.value = await getImageFromEnv(this.envKey);
    }

    async save(): Promise<void> {
        // Env vars don't save to storage
    }
}

class VariableManager {
    private configDir: string;
    private variables: Variable[];

    constructor(configDir: string) {
        this.configDir = configDir;
        this.variables = [
            new PlainFileVar(
                {
                    name: "dockerRepo",
                    description:
                        "Docker repository (e.g., Docker Hub username or repo)",
                    defaultValue: "planqtn",
                    requiredFor: ["images"],
                },
                configDir,
                "docker-repo",
            ),
            new PlainFileVar(
                {
                    name: "supabaseProjectRef",
                    description: "Supabase project ID",
                    requiredFor: ["supabase"],
                    hint:
                        `Get it from your supabase project settings. Store it in ${configDir}/supabase-project-id`,
                },
                configDir,
                "supabase-project-id",
            ),
            new PlainFileVar(
                {
                    name: "dbPassword",
                    description: "Supabase database password",
                    isSecret: true,
                    requiredFor: ["supabase"],
                },
                configDir,
                "db-password",
            ),
            new PlainFileVar(
                {
                    name: "environment",
                    description: "Environment",
                    defaultValue: "development",
                    requiredFor: ["supabase-secrets", "gcp"],
                },
                configDir,
                "environment",
            ),
            new EnvFileVar(
                {
                    name: "jobsImage",
                    description: "Jobs image name",
                    requiredFor: ["supabase-secrets", "gcp"],
                    outputBy: "images",
                },
                "job",
                "job",
            ),
            new PlainFileVar(
                {
                    name: "gcpProjectId",
                    description: "GCP project ID",
                    requiredFor: ["supabase-secrets", "gcp"],
                },
                configDir,
                "gcp-project-id",
            ),
            new PlainFileVar(
                {
                    name: "apiUrl",
                    description: "Cloud Run PlanqTN API URL",
                    requiredFor: ["supabase-secrets"],
                    outputBy: "gcp",
                },
                configDir,
                "api-url",
            ),
            new PlainFileVar(
                {
                    name: "gcpSvcAccountKey",
                    description: "GCP service account key",
                    isSecret: true,
                    requiredFor: ["supabase-secrets"],
                    outputBy: "gcp",
                },
                configDir,
                "gcp-service-account-key",
            ),
            new PlainFileVar(
                {
                    name: "gcpRegion",
                    description: "GCP region",
                    defaultValue: "us-east1",
                    requiredFor: ["gcp"],
                },
                configDir,
                "gcp-region",
            ),
            new DerivedVar(
                {
                    name: "supabaseUrl",
                    description: "Supabase URL",
                    requiredFor: ["gcp"],
                },
                (vars) =>
                    `https://${
                        vars.find((v) => v.getName() === "supabaseProjectRef")
                            ?.getRequiredValue()
                    }.supabase.co`,
            ),
            new PlainFileVar(
                {
                    name: "supabaseServiceKey",
                    description: "Supabase service key",
                    isSecret: true,
                    requiredFor: ["gcp", "integration-test-config"],
                },
                configDir,
                "supabase-service-key",
            ),
            new EnvFileVar(
                {
                    name: "apiImage",
                    description: "API image name",
                    requiredFor: ["gcp"],
                    outputBy: "images",
                },
                "api",
                "api",
            ),
            new PlainFileVar(
                {
                    name: "supabaseAnonKey",
                    description: "Supabase anonymous key",
                    isSecret: true,
                    requiredFor: ["integration-test-config"],
                },
                configDir,
                "supabase-anon-key",
            ),
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
                const otherVars = Object.fromEntries(
                    this.variables
                        .map((v) => [v.getName(), v.getValue()])
                        .filter(([_, value]) => value !== undefined),
                );
                variable.compute(this.variables);
            }
        }

        // Save all variables
        for (const variable of this.variables) {
            await variable.save();
        }
    }

    getValue(key: string): string {
        const variable = this.variables.find((v) => v.getName() === key);
        if (!variable) {
            throw new Error(`Variable ${key} not found`);
        }
        return variable.getRequiredValue();
    }

    async loadGcpOutputs(): Promise<void> {
        console.log("Loading GCP outputs...");
        const gcpDir = path.join(APP_DIR, "gcp");
        if (await exists(gcpDir)) {
            try {
                const terraformPath = await ensureTerraformInstalled();
                // Get Terraform outputs
                const apiUrl = execSync(
                    `${terraformPath} output -raw api_service_url`,
                    {
                        cwd: gcpDir,
                    },
                ).toString().trim();
                console.log("API URL:", apiUrl);
                const rawServiceAccountKey = execSync(
                    `${terraformPath} output -raw api_service_account_key`,
                    { cwd: gcpDir },
                ).toString().trim();

                // Base64 encode the service account key using Buffer
                const serviceAccountKey = Buffer.from(rawServiceAccountKey)
                    .toString("base64");

                // Set values on the Variable instances
                const apiUrlVar = this.variables.find((v) =>
                    v.getName() === "apiUrl"
                );
                const gcpSvcAccountKeyVar = this.variables.find((v) =>
                    v.getName() === "gcpSvcAccountKey"
                );

                if (apiUrlVar) {
                    apiUrlVar.setValue(apiUrl);
                }
                if (gcpSvcAccountKeyVar) {
                    gcpSvcAccountKeyVar.setValue(serviceAccountKey);
                }

                console.log("Terraform outputs loaded successfully.");
            } catch (error) {
                // Silently fail if terraform commands fail - outputs might not be available yet
                console.log(
                    "Warning: Terraform outputs not found.",
                    error,
                );
            }
        } else {
            console.log(
                "Warning: Terraform outputs not found.",
            );
        }
    }

    private getRequiredVariables(
        skipPhases: { images: boolean; supabase: boolean; gcp: boolean },
        phase?: "images" | "supabase" | "gcp",
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
            return config.requiredFor.some((p) =>
                !skipPhases[p as keyof typeof skipPhases]
            );
        });
    }

    async prompt(
        skipPhases: { images: boolean; supabase: boolean; gcp: boolean },
    ): Promise<void> {
        const prompt = promptSync({ sigint: true });
        console.log("\n=== Collecting Configuration ===");

        const requiredVars = this.getRequiredVariables(skipPhases);

        for (const variable of requiredVars) {
            const config = variable.getConfig();
            const currentValue = variable.getValue();
            // Only skip prompting if the value is set AND it's output by a non-skipped phase
            if (!currentValue || (currentValue && !config.outputBy)) {
                const promptText = `Enter ${config.description}${
                    config.defaultValue ? ` [${config.defaultValue}]` : ""
                }${
                    currentValue && !config.isSecret
                        ? ` (current: ${currentValue})`
                        : currentValue && config.isSecret
                        ? " (leave blank to keep current value)"
                        : " (not set)"
                }: `;

                let value: string;
                if (config.isSecret) {
                    value = prompt(promptText, { echo: "*" });
                } else {
                    value = prompt(promptText, config.defaultValue || "");
                }

                if (value) {
                    variable.setValue(value);
                }
            }
        }

        await this.saveValues();
    }

    async validatePhaseRequirements(
        phase: "images" | "supabase" | "gcp",
        skipPhases: { images: boolean; supabase: boolean; gcp: boolean },
    ): Promise<void> {
        const requiredVars = this.getRequiredVariables(skipPhases, phase);
        const missingVars: string[] = [];

        for (const variable of requiredVars) {
            if (!variable.getValue()) {
                missingVars.push(variable.getConfig().description);
            }
        }

        if (missingVars.length > 0) {
            throw new Error(
                `Missing required variables: ${missingVars.join(", ")}`,
            );
        }
    }

    async generateIntegrationTestConfig(): Promise<void> {
        const config = {
            ANON_KEY: this.getValue("supabaseAnonKey"),
            API_URL: this.getValue("supabaseUrl"),
            SERVICE_ROLE_KEY: this.getValue("supabaseServiceKey"),
        };

        const configPath = path.join(this.configDir, "supabase_config.json");
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

export function setupCloudCommand(program: Command): void {
    const cloudCommand = program
        .command("cloud")
        .description("Deploy to cloud");

    cloudCommand
        .command("deploy")
        .description("Deploy to cloud")
        .option("-q, --non-interactive", "Run in non-interactive mode", false)
        .option("--skip-images", "Skip building and pushing images")
        .option("--skip-supabase", "Skip Supabase deployment")
        .option("--skip-supabase-secrets", "Skip Supabase secrets deployment")
        .option("--skip-gcp", "Skip GCP deployment")
        .option(
            "--skip-integration-test-config",
            "Skip integration test config generation",
        )
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

                // // Copy example config if it doesn't exist
                // const exampleConfig = path.join(APP_DIR, ".config.example");
                // if (!await exists(path.join(configDir, "docker-repo"))) {
                //     execSync(`cp -r ${exampleConfig}/* ${configDir}/`);
                // }

                const variableManager = new VariableManager(configDir);
                await variableManager.loadExistingValues();

                const skipPhases = {
                    images: options.skipImages,
                    supabase: options.skipSupabase,
                    gcp: options.skipGcp,
                    supabaseSecrets: options.skipSupabaseSecrets,
                    integrationTestConfig: options.skipIntegrationTestConfig,
                };

                // Load GCP outputs if GCP is not skipped
                if (!skipPhases.gcp) {
                    await variableManager.loadGcpOutputs();
                }

                if (!options.nonInteractive) {
                    await variableManager.prompt(skipPhases);
                } else {
                    await variableManager.loadFromEnv();
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
                    await setupGCP(
                        options.nonInteractive,
                        variableManager.getValue("dockerRepo"),
                        variableManager.getValue("supabaseProjectRef"),
                        variableManager.getValue("supabaseServiceKey"),
                        variableManager.getValue("gcpProjectId"),
                        variableManager.getValue("gcpRegion"),
                    );
                    // Reload outputs after GCP setup
                    await variableManager.loadGcpOutputs();
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

                // Generate integration test config if needed
                if (!skipPhases.integrationTestConfig) {
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
                    ".config",
                );

                // Create config directory if it doesn't exist
                if (!await exists(configDir)) {
                    await mkdir(configDir, { recursive: true });
                }

                const variableManager = new VariableManager(configDir);
                await variableManager.loadExistingValues();

                // Only prompt for variables needed for integration test config
                const skipPhases = {
                    images: true,
                    supabase: true,
                    gcp: true,
                    supabaseSecrets: true,
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
        .description(
            "Print required environment variables for non-interactive mode",
        )
        .action(async () => {
            try {
                const configDir = path.join(
                    process.env.HOME || "",
                    ".planqtn",
                    ".config",
                );

                const variableManager = new VariableManager(configDir);
                const userVars = variableManager.getUserVariables();

                console.log(
                    "\nRequired environment variables for non-interactive mode:",
                );
                console.log(
                    "=====================================================",
                );
                for (const variable of userVars) {
                    const config = variable.getConfig();
                    console.log(`# Description: ${config.description}`);
                    if (config.hint) {
                        console.log(`# Hint: ${config.hint}`);
                    }
                    if (config.defaultValue) {
                        console.log(`# Default: ${config.defaultValue}`);
                    }
                    await variable.loadFromEnv(userVars);

                    console.log(
                        `${variable.getEnvVarName()}: \${{ secrets.${variable.getEnvVarName()} }}`,
                    );
                    console.log();
                }
                console.log(
                    "\n=====================================================",
                );
                console.log(
                    "\nSet these environment variables in your CI/CD secrets.",
                );
            } catch (error) {
                console.error("Error:", error);
                process.exit(1);
            }
        });
}

interface CloudOptions {
    nonInteractive: boolean;
    skipImages: boolean;
    skipSupabase: boolean;
    skipSupabaseSecrets: boolean;
    skipGcp: boolean;
    skipIntegrationTestConfig: boolean;
}
