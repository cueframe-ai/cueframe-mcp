import { GetCompositionQueryParams } from '@cueframe/sdk/zod';
import { z } from 'zod';

/**
 * A composition read names every component execution version it accepts, or the server refuses a
 * composition that pins a native (version 4) component. The list is the widest one the contract's
 * `componentExecutionVersions` declares, read from the generated schema rather than restated here.
 */
const versionLists = GetCompositionQueryParams.shape.componentExecutionVersions.unwrap().options;
const widest = versionLists.find((list): list is Extract<(typeof versionLists)[number], z.ZodTuple> => list instanceof z.ZodTuple);
export const compositionPath = (projectId: string) =>
  `/v1/projects/${projectId}/composition?${new URLSearchParams(widest!.def.items.map((version) => ['componentExecutionVersions', version.value]))}`;
