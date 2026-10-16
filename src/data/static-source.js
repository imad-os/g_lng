// The same documents as Firestore, read from content/build in this site. Used standalone, offline,
// before Firestore is seeded, or when app_config says contentSource: "static".
export function staticSource(version) {
  return {
    name: 'static',
    async get(path) {
      const res = await fetch(`content/build/${path}.json?v=${version}`);
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`Static content ${res.status} for ${path}`);
      return res.json();
    },
  };
}
