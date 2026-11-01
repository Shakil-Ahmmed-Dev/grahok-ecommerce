This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Docker

Create a local `.env` file with `DATABASE_URL` and `BETTER_AUTH_SECRET` set. `BASE_URL` defaults to `http://localhost:3000`; Upstash Redis settings are optional.

### Development Mode

Run the development server with hot reload:

```bash
docker compose --profile development up
```

The development profile mounts the repository with polling-based hot reload (`WATCHPACK_POLLING=true`), isolates `/app/.next` build artifacts in an anonymous container volume to prevent host mount collisions, and persists Corepack and pnpm caches in named Docker volumes (`corepack-cache`, `pnpm-cache`).

### Production Standalone Image

Build the hardened production image with standalone Next.js output and run it with `node server.js`:

```bash
docker compose --profile production up --build
```

The production container uses a minimal multi-stage Alpine image running as a non-privileged `nextjs` user (`uid: 1001`), executes `node server.js` directly without development dependencies or package manager overhead, and includes an internal container healthcheck targeting `/api/health`.

### Database Migrations

The production container is a stripped-down, hardened runtime that does not include development tooling or migration runners (`drizzle-kit`, `tsx`). Always run database migrations separately before deploying or starting the production container:

```bash
# Apply pending migrations to the database
pnpm db:migrate

# Or for local development schema push:
pnpm db:push
```

Both profiles publish the app on [http://localhost:3000](http://localhost:3000). Use only one profile at a time.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
