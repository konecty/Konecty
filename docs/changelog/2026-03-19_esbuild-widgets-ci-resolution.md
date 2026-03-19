# Build reliability for MCP widgets in CI

## Summary

This change fixes a CI build failure where the MCP widgets build could not resolve `esbuild` in clean environments.

## Motivation

GitHub Actions jobs were running the root build command without ensuring dependencies were installed inside the nested `src/mcp/widgets` package. In runners without a preexisting local install, this caused `ERR_MODULE_NOT_FOUND`.

## What changed

- Updated the root widgets build script to install dependencies inside `src/mcp/widgets` before running the widgets build.
- Moved `esbuild` from `devDependencies` to `dependencies` in the widgets package to make build-time resolution resilient in production-only install scenarios.
- Extended CI dependency cache paths to include `src/mcp/widgets/node_modules` in relevant workflows.

## Technical impact

- Root builds now perform a deterministic install step for the nested widgets package before executing its build.
- CI jobs can reuse cached nested dependencies, reducing repeated install cost.
- The widgets build no longer depends on incidental local state to resolve `esbuild`.

## External impact

There is no runtime behavior change for end users. The impact is limited to build stability and CI reliability.

## How to validate

- Run the root build in a clean environment and verify the widgets step completes successfully.
- Confirm CI workflows pass the build phase that runs the root `yarn build` command.

## Affected files

- `package.json`
- `src/mcp/widgets/package.json`
- `.github/workflows/develop.yaml`
- `.github/workflows/release.yaml`
- `.github/workflows/merge-requests.yaml`

## Is migration required?

No migration is required.
