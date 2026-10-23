import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { projectDeleteCommand, mediaDeleteCommand } from './commands/destroy.js';
import { newComponentCommand } from './commands/newComponent.js';
import { pushCommand, syncCommand } from './commands/push.js';

describe('cli destructive parity', () => {
  it('exposes project/media delete commands', () => {
    expect(typeof projectDeleteCommand).toBe('function');
    expect(typeof mediaDeleteCommand).toBe('function');
  });
});


function enumerateSdkOperations(): string[] {
  const here = dirname(fileURLToPath(import.meta.url)); // .../packages/cli/src
  const generatedDir = resolve(here, '..', '..', 'sdk', 'src', 'generated');
  const ops = new Set<string>();
  for (const tag of readdirSync(generatedDir)) {
    if (tag === 'models' || tag === 'zod') continue;
    const tagDir = join(generatedDir, tag);
    if (!statSync(tagDir).isDirectory()) continue;
    for (const file of readdirSync(tagDir)) {
      if (!file.endsWith('.ts')) continue;
      const src = readFileSync(join(tagDir, file), 'utf8');
      for (const m of src.matchAll(/export const ([a-zA-Z0-9_]+) = async/g)) {
        ops.add(m[1]);
      }
    }
  }
  return [...ops].sort();
}

const CLI_WRAPPED: Record<string, string> = {
  compareFrames: 'compare',
  getComposition: 'composition get',
  putComposition: 'composition put',
  validateComposition: 'composition validate',
  composeFromSuggestion: 'composition from-suggestion',
  compose: 'compose',
  getComposeJob: 'compose inspect',
  selectComposeCandidate: 'compose select',
  resumeCheckpoint: 'compose resume',
  createRender: 'render',
  retryRender: 'render retry',
  getOpenAPISpec: 'schema',
  suggestBriefs: 'analyze',
  listMediaSuggestions: 'clips',
  listMedia: 'clips',
  createMediaUpload: 'upload',
  deleteMedia: 'media delete',
  getMediaDownloadUrl: 'media download-url',
  listProjects: 'list',
  createProject: 'project create',
  deleteProject: 'project delete',
  listSessions: 'sessions list',
  createSession: 'sessions create',
  getSession: 'sessions get',
  deleteSession: 'sessions delete',
  createFcpxmlExport: 'export fcpxml',
  createPremiereExport: 'export premiere',
  createComponent: 'push / sync',
  updateComponent: 'push / sync',
  getComponent: 'push / sync',
  publishTemplate: 'template run (publishes a local document) / template validate and template run --dry-run (dryRun: true)',
  getTemplate: 'template run / template validate (an org template id reads GET /v1/templates/{id})',
  instantiateTemplate: 'template run',
  getTemplateJob: 'template status / template run (polled until ready)',
};

