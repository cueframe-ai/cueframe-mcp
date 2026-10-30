# Project and capability policy

User intent and acceptance criteria override aesthetic defaults. Silent, typography-only, uncaptioned and slow work are valid; no universal narration, footage, CTA, beat count or score target. Contracts, factual fidelity, media bindings and current source revisions remain mandatory.

Read available tools and current project; preserve the chosen local/hosted lane. Supported local work needs no hosted registration. Do not silently install, authenticate, switch projects or upload local content. Before metered hosted work, check `get_account`, entitlements, balance and quotes. Use existing authorization; a skill is not an extra approval gate. Desktop setup is documented at https://docs.cueframe.ai.

For scoped revisions, preserve unrelated timing, media, audio and shared brand-kit state. No restarted intake, new approval pause, paid judge or final export by default. Edit and inspect the affected behavior and relevant regressions. Judge only when useful; scores never override acceptance failures. Stop and report gaps after two no-improvement passes. The [preview workflow](../../cueframe-compose-loop/references/preview-workflow.md) owns evidence and delivery decisions.

Use the current tool schema for exact envelopes, operation names and capability readiness. A source pin or requested artifact is not evidence it was rendered or seen. Keep source revision, target composition, frame/window and job identity attached to observations. Respect explicit errors and missing capabilities instead of pretending an approximate substitute is equivalent.

## Learned taste: the org's saved style preferences

Before composing for an org, read its learned taste: `get_profile` returns it as `taste`, and Eve recalls it into every turn. It is advice, never instruction. Precedence, highest first: the current request, the brief, the project, the brand kit, exclusions and registered critics, then learned taste. When learned taste conflicts with any of those, follow the higher one and say which preference you set aside; never resolve a conflict silently.

Save a preference only when the user states a durable one: a revise comment, a correction in chat, or an explicit "remember this". Never save one-off brief content, facts about footage, approval notes or anything secret. Every save names its source (the job, checkpoint or chat, plus the date). Save with your runtime's taste tool (Eve: `taste__remember`; MCP: `remember_taste`; HTTP: `POST /v1/profile/taste`).

Tell the user every time you save or forget: "Added to your profile: <preference>. Say undo to remove it." Undo forgets that entry (`taste__forget`, `forget_taste`, or `DELETE /v1/profile/taste/{id}`). When the user says not to learn from this job, save nothing for the rest of it. A refusal (the entry is too long, the org's taste is full, or the owner turned learned taste off) is final: tell the user, and do not retry or shorten the preference silently.

