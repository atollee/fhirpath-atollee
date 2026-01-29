/**
 * FHIRPath Visual Builder
 * 
 * A Web Component for building FHIRPath expressions visually.
 * 
 * @example
 * ```html
 * <script type="module">
 *   import "@atollee/fhirpath/visual-builder";
 * </script>
 * 
 * <fhirpath-builder
 *   resource-type="Patient"
 *   value="name.given"
 * ></fhirpath-builder>
 * ```
 */

export { 
  FhirPathBuilder, 
  FUNCTION_CATEGORIES, 
  COMMON_PATHS, 
  OPERATORS 
} from "./FhirPathBuilder.ts";

export default FhirPathBuilder;
