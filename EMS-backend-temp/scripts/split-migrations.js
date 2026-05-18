// scripts/split-migrations.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const INPUT = path.join(__dirname, '..', 'DDL', 'full_schema.sql');
const OUTPUT_DIR = path.join(__dirname, '..', 'migrations');

if (!fs.existsSync(INPUT)) {
  console.error('❌ full_schema.sql not found in DDL/');
  process.exit(1);
}
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const sql = fs.readFileSync(INPUT, 'utf8');

function extract(pattern) {
  const regex = new RegExp(pattern, 'gis');
  const matches = [];
  let match;
  while ((match = regex.exec(sql)) !== null) {
    matches.push(match[0].trim());
  }
  return matches;
}

const extensions = extract(/CREATE EXTENSION.*?;/gs);
const sequences = extract(/CREATE SEQUENCE[\s\S]*?;/gs);
const functions = extract(/CREATE (?:OR REPLACE )?\s*FUNCTION[\s\S]*?END;\s*\$\$;/gs);
const tables = extract(/CREATE TABLE[\s\S]*?;/gs);
const constraints = extract(/ALTER TABLE ONLY[\s\S]*?;/gs);
const indexes = extract(/CREATE INDEX[\s\S]*?;/gs);
const triggers = extract(/CREATE TRIGGER[\s\S]*?;/gs);

// --- Timestamps for migration ordering ---
const timestamps = [
  '1712620800000',
  '1712620801000',
  '1712620802000',
  '1712620803000',
  '1712620804000',
  '1712620805000',
  '1712620806000',
];

const migrationFiles = [
  { name: '000_enable_extensions.sql', newName: `${timestamps[0]}_enable_extensions.sql`, items: extensions, drop: extensions.map(e => `DROP EXTENSION IF EXISTS "${e.match(/CREATE EXTENSION.*?"([^"]+)"/i)?.[1] || 'unknown'}" CASCADE;`) },
  { name: '001_create_sequences.sql', newName: `${timestamps[1]}_create_sequences.sql`, items: sequences, drop: sequences.map(s => `DROP SEQUENCE IF EXISTS ${s.match(/CREATE SEQUENCE\s+([\w.]+)/i)?.[1] || 'unknown'};`) },
  { name: '002_create_functions.sql', newName: `${timestamps[2]}_create_functions.sql`, items: functions, drop: functions.map(f => { const sig = f.match(/CREATE (?:OR REPLACE )?FUNCTION\s+([\w.]+\([^)]*\))/i)?.[1]; return sig ? `DROP FUNCTION IF EXISTS ${sig};` : `-- TODO: Drop function manually`; }) },
  { name: '003_create_tables.sql', newName: `${timestamps[3]}_create_tables.sql`, items: tables, drop: tables.map(t => `DROP TABLE IF EXISTS ${t.match(/CREATE TABLE\s+([\w.]+)/i)?.[1] || 'unknown'} CASCADE;`) },
  { name: '004_create_constraints.sql', newName: `${timestamps[4]}_create_constraints.sql`, items: constraints, drop: ['-- Constraints are automatically dropped by DROP TABLE CASCADE in 003_create_tables.sql'] },
  { name: '005_create_indexes.sql', newName: `${timestamps[5]}_create_indexes.sql`, items: indexes, drop: indexes.map(i => `DROP INDEX IF EXISTS ${i.match(/CREATE INDEX\s+([\w.]+)/i)?.[1] || 'unknown'};`) },
  { name: '006_create_triggers.sql', newName: `${timestamps[6]}_create_triggers.sql`, items: triggers, drop: triggers.map(t => { const match = t.match(/CREATE TRIGGER\s+([\w.]+)\s+.*?ON\s+([\w.]+)/i); return match ? `DROP TRIGGER IF EXISTS ${match[1]} ON ${match[2]};` : `-- TODO: Drop trigger manually`; }) },
];

function writeMigration(filename, upBlocks, downLines) {
  if (upBlocks.length === 0) return;
  const content = `-- Up Migration\n${upBlocks.join('\n\n')}\n\n-- Down Migration\n${downLines.join('\n')}\n`;
  fs.writeFileSync(path.join(OUTPUT_DIR, filename), content, 'utf8');
  console.log(`✅ ${filename} (${upBlocks.length} objects)`);
}

// --- Delete old migration files ---
const oldFiles = fs.readdirSync(OUTPUT_DIR).filter(f => /^00\d_/.test(f));
oldFiles.forEach(f => {
  fs.unlinkSync(path.join(OUTPUT_DIR, f));
  console.log(`🗑️  Deleted ${f}`);
});

// --- Write new migration files with timestamps ---
migrationFiles.forEach(m => {
  writeMigration(m.newName, m.items, m.drop);
});

console.log('\n🎉 All migration files generated in /migrations');

// --- Update pgmigrations table to track new timestamps ---
async function updateMigrationTracking() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    const oldToNew = migrationFiles.map(m => ({ old: m.name.replace('.sql', ''), new: m.newName.replace('.sql', '') }));
    for (const { old, new: newName } of oldToNew) {
      const res = await client.query('SELECT 1 FROM pgmigrations WHERE name = $1', [old]);
      if (res.rows.length > 0) {
        await client.query('UPDATE pgmigrations SET name = $1 WHERE name = $2', [newName, old]);
        console.log(`✅ Tracked: ${old} → ${newName}`);
      }
    }
    console.log('✅ Migration tracking updated');
  } catch (err) {
    console.error('❌ Failed to update migration tracking:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

updateMigrationTracking();
