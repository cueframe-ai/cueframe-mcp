import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {checkPublicOpenAPI} from './check-openapi-public.mjs';
const document=JSON.parse(readFileSync(new URL('../api/openapi.json',import.meta.url),'utf8'));
const surface=JSON.parse(readFileSync(new URL('../api/public-surface.json',import.meta.url),'utf8'));
const snapshot=doc=>doc.components.schemas.AcquireRegistryItemRequest.properties.snapshot.properties;
test('reviewed public upstream registry full-SHA selectors pass the actual projected contract',()=>{
 assert.equal(snapshot(document).sourceCommit.pattern,'^[0-9a-f]{40}$');
 assert.ok(checkPublicOpenAPI(document,surface).operationCount>0);
});
test('private build commit payload remains forbidden even when it is a full SHA',()=>{
 const doc=structuredClone(document);doc.info.sourceCommit='a'.repeat(40);
 assert.throws(()=>checkPublicOpenAPI(doc,surface),/Private structural key at \$\.info\.sourceCommit/);
});
test('same named registry schema cannot hide private commit metadata at an unreviewed path',()=>{
 const doc=structuredClone(document);
 doc.components.schemas.AcquireRegistryItemRequest.properties.privateBuild={type:'object',properties:structuredClone(snapshot(document))};
 assert.throws(()=>checkPublicOpenAPI(doc,surface),/Private structural key .*privateBuild\.properties\.sourceCommit/);
});
test('unrelated named schemas cannot borrow the public registry selector shape',()=>{
 const doc=structuredClone(document);doc.components.schemas.PrivateBuildMetadata={type:'object',properties:structuredClone(snapshot(document))};
 assert.throws(()=>checkPublicOpenAPI(doc,surface),/Private structural key .*PrivateBuildMetadata\.properties\.sourceCommit/);
});
test('upstream exception requires the canonical full commit constraint',()=>{
 const doc=structuredClone(document);snapshot(doc).sourceCommit.pattern='.*';
 assert.throws(()=>checkPublicOpenAPI(doc,surface),/Private structural key .*sourceCommit/);
});
test('other private source provenance stays forbidden beside a public upstream selector',()=>{
 const doc=structuredClone(document);snapshot(doc).sourceRepository={type:'string'};
 assert.throws(()=>checkPublicOpenAPI(doc,surface),/Private structural key/);
});
