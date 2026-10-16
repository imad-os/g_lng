// Every built document must survive the trip seed (encode) -> app (decode) unchanged.
//   node tools/test-firestore-format.mjs
import assert from 'node:assert/strict';
import { readBuild } from './lib/common.mjs';
import { encodeFields } from './lib/firestore-value.mjs';
import { decodeFields } from '../src/data/firestore.js';

const docs = readBuild();
for (const d of docs) assert.deepEqual(decodeFields(JSON.parse(JSON.stringify(encodeFields(d.data)))), d.data, d.path);
console.log(`OK: ${docs.length} documents round-trip through the Firestore format`);
