import { Client } from '@neondatabase/serverless';
import fs from 'fs';
import path from 'path';

const env = fs.readFileSync('.env.local', 'utf8');
const match = env.match(/DATABASE_URL="?([^"\r\n]+)"?/);
if (!match) {
  console.error('DATABASE_URL not found in .env.local');
  process.exit(1);
}

const client = new Client(match[1]);
await client.connect();

function getMime(filename) {
  const ext = path.extname(filename).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.gif') return 'image/gif';
  if (ext === '.svg') return 'image/svg+xml';
  if (ext === '.pdf') return 'application/pdf';
  return 'application/octet-stream';
}

console.log('🔄 Checking existing local uploads to migrate to Neon Postgres...');

// Cache uploaded file mapping: oldUrl -> newUrl
const urlCache = new Map();

async function migrateFile(oldUrl) {
  if (!oldUrl || !oldUrl.startsWith('/uploads/')) return oldUrl;
  if (urlCache.has(oldUrl)) return urlCache.get(oldUrl);

  const cleanPath = oldUrl.split('?')[0].replace(/^\/uploads\//, '');
  const diskPath = path.join(process.cwd(), 'public', 'uploads', cleanPath);

  if (!fs.existsSync(diskPath)) {
    console.warn(`⚠️ File not found on disk: ${diskPath}`);
    return oldUrl;
  }

  const buffer = fs.readFileSync(diskPath);
  const fileName = path.basename(diskPath);
  const mimeType = getMime(fileName);

  const res = await client.query(
    `INSERT INTO stored_files (file_name, mime_type, file_data, file_size)
     VALUES ($1, $2, $3, $4) RETURNING id;`,
    [fileName, mimeType, buffer, buffer.length]
  );

  const newId = res.rows[0].id;
  const newUrl = `/api/files/${newId}/${fileName}`;
  urlCache.set(oldUrl, newUrl);
  return newUrl;
}

// 1. Migrate questions
const qRes = await client.query(`
  SELECT id, image_url, option_a_image_url, option_b_image_url, option_c_image_url, option_d_image_url, option_e_image_url
  FROM questions
  WHERE image_url LIKE '%/uploads/%'
     OR option_a_image_url LIKE '%/uploads/%'
     OR option_b_image_url LIKE '%/uploads/%'
     OR option_c_image_url LIKE '%/uploads/%'
     OR option_d_image_url LIKE '%/uploads/%'
     OR option_e_image_url LIKE '%/uploads/%';
`);

console.log(`Found ${qRes.rows.length} questions to migrate.`);

let updatedQCount = 0;
for (const q of qRes.rows) {
  let changed = false;
  let newImg = q.image_url;
  let newA = q.option_a_image_url;
  let newB = q.option_b_image_url;
  let newC = q.option_c_image_url;
  let newD = q.option_d_image_url;
  let newE = q.option_e_image_url;

  if (q.image_url && q.image_url.includes('/uploads/')) {
    newImg = await migrateFile(q.image_url);
    if (newImg !== q.image_url) changed = true;
  }
  if (q.option_a_image_url && q.option_a_image_url.includes('/uploads/')) {
    newA = await migrateFile(q.option_a_image_url);
    if (newA !== q.option_a_image_url) changed = true;
  }
  if (q.option_b_image_url && q.option_b_image_url.includes('/uploads/')) {
    newB = await migrateFile(q.option_b_image_url);
    if (newB !== q.option_b_image_url) changed = true;
  }
  if (q.option_c_image_url && q.option_c_image_url.includes('/uploads/')) {
    newC = await migrateFile(q.option_c_image_url);
    if (newC !== q.option_c_image_url) changed = true;
  }
  if (q.option_d_image_url && q.option_d_image_url.includes('/uploads/')) {
    newD = await migrateFile(q.option_d_image_url);
    if (newD !== q.option_d_image_url) changed = true;
  }
  if (q.option_e_image_url && q.option_e_image_url.includes('/uploads/')) {
    newE = await migrateFile(q.option_e_image_url);
    if (newE !== q.option_e_image_url) changed = true;
  }

  if (changed) {
    await client.query(
      `UPDATE questions
       SET image_url = $1,
           option_a_image_url = $2,
           option_b_image_url = $3,
           option_c_image_url = $4,
           option_d_image_url = $5,
           option_e_image_url = $6
       WHERE id = $7;`,
      [newImg, newA, newB, newC, newD, newE, q.id]
    );
    updatedQCount++;
  }
}

console.log(`✅ Successfully migrated ${updatedQCount} questions into Neon Postgres!`);

// 2. Migrate exams pdf_url
const eRes = await client.query(`
  SELECT id, pdf_url
  FROM exams
  WHERE pdf_url LIKE '%/uploads/%';
`);

console.log(`Found ${eRes.rows.length} exams with pdf_url to migrate.`);
let updatedECount = 0;
for (const ex of eRes.rows) {
  if (ex.pdf_url && ex.pdf_url.includes('/uploads/')) {
    const newPdf = await migrateFile(ex.pdf_url);
    if (newPdf !== ex.pdf_url) {
      await client.query(`UPDATE exams SET pdf_url = $1 WHERE id = $2;`, [newPdf, ex.id]);
      updatedECount++;
    }
  }
}

console.log(`✅ Successfully migrated ${updatedECount} exams into Neon Postgres!`);
console.log(`Total unique files transferred into Neon: ${urlCache.size}`);

await client.end();
console.log('🎉 Migration to Neon file storage completed!');

