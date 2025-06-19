#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import semver from 'semver';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function validateVersion() {
  try {
    // Read package.json
    const packageJsonPath = path.join(__dirname, 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    
    const version = packageJson.version;
    
    if (!version) {
      console.error('❌ Error: No version field found in package.json');
      process.exit(1);
    }
    
    // Validate that it's a valid semver
    if (!semver.valid(version)) {
      console.error(`❌ Error: Invalid semver version: ${version}`);
      console.error('Version must follow semantic versioning format (e.g., 1.0.0, 2.1.0-alpha.1)');
      process.exit(1);
    }
    
    // Additional validation for pre-release versions
    if (semver.prerelease(version)) {
      const prerelease = semver.prerelease(version);
      if (prerelease && prerelease.length > 0) {
        // Check if prerelease identifier is valid
        const prereleaseStr = prerelease.join('.');
        if (!/^alpha\.[0-9]+$/.test(prereleaseStr)) {
          console.error(`❌ Error: Invalid prerelease version: ${version}, must be in the format of alpha.X where X is the build number.`);
          process.exit(1);
        }
      }
    }
    
    console.log(`✅ Version ${version} is valid semver`);
    
    // Optional: Check if version is greater than a minimum version
    // Uncomment the following lines if you want to enforce a minimum version
    // const minVersion = '0.1.0';
    // if (semver.lt(version, minVersion)) {
    //   console.error(`❌ Error: Version ${version} is less than minimum required version ${minVersion}`);
    //   process.exit(1);
    // }
    
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.error('❌ Error: package.json not found');
    } else if (error instanceof SyntaxError) {
      console.error('❌ Error: Invalid JSON in package.json');
    } else {
      console.error(`❌ Error: ${error.message}`);
    }
    process.exit(1);
  }
}

// Run validation
validateVersion(); 