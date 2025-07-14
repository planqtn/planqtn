#!/usr/bin/env -S deno run --allow-net --allow-read
/**
 * Deno license checker for Apache 2.0 compatibility
 * Checks licenses from external imports in Supabase Edge Functions
 */

import { parse } from "https://deno.land/std@0.208.0/flags/mod.ts";

interface DenoModuleInfo {
  specifier: string;
  license?: string;
  repository?: string;
  name?: string;
  version?: string;
  registry?: string;
}

interface RegistryInfo {
  name: string;
  version: string;
  license?: string;
  repository?: string;
}

interface ManualLicenseLookup {
  license_type: string;
  license_url: string;
  reason: string;
  verified_date: string;
  note?: string;
}

interface Config {
  apache_2_compatible: {
    allowed: string[];
    requires_review: string[];
    prohibited: string[];
  };
  exceptions?: Record<string, any>;
  manual_license_lookups?: Record<string, ManualLicenseLookup>;
  deno_manual_license_lookups?: Record<string, ManualLicenseLookup>;
}

const COMPATIBLE_LICENSES = [
  "MIT",
  "BSD",
  "BSD-2-Clause",
  "BSD-3-Clause",
  "Apache-2.0",
  "ISC",
  "Unlicense",
  "0BSD",
  "CC0-1.0",
  "PSF",
  "CC-BY-4.0",
  "WTFPL"
];

const REVIEW_LICENSES = [
  "MPL-2.0",
  "MPL",
  "UNKNOWN",
  "Custom",
  "Python-2.0",
  "UNLICENSED"
];

const PROHIBITED_LICENSES = [
  "GPL",
  "GPL-2.0",
  "GPL-3.0",
  "LGPL",
  "LGPL-2.1",
  "LGPL-3.0",
  "AGPL",
  "AGPL-3.0",
  "CDDL",
  "EPL",
  "EUPL",
  "OSL",
  "SSPL",
  "BUSL"
];

async function getJsrPackageInfo(
  name: string,
  version: string
): Promise<RegistryInfo | null> {
  try {
    const response = await fetch(
      `https://jsr.io/@${name}/${version}/meta.json`
    );
    if (!response.ok) {
      return null;
    }
    const data = await response.json();
    return {
      name: `@${name}`,
      version,
      license: data.license,
      repository: data.repository
    };
  } catch (error) {
    console.error(`Error fetching JSR info for ${name}@${version}:`, error);
    return null;
  }
}

async function getDenoLandPackageInfo(
  name: string,
  version?: string
): Promise<RegistryInfo | null> {
  try {
    const baseUrl = `https://deno.land/x/${name}`;
    const metaUrl = version
      ? `${baseUrl}@${version}/meta.json`
      : `${baseUrl}/meta.json`;

    const response = await fetch(metaUrl);
    if (!response.ok) {
      return null;
    }
    const data = await response.json();
    return {
      name,
      version: version || "latest",
      license: data.license,
      repository: data.repository
    };
  } catch (error) {
    console.error(`Error fetching Deno Land info for ${name}:`, error);
    return null;
  }
}

async function getNpmPackageInfo(
  name: string,
  version: string
): Promise<RegistryInfo | null> {
  try {
    const response = await fetch(
      `https://registry.npmjs.org/${name}/${version}`
    );
    if (!response.ok) {
      return null;
    }
    const data = await response.json();
    return {
      name,
      version,
      license: data.license,
      repository: data.repository?.url
    };
  } catch (error) {
    console.error(`Error fetching NPM info for ${name}@${version}:`, error);
    return null;
  }
}

function parseImportUrl(url: string): DenoModuleInfo {
  const info: DenoModuleInfo = { specifier: url };

  // JSR imports: jsr:@scope/package@version
  const jsrMatch = url.match(/^jsr:@([^/]+)\/([^@]+)@?(.+)?$/);
  if (jsrMatch) {
    info.name = `${jsrMatch[1]}/${jsrMatch[2]}`;
    info.version = jsrMatch[3] || "latest";
    info.registry = "jsr";
    return info;
  }

  // NPM imports: npm:package@version
  const npmMatch = url.match(/^npm:([^@]+)@(.+)$/);
  if (npmMatch) {
    info.name = npmMatch[1];
    info.version = npmMatch[2];
    info.registry = "npm";
    return info;
  }

  // Deno.land imports: https://deno.land/x/package@version/...
  const denoLandMatch = url.match(
    /https:\/\/deno\.land\/x\/([^@\/]+)(?:@([^\/]+))?/
  );
  if (denoLandMatch) {
    info.name = denoLandMatch[1];
    info.version = denoLandMatch[2] || "latest";
    info.registry = "deno.land";
    return info;
  }

  // ESM.sh imports: https://esm.sh/package@version
  const esmMatch = url.match(/https:\/\/esm\.sh\/([^@\/]+)@([^\/]+)/);
  if (esmMatch) {
    info.name = esmMatch[1];
    info.version = esmMatch[2];
    info.registry = "esm.sh";
    return info;
  }

  // Standard library: https://deno.land/std@version/...
  const stdMatch = url.match(/https:\/\/deno\.land\/std@([^\/]+)/);
  if (stdMatch) {
    info.name = "std";
    info.version = stdMatch[1];
    info.registry = "deno.land";
    info.license = "MIT"; // Deno standard library is MIT licensed
    return info;
  }

  // Other URLs - mark as unknown
  info.name = "unknown";
  info.version = "unknown";
  info.registry = "unknown";

  return info;
}

