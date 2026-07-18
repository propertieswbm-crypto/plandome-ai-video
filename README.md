# OpenVideo Studio

Production-oriented AI video generation SaaS built with Next.js, TypeScript, Supabase, BullMQ, Remotion, and FFmpeg.

## Local setup

1. Install Node.js 22+ and pnpm 11.
2. Copy `.env.example` to `.env.local` and add the public settings from a Supabase project.
3. Apply `supabase/migrations` with the Supabase CLI or SQL editor.
4. Run `pnpm install` and `pnpm dev`.
5. Open `http://localhost:3000`.

Use `pnpm check` before every deployment. Secret service-role and provider keys must never use the `NEXT_PUBLIC_` prefix.
