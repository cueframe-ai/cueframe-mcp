// Verified 2026-10-08 against OpenAI “Package your plugin” and Claude “Plugin manifest reference”.
export const MCP_SCHEMA = 'https://agent-plugins.org/schemas/1.0.0/mcp.schema.json';
export const MCP_URL = 'https://api.cueframe.ai/v1/mcp';
export function validateMcp(config, host) {
  const errors = [];
  if (host === 'portable' && config.$schema !== MCP_SCHEMA) errors.push('portable MCP schema is missing or invalid');
  if (host === 'claude' && '$schema' in config) errors.push('Claude MCP config must not use the portable schema');
  if (JSON.stringify(Object.keys(config.mcpServers ?? {}).sort()) !== JSON.stringify(['cueframe'])) errors.push('MCP config must contain exactly the cueframe server');
  const server = config.mcpServers?.cueframe;
  if (server?.type !== (host === 'portable' ? 'streamable-http' : 'http')) errors.push(`${host} MCP transport is invalid`);
  if (server?.url !== MCP_URL) errors.push('MCP endpoint must be the hosted production server');
  if (server && Object.keys(server).some((key) => !['type', 'url'].includes(key))) errors.push('shipped MCP config must not contain credentials or launcher overrides');
  return errors;
}
