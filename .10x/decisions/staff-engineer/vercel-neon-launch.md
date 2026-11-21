# Staff engineer — vercel-neon-launch
- Keep handlers pure (`Deps`), tests on memory repo. Files < 400 lines, no `any`, no console.log (adapter logs with console.error only on 500, as before).
- i18n: every new string via `t()` + `en.ts`. Design system tokens/components (`components/ui/styles`).
- Admin preview code removed together with its tests.
