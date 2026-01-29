#!/usr/bin/env -S deno run --allow-net --allow-write --allow-read
/**
 * Generate FHIR Context files for FHIRPath evaluation
 * 
 * Downloads FHIR definitions and generates:
 * - path2Type.json: Mapping from paths to types
 * - choiceTypePaths.json: Choice type paths
 * - pathsDefinedElsewhere.json: Path redirections
 * - type2Parent.json: Type inheritance
 * 
 * Usage: deno run --allow-net --allow-write --allow-read scripts/generate-fhir-context.ts r4b
 */

const FHIR_URLS: Record<string, string> = {
  r4: "https://hl7.org/fhir/R4/definitions.json.zip",
  r4b: "https://hl7.org/fhir/R4B/definitions.json.zip",
  r5: "https://hl7.org/fhir/R5/definitions.json.zip",
  r6: "https://hl7.org/fhir/R6/definitions.json.zip",
};

interface StructureDefinition {
  resourceType: string;
  id: string;
  name: string;
  type: string;
  kind: string;
  baseDefinition?: string;
  snapshot?: {
    element: ElementDefinition[];
  };
}

interface ElementDefinition {
  id: string;
  path: string;
  type?: Array<{ code: string }>;
  contentReference?: string;
}

interface Bundle {
  resourceType: string;
  entry?: Array<{ resource: StructureDefinition }>;
}

