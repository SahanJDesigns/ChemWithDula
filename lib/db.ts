import { neon } from '@neondatabase/serverless';

const dbUrl = process.env.DATABASE_URL || process.env.DATABASE_URL_UNPOOLED;

if (!dbUrl) {
  throw new Error('DATABASE_URL is not set in environment variables');
}

export const sql = neon(dbUrl);
