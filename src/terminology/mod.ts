/**
 * Terminology Service Module
 * 
 * Provides support for the FHIRPath %terminologies API
 * and memberOf function.
 */

export type {
  ITerminologyService,
  CodedValue,
  TerminologyParams,
  SubsumesResult,
  RemoteTerminologyServiceConfig,
  TerminologyOptions,
} from "./types.ts";

export {
  RemoteTerminologyService,
  createTerminologyService,
} from "./remote-service.ts";

export {
  TerminologiesProxy,
  createTerminologiesProxy,
} from "./terminologies-proxy.ts";
