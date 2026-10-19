# Claude Code

Add the hosted server (the browser opens to sign in on the first call):

```
claude mcp add --transport http cueframe https://api.cueframe.ai/v1/mcp
```

Then ask:

> Run get_account to confirm CueFrame is connected, then make a 9:16 social clip from https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/360/Big_Buck_Bunny_360_10s_1MB.mp4 with captions and give me the MP4.

For the skills as well (storyboarding, clipping, brand kits, the quality bar), install the plugin (`claude plugin marketplace add cueframe-ai/cueframe-mcp && claude plugin install cueframe@cueframe`) or run `npx -y cueframe@0.10 install`.
