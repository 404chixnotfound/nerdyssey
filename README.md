# NERDYSSEY (Netlify)

## Deploy
1. Push this folder to GitHub (or drag-drop is NOT enough: functions need a build, use Git deploy or Netlify CLI).
2. Netlify > Add new site > Import from Git. Build settings auto-read from `netlify.toml`.
3. Site settings > Environment variables > add `ADMIN_PASSWORD` (mark as secret).
4. Deploy. Done.

CLI alternative: `npm i -g netlify-cli && netlify deploy --build --prod`

Data stored in Netlify Blobs. Visitors poll every 4s.
