# @cueframe/skills

The CueFrame agent skills as an npm package: one directory per skill, each with a `SKILL.md` (YAML frontmatter `name` and `description`, then the skill) and, where a skill has them, `references/`. The same tree ships the per-skill ChatGPT/Codex card (`agents/openai.yaml`) and icon (`assets/icon.svg`); a program installing skills into another host drops those two files.

The skills are maintained in the `skills/` directory of [cueframe-ai/cueframe-mcp](https://github.com/cueframe-ai/cueframe-mcp), which is also the plugin that installs them into Claude Code, Codex, Cursor and Gemini CLI. This package is a build-time copy of that directory, for programs that embed or copy the skills (the `cueframe` CLI's `install` command, CueFrame's own services).

```js
import { SKILLS_DIR } from '@cueframe/skills/dir';
// SKILLS_DIR: absolute path of the directory holding one subdirectory per skill
```

`@cueframe/skills/package.json` is exported too, so a consumer can read the version it installed.

The hosted MCP server at `https://api.cueframe.ai/v1/mcp` does the work; the skills teach the agent the workflows. Documentation: https://docs.cueframe.ai

Apache-2.0. See LICENSE and NOTICE.
