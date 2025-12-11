# Project Overview

Simple TypeScript Express backend that stores a repo/branch, scans commits, and marks ones with detected leaks. A future React frontend will live under `platform/`.

## services

To start 
```bash
cd services && npm run dev
```

### Behaviour
- Express API with `/repos` (configure repo/branch) and `/scans` (view scan results).
-  GitHub calls include retry with exponential backoff.
-  Repo/scan state is kept in-memory and scans run asynchronously so results populate while leak checks continue.

### Files
- `services/src/server.ts` — boots the Express app on `PORT` (default 3000).
- `services/src/app.ts` — wires middleware and routes.
- `services/src/clients/githubClient.ts` — Octokit client with retry (8 tries, exponential backoff) for repo/branch/commit/diff fetches.
- `services/src/services/state.service.ts` — in-memory repo metadata and GitHub client singleton.
- `services/src/services/repos.service.ts` — handles `/repos` POST/GET; kicks off scans after validation.
- `services/src/services/scans.service.ts` — paginates commits (up to 2,000), stores them, then asynchronously enriches with leak findings.
- `services/src/utils/leakIdentifier.util.ts` — detects leaks in commit diffs based on env toggle.

Detection note: by default the backend flags basic secret-looking values (tokens/keys) in added lines. Set env `DETECT_THE_WORD_GENERATED=true` to switch to the previous behavior that only looks for the word “Generated”.

## platform

Has supporting react application.

To start
```bash
cd platform && npm run dev
```
