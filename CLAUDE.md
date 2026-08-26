# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

- `npm run dev` — start the dev server at http://localhost:3000
- `npm run build` — production build
- `npm run start` — serve the production build
- `npm run lint` — ESLint (flat config in `eslint.config.mjs`, extends `eslint-config-next`)

No test runner is configured yet.

## Architecture

This is a freshly scaffolded Next.js App Router project (`src/app`) with shadcn/ui; there is no
custom application code yet beyond the default homepage.

- Path alias `@/*` → `src/*` (see `tsconfig.json`).
- Tailwind CSS v4 with no `tailwind.config.*` — theme tokens and the `dark` variant are defined
  directly in `src/app/globals.css` via `@theme inline`. That file also imports `shadcn/tailwind.css`
  from the `shadcn` package, so shadcn's own token/utility layer is pulled in at build time rather
  than copied into the repo.
- shadcn/ui is configured through `components.json`: style `base-nova`, base color `neutral`, icons
  from `lucide-react`, RSC on. Components generated under this style are built on `@base-ui/react`
  primitives (not Radix, which is what most shadcn/ui docs and examples assume) — check the
  installed component's imports before assuming Radix-style props/APIs apply.
- Add new shadcn components with `npx shadcn add <name>`; they land in `src/components/ui` per the
  aliases in `components.json` (`components`, `ui`, `lib`, `hooks` all map under `@/`).
- `src/lib/utils.ts` exports `cn()` (clsx + tailwind-merge), the standard helper shadcn components
  use for merging class names.
