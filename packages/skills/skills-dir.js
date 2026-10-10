import { fileURLToPath } from 'node:url';
// The published tree: dist/skills is a build-time copy of the repository's root skills/ directory.
export const SKILLS_DIR = fileURLToPath(new URL('./dist/skills/', import.meta.url));
