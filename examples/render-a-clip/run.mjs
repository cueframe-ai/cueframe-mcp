#!/usr/bin/env node
// Render a clip with @cueframe/sdk: create a project, import a public sample, wait for it
// to process, add one clip, render, and print the MP4 URL. Reads CUEFRAME_API_KEY from the
// environment and exits non-zero on any API error with the error envelope printed.
import { ApiError, account, compositions, createClient, media, projects, renders } from "@cueframe/sdk";

const SAMPLE_URL =
  "https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/360/Big_Buck_Bunny_360_10s_1MB.mp4";

const apiKey = process.env.CUEFRAME_API_KEY;
if (!apiKey) {
  console.error("Set CUEFRAME_API_KEY to a cf_live_… or cf_test_… API key.");
  process.exit(2);
}
createClient({ baseUrl: process.env.CUEFRAME_API_URL ?? "https://api.cueframe.ai", apiKey });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Poll `read` until `isDone` returns true; `isDone` throws on a terminal failure.
async function poll(read, isDone, label, { everyMs = 3000, timeoutMs = 15 * 60_000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = await read();
    if (isDone(value)) return value;
    if (Date.now() > deadline) throw new Error(`${label}: still not finished after ${timeoutMs / 1000}s`);
    await sleep(everyMs);
  }
}

// The wallet every metered feature draws from (get_account: read `balance`, not `included`).
function credits(acct) {
  const wallet = Object.values(acct.entitlements ?? {}).find((e) => e.type === "credit_system");
  return wallet ? `${wallet.balance} ${wallet.unit ?? "credits"}` : "unknown";
}

try {
  const before = await account.getAccount();
  console.log(`account: org ${before.orgId}, plan ${before.plan?.id ?? "unknown"}, credits ${credits(before)}`);

  const project = await projects.createProject({
    name: `render-a-clip ${new Date().toISOString()}`,
    format: { aspectRatio: "16:9", fps: 30, resolution: "hd" },
  });
  console.log(`project: ${project.id}`);

  const imported = await media.importMedia({
    url: SAMPLE_URL,
    filename: "big-buck-bunny-10s.mp4",
    contentType: "video/mp4",
  });
  const item = await poll(
    () => media.getMedia(imported.id),
    (m) => {
      const phase = m.processingStatus?.phase ?? m.status;
      if (phase === "error" || phase === "cancelled") {
        throw new Error(`media import ${phase}: ${m.processingStatus?.error ?? m.processingStatus?.message ?? ""}`);
      }
      return phase === "complete" || phase === "ready";
    },
    "media import",
  );
  console.log(`media: ${item.id} (${item.duration}s, ${item.width}x${item.height})`);

  // A project holds many compositions; the first one becomes its active default.
  const composition = await compositions.newComposition(project.id, { name: "clip" });
  const duration = item.duration;
  const applied = await compositions.applyComposition(project.id, {
    composition_id: composition.compositionId,
    ops: [
      {
        type: "clip.add",
        newTrack: true,
        clip: {
          id: "clip-1",
          kind: "video",
          startTime: 0,
          duration,
          source: { kind: "media", mediaId: item.id, trim: { start: 0, end: duration } },
        },
      },
    ],
  });
  console.log(`composition: ${composition.compositionId} (etag ${applied.etag})`);

  const render = await renders.createRender(project.id, {
    compositionId: composition.compositionId,
    intent: "final",
  });
  const done = await poll(
    () => renders.getRender(project.id, render.id),
    (r) => {
      if (r.status === "error" || r.status === "cancelled") {
        throw new Error(`render ${r.status}: ${r.errorCode ?? ""} ${r.error ?? ""}`.trim());
      }
      return r.status === "complete";
    },
    "render",
  );
  console.log(`render: ${done.id} complete`);
  console.log(`mp4: ${done.outputUrl}`);
  console.log(`expires: ${done.outputExpiresAt}`);

  const after = await account.getAccount();
  console.log(`credits after: ${credits(after)}`);
} catch (error) {
  if (error instanceof ApiError) {
    console.error(
      JSON.stringify(
        {
          status: error.status,
          requestId: error.requestId,
          error: { code: error.code, message: error.message, details: error.details },
        },
        null,
        2,
      ),
    );
  } else {
    console.error(error instanceof Error ? error.message : String(error));
  }
  process.exit(1);
}
