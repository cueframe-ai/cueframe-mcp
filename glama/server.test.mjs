import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {test} from 'node:test';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';

test('discovery shim preserves schemas and returns useful tool errors through the actual SDK', async () => {
  const snapshot=JSON.parse(readFileSync(new URL('./tools.json',import.meta.url),'utf8'));
  const instructions=readFileSync(new URL('./instructions.txt',import.meta.url),'utf8').trim();
  const client=new Client({name:'cueframe-discovery-regression',version:'1'});
  const transport=new StdioClientTransport({command:process.execPath,
    args:[fileURLToPath(new URL('./server.mjs',import.meta.url))],
    env:{PATH:process.env.PATH??'/usr/bin:/bin'},stderr:'pipe'});
  let stderr='';transport.stderr?.on('data',chunk=>stderr+=String(chunk));
  try {
    await client.connect(transport);
    const before=await client.listTools();
    assert.deepEqual(before.tools,snapshot.tools);
    assert.equal(client.getInstructions(),instructions);
    // The SDK validates successful structured output once tools/list has
    // cached outputSchema. A discovery refusal must be a tool error, not a
    // successful text response that fails the SDK's output contract.
    assert(before.tools.find(tool=>tool.name==='get_account').outputSchema);
    for(const name of ['get_account','download_media']) {
      const result=await client.callTool({name,arguments:name==='download_media'?{mediaItemId:'discovery-only'}:{}});
      assert.equal(result.isError,true);
      assert.equal(result.structuredContent,undefined);
      assert.equal(result.content[0].type,'text');
      assert.match(result.content[0].text,/was not executed/);
      assert.match(result.content[0].text,/https:\/\/api\.cueframe\.ai\/v1\/mcp/);
      assert.match(result.content[0].text,/sign in/);
    }
    assert.deepEqual((await client.listTools()).tools,before.tools);
    assert.equal(stderr,'');
  } finally { await client.close(); }
});
