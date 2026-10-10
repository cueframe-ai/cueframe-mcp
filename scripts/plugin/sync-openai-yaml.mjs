#!/usr/bin/env node
// Generates skills/<name>/agents/openai.yaml, the per-skill card ChatGPT and Codex list, from each
// skill's SKILL.md frontmatter, and copies assets/icon.svg into the skill so the card's icon paths
// resolve when a skill is installed on its own. Re-run with `pnpm build:plugin`; commit the output.
// scripts/plugin/validate.mjs imports renderCard to prove the committed cards are current.
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const skillsDir = resolve(ROOT, 'skills');
export const icon = resolve(ROOT, 'assets/icon.svg');
const SHORT_MAX = 80;

const oneLine = (s) => String(s).replace(/\s+/g, ' ').trim();

// Truncate at a word boundary so the result, including the ellipsis, fits in `max` characters.
const truncate = (s, max) => {
  const text = oneLine(s);
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const space = cut.lastIndexOf(' ');
  return `${cut.slice(0, space > 0 ? space : cut.length).replace(/[\s,;:—–-]+$/, '')}…`;
};

// First sentence: split after . ! ? (optionally followed by a closing quote or paren) before a capital letter,
// which leaves "e.g." and quoted lowercase examples intact.
const firstSentence = (s) => oneLine(s).split(/(?<=[.!?]["”)]?)\s+(?=[A-Z])/)[0];

// The card's prompt is "Use $name to …" when the skill has a hand-written `defaultPrompt`. Without one the
// first sentence of the description is used, with the connective chosen from the sentence's shape so the
// prompt stays grammatical: "Use when X" becomes "Use $name when X"; a third-person verb ("Turns footage…")
// becomes "to turn footage…"; a noun phrase ("The definition of…") takes "for"; anything else is treated as
// an imperative and takes "to". Brand names and acronyms keep their capitals.
const DETERMINERS = new Set(['the', 'a', 'an', 'this', 'these', 'those', 'our', 'your', 'its']);
const lowerFirstWord = (t) => t.replace(/^[A-Z][a-z]+\b|^[A-Z]+\b/, (w) => w.toLowerCase());
const asPrompt = (name, sentence) => {
  const use = sentence.match(/^Use\s+(\S.*)$/i);
  if (use) return `Use $${name} ${lowerFirstWord(use[1].trim())}`;
  const third = sentence.match(/^([A-Z][a-z]+?)s\b(?=\s)/);
  if (third && !/(ss|us|is)$/.test(third[0])) return `Use $${name} to ${third[1].toLowerCase()}${sentence.slice(third[0].length)}`;
  const first = sentence.match(/^\w+/)?.[0] ?? '';
  const connective = DETERMINERS.has(first.toLowerCase()) ? 'for' : 'to';
  return `Use $${name} ${connective} ${lowerFirstWord(sentence)}`;
};

/** The openai.yaml text for one skill, from its SKILL.md source. Throws on a malformed skill. */
export function renderCard(name, text) {
  const fm = text.match(/^---\n([\s\S]*?)\n---\n/);
  if (!fm) throw new Error(`${name}: missing frontmatter`);
  const meta = YAML.parse(fm[1]) ?? {};
  if (typeof meta.description !== 'string' || !meta.description.trim()) throw new Error(`${name}: missing description`);
  const title = text.slice(fm[0].length).match(/^#\s+(.+?)\s*$/m)?.[1];
  if (!title) throw new Error(`${name}: missing # title`);
  const prompt = meta.defaultPrompt ? `Use $${name} to ${oneLine(meta.defaultPrompt)}` : asPrompt(name, firstSentence(meta.description));
  const card = {
    interface: {
      display_name: title,
      short_description: truncate(meta.description, SHORT_MAX),
      icon_small: './assets/icon.svg',
      icon_large: './assets/icon.svg',
      default_prompt: prompt,
    },
  };
  return YAML.stringify(card, { lineWidth: 0, defaultStringType: 'QUOTE_DOUBLE', defaultKeyType: 'PLAIN' });
}

export const listSkills = () => readdirSync(skillsDir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).sort();

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (!existsSync(icon)) throw new Error(`missing ${icon}`);
  let written = 0;
  const skills = listSkills();
  for (const name of skills) {
    const out = renderCard(name, readFileSync(join(skillsDir, name, 'SKILL.md'), 'utf8'));
    mkdirSync(join(skillsDir, name, 'agents'), { recursive: true });
    mkdirSync(join(skillsDir, name, 'assets'), { recursive: true });
    const target = join(skillsDir, name, 'agents/openai.yaml');
    if (!existsSync(target) || readFileSync(target, 'utf8') !== out) { writeFileSync(target, out); written++; }
    const iconTarget = join(skillsDir, name, 'assets/icon.svg');
    if (!existsSync(iconTarget) || readFileSync(iconTarget, 'utf8') !== readFileSync(icon, 'utf8')) copyFileSync(icon, iconTarget);
  }
  console.log(`openai.yaml: ${skills.length} skills, ${written} written`);
}
