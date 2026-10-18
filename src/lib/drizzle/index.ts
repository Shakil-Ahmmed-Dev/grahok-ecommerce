import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { env } from '@/lib/t3env';
import * as publicSchema from './schemas/public';
import * as authSchema from './schemas/auth';

export * from './schemas/public';
export * from './schemas/auth';

const sql = neon(env.DATABASE_URL);
export const db = drizzle({ client: sql, schema: { ...publicSchema, ...authSchema } });