async function downloadAndExtract(version: string): Promise<Bundle> {
  const url = FHIR_URLS[version];
  if (!url) {
    throw new Error(`Unknown FHIR version: ${version}. Available: ${Object.keys(FHIR_URLS).join(", ")}`);
  }

  console.log(`Downloading ${url}...`);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download: ${response.statusText}`);
  }

  const zipData = new Uint8Array(await response.arrayBuffer());
  
  // Use Deno's built-in ZIP handling or decompress manually
  // For simplicity, we'll use the unzipped JSON URL directly
  const jsonUrl = url.replace(".zip", "").replace("definitions.json", "profiles-types.json");
  const typesUrl = url.replace("definitions.json.zip", "profiles-types.json");
  const resourcesUrl = url.replace("definitions.json.zip", "profiles-resources.json");
  
  console.log(`Fetching type definitions...`);
  const typesResponse = await fetch(typesUrl);
  const typesBundle = await typesResponse.json() as Bundle;
  
  console.log(`Fetching resource definitions...`);
  const resourcesResponse = await fetch(resourcesUrl);
  const resourcesBundle = await resourcesResponse.json() as Bundle;
  
  // Merge bundles
  return {
    resourceType: "Bundle",
    entry: [
      ...(typesBundle.entry || []),
      ...(resourcesBundle.entry || []),
    ],
  };
}

function processBundle(bundle: Bundle): {
  path2Type: Record<string, string>;
  choiceTypePaths: Record<string, string[]>;
  pathsDefinedElsewhere: Record<string, string>;
  type2Parent: Record<string, string>;
} {
  const path2Type: Record<string, string> = {};
  const choiceTypePaths: Record<string, string[]> = {};
  const pathsDefinedElsewhere: Record<string, string> = {};
  const type2Parent: Record<string, string> = {};

  const structureDefinitions = (bundle.entry || [])
    .map((e) => e.resource)
    .filter((r): r is StructureDefinition => 
      r?.resourceType === "StructureDefinition" && 
      (r.kind === "resource" || r.kind === "complex-type" || r.kind === "primitive-type")
    );

  // Build type2Parent
  for (const sd of structureDefinitions) {
    if (sd.baseDefinition) {
      const parentType = sd.baseDefinition.split("/").pop() || "";
      if (parentType && parentType !== sd.name) {
        type2Parent[sd.name] = parentType;
      }
    }
  }

  // Process elements
  for (const sd of structureDefinitions) {
    if (!sd.snapshot?.element) continue;

    for (const element of sd.snapshot.element) {
      const path = element.path;
      
      // Skip the root element
      if (path === sd.type) continue;
      
      // Handle content references
      if (element.contentReference) {
        const refPath = element.contentReference.replace("#", "");
        pathsDefinedElsewhere[path] = refPath;
        continue;
      }

      // Handle types
      if (element.type && element.type.length > 0) {
        if (element.type.length === 1) {
          // Single type
          path2Type[path] = element.type[0].code;
        } else {
          // Choice type (multiple types)
          // Remove [x] suffix for the path key
          const basePath = path.replace(/\[x\]$/, "");
          choiceTypePaths[basePath] = element.type.map((t) => 
            // Capitalize first letter for choice types
            t.code.charAt(0).toUpperCase() + t.code.slice(1)
          );
        }
      }
    }
  }

  return { path2Type, choiceTypePaths, pathsDefinedElsewhere, type2Parent };
}

function sortObject<T>(obj: Record<string, T>): Record<string, T> {
  const sorted: Record<string, T> = {};
  for (const key of Object.keys(obj).sort()) {
    sorted[key] = obj[key];
  }
  return sorted;
}

async function generate(version: string) {
  const outputDir = `fhir-context/${version}/data`;
  
  console.log(`\nGenerating FHIR ${version.toUpperCase()} context...`);
  
  const bundle = await downloadAndExtract(version);
  console.log(`Processing ${bundle.entry?.length || 0} definitions...`);
  
  const { path2Type, choiceTypePaths, pathsDefinedElsewhere, type2Parent } = processBundle(bundle);
  
  // Create output directory
  await Deno.mkdir(outputDir, { recursive: true });
  
  // Write files
  const files = [
    { name: "path2Type.json", data: sortObject(path2Type) },
    { name: "choiceTypePaths.json", data: sortObject(choiceTypePaths) },
    { name: "pathsDefinedElsewhere.json", data: sortObject(pathsDefinedElsewhere) },
    { name: "type2Parent.json", data: sortObject(type2Parent) },
  ];
  
  for (const { name, data } of files) {
    const path = `${outputDir}/${name}`;
    await Deno.writeTextFile(path, JSON.stringify(data, null, 2) + "\n");
    console.log(`  Written: ${path} (${Object.keys(data).length} entries)`);
  }
  
  // Write mod.ts
  const modContent = `/**
 * FHIR ${version.toUpperCase()} Model for FHIRPath evaluation (ESM version)
 * 
 * This module provides a pure ESM version of the ${version.toUpperCase()} FHIR model.
 * It imports JSON files directly using Deno/ESM JSON imports.
 */

// Import JSON files with assertion (local copies for bundling)
import path2Type from "./data/path2Type.json" with { type: "json" };
import choiceTypePaths from "./data/choiceTypePaths.json" with { type: "json" };
import pathsDefinedElsewhere from "./data/pathsDefinedElsewhere.json" with { type: "json" };
import type2Parent from "./data/type2Parent.json" with { type: "json" };

// Process path2Type to exclude Element and BackboneElement
const path2TypeWithoutElements: Record<string, string> = {};

for (const [p, v] of Object.entries(path2Type as Record<string, string>)) {
  if (v === 'Element' || v === 'BackboneElement') {
    continue;
  }
  path2TypeWithoutElements[p] = v;
}

/**
 * FHIR ${version.toUpperCase()} Model
 */
const ${version}Model = {
  version: '${version}' as const,
  score: {
    propertyURI: 'http://hl7.org/fhir/concept-properties#itemWeight',
    extensionURI: ['http://hl7.org/fhir/StructureDefinition/itemWeight']
  },
  /**
   * A hash of resource element paths that are known to be choice types.
   */
  choiceTypePaths,
  /**
   * A hash from paths to the path for which their content is defined.
   */
  pathsDefinedElsewhere,
  /**
   * Mapping data types to parent data types.
   */
  type2Parent,
  /**
   * Mapping paths to data types.
   */
  path2Type,
  /**
   * Mapping paths to data types (excluding Element and BackboneElement)
   */
  path2TypeWithoutElements,
};

export default ${version}Model;
export { ${version}Model };
`;

  await Deno.writeTextFile(`fhir-context/${version}/mod.ts`, modContent);
  console.log(`  Written: fhir-context/${version}/mod.ts`);
  
  console.log(`\n✅ FHIR ${version.toUpperCase()} context generated successfully!`);
  console.log(`   - path2Type: ${Object.keys(path2Type).length} paths`);
  console.log(`   - choiceTypePaths: ${Object.keys(choiceTypePaths).length} paths`);
  console.log(`   - pathsDefinedElsewhere: ${Object.keys(pathsDefinedElsewhere).length} paths`);
  console.log(`   - type2Parent: ${Object.keys(type2Parent).length} types`);
}

// Main
const version = Deno.args[0];
if (!version) {
  console.log("Usage: deno run --allow-net --allow-write --allow-read scripts/generate-fhir-context.ts <version>");
  console.log("Available versions:", Object.keys(FHIR_URLS).join(", "));
  Deno.exit(1);
}

await generate(version);
