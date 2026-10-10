# cueframe

Agent-native CLI for **CueFrame** — turn media into rendered video from the
terminal. Every command speaks `--json` (an NDJSON event stream) and the binary
self-describes via `npx -y cueframe describe --json`, so agents can drive it without
guesswork.

> Connects to the hosted CueFrame service — create an API key at
> [app.cueframe.ai](https://app.cueframe.ai), or use `npx -y cueframe login`.

## Run it

There is nothing to install. Every command in this README runs as
`npx -y cueframe …` and is executable verbatim:

```bash
npx -y cueframe --help
```

`npx -y cueframe install` wires the CueFrame MCP server into every agent on your
machine — but note it installs **no binary**: npx unpacks to an ephemeral cache and
leaves nothing on your `PATH`. That is deliberate. `npx` re-resolves the current
version on every call (~0.5s warm), so these commands can never go stale the way a
pinned global install does.

Running many commands in a row and want to skip that overhead? Install it once and
drop the `npx -y ` prefix:

```bash
npm i -g cueframe               # optional — needs a user-writable npm prefix
```

This is an optimization, not the supported path. On a default Linux install it fails
with `EACCES: permission denied, mkdir '/usr/local/lib/node_modules/cueframe'` unless
you have configured an npm prefix in your home directory.

## Authenticate

```bash
npx -y cueframe auth <cf_live_… key>        # static API key (CI / headless)
# or
npx -y cueframe login                       # OAuth device flow (browser)
```

The key can also be supplied via the `CUEFRAME_API_KEY` environment variable.

## Quick start — upload → author → render

```bash
# 1. Register media (video / image / audio)
npx -y cueframe upload ./source.mp4 --json              # → mediaItemId

# 2. Create a project (sets aspect / format)
npx -y cueframe project create -n promo -a 9:16 --json  # → projectId

# 3. Author the composition — tracks of clips, per-clip reframe/trim,
#    optional captions. The composition is the source of truth.
npx -y cueframe composition put <projectId> -b @composition.json

# 4. Render the saved composition to MP4 (queues, SSE-watches, downloads)
npx -y cueframe render <projectId> -o out.mp4 --json
```

`render` takes only a project id and renders whatever composition is saved on
it — no clip suggestion required. Run `npx -y cueframe describe --json` for the full
composition schema and every command + flag.

## Let CueFrame pick the clip (podcast → short)

```bash
npx -y cueframe upload ./long.mp4 --analyze --json                 # media + AI clip suggestions
npx -y cueframe clips <mediaItemId> --json                         # list suggestions (sug_…)
npx -y cueframe project create -n short -a 9:16 --from-suggestion <sug_…> --json
npx -y cueframe render <projectId> -o short.mp4 --json
```

Both paths converge on `render`; the suggestion on-ramp just authors the
composition for you instead of you hand-writing it.

## Run a template

A template is one `.cueframe` document: a composition with `{{name}}`
references, the parameters that fill them, optional presets and brand kits.
The public catalog lives in `cueframe-ai/cueframe-templates`; your org keeps
its own under `POST /v1/templates`.

```bash
cueframe template run yosemite-warp-text --preset granite --media source=sample --values text=CARVED -o carved.mp4
cueframe template run ./template.cueframe --media source=./clip.mp4 --values title="Journey" --no-render --json
cueframe template status <jobId> --wait --json       # reconnect to a running preparation
cueframe template validate ./template.cueframe          # on the API with your key; nothing is stored
```

`run` publishes a local document to your org (a catalog slug is imported on
first use), uploads each `--media name=<file>`, then starts one preparation job.
The job imports and processes media, attaches verified template assets, applies
the composition, and returns the ready project before `run` renders it. The
`template_job_request` JSON event carries an idempotency key; pass it back with
`--idempotency-key` if the start request loses its response. Reuse the same
media IDs from the earlier upload events as `--media name=media:<id>` so the
retried request has identical inputs. After a `jobId` arrives,
`template status <jobId> --wait` reconnects without starting another project.
`--media name=<https url>` imports the
URL, `--media name=sample` takes the template's own sample. `--values` are
coerced to the document's parameter types before anything is sent; whether a
value fits (an enum option, a number in range) is the server's verdict, which
`--dry-run` fetches without storing anything.

`validate` runs on the CueFrame API with your key and stores nothing. It exits
2 with the problems the server returns: undeclared or misplaced references, a
preset that does not bind, a required media parameter with no sample, a
prepared matte at another bake version.

## Wire it into your agents

```bash
npx -y cueframe install
```

Detects every agent on the machine — Claude Code, Cursor, Codex, VS Code, Windsurf,
Zed, Antigravity CLI, Copilot CLI and more — and wires the CueFrame MCP server into each
one's config. Auth happens on the agent's first call via a browser "Allow"; no API key.

It also copies the usage skills to `~/.claude/skills/`. **Only Claude Code reads that
directory** — every other agent gets the same verb surface as MCP tools from the server,
so there is nothing further to install for them.

Claude Desktop and ChatGPT can't be wired from the command line (neither reads a local
MCP config) — add `https://api.cueframe.ai/v1/mcp` as a custom connector instead.

## For agents

- **`--json` everywhere** — NDJSON lifecycle: `<verb>_prepare → <verb>_progress* → <verb>_complete | error`, plus a non-zero exit on failure.
- **`npx -y cueframe describe --json`** — the full command tree as structured JSON.
- **`npx -y cueframe api <METHOD> <path>`** — raw escape hatch over the v1 API.

## Common commands

| Need to… | Command |
|---|---|
| List projects | `npx -y cueframe list` |
| Read a composition + ETag | `npx -y cueframe composition get <projectId> --json` |
| Write a composition | `npx -y cueframe composition put <projectId> -b @comp.json` |
| Export to Final Cut / Premiere | `npx -y cueframe export fcpxml \| premiere <projectId> -s <sug_…> --wait -o cut.zip` |
| Validate without mutating | append `--dry-run` |

---

© CueFrame, Inc. Open source under Apache-2.0.
