import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { packageOpenai, validateArtifact } from './package-openai.mjs';
import { validateMcp, MCP_SCHEMA, MCP_URL } from './host-config.mjs';
test('host transport formats reject missing schema, wrong transport and credentials', () => {
  const config = { $schema: MCP_SCHEMA, mcpServers: { cueframe: { type: 'streamable-http', url: MCP_URL } } };
  assert.deepEqual(validateMcp(config, 'portable'), []);
  assert.ok(validateMcp(config, 'claude').length);
  assert.ok(validateMcp({ mcpServers: { cueframe: { url: MCP_URL } } }, 'portable').length);
  assert.ok(validateMcp({ ...config, mcpServers: { cueframe: { ...config.mcpServers.cueframe, headers: { Authorization: 'secret' } } } }, 'portable').length);
});
test('fresh self-contained artifact verifies both manifests, references, drift and hooks', () => {
  const output = mkdtempSync(join(tmpdir(), 'cueframe-openai-'));
  try {
    const manifest = packageOpenai({ output });
    assert.equal(typeof manifest.sourceDirty, 'boolean');
    assert.equal(Object.keys(manifest.files).some((file) => file.startsWith('hooks/')), false);
    assert.deepEqual(validateArtifact(output), []);
    packageOpenai({ output, check: true });
    writeFileSync(join(output, 'mcp.json'), '{}');
    assert.throws(() => packageOpenai({ output, check: true }), /stale/);
    packageOpenai({ output });
    mkdirSync(join(output, 'hooks'));
    writeFileSync(join(output, 'hooks/hooks.json'), '{}');
    assert.ok(validateArtifact(output).some((error) => error.includes('forbidden')));
    assert.throws(() => packageOpenai({ output, check: true }), /unexpected/);
    rmSync(join(output, 'hooks'), { recursive: true });
    const root = JSON.parse(readFileSync(join(output, 'plugin.json'), 'utf8'));
    root.extensions['com.openai'].hooks = {};
    writeFileSync(join(output, 'plugin.json'), JSON.stringify(root));
    assert.ok(validateArtifact(output).some((error) => error.includes('must not declare')));
  } finally { rmSync(output, { recursive: true, force: true }); }
});
