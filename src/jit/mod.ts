/**
 * FHIRPath JIT Compiler Module
 * 
 * Provides high-performance JIT compilation of FHIRPath expressions
 * to native JavaScript functions.
 */

export {
  FhirPathJIT,
  compileJIT,
  clearJITCache,
  jitCompiler,
  type CompiledFhirPath,
  type JITOptions,
} from "./compiler.ts";
