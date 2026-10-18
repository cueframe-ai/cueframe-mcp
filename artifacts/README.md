# Kernel used for local contract generation

`cueframe-kernel-0.7.6.tgz` is the selected packed kernel from the frozen,
uncommitted integration source based on public commit
`3149381bec40d585c849a92b4fb961abf8968a97`. It is a local candidate, not a published
or clean committed release. SHA-256:
`891c00fdb68891d5dae25545abcefbd6d0f1fa755b9d22bc864ee7e560073571`.
Its generated composition schema reports version `0.7.6`.

This archive supersedes the earlier local 0.7.6 candidate with SHA-256
`ef76208f8387b0aeb8b1bfd09192a3c74473cc2d1087ae9e792bc3d0c26f2d4d`, whose
generated composition schema still reported 0.7.5. The pnpm lock records the
replacement archive's integrity.

The older `cueframe-kernel-0.7.5.tgz` remains as historical input (SHA-256
`f71ef2374b6b8cd268475fd2aa3eb3113657efe201227d84f096d0793b7b1901`); the current
override selects 0.7.6.

The repository-relative pnpm override retains the exact artifact used for local
contract generation before registry publication. Changing archive bytes requires
refreshing the lockfile integrity and installation before generating consumers.
