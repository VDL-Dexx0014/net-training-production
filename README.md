# NET Training App

A workout tracking platform for personal training gyms. Trainers log client sessions on machines, clients view their progress, and management tracks utilisation across locations.

Built with Next.js 15, Supabase, and deployed on Vercel.

---

## Roles

| Role | Access |
|---|---|
| **Client** | View training routines, session history, progress charts, export data |
| **Trainer** | Log sessions for assigned clients, manage client programs |
| **Management** | Full dashboard — clients, trainers, locations, reports |
| **Admin** | User management, machine configuration, system settings |

---

## Getting started

### Prerequisites

- Node.js 18+
- A Supabase project (see [supabase.com](https://supabase.com))
- A Vercel account connected to this GitHub repo

### Local setup

1. Clone this repo
2. Install dependencies:
   ```bash
   npm install
   ```
3. Copy the environment file and fill in your Supabase credentials:
   ```bash
   cp .env.local.example .env.local
   ```
4. Run the development server:
   ```bash
   npm run dev
   ```
   The app will be available at [http://localhost:3000](http://localhost:3000).

---

## Environment variables

| Variable | Where to find it |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API → anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API → service_role key (keep private) |

---

## Database

All migrations live in `supabase/migrations/` in chronological order. To set up a fresh Supabase project, run them in order via the Supabase SQL editor or CLI.

The canonical schema is defined in `src/types/database.types.ts`.

---

## Deployment

The app deploys automatically to Vercel on every push to `main`.

To deploy manually:
```bash
vercel --prod
```

---

## Project structure

```
src/
  app/          # Next.js App Router pages (client/, trainer/, management/, admin/, api/)
  components/   # React components organised by feature
  lib/          # Supabase client, auth helpers, export logic, utilities
  store/        # Zustand auth store
  types/        # TypeScript types (database.types.ts is auto-generated from Supabase)
public/         # Static assets (logos, default images)
supabase/
  migrations/   # All database migrations in order
```

---

## Support

Contact [veerle@gmail.com](mailto:veerle@gmail.com) for setup assistance or to report issues.
