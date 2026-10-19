import { COMPONENT_EXECUTION_VERSIONS } from '@cueframe/sdk';

/**
 * A composition read names every component execution version it accepts, or the server refuses a
 * composition that pins a native (version 4) component. The list is the contract's, generated into the SDK.
 */
export const compositionPath = (projectId: string) =>
  `/v1/projects/${projectId}/composition?${new URLSearchParams(COMPONENT_EXECUTION_VERSIONS.map((version) => ['componentExecutionVersions', String(version)]))}`;

export function normalizeEtag(etag: string): string {
  return etag.replace(/^W\//, '').replace(/-gzip(?=("?)$)/, '');
}
