import { env } from '@/lib/t3env';
import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
    out: './src/lib/drizzle/migrations',
    schema: [
        './src/lib/drizzle/schemas/public.ts',
        './src/lib/drizzle/schemas/auth.ts'
    ],
    dialect: 'postgresql',
    dbCredentials: {
        url: env.DATABASE_URL,
    },
});
