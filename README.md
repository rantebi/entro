# Project Overview

Simple TypeScript Express backend that stores a repo/branch, scans commits, and marks ones with detected leaks (currently just the word "Generated"). A future React frontend will live under `platform/`.

## services

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
- `services/src/utils/leakIdentifier.util.ts` — detects leaks in commit diffs; currently flags added lines containing “Generated”.

Detection note: leak detection is currently limited to finding the literal text “Generated” in added lines.

## platform
(reserved for upcoming React UI)

