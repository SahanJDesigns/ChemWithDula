import { Client } from '@neondatabase/serverless';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const env = fs.readFileSync('.env.local', 'utf8');
const match = env.match(/DATABASE_URL="?([^"\r\n]+)"?/);
if (!match) {
  console.error('DATABASE_URL not found in .env.local');
  process.exit(1);
}

const client = new Client(match[1]);
await client.connect();

// 1. Check existing stored_files
const storedFilesRes = await client.query('SELECT id, file_name, file_size FROM stored_files;');
console.log(`Currently ${storedFilesRes.rows.length} files stored in Neon DB.`);

// Map file_name + file_size to id
const existingMap = new Map();
for (const row of storedFilesRes.rows) {
  existingMap.set(`${row.file_name}_${row.file_size}`, row.id);
}

// 2. Scan all files in public/uploads
const uploadsDir = path.join(process.cwd(), 'public', 'uploads');

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

function getAllFiles(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  const items = fs.readdirSync(dir);
  for (const item of items) {
    if (item === '.gitkeep') continue;
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      getAllFiles(fullPath, fileList);
    } else {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

const allFiles = getAllFiles(uploadsDir);
console.log(`Found ${allFiles.length} files in public/uploads/`);

// 3. Upload any file not yet in Neon
let uploadedCount = 0;
const filePathToUrlMap = new Map();

for (const filePath of allFiles) {
  const fileName = path.basename(filePath);
  const buffer = fs.readFileSync(filePath);
  const size = buffer.length;
  const key = `${fileName}_${size}`;
  const relativeWebPath = '/uploads/' + path.relative(uploadsDir, filePath).replace(/\\/g, '/');

  let fileId;
  if (existingMap.has(key)) {
    fileId = existingMap.get(key);
  } else {
    const mimeType = getMime(fileName);
    const insertRes = await client.query(
      `INSERT INTO stored_files (file_name, mime_type, file_data, file_size)
       VALUES ($1, $2, $3, $4) RETURNING id;`,
      [fileName, mimeType, buffer, size]
    );
    fileId = insertRes.rows[0].id;
    existingMap.set(key, fileId);
    uploadedCount++;
  }

  const newUrl = `/api/files/${fileId}/${fileName}`;
  filePathToUrlMap.set(relativeWebPath, newUrl);
  // Also map with basename or alternative matches if needed
  filePathToUrlMap.set(fileName, newUrl);
}

console.log(`Uploaded ${uploadedCount} new files into Neon.`);

// 4. Update any database references across relevant tables
// Check tables that might have /uploads/
const tablesToCheck = [
  { table: 'questions', cols: ['image_url', 'option_a_image_url', 'option_b_image_url', 'option_c_image_url', 'option_d_image_url', 'option_e_image_url'] },
  { table: 'exams', cols: ['pdf_url'] }
];

for (const { table, cols } of tablesToCheck) {
  for (const col of cols) {
    const queryRes = await client.query(`SELECT id, ${col} FROM ${table} WHERE ${col} LIKE '%/uploads/%';`);
    if (queryRes.rows.length > 0) {
      console.log(`Found ${queryRes.rows.length} rows in ${table}.${col} with /uploads/`);
      for (const row of queryRes.rows) {
        const val = row[col];
        // find replacement
        let rep = null;
        for (const [oldPath, newUrl] of filePathToUrlMap.entries()) {
          if (oldPath.startsWith('/uploads/') && val.includes(oldPath)) {
            rep = val.replace(oldPath, newUrl);
            break;
          }
        }
        if (!rep) {
          // try matching filename
          const fname = path.basename(val.split('?')[0]);
          if (filePathToUrlMap.has(fname)) {
            rep = filePathToUrlMap.get(fname);
          }
        }
        if (rep) {
          await client.query(`UPDATE ${table} SET ${col} = $1 WHERE id = $2;`, [rep, row.id]);
          console.log(`  Updated ${table} ${row.id}: ${val} -> ${rep}`);
        } else {
          console.warn(`  Could not find replacement for ${table}.${col}: ${val}`);
        }
      }
    }
  }
}

// 5. Verify no remaining /uploads/ references in database
let remainingRefs = 0;
for (const { table, cols } of tablesToCheck) {
  for (const col of cols) {
    const checkRes = await client.query(`SELECT count(*) FROM ${table} WHERE ${col} LIKE '%/uploads/%';`);
    const count = parseInt(checkRes.rows[0].count, 10);
    remainingRefs += count;
    if (count > 0) {
      console.warn(`⚠️ Warning: ${count} rows still have /uploads/ in ${table}.${col}`);
    }
  }
}

if (remainingRefs === 0) {
  console.log('✅ No /uploads/ references left in the database!');
} else {
  console.warn(`⚠️ Still found ${remainingRefs} references in database.`);
}

// 6. Delete all files in public/uploads/ except .gitkeep
function cleanDirectory(dir) {
  if (!fs.existsSync(dir)) return;
  const items = fs.readdirSync(dir);
  for (const item of items) {
    if (item === '.gitkeep') continue;
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      cleanDirectory(fullPath);
      // Remove folder if empty
      try {
        fs.rmdirSync(fullPath);
      } catch (e) {}
    } else {
      fs.unlinkSync(fullPath);
    }
  }
}

console.log('🗑️ Cleaning public/uploads/...');
cleanDirectory(uploadsDir);

// Ensure .gitkeep exists
const gitkeepPath = path.join(uploadsDir, '.gitkeep');
if (!fs.existsSync(gitkeepPath)) {
  fs.writeFileSync(gitkeepPath, '');
}

console.log('✅ public/uploads/ successfully emptied! Kept .gitkeep.');

const finalStored = await client.query('SELECT count(*) FROM stored_files;');
console.log(`Total files stored in Neon: ${finalStored.rows[0].count}`);

await client.end();

