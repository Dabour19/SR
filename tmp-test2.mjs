import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import cfg from './firebase-applet-config.json' with { type: 'json' };
const app = initializeApp(cfg);
const auth = getAuth(app);
const cred = await signInAnonymously(auth);
const tok = await cred.user.getIdToken();
const base = `https://firestore.googleapis.com/v1/projects/${cfg.projectId}/databases/${encodeURIComponent(cfg.firestoreDatabaseId)}`;
// READ
let r = await fetch(`${base}/documents/leaderboard?pageSize=1`, { headers: { Authorization: `Bearer ${tok}` } });
console.log('READ status:', r.status, (await r.text()).slice(0, 300));
// WRITE
r = await fetch(`${base}/documents/usernames?documentId=testx`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ fields: { uid: { stringValue: cred.user.uid }, reservedAt: { integerValue: String(Date.now()) } } })
});
console.log('WRITE status:', r.status, (await r.text()).slice(0, 500));
process.exit(0);
