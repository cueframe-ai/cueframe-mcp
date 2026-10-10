import {expect,it} from 'vitest';
import {ComponentListResponse} from './generated/zod/models/componentListResponse.zod';
const pin='a'.repeat(64),documentPin='b'.repeat(64);
const scopes=[{kind:'builtin',collection:'native'},{kind:'org-local',orgId:'org',workspaceId:'local'},{kind:'org-hosted',orgId:'org',deploymentId:'host'}] as const;
it('generated consumers accept absent presentation and preserve its optional descriptor across every origin and card kind',()=>{
 for(const scope of scopes){
  const source={scope,componentId:'card',sourceVersionId:pin,sourceVersion:3};
  const document={scope,documentId:'recipe',documentSha256:documentPin};
  const common={identity:{scope,id:'card',revision:pin},name:'Card',description:'',category:'text'};
  const cards=[{...common,kind:'definition',source,origin:'customer-owned',declaration:{state:'v3',capabilities:[{kind:'clip'}],timing:{defaultDuration:{frames:150,fps:30}}}},{...common,kind:'preset',definition:source,presetVersionId:pin,historicalDocument:document,equivalence:'unproven'},{...common,identity:{scope,id:'recipe',revision:documentPin},kind:'recipe',document,memberSources:[source],placementCount:1,equivalence:'unproven'}];
  for(const card of cards)for(const presentation of [undefined,{version:1,representativeTimeSeconds:4}]){
   const value={...card,...(presentation?{presentation}:{})};
   const response={protocolVersion:1,scope,data:[value],pagination:{hasMore:false,nextCursor:null,prevCursor:null}};
   expect(ComponentListResponse.parse(response)).toEqual(response);
   expect(value.identity).toEqual(card.identity);
  }
  for(const presentation of [{version:2,representativeTimeSeconds:4},{version:1,representativeTimeSeconds:-1},{version:1,representativeTimeSeconds:4,unknown:true}])expect(ComponentListResponse.safeParse({protocolVersion:1,scope,data:[{...cards[0],presentation}],pagination:{hasMore:false,nextCursor:null,prevCursor:null}}).success).toBe(false);
 }
});
