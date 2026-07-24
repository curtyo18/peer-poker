# Deploy

On going public, deploy the app to GitHub Pages:
1. `cd app && npm run build` → outputs `dist/`.
2. GitHub Actions: upload `dist/` as a Pages artifact (actions/deploy-pages@v4) on push to master.
3. `base` in vite.config.ts is already `/peer-poker/` (the repo name).