async function getLicenseInfo(
  moduleInfo: DenoModuleInfo
): Promise<string | null> {
  if (moduleInfo.license) {
    return moduleInfo.license;
  }

  if (!moduleInfo.name || !moduleInfo.version) {
    return null;
  }

  let registryInfo: RegistryInfo | null = null;

  switch (moduleInfo.registry) {
    case "jsr":
      registryInfo = await getJsrPackageInfo(
        moduleInfo.name,
        moduleInfo.version
      );
      break;
    case "npm":
      registryInfo = await getNpmPackageInfo(
        moduleInfo.name,
        moduleInfo.version
      );
      break;
    case "deno.land":
      registryInfo = await getDenoLandPackageInfo(
        moduleInfo.name,
        moduleInfo.version
      );
      break;
    case "esm.sh":
      // ESM.sh serves NPM packages, so try NPM registry
      registryInfo = await getNpmPackageInfo(
        moduleInfo.name,
        moduleInfo.version
      );
      break;
    default:
      return "UNKNOWN";
  }

  return registryInfo?.license || "UNKNOWN";
}

function categorizeLicense(
  license: string,
  config: Config
): "compatible" | "review" | "prohibited" {
  const normalizedLicense = license.toUpperCase();

  const allowed = config.apache_2_compatible.allowed.map((l) =>
    l.toUpperCase()
  );
  const review = config.apache_2_compatible.requires_review.map((l) =>
    l.toUpperCase()
  );
  const forbidden = config.apache_2_compatible.prohibited.map((l) =>
    l.toUpperCase()
  );

  if (forbidden.some((prohibited) => normalizedLicense.includes(prohibited))) {
    return "prohibited";
  }

  if (allowed.some((compatible) => normalizedLicense.includes(compatible))) {
    return "compatible";
  }

  if (
    review.some((reviewLicense) => normalizedLicense.includes(reviewLicense))
  ) {
    return "review";
  }

  return "review";
}

async function extractImportsFromFile(filePath: string): Promise<string[]> {
  const imports: string[] = [];

  try {
    const content = await Deno.readTextFile(filePath);
    const lines = content.split("\n");

    for (const line of lines) {
      // Match import statements
      const importMatch = line.match(/from\s+["']([^"']+)["']/);
      if (importMatch) {
        const importPath = importMatch[1];
        if (
          importPath.startsWith("http") ||
          importPath.startsWith("jsr:") ||
          importPath.startsWith("npm:")
        ) {
          imports.push(importPath);
        }
      }

      // Match dynamic imports
      const dynamicMatch = line.match(/import\s*\(\s*["']([^"']+)["']\s*\)/);
      if (dynamicMatch) {
        const importPath = dynamicMatch[1];
        if (
          importPath.startsWith("http") ||
          importPath.startsWith("jsr:") ||
          importPath.startsWith("npm:")
        ) {
          imports.push(importPath);
        }
      }
    }
  } catch (error) {
    console.error(`Error reading file ${filePath}:`, error);
  }

  return imports;
}

async function getAllImports(): Promise<string[]> {
  const allImports: string[] = [];

  // Read import_map.json
  try {
    const importMapContent = await Deno.readTextFile(
      "app/supabase/functions/import_map.json"
    );
    const importMap = JSON.parse(importMapContent);

    if (importMap.imports) {
      Object.values(importMap.imports).forEach((importPath: any) => {
        if (
          typeof importPath === "string" &&
          (importPath.startsWith("http") ||
            importPath.startsWith("jsr:") ||
            importPath.startsWith("npm:"))
        ) {
          allImports.push(importPath);
        }
      });
    }
  } catch (error) {
    console.error("Error reading import_map.json:", error);
  }

  // Scan TypeScript files for imports
  const tsFiles = [];
  for await (const entry of Deno.readDir("app/supabase/functions")) {
    if (entry.isDirectory) {
      for await (const subEntry of Deno.readDir(
        `app/supabase/functions/${entry.name}`
      )) {
        if (subEntry.isFile && subEntry.name.endsWith(".ts")) {
          tsFiles.push(`app/supabase/functions/${entry.name}/${subEntry.name}`);
        }
      }
    }
  }

  // Also check shared directory
  try {
    for await (const entry of Deno.readDir("app/supabase/functions/shared")) {
      if (entry.isDirectory) {
        for await (const subEntry of Deno.readDir(
          `app/supabase/functions/shared/${entry.name}`
        )) {
          if (subEntry.isFile && subEntry.name.endsWith(".ts")) {
            tsFiles.push(
              `app/supabase/functions/shared/${entry.name}/${subEntry.name}`
            );
          }
        }
      }
    }
  } catch (error) {
    console.error("Error reading shared directory:", error);
  }

  for (const file of tsFiles) {
    const imports = await extractImportsFromFile(file);
    allImports.push(...imports);
  }

  return [...new Set(allImports)]; // Remove duplicates
}

