// Owner settings from the App Store Manager's Config button (MyPC.app_config), with defaults.
// app_config is not secret: never put API keys here.
import { firebaseConfig } from './data/firebase-config.js?v=2.5.5';

export function readConfig(appConfig) {
  const c = appConfig && typeof appConfig === 'object' ? appConfig : {};
  return {
    // 'auto' tries Firestore and falls back to the copy in content/build; 'firestore' or 'static' force one.
    contentSource: ['auto', 'firestore', 'static'].includes(c.contentSource) ? c.contentSource : 'auto',
    firestoreProject: typeof c.firestoreProject === 'string' && c.firestoreProject ? c.firestoreProject : firebaseConfig.projectId,
    firestoreKey: firebaseConfig.apiKey,
    // Default "audio": the clips published next to the app (audio/<lang>/<hash>.mp3, see tools/gen-audio.py).
    audioBase: typeof c.audioBase === 'string' ? c.audioBase.replace(/\/+$/, '') : 'audio',
    speech: c.speech !== false,
    ai: c.ai === true,
  };
}
