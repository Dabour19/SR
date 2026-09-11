import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import cfg from './firebase-applet-config.json' with { type: 'json' };
const app = initializeApp(cfg);
const auth = getAuth(app);
const cred = await signInAnonymously(auth);
const tok = await cred.user.getIdToken();
const base = `https://firestore.googleapis.com/v1/projects/${cfg.projectId}/databases/${encodeURIComponent(cfg.firestoreDatabaseId)}`;
const paths = ['documents/usernames/testx', 'documents/usernames?pageSize=3', 'documents?pageSize=3'];
for (const p of paths) {
  const r = await fetch(`${base}/${p}`, { headers: { Authorization: `Bearer ${tok}` } });
  console.log(p, '->', r.status, (await r.text()).slice(0, 200).replace(/\n/g, ' '));
}
process.exit(0);