async function loadConfig(): Promise<Config> {
  try {
    const configPath = "licenses/license-config.json";
    const configContent = await Deno.readTextFile(configPath);
    return JSON.parse(configContent) as Config;
  } catch (error) {
    console.error("Error loading config:", error);
    // Return default config if loading fails
    return {
      apache_2_compatible: {
        allowed: COMPATIBLE_LICENSES,
        requires_review: REVIEW_LICENSES,
        prohibited: PROHIBITED_LICENSES
      }
    };
  }
}

function getManualLicense(
  moduleInfo: DenoModuleInfo,
  config: Config
): string | null {
  const manualLookups = config.deno_manual_license_lookups || {};

  // Check by package name
  if (moduleInfo.name && manualLookups[moduleInfo.name]) {
    return manualLookups[moduleInfo.name].license_type;
  }

  // Check by full specifier for exact matches
  if (manualLookups[moduleInfo.specifier]) {
    return manualLookups[moduleInfo.specifier].license_type;
  }

  return null;
}

async function main() {
  console.log(
    "🔍 Checking Deno dependencies for Apache 2.0 compatibility...\n"
  );

  const config = await loadConfig();
  const imports = await getAllImports();

  if (imports.length === 0) {
    console.log("No external imports found.");
    return;
  }

  console.log(`Found ${imports.length} external imports to check:\n`);

  const results = {
    compatible: [] as Array<{
      import: string;
      license: string;
      info: DenoModuleInfo;
    }>,
    review: [] as Array<{
      import: string;
      license: string;
      info: DenoModuleInfo;
    }>,
    prohibited: [] as Array<{
      import: string;
      license: string;
      info: DenoModuleInfo;
    }>
  };

  for (const importUrl of imports) {
    const moduleInfo = parseImportUrl(importUrl);
    let license = await getLicenseInfo(moduleInfo);
    let licenseSource = "";

    // Check for manual license lookup if license is unknown
    if (!license || license === "UNKNOWN") {
      const manualLicense = getManualLicense(moduleInfo, config);
      if (manualLicense) {
        license = manualLicense;
        licenseSource = " (Manual lookup)";
      }
    }

    if (!license) {
      results.review.push({
        import: importUrl,
        license: "UNKNOWN",
        info: moduleInfo
      });
      continue;
    }

    const category = categorizeLicense(license, config);
    results[category].push({
      import: importUrl,
      license: license + licenseSource,
      info: moduleInfo
    });
  }

  // Generate report
  let report = "# Deno Dependencies License Report\n\n";

  if (results.compatible.length > 0) {
    report += `## ✅ Compatible Licenses (${results.compatible.length})\n\n`;
    for (const item of results.compatible) {
      report += `- **${item.info.name}@${item.info.version}**: ${item.license}\n`;
      report += `  - Import: \`${item.import}\`\n`;
      report += `  - Registry: ${item.info.registry}\n\n`;
    }
  }

  if (results.review.length > 0) {
    report += `## ⚠️  Licenses Needing Review (${results.review.length})\n\n`;
    for (const item of results.review) {
      report += `- **${item.info.name}@${item.info.version}**: ${item.license}\n`;
      report += `  - Import: \`${item.import}\`\n`;
      report += `  - Registry: ${item.info.registry}\n\n`;
    }
  }

  if (results.prohibited.length > 0) {
    report += `## ❌ Prohibited Licenses (${results.prohibited.length})\n\n`;
    for (const item of results.prohibited) {
      report += `- **${item.info.name}@${item.info.version}**: ${item.license}\n`;
      report += `  - Import: \`${item.import}\`\n`;
      report += `  - Registry: ${item.info.registry}\n\n`;
    }
  }

  // Create licenses directory if it doesn't exist
  try {
    await Deno.mkdir("licenses", { recursive: true });
  } catch (error) {
    // Directory might already exist, ignore error
  }

  // Write report to file
  await Deno.writeTextFile("licenses/deno-license-report.txt", report);

  // Print summary
  console.log("📋 License Check Summary:");
  console.log(`✅ Compatible: ${results.compatible.length}`);
  console.log(`⚠️  Need Review: ${results.review.length}`);
  console.log(`❌ Prohibited: ${results.prohibited.length}`);

  if (results.prohibited.length > 0) {
    console.log("\n❌ FAILED: Found prohibited licenses!");
    for (const item of results.prohibited) {
      console.log(
        `  - ${item.info.name}@${item.info.version}: ${item.license}`
      );
    }
    Deno.exit(1);
  }

  if (results.review.length > 0) {
    console.log("\n⚠️  Some licenses need manual review:");
    for (const item of results.review) {
      console.log(
        `  - ${item.info.name}@${item.info.version}: ${item.license}`
      );
    }
  }

  console.log("\n🎉 License check completed successfully!");
}

if (import.meta.main) {
  main();
}