const CLI_EXEMPT: Record<string, string> = {
  createVideoClipExport: 'expert-only: direct MP4 export via generated SDK or cueframe api POST /v1/projects/:id/exports/videoClip; render remains the ordinary CLI video command',
  retryExport: 'expert-only: retry the admitted export snapshot via generated SDK or cueframe api POST /v1/projects/:id/exports/:exportId/retry; classified alongside cancelExport',
  startHostedProcessingRun: 'expert-only: configured processing admission via SDK or cueframe api POST /v1/media/:id/processing-runs; upload owns the ordinary ingest lane',
  getHostedProcessingRun: 'expert-only: exact processing run status via SDK or cueframe api GET /v1/media/:id/processing-runs/:runId',
  getHostedProcessingArtifact: 'expert-only: scoped processing artifact grant via SDK or cueframe api; no first-class artifact command',
  cancelHostedProcessingRun: 'expert-only: exact processing run cancellation via SDK or cueframe api; no first-class processing cancel command',
  reconcileComposeDispatch: 'expert-only: ambiguous compose dispatch reconciliation via SDK or cueframe api; ordinary compose must not automatically resubmit',
  editorialGetBrief: 'expert-only: read a persisted editorial brief via the generated SDK or cueframe api; native agents use the shared editorial tool surface',
  editorialUpdateBrief: 'expert-only: revise a persisted editorial brief via the generated SDK or cueframe api; native agents use the shared editorial tool surface',
  editorialListBriefs: 'expert-only: list scoped editorial briefs via the generated SDK or cueframe api; native agents use the shared editorial tool surface',
  editorialCreateBrief: 'expert-only: create an editorial brief via the generated SDK or cueframe api; native agents use the shared editorial tool surface',
  editorialAdoptLegacyBrief: 'expert-only: explicitly adopt a historical brief via the generated SDK or cueframe api; native agents use the shared editorial tool surface',
  editorialCreateRun: 'expert-only: admit an editorial run with fixed inputs via the generated SDK or cueframe api; native agents use the shared editorial tool surface',
  editorialListRuns: 'expert-only: list scoped editorial runs via the generated SDK or cueframe api; native agents use the shared editorial tool surface',
  editorialGetRunSource: 'expert-only: discover certified editorial source ranges via the generated SDK or cueframe api GET /v1/editorial/source; native agents use editorial_run_source',
  editorialGetRun: 'expert-only: recover an editorial run via the generated SDK or cueframe api; native agents use the shared editorial tool surface',
  editorialListEvidence: 'expert-only: read bounded persisted inspection evidence via the generated SDK or cueframe api; native agents use the shared editorial tool surface',
  editorialInspectFrame: 'expert-only: inspect an exact frame and persist evidence via the generated SDK or cueframe api; native agents use the shared editorial tool surface',
  editorialSampleMotion: 'expert-only: sample motion and persist bounded coverage via the generated SDK or cueframe api; native agents use the shared editorial tool surface',
  editorialInspectAudio: 'expert-only: inspect audio and persist bounded coverage via the generated SDK or cueframe api; native agents use the shared editorial tool surface',
  editorialInspectTranscript: 'expert-only: inspect canonical transcript ranges via the generated SDK or cueframe api; native agents use the shared editorial tool surface',
  editorialFindingsAppend: 'expert-only: append attributed findings via the generated SDK or cueframe api; native agents use the shared editorial tool surface',
  editorialFindingsList: 'expert-only: recover findings without agent memory via the generated SDK or cueframe api; native agents use the shared editorial tool surface',
  editorialIntegrate: 'expert-only: integrate editorial decisions via the generated SDK or cueframe api; native agents use the shared editorial tool surface',
  editorialCancelRun: 'expert-only: cancel an editorial run via the generated SDK or cueframe api; native agents use the shared editorial tool surface',
  editorialApplyComposition: 'expert-only: apply editorial composition changes with concurrency checks via the generated SDK or cueframe api; native agents use the shared editorial tool surface',
  createApiKey: 'covered-by-keys-create: cueframe keys create mints via Better Auth (/api/auth/api-key), not /v1/api-keys',
  getAccount: 'expert-only: entitlement orientation via MCP get_account / cueframe api',
  getBillingPlans: 'expert-only: plan catalog via MCP list_plans / cueframe api',
  createCheckout: 'expert-only: checkout URL minted via MCP create_checkout / the console',
createUploadToken:
    'expert-only: the signed-upload-lane (Uppy worker) token mint — the desktop import dialog\'s ' +
    'plumbing, not a CLI verb; the CLI uploads via createMediaUpload\'s presigned lane',
  createBrief: 'expert-only: briefs via MCP create_brief / cueframe api; no CLI planning verb',
  getBrief: 'expert-only: briefs via MCP / cueframe api',
  listBriefs: 'expert-only: briefs via MCP / cueframe api',
  updateBrief: 'expert-only: briefs via MCP / cueframe api',
  deleteBrief: 'expert-only: briefs via MCP / cueframe api',
  getCheckpoint: 'expert-only: packet read via MCP get_checkpoint / cueframe api; the CLI pause hint prints the GET path',
  listCheckpoints: 'expert-only: gate history via MCP list_checkpoints / cueframe api',
  consult: 'expert-only: advisory compose via MCP consult / cueframe api',
  newComposition: 'expert-only: composition mint via MCP new_composition / cueframe api; the CLI composes via compose',
  listCompositions: 'expert-only: composition history via MCP list_compositions / cueframe api',
  deriveComposition: 'expert-only: format siblings via MCP derive_composition / cueframe api',
  commitComposeSession: 'mcp-only-session-op',
  getComposeSessionComposition: 'mcp-only-session-op',
  extractBrandKit: 'expert-only: brand extraction via MCP extract_brand_kit / cueframe api',
  createCritic: 'expert-only: critics via MCP register_critic / cueframe api',
  importResource: 'expert-only: stock import via MCP import_resource / cueframe api',
  searchResources: 'expert-only: stock search via MCP search_resources / cueframe api',
  searchFonts: 'expert-only: font search via MCP search_fonts / cueframe api',
  getJob: 'expert-only: generic job poll via MCP wait_job / cueframe api',
  cancelJob: 'expert-only: generic job cancel via MCP cancel_job / cueframe api',
  previewClip: 'expert-only: scoped motion preview via MCP preview_clip / cueframe api; CLI renders full via render',
  getWebhookEvents: 'expert-only: delivery contract via MCP cueframe://webhook-events / cueframe api',
  verifyWebhook: 'expert-only: ownership re-challenge via MCP verify_webhook / cueframe api',
  listBrandKits: 'expert-only: brand kits via cueframe api / MCP; no first-class CLI verb',
  createBrandKit: 'expert-only: brand kits via cueframe api / MCP create_brand_kit',
  getBrandKit: 'expert-only: brand kits via cueframe api / MCP',
  createExemplarUploads: 'expert-only: exemplar-frame presign inside the brand-kit flow via cueframe api / MCP',
  getBrandKitExemplars: 'expert-only: exemplar frames via cueframe api / MCP',
  resetMediaSuggestions: 'expert-only: re-analyze via cueframe analyze; reset is an operator action via cueframe api',
  resolveBuiltinComponent: 'expert-only: exact builtin document resolution via MCP resolve_builtin_component / cueframe api GET /v1/components/builtin/resolve; see builtin insertion skill',
  listCatalog: 'expert-only: catalog list via MCP list_catalog / cueframe api; the local workspace lists components from disk',
  listRenderFonts: 'expert-only: renderer font set via MCP list_render_fonts / search_fonts / cueframe api; classified with listCatalog, its sibling read-only discovery op',
  scoreComposition: 'expert-only: the sighted judge via MCP score_composition / cueframe api',
  previewFrameJob: 'expert-only: durable still evidence via MCP preview_frame / cueframe api',
  previewComponent: 'expert-only: component motion preview via MCP preview_component / cueframe api',
  getBlankComponentSource: 'covered-by-new-component: `cueframe new component` scaffolds the same blank native source, generated into the SDK from the contract',
  repinComponent: 'expert-only: moving retired TSX component clips to their native successors via cueframe api POST /v1/projects/:id/components/native-upgrade',
  deleteComposition: 'expert-only: composition delete via MCP delete_composition / cueframe api',
  getProfile: 'expert-only: the org taste read via MCP get_profile / cueframe api',
  listTaste: 'expert-only: learned taste via MCP get_profile / cueframe api',
  createTasteEntry: 'expert-only: learned taste via MCP remember_taste / cueframe api',
  updateTasteEntry: 'expert-only: learned taste edits via the Console / cueframe api',
  deleteTasteEntry: 'expert-only: learned taste via MCP forget_taste / cueframe api',
  updateTasteSettings: 'expert-only: the owner switch via the Console / cueframe api',
  listCritics: 'expert-only: critics via MCP list_critics / cueframe api',
  deleteCritic: 'expert-only: critics via MCP delete_critic / cueframe api',
  getUsage: 'expert-only: the usage ledger via MCP get_usage / cueframe api',
  getReviewPacket: 'internal: the hosted review page reads this with its ?token, never an API key',
  recordReviewDecision: 'internal: the hosted review page records decisions with its ?token, never an API key',
  getComponentSource: 'expert-only: primitive source via MCP get_component_source / cueframe api; the CLI edits component source in the local workspace',
  openComposeSession: 'mcp-only-session-op',
  closeComposeSession: 'mcp-only-session-op',
  streamCompose: 'covered-by-compose: SSE stream consumed inside the compose run command',
  listComposeJobs: 'expert-only: compose job history via cueframe api',
  cancelCompose: 'expert-only: cancel via cueframe api / MCP cancel_compose',
  applyCompositionOp: 'expert-only: single-op apply via cueframe api; CLI authors via composition put',
  applyComposition: 'expert-only: batch-op apply via cueframe api; CLI authors via composition put',
  getExport: 'covered-by-export: polled during cueframe export --wait',
  cancelExport: 'expert-only: cancel via cueframe api / MCP cancel_export',
  health: 'health',
  whoami: 'internal: identity probe via cueframe api GET /v1/whoami',
  generateMedia: 'expert-only: generation via MCP generate_media / cueframe api; no CLI gen verb yet',
  importMedia: 'expert-only: URL import via cueframe api POST /v1/media/import; CLI uploads files via upload',
  getMedia: 'covered-by-upload: polled while cueframe upload waits for processing',
  finalizeMedia: 'covered-by-upload: the presign→PUT→finalize handshake runs inside cueframe upload',
  getMediaTranscript: 'expert-only: transcript via cueframe api',
  getMediaContext: 'expert-only: authoring context via MCP get_media_context / cueframe api',
  listMediaFacts: 'expert-only: exact enhancement status/quotes are consumed by the editor and raw API',
  purchaseMediaFact: 'expert-only: paid enhancement fulfillment is initiated by the editor and raw API',
  triggerMatteBake: 'expert-only: behind-subject matte fulfillment is an editor/compose consequence, not a CLI verb',
  searchLibrary: 'expert-only: in-loop footage search via cueframe api GET /v1/media/search; operator-only op, not a CLI verb',
  analyzeTranscript: 'expert-only: metered transcript read via cueframe api; operator-only op, not a CLI verb',
  analyzeTimeline: 'expert-only: edit-decision analysis via MCP / cueframe api; no first-class CLI verb',
  triggerSubjectDetection: 'expert-only: subject detection via cueframe api; runs as a compose side-effect',
  scoreTrace: 'expert-only: attach feedback to an existing Director trace via SDK or cueframe api',
  getProject: 'covered-by-list: project read via cueframe list / cueframe api',
  patchProject: 'expert-only: project update via cueframe api; no first-class CLI verb',
  getProjectContext: 'expert-only: in-loop orientation read via cueframe api GET /v1/projects/:id/context; operator-only op, not a CLI verb',
  listProjectRenders: 'expert-only: render history via cueframe api',
  getRender: 'covered-by-render: polled by cueframe render / render watch',
  cancelRender: 'expert-only: cancel via cueframe api / MCP cancel_render',
  refreshRenderUrl: 'expert-only: presigned-URL refresh via cueframe api',
  streamRender: 'covered-by-render: SSE progress consumed by cueframe render / render watch',
  listSelectorCandidates: 'expert-only: selector internals via cueframe api',
  previewSelector: 'expert-only: selector internals via cueframe api',
  triggerMuxJob: 'covered-by-sessions: mux job triggered as part of the session flow',
  getMuxJob: 'covered-by-sessions: mux status within the session flow',
  cancelMuxJob: 'expert-only: cancel an exact mux attempt through cueframe api POST /v1/sessions/:id/mux-job/cancel; preserves the session for retry',
  listSkills: 'covered-by-install: cueframe install bundles skills from package data, no API fetch',
  getSkill: 'covered-by-install: cueframe install bundles skills from package data, no API fetch',
  listWebhooks: 'expert-only: webhooks via cueframe api / MCP',
  createWebhook: 'expert-only: webhooks via cueframe api / MCP create_webhook',
  getWebhook: 'expert-only: webhooks via cueframe api / MCP',
  patchWebhook: 'expert-only: webhooks via cueframe api / MCP update_webhook',
  deleteWebhook: 'expert-only: webhooks via cueframe api / MCP delete_webhook',
  testWebhook: 'expert-only: webhooks via cueframe api',
  createWorkspace: 'expert-only: workspace provisioning op; not a CLI verb',
  patchComponent: 'expert-only: partial component update via cueframe api PATCH /v1/components/:id; push / sync and MCP update_component publish whole manifests',
  applyTemplate: 'expert-only: synchronous apply via cueframe api POST /v1/templates/:id/apply; the CLI prepares through the durable instantiate job (template run)',
  retryTemplateJob: 'expert-only: job retry via cueframe api POST /v1/template-jobs/:jobId/retry; template run re-issues with --idempotency-key, template status --wait reconnects',
  cancelTemplateJob: 'expert-only: job cancel via cueframe api POST /v1/template-jobs/:jobId/cancel; no CLI cancel verb',
  listTemplates: 'expert-only: org template list via cueframe api GET /v1/templates; the CLI reads the public catalog from cueframe-templates',
  deleteTemplate: 'expert-only: org template delete via cueframe api DELETE /v1/templates/:id; no CLI verb',
  createTemplateRender: 'expert-only: the template render lane via cueframe api POST /v1/templates/:id/renders; the CLI renders the prepared project with render',
  getTemplateRender: 'expert-only: template render read via cueframe api; the CLI watches project renders with render watch',
  cancelTemplateRender: 'expert-only: template render cancel via cueframe api; no CLI verb',
  revokeTemplateRender: 'expert-only: template render revoke via cueframe api; no CLI verb',
};

