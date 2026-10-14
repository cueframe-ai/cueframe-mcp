// The contract embeds the kernel's own OpenAPI components verbatim. The kernel that generates them is
// the one pinned for the contract build (packages/api-contract devDependency @cueframe/kernel), and its
// version must be the manifest's kernelVersion: a contract that embeds another kernel's components, or
// a pin that disagrees with the manifest, fails here instead of shipping (contract 4.0.0 shipped
// pre-0.7.0 components under kernel 0.7.0).
import { isDeepStrictEqual } from 'node:util';

/** Problems with `spec`'s kernel-owned components against the kernel `artifact`; empty when they agree. */
export function kernelComponentProblems(spec, artifact, kernelVersion) {
  const problems = [];
  if (artifact.info.version !== kernelVersion) {
    problems.push(`the pinned @cueframe/kernel is ${artifact.info.version}, but api/contract-manifest.json records kernelVersion ${kernelVersion}; pin the kernel the contract was synced from`);
  }
  for (const [name, definition] of Object.entries(artifact.components.schemas)) {
    if (!isDeepStrictEqual(spec.components?.schemas?.[name], definition)) {
      problems.push(`components.schemas.${name} differs from @cueframe/kernel ${artifact.info.version}; re-run the private contract sync against that kernel`);
    }
  }
  return problems;
}
