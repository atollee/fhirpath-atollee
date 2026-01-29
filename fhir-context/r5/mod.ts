/**
 * FHIR R5 Model for FHIRPath evaluation (ESM version)
 * 
 * This module provides a pure ESM version of the R5 FHIR model.
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
 * FHIR R5 Model
 */
const r5Model = {
  version: 'r5' as const,
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

export default r5Model;
export { r5Model };
