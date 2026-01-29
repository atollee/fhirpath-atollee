/**
 * Build script for npm package and browser bundle
 * 
 * Usage: deno run -A scripts/build-npm.ts
 * 
 * Creates:
 * - dist/npm/ - npm-compatible package
 * - dist/browser/ - browser bundle (ESM + UMD)
 */

import { build, emptyDir } from "jsr:@deno/dnt@0.41.3";

const VERSION = "0.4.0";

async function buildNpm() {
  console.log("Building npm package...");
  
  await emptyDir("./dist/npm");

  await build({
    entryPoints: [
      "./mod.ts",
      {
        name: "./fhir-context/r4",
        path: "./fhir-context/r4/mod.ts",
      },
      {
        name: "./fhir-context/r5",
        path: "./fhir-context/r5/mod.ts",
      },
      {
        name: "./fhir-context/r6",
        path: "./fhir-context/r6/mod.ts",
      },
    ],
    outDir: "./dist/npm",
    shims: {
      deno: "dev",
    },
    // Skip type checking since we're building from TypeScript sources
    typeCheck: false,
    // Skip tests
    test: false,
    // Filter function to exclude test files and problematic modules
    filterDiagnostic(diagnostic) {
      // Ignore cannot find module errors for test dependencies
      if (diagnostic.code === 2307) {
        const text = typeof diagnostic.messageText === 'string' 
          ? diagnostic.messageText 
          : diagnostic.messageText?.messageText;
        if (text?.includes("@std/assert") || text?.includes("fhir/r6")) {
          return false;
        }
      }
      return true;
    },
    package: {
      name: "@atollee/fhirpath",
      version: VERSION,
      description: "High-performance FHIRPath implementation in TypeScript - drop-in replacement for fhirpath.js",
      license: "MIT",
      repository: {
        type: "git",
        url: "https://github.com/atollee/fhirpath-atollee.git",
      },
      bugs: {
        url: "https://github.com/atollee/fhirpath-atollee/issues",
      },
      keywords: [
        "fhirpath",
        "fhir",
        "hl7",
        "healthcare",
        "medical",
        "typescript",
        "query",
        "expression",
      ],
      engines: {
        node: ">=18.0.0",
      },
    },
    postBuild() {
      // Copy additional files
      Deno.copyFileSync("LICENSE", "dist/npm/LICENSE");
      Deno.copyFileSync("README.md", "dist/npm/README.md");
    },
  });

  console.log("npm package built successfully!");
}

async function buildBrowser() {
  console.log("Building browser bundle...");
  
  await emptyDir("./dist/browser");
  
  // Use esbuild for browser bundle
  const esbuildProcess = new Deno.Command("deno", {
    args: [
      "run",
      "-A",
      "npm:esbuild@0.20.0",
      "./mod.ts",
      "--bundle",
      "--format=esm",
      "--outfile=./dist/browser/fhirpath.esm.js",
      "--target=es2020",
      "--minify",
      "--sourcemap",
    ],
    stdout: "inherit",
    stderr: "inherit",
  });
  
  const result = await esbuildProcess.output();
  
  if (!result.success) {
    console.error("Browser ESM build failed!");
    return;
  }
  
  // Build UMD version
  const umdProcess = new Deno.Command("deno", {
    args: [
      "run",
      "-A",
      "npm:esbuild@0.20.0",
      "./mod.ts",
      "--bundle",
      "--format=iife",
      "--global-name=fhirpath",
      "--outfile=./dist/browser/fhirpath.umd.js",
      "--target=es2020",
      "--minify",
      "--sourcemap",
    ],
    stdout: "inherit",
    stderr: "inherit",
  });
  
  const umdResult = await umdProcess.output();
  
  if (!umdResult.success) {
    console.error("Browser UMD build failed!");
    return;
  }
  
  console.log("Browser bundles built successfully!");
  console.log("  - dist/browser/fhirpath.esm.js");
  console.log("  - dist/browser/fhirpath.umd.js");
}

// Main
console.log(`Building @atollee/fhirpath v${VERSION}`);
console.log("=".repeat(50));

try {
  await buildNpm();
  console.log("");
  await buildBrowser();
  console.log("");
  console.log("Build complete!");
} catch (error) {
  console.error("Build failed:", error);
  Deno.exit(1);
}
