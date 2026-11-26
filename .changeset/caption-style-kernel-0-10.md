---
"@cueframe/api-contract": major
"@cueframe/sdk": minor
"cueframe": patch
---

Sync the contract against released kernel 0.10.0. Each `setCaptionStyle` style field now also accepts `null`, which clears that field. Captions gain `lingerMs`, which sets how long a caption page stays after its last word (0 to 2000 ms). The caption plate and the bounded caption style fields are now documented.
