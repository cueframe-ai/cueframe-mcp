
export { createClient, getClientConfig, request, requestRaw, ApiError, TimeoutError, NetworkError } from "./client";
export type { ClientConfig, RawResponse } from "./client";
export { adviseError } from "./errors";
export type { ApiErrorCode } from "./errors";
export { iterRenderEvents, iterComposeEvents } from "./sse";
export type {
  RenderEvent,
  RenderEventName,
  ProgressFrame,
  CompleteFrame,
  ErrorFrame,
  ComposeEvent,
  ComposeEventName,
} from "./sse";

export * from "./generated/operations";


export * from "./generated/models";
export { COMPONENT_EXECUTION_VERSIONS, BLANK_COMPONENT_SOURCE_V4 } from "./generated/executionVersions";

// Orval inlines single-property numeric unions into the parent model instead
// of emitting a named model. Keep the SDK's public convenience type stable.
export type FormatFps = NonNullable<
  import("./generated/models").Format["fps"]
>;
