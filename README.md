# NERDYSSEY (Netlify)

## Deploy
1. Push this folder to GitHub (or drag-drop is NOT enough: functions need a build, use Git deploy or Netlify CLI).
2. Netlify > Add new site > Import from Git. Build settings auto-read from `netlify.toml`.
3. Site settings > Environment variables > add `ADMIN_PASSWORD` (mark as secret).
4. Deploy. Done.

CLI alternative: `npm i -g netlify-cli && netlify deploy --build --prod`

Data stored in Netlify Blobs. Visitors poll every 4s.

## /s1 page
Secret word unlocks the digit "6". Word is checked on the server.
Set env var `S1_WORD` in Netlify (not secret-flagged needed, but fine to mark secret). Case and spaces ignored.
