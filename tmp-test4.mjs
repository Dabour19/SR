import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { getFirestore, initializeFirestore, doc, runTransaction, collection, query, where, getDocs, getDoc } from 'firebase/firestore';
import cfg from './firebase-applet-config.json' with { type: 'json' };
const app = initializeApp(cfg);
const auth = getAuth(app);
const cred = await signInAnonymously(auth);
const db = initializeFirestore(app, { databaseId: cfg.firestoreDatabaseId, experimentalForceLongPolling: true });
const uid = cred.user.uid;
const name = 'TESTHERO' + Math.floor(Math.random()*100);
// 1) reserve like reserveUsername does
try {
  await runTransaction(db, async (tx) => {
    const ref = doc(db, 'usernames', name.toLowerCase());
    const snap = await tx.get(ref);
    if (snap.exists()) throw new Error('NAME_TAKEN');
    tx.set(ref, { uid, reservedAt: Date.now() });
  });
  console.log('RESERVE OK');
} catch (e) { console.log('RESERVE FAIL', e.code || '', e.message); }
// 2) claim same name again from a different uid (should be NAME_TAKEN)
try {
  const cred2 = await signInAnonymously(auth);
  await runTransaction(db, async (tx) => {
    const ref = doc(db, 'usernames', name.toLowerCase());
    const snap = await tx.get(ref);
    if (snap.exists()) throw new Error('NAME_TAKEN');
    tx.set(ref, { uid: cred2.user.uid, reservedAt: Date.now() });
  });
  console.log('UNIQUENESS BROKEN!');
} catch (e) { console.log('UNIQUENESS OK ->', e.code || '', e.message); }
// 3) friends query (used by Lobby)
try {
  const q = query(collection(db, 'friends'), where('targetId', '==', uid), where('status', '==', 'pending'));
  const snap = await getDocs(q);
  console.log('FRIENDS QUERY OK, docs:', snap.size);
} catch (e) { console.log('FRIENDS QUERY FAIL', e.code || '', e.message.slice(0, 120)); }
// 4) leaderboard ordered query
try {
  const snap = await getDocs(query(collection(db, 'leaderboard')));
  console.log('LEADERBOARD UNORDERED OK, docs:', snap.size);
} catch (e) { console.log('LEADERBOARD FAIL', e.code || '', e.message.slice(0, 120)); }
process.exit(0);