const ALLOWED_EXEMPT_CATEGORY = /^(internal|mcp-only-session-op|health|expert-only|covered-by)/;

describe('CLI↔SDK coverage gate (the CLI arm of the SSOT drift gate)', () => {
  const ops = enumerateSdkOperations();

  it('enumerates a non-trivial set of SDK operations (sanity)', () => {
    expect(ops.length).toBeGreaterThan(50);
  });

  it('every CLI_WRAPPED / CLI_EXEMPT key references a REAL SDK operation (no stale entries)', () => {
    const known = new Set(ops);
    const dangling = [...Object.keys(CLI_WRAPPED), ...Object.keys(CLI_EXEMPT)].filter(
      (op) => !known.has(op),
    );
    expect(dangling).toEqual([]);
  });

  it('no operation is BOTH wrapped and exempt', () => {
    const both = Object.keys(CLI_WRAPPED).filter((op) => op in CLI_EXEMPT);
    expect(both).toEqual([]);
  });

  it('EVERY SDK operation is wrapped by a command or justified as exempt (fails on unclassified drift)', () => {
    const unclassified = ops.filter((op) => !(op in CLI_WRAPPED) && !(op in CLI_EXEMPT));
    expect(unclassified).toEqual([]);
  });

  it('every exempt reason uses an allowed category prefix (honest justification)', () => {
    const bad = Object.entries(CLI_EXEMPT)
      .filter(([, reason]) => !ALLOWED_EXEMPT_CATEGORY.test(reason))
      .map(([op]) => op);
    expect(bad).toEqual([]);
  });

  it('the component-authoring round-trip ops are wrapped (push/sync)', () => {
    for (const op of ['createComponent', 'updateComponent', 'getComponent']) {
      expect(CLI_WRAPPED[op]).toBe('push / sync');
    }
    expect(typeof newComponentCommand).toBe('function');
    expect(typeof pushCommand).toBe('function');
    expect(typeof syncCommand).toBe('function');
  });
});
