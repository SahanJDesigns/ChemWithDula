import { Client } from '@neondatabase/serverless';
import fs from 'fs';

const env = fs.readFileSync('.env.local', 'utf8');
const match = env.match(/DATABASE_URL="?([^"\r\n]+)"?/);
const client = new Client(match[1]);
await client.connect();

const q = await client.query("SELECT count(*) FROM questions WHERE image_url LIKE '%uploads%'");
const e = await client.query("SELECT count(*) FROM exams WHERE pdf_url LIKE '%uploads%'");
console.log('Questions with local uploads:', q.rows[0].count);
console.log('Exams with local uploads:', e.rows[0].count);

await client.end();
