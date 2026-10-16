// Read-only Firestore access over REST: no Firebase SDK download, one fetch per document.
// Security rules (firestore.rules) allow public reads and deny every client write.

export function firestoreSource(projectId, apiKey) {
  const base = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents/`;
  return {
    name: 'firestore',
    async get(path) {
      const res = await fetch(base + path.split('/').map(encodeURIComponent).join('/') + '?key=' + encodeURIComponent(apiKey));
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`Firestore ${res.status} for ${path}`);
      const doc = await res.json();
      return decodeFields(doc.fields || {});
    },
  };
}

// Firestore REST "Value" -> plain JSON (the seed script encodes with tools/lib/firestore-value.mjs).
export function decodeValue(v) {
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('nullValue' in v) return null;
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(decodeValue);
  if ('mapValue' in v) return decodeFields(v.mapValue.fields || {});
  if ('timestampValue' in v) return v.timestampValue;
  return null;
}

export function decodeFields(fields) {
  const out = {};
  for (const k of Object.keys(fields)) out[k] = decodeValue(fields[k]);
  return out;
}
