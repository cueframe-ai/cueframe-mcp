---
name: cueframe-connect
description: Use when CueFrame is not connected yet, the user asks how to connect or authenticate CueFrame, or another CueFrame skill is about to call a tool and needs the one-time setup path for Claude Code, Claude, ChatGPT, Cursor, Codex, VS Code, Windsurf, Zed, Antigravity CLI, Copilot CLI, or an x402 wallet.
---

# Connect CueFrame

## Scope and capability policy

User intent and acceptance criteria override this recipe's aesthetic defaults. Silent, typography-only, uncaptioned and slow work are valid; no universal narration, footage, CTA, beat count or score target. Contracts, factual fidelity, media bindings and current source revisions remain mandatory.

Read available tools and current project; preserve the chosen local/hosted lane. Supported local work needs no hosted registration. Do not silently install, authenticate, switch projects or upload local content. Before metered hosted work, check `get_account`, entitlements, balance and quotes. Desktop setup: https://docs.cueframe.ai.

For scoped revisions, preserve unrelated timing, media, audio and shared brand-kit state. Edit affected content; inspect relevant frames, continuous motion and affected audio. No restarted intake, new approval pause, paid judge or final export by default. Judge only when useful; scores never override acceptance failures. Stop/report after two no-improvement passes. See [preview workflow](../cueframe-compose-loop/references/preview-workflow.md).

First inspect available CueFrame tools and their current project context. If the requested work is supported by an existing connection, use it without installing again. Preserve the user's chosen local or hosted lane. Local-only desktop work needs no hosted registration; desktop connection instructions are at https://docs.cueframe.ai. This public plugin connects to the hosted product at `https://api.cueframe.ai/v1/mcp`.

When a required capability is missing, explain the limitation and the supported alternative. Setup is warranted only when requested or necessary for an authorized tool action. Do not silently install across clients, launch authentication, switch projects or upload local content. For CLI setup, select the intended client using its supported flags rather than wiring every detected host. Resume the original task after setup.

- **Claude Code:** offer to run
  `claude mcp add --transport http cueframe https://api.cueframe.ai/v1/mcp` — a browser
  opens and the user clicks **Allow**. No API key.
- **Claude.ai / Claude Desktop:** Settings → Connectors → add a custom connector with
  `https://api.cueframe.ai/v1/mcp`.
- **Other agents (Cursor, Codex, VS Code, Windsurf, Zed, Antigravity CLI, Copilot CLI, …):**
  use `npx -y cueframe@0.8 install --help` to select the intended client; preserve existing configuration and avoid duplicate installs.
- **ChatGPT:** the CLI cannot wire it because there is no local config to write; add
  `https://api.cueframe.ai/v1/mcp` as a custom connector instead.
- **No account (pay per call):** connect
  `https://api.cueframe.ai/v1/mcp/x402` — no sign-up or API key; priced calls settle
  per call in USDC over x402 from the agent's wallet.

Do not ask the user to configure a model provider for CueFrame. This connection exposes CueFrame's
tools; the host agent keeps using its already-selected CueFrame Gateway, BYOK, or local model.

## Confirm the capabilities needed for the task

Connected is not the same as working, and finding out at the first *paid* call is the expensive
way. Use available read-only discovery for the selected lane:

1. **Discover the surface.** List the tools your host now exposes. You should see the compose loop
   (`new_composition`, `apply_composition`, `validate_composition`, `create_render`) alongside
   discovery reads (`list_catalog`, `list_media`, `get_account`). There are also resources
   (`cueframe://scene-shot` for 3D product shots) and workflow prompts — a flat tool list is not
   the whole surface.
2. **For hosted work, smoke-call `get_account` before spending.** It takes no arguments, costs nothing, and answers the questions
   worth knowing before you spend: which org the key is bound to, the plan, per-feature
   entitlements and — the one that matters — `balance`, not `included`. CueFrame is credit-funded,
   so rendering, generation, preview stills, the judge and the Director all draw on ONE shared
   wallet. A successful `get_account` proves that read is authorized; check the specific capability and current quote separately. Local tools without metered hosted work do not need this hosted call.

If a later call fails on scope, the error names the exact missing permission (for example
`billing:read`, which `get_usage` needs and a creative-only key will not have). Explain the missing permission and use an authorized setup path; do not broaden credentials automatically.
