/**
 * FHIR R6 Model for FHIRPath evaluation (ESM version)
 * 
 * This module provides a pure ESM version of the R6 FHIR model.
 * It imports JSON files directly using Deno/ESM JSON imports.
 */

// Import JSON files with assertion (local copies for bundling)
import path2TypeRaw from "./data/path2Type.json" with { type: "json" };
import choiceTypePaths from "./data/choiceTypePaths.json" with { type: "json" };
import pathsDefinedElsewhere from "./data/pathsDefinedElsewhere.json" with { type: "json" };
import type2Parent from "./data/type2Parent.json" with { type: "json" };
import resourcesWithUrlParam from "./data/resourcesWithUrlParam.json" with { type: "json" };

// Process path2Type to handle both string values and objects with refType
const path2RefType: Record<string, string> = {};
const path2Type: Record<string, string> = {};
const path2TypeWithoutElements: Record<string, string> = {};

for (const [p, v] of Object.entries(path2TypeRaw as Record<string, unknown>)) {
  if (v && typeof v === 'object' && 'refType' in v && 'code' in v) {
    const obj = v as { refType: string; code: string };
    path2RefType[p] = obj.refType;
    path2Type[p] = obj.code;
  } else if (typeof v === 'string') {
    path2Type[p] = v;
  } else {
    continue;
  }

  if (path2Type[p] === 'Element' || path2Type[p] === 'BackboneElement') {
    continue;
  }
  path2TypeWithoutElements[p] = path2Type[p];
}

/**
 * FHIR R6 Model
 */
const r6Model = {
  version: 'r6' as const,
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
   * Mapping paths to reference types (for R6 complex path2Type structure)
   */
  path2RefType,
  /**
   * Resources that have a url parameter (for lookup operations)
   */
  resourcesWithUrlParam,
  /**
   * Mapping paths to data types (excluding Element and BackboneElement)
   */
  path2TypeWithoutElements,
};

export default r6Model;
export { r6Model };
