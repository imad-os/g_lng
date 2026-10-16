// Writes content/build into Firestore. Run it on your own PC; it is never shipped to TVs.
//   node tools/seed-firestore.mjs --key path/to/service-account.json [--only fr] [--dry-run]
// The service account key comes from Firebase console > Project settings > Service accounts >
// Generate new private key. Keep that file out of the repository (.gitignore lists *service-account*.json).
import fs from 'node:fs';
import crypto from 'node:crypto';
import { readBuild } from './lib/common.mjs';
import { encodeFields } from './lib/firestore-value.mjs';

const args = process.argv.slice(2);
const arg = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const dryRun = args.includes('--dry-run');
const only = arg('--only');
const keyFile = arg('--key');

let docs = readBuild();
if (only) docs = docs.filter((d) => d.path === `courses/${only}` || d.path.startsWith(`courses/${only}/`) || d.path === 'meta/catalog');
// The catalog goes last: the app sees the new content version only once everything else is written.
docs.sort((a, b) => (a.path === 'meta/catalog') - (b.path === 'meta/catalog'));

if (dryRun) {
  console.log(`Dry run: ${docs.length} documents would be written`);
  for (const d of docs.slice(0, 10)) console.log('  ' + d.path);
  process.exit(0);
}
if (!keyFile) { console.error('Missing --key path/to/service-account.json'); process.exit(1); }

const key = JSON.parse(fs.readFileSync(keyFile, 'utf8'));
const project = arg('--project') || key.project_id;
const base = `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents`;
const token = await accessToken(key);

const BATCH = 400;   // Firestore allows 500 writes per commit
for (let i = 0; i < docs.length; i += BATCH) {
  const writes = docs.slice(i, i + BATCH).map((d) => ({
    update: { name: `projects/${project}/databases/(default)/documents/${d.path}`, fields: encodeFields(d.data) },
  }));
  const res = await fetch(`${base}:commit`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ writes }),
  });
  if (!res.ok) { console.error(`Commit failed (${res.status}): ${await res.text()}`); process.exit(1); }
  console.log(`Wrote ${Math.min(i + BATCH, docs.length)} / ${docs.length}`);
}
console.log(`Done: ${docs.length} documents in ${project}`);

async function accessToken(sa) {
  const now = Math.floor(Date.now() / 1000);
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const unsigned = `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64({
    iss: sa.client_email, scope: 'https://www.googleapis.com/auth/datastore',
    aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600,
  })}`;
  const signature = crypto.createSign('RSA-SHA256').update(unsigned).sign(sa.private_key).toString('base64url');
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsigned}.${signature}` }),
  });
  if (!res.ok) { console.error(`Sign-in with the service account failed (${res.status}): ${await res.text()}`); process.exit(1); }
  return (await res.json()).access_token;
}
