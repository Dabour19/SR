import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInAnonymously,
  signOut,
  User as FirebaseUser,
} from 'firebase/auth';
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  collection,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  runTransaction,
} from 'firebase/firestore';
import { connectivityService } from './connectivityService';
import firebaseConfig from '../../firebase-applet-config.json';
import { PlayerAccount, LeaderboardRecord } from '../types';

/* ==================== USERNAME REGISTRY (unique names) ====================
 * Collection 'usernames': doc id = lowercase name, value = { uid, reservedAt }.
 * Reserving happens inside a Firestore transaction so two players can never
 * claim the same name. Deleting the profile releases the name. */

export type ReserveNameResult =
  | { success: true }
  | { success: false; error: string };

export function normalizeUsername(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Reserve a unique username for the signed-in uid. Atomic via transaction. */
export async function reserveUsername(name: string, uid: string): Promise<ReserveNameResult> {
  const key = normalizeUsername(name);
  if (key.length < 2 || key.length > 30) {
    return { success: false, error: 'يجب أن يتكون الاسم من 2 إلى 30 حرفاً' };
  }
  try {
    await runTransaction(db, async (tx) => {
      const ref = doc(db, 'usernames', key);
      const snap = await tx.get(ref);
      if (snap.exists()) {
        const owner = snap.data()?.uid;
        if (owner === uid) return; // already mine — keep it
        throw new Error('NAME_TAKEN');
      }
      tx.set(ref, { uid, reservedAt: Date.now() });
    });
    return { success: true };
  } catch (e: any) {
    if (e?.message === 'NAME_TAKEN') {
      return { success: false, error: 'اسم البطل هذا محجوز للاعب آخر، الرجاء اختيار اسم مميز' };
    }
    console.warn('reserveUsername error', e);
    return { success: false, error: e?.code === 'permission-denied'
      ? 'تعذر حجز الاسم (تحقق من تسجيل الدخول بالإنترنت)'
      : 'تعذر حجز الاسم، حاول مجددًا' };
  }
}

/** Release a name I own (e.g. renaming). Silently ignores failures. */
export async function releaseUsername(name: string, uid: string): Promise<void> {
  const key = normalizeUsername(name);
  try {
    await runTransaction(db, async (tx) => {
      const ref = doc(db, 'usernames', key);
      const snap = await tx.get(ref);
      if (snap.exists() && snap.data()?.uid === uid) tx.delete(ref);
    });
  } catch (e) {
    console.warn('releaseUsername error', e);
  }
}

/** Look up which uid owns a username (or null if free/not found). */
export async function getUidForUsername(name: string): Promise<string | null> {
  try {
    const snap = await getDoc(doc(db, 'usernames', normalizeUsername(name)));
    return snap.exists() ? (snap.data()?.uid ?? null) : null;
  } catch (e) {
    console.warn('getUidForUsername error', e);
    return null;
  }
}

/** Is this username available (not reserved by someone else)? */
export async function isUsernameAvailable(name: string): Promise<boolean> {
  const owner = await getUidForUsername(name);
  return owner === null || owner === auth.currentUser?.uid;
}

// Initialize Firebase App
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
// Set prompt to select_account so users can easily pick which Google account to use
googleProvider.setCustomParameters({
  prompt: 'select_account',
});

// Initialize Firestore with offline persistence: reads are served from the
// local cache and writes are queued while offline, then synced automatically
// once connectivity returns.
let db: ReturnType<typeof getFirestore>;
// NOTE: the database ID is the THIRD argument of initializeFirestore/getFirestore —
// it is NOT a settings property. Putting it inside settings is silently ignored
// and the SDK falls back to the (default) database.
const customDbId =
  firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)'
    ? firebaseConfig.firestoreDatabaseId
    : undefined;
try {
  db = initializeFirestore(
    app,
    {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
      /* This project's Firestore database is an Enterprise-edition instance whose
         gRPC channel rejects client SDK traffic with 5 NOT_FOUND, while the REST
         (HTTP) channel works. Force the long-polling (HTTP) transport so all
         reads/writes/listens actually reach the backend. */
      experimentalForceLongPolling: true,
    },
    customDbId
  );
} catch {
  // Fallback (e.g. IndexedDB unavailable) — still fully functional online.
  db = getFirestore(app, customDbId);
}
export { db };

/**
 * Sign in with Google Popup
 */
export async function loginWithGoogle(): Promise<{
  success: boolean;
  user?: FirebaseUser;
  error?: string;
  errorCode?: string;
}> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return {
      success: true,
      user: result.user,
    };
  } catch (err: any) {
    console.error('Google Sign-In Error:', err);
    const code = err?.code || '';
    let errorMsg = 'تعذر تسجيل الدخول بحساب جوجل. يرجى المحاولة مرة أخرى.';
    if (code === 'auth/unauthorized-domain') {
      errorMsg = 'النطاق الحالي غير مدرج في النطاقات المصرح بها (Authorized Domains) في إعدادات Firebase Auth. يمكنك فتح اللعبة في نافذة منفصلة أو الدخول كبطل فورياً بدون الحاجة لربط الحساب.';
    } else if (code === 'auth/operation-not-allowed') {
      errorMsg = 'موفر تسجيل الدخول عبر Google غير مفعّل في لوحة تحكم Firebase Console (Authentication > Sign-in method). يمكنك المتابعة بالدخول السريع كبطل.';
    } else if (code === 'auth/popup-closed-by-user') {
      errorMsg = 'تم إغلاق نافذة تسجيل الدخول قبل اكتمال العملية.';
    } else if (code === 'auth/popup-blocked') {
      errorMsg = 'تم حظر النافذة المنبثقة من قِبل المتصفح. يرجى السماح بالنوافذ المنبثقة أو فتح اللعبة في نافذة مستقلة.';
    } else if (code === 'auth/cancelled-popup-request') {
      errorMsg = 'تم إلغاء الطلب السابق لتسجيل الدخول.';
    } else if (code === 'auth/network-request-failed') {
      errorMsg = 'حدث خطأ في الاتصال بالشبكة أثناء محاولة تسجيل الدخول.';
    } else if (err.message) {
      errorMsg = `تعذر إتمام الدخول عبر Google (${code || 'Auth Error'}): ${err.message}`;
    }
    return {
      success: false,
      error: errorMsg,
      errorCode: code,
    };
  }
}

