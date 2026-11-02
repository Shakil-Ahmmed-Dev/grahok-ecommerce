import { drizzle } from 'drizzle-orm/node-postgres';
import { env } from '@/lib/t3env';
import * as publicSchema from './schemas/public';
import * as authSchema from './schemas/auth';

export * from './schemas/public';
export * from './schemas/auth';

export const db = drizzle(env.DATABASE_URL, { schema: { ...publicSchema, ...authSchema } });
