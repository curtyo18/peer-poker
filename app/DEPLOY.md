# Deploy

The app deploys to GitHub Pages as a static bundle:
1. `cd app && npm run build` → outputs `dist/`.
2. GitHub Actions: upload `dist/` as a Pages artifact (actions/deploy-pages@v4) on push to master.
3. `base` in vite.config.ts is already `/peer-poker/` (the repo name).

## CI workflow

`.github/workflows/deploy.yml` (repo root) builds `app/` and deploys `app/dist`
to GitHub Pages on every push to `master`, plus manual `workflow_dispatch`.
Enable it under Settings → Pages → Source: **GitHub Actions**.

Note that GitHub Pages only publishes from private repos on plans that support
it (GitHub Pro/Team/Enterprise, or GitHub Free for orgs with the feature
enabled). On a private repo without that, the workflow still builds
successfully but the `deploy` job/Pages site won't go live.