/**
 * Try anonymous sign in for cloud session if Google provider is unavailable
 */
export async function loginAnonymously(): Promise<{
  success: boolean;
  user?: FirebaseUser;
  error?: string;
}> {
  try {
    const res = await signInAnonymously(auth);
    return { success: true, user: res.user };
  } catch (err: any) {
    console.warn('Anonymous sign-in not available:', err);
    return { success: false, error: err?.message };
  }
}

/**
 * Sign out user from Firebase
 */
export async function logoutFirebase(): Promise<void> {
  try {
    await signOut(auth);
  } catch (err) {
    console.error('Firebase sign out error:', err);
  }
}

/**
 * Save player account to Firestore
 */
/** Load a player profile by username via the registry (cross-device login). */
export async function loadPlayerByUsername(name: string): Promise<PlayerAccount | null> {
  const uid = await getUidForUsername(name);
  if (!uid) return null;
  return loadPlayerFromFirestore(uid);
}
export async function savePlayerToFirestore(account: PlayerAccount): Promise<boolean> {
  if (!account || !account.id) return false;
  if (connectivityService.isOffline()) {
    // Queued locally via the persistent Firestore cache instead.
    console.warn('Offline: profile save deferred until connectivity returns.');
    return false;
  }
  try {
    const userDocRef = doc(db, 'users', account.id);
    await setDoc(
      userDocRef,
      {
        id: account.id,
        username: account.username,
        usernameKey: normalizeUsername(account.username),
        pin: account.pin || null,
        email: account.email || null,
        photoURL: account.photoURL || null,
        authProvider: account.authProvider || 'custom',
        avatar: account.avatar,
        title: account.title,
        tier: account.tier,
        rankScore: account.rankScore,
        isGuest: account.isGuest,
        stats: account.stats,
        history: account.history ? account.history.slice(0, 20) : [],
        updatedAt: Date.now(),
      },
      { merge: true }
    );
    return true;
  } catch (err) {
    console.warn('Could not save user profile to Firestore:', err);
    return false;
  }
}

/**
 * Load player account from Firestore
 */
export async function loadPlayerFromFirestore(uid: string): Promise<PlayerAccount | null> {
  if (connectivityService.isOffline()) return null;
  try {
    const userDocRef = doc(db, 'users', uid);
    const snap = await getDoc(userDocRef);
    if (snap.exists()) {
      const data = snap.data();
      return {
        id: data.id || uid,
        username: data.username || 'بطل الصمود',
        email: data.email || undefined,
        photoURL: data.photoURL || undefined,
        authProvider: data.authProvider || 'google',
        pin: data.pin || undefined,
        avatar: data.avatar || 'blade',
        title: data.title || 'مقاتل مبتدئ',
        tier: data.tier || 'bronze',
        rankScore: data.rankScore || 0,
        isGuest: false,
        stats: data.stats || {
          bestSurvivalTime: 0,
          bestKills: 0,
          highestLevel: 1,
          totalDamage: 0,
          totalRuns: 0,
          totalKills: 0,
          victories: 0,
          lastPlayed: Date.now(),
        },
        history: data.history || [],
      };
    }
    return null;
  } catch (err) {
    console.warn('Could not fetch player from Firestore:', err);
    return null;
  }
}

/**
 * Sync player's best run to global Firestore Leaderboard
 */
export async function syncToGlobalLeaderboard(record: LeaderboardRecord): Promise<void> {
  if (!record || !record.id) return;
  if (connectivityService.isOffline()) return; // kept in local cache, synced later
  try {
    const recordDocRef = doc(db, 'leaderboard', record.id);
    await setDoc(
      recordDocRef,
      {
        ...record,
        updatedAt: Date.now(),
      },
      { merge: true }
    );
  } catch (err) {
    console.warn('Could not update Firestore leaderboard:', err);
  }
}

/**
 * Fetch top records from global Firestore Leaderboard
 */
export async function fetchGlobalLeaderboard(): Promise<LeaderboardRecord[]> {
  if (connectivityService.isOffline()) return [];
  try {
    const lbCollection = collection(db, 'leaderboard');
    const q = query(lbCollection, orderBy('score', 'desc'), limit(50));
    const querySnapshot = await getDocs(q);
    const records: LeaderboardRecord[] = [];
    querySnapshot.forEach((d) => {
      const data = d.data() as LeaderboardRecord;
      records.push({
        id: data.id || d.id,
        playerName: data.playerName || 'بطل مجهول',
        avatar: data.avatar || 'blade',
        tier: data.tier || 'bronze',
        timeSurvived: data.timeSurvived || 0,
        kills: data.kills || 0,
        level: data.level || 1,
        damage: data.damage || 0,
        victory: !!data.victory,
        score: data.score || 0,
        date: data.date || Date.now(),
      });
    });
    return records;
  } catch (err) {
    console.warn('Could not fetch Firestore leaderboard:', err);
    return [];
  }
}
