import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { initializeFirestore, collection, getDocs, doc, runTransaction, getDoc, setDoc, query, where, limit } from 'firebase/firestore';
import cfg from './firebase-applet-config.json' with { type: 'json' };
const app = initializeApp(cfg);
const auth = getAuth(app);
const cred = await signInAnonymously(auth);
const uid = cred.user.uid;
const db = initializeFirestore(app, { databaseId: cfg.firestoreDatabaseId, experimentalAutoDetectLongPolling: false, ignoreUndefinedProperties: true, experimentalForceLongPolling: true });
// plain setDoc
try { await setDoc(doc(db, 'usernames', 'zzz' + Date.now().toString(36)), { uid, reservedAt: Date.now() }); console.log('setDoc OK'); }
catch (e) { console.log('setDoc FAIL', e.code, e.message); }
// getDoc
try { const s = await getDoc(doc(db, 'usernames', 'testx')); console.log('getDoc OK exists=', s.exists()); }
catch (e) { console.log('getDoc FAIL', e.code, e.message); }
// where query
try { const s = await getDocs(query(collection(db, 'usernames'), where('uid', '==', uid), limit(1))); console.log('where-query OK size=', s.size); }
catch (e) { console.log('where-query FAIL', e.code, e.message); }
// transaction
try { await runTransaction(db, async (tx) => { const s = await tx.get(doc(db, 'usernames', 'testx')); tx.set(doc(db, 'usernames', 'testx'), { uid, reservedAt: Date.now() }); }); console.log('tx OK'); }
catch (e) { console.log('tx FAIL', e.code, e.message); }
process.exit(0);
