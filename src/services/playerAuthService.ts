import {
  GameRunStats,
  LeaderboardFilter,
  LeaderboardRecord,
  PlayerAccount,
  PlayerAvatar,
  PlayerRunHistory,
  PlayerTier,
} from '../types';
import {
  auth,
  loginWithGoogle as firebaseLoginWithGoogle,
  logoutFirebase,
  savePlayerToFirestore,
  loadPlayerFromFirestore,
  syncToGlobalLeaderboard,
  fetchGlobalLeaderboard,
} from './firebase';
import { onAuthStateChanged } from 'firebase/auth';

const STORAGE_ACCOUNTS_KEY = 'survivor_rogue_accounts_v2';
const STORAGE_CURRENT_USER_KEY = 'survivor_rogue_current_uid_v2';
const STORAGE_LEADERBOARD_KEY = 'survivor_rogue_leaderboard_v2';

export interface TierInfo {
  tier: PlayerTier;
  title: string;
  titleAr: string;
  labelAr: string;
  color: string;
  bgBadge: string;
  borderBadge: string;
  minScore: number;
}

export const TIERS_CONFIG: Record<PlayerTier, TierInfo> = {
  bronze: {
    tier: 'bronze',
    title: 'Novice Survivor',
    titleAr: 'مقاتل مبتدئ',
    labelAr: 'برونزي (Bronze)',
    color: '#cd7f32',
    bgBadge: 'bg-amber-950/40',
    borderBadge: 'border-amber-700/60',
    minScore: 0,
  },
  silver: {
    tier: 'silver',
    title: 'Adept Hunter',
    titleAr: 'صياد متمرس',
    labelAr: 'فضي (Silver)',
    color: '#94a3b8',
    bgBadge: 'bg-slate-800/60',
    borderBadge: 'border-slate-500/60',
    minScore: 2500,
  },
  gold: {
    tier: 'gold',
    title: 'Elite Blade',
    titleAr: 'نصل النخبة',
    labelAr: 'ذهبي (Gold)',
    color: '#facc15',
    bgBadge: 'bg-yellow-950/40',
    borderBadge: 'border-yellow-500/60',
    minScore: 6000,
  },
  platinum: {
    tier: 'platinum',
    title: 'Storm Champion',
    titleAr: 'بطل العواصف',
    labelAr: 'بلاتيني (Platinum)',
    color: '#22d3ee',
    bgBadge: 'bg-cyan-950/40',
    borderBadge: 'border-cyan-400/60',
    minScore: 12000,
  },
  diamond: {
    tier: 'diamond',
    title: 'Mythic Vanguard',
    titleAr: 'طليعة الأساطير',
    labelAr: 'ماسي (Diamond)',
    color: '#818cf8',
    bgBadge: 'bg-indigo-950/40',
    borderBadge: 'border-indigo-400/60',
    minScore: 20000,
  },
  legend: {
    tier: 'legend',
    title: 'Survivor Legend',
    titleAr: 'أسطورة الصمود الخالدة',
    labelAr: 'أسطوري (Survivor Legend)',
    color: '#ec4899',
    bgBadge: 'bg-pink-950/50',
    borderBadge: 'border-pink-500/70',
    minScore: 35000,
  },
};

export const AVATAR_OPTIONS: { id: PlayerAvatar; nameAr: string; icon: string; descAr: string }[] = [
  { id: 'blade', nameAr: 'الفارس المقنع', icon: '🗡️', descAr: 'سيد الشفرات الدوارة والتفادي' },
  { id: 'mage', nameAr: 'الساحر النجمي', icon: '🔮', descAr: 'متقن الرشقات السحرية والنار' },
  { id: 'hunter', nameAr: 'صياد الوحوش', icon: '🏹', descAr: 'سرعة البرق والضربات الحاسمة' },
  { id: 'paladin', nameAr: 'فارس الهالة المقدسة', icon: '🛡️', descAr: 'دروع متينة وتجدد مستمر' },
  { id: 'wraith', nameAr: 'شبح الظلال', icon: '👁️', descAr: 'حضور غامض وهجوم صاعق' },
  { id: 'berserker', nameAr: 'المحارب الهائج', icon: '🪓', descAr: 'قوة تدميرية مضاعفة' },
];

export function calculateScore(timeSurvived: number, kills: number, level: number, victory: boolean): number {
  return Math.round(timeSurvived * 12 + kills * 25 + level * 75 + (victory ? 8000 : 0));
}

export function determineTier(score: number): TierInfo {
  if (score >= TIERS_CONFIG.legend.minScore) return TIERS_CONFIG.legend;
  if (score >= TIERS_CONFIG.diamond.minScore) return TIERS_CONFIG.diamond;
  if (score >= TIERS_CONFIG.platinum.minScore) return TIERS_CONFIG.platinum;
  if (score >= TIERS_CONFIG.gold.minScore) return TIERS_CONFIG.gold;
  if (score >= TIERS_CONFIG.silver.minScore) return TIERS_CONFIG.silver;
  return TIERS_CONFIG.bronze;
}

// Pre-seeded competitive benchmark survivor legends
const BENCHMARK_LEADERBOARD: LeaderboardRecord[] = [
  {
    id: 'legend-1',
    playerName: 'سيد الظلال (Kage)',
    avatar: 'wraith',
    tier: 'legend',
    timeSurvived: 1200, // 20:00 (Victory)
    kills: 1680,
    level: 42,
    damage: 185000,
    victory: true,
    score: 64250,
    date: Date.now() - 86400000 * 2,
  },
  {
    id: 'legend-2',
    playerName: 'صائدة الشفق (Elena)',
    avatar: 'mage',
    tier: 'legend',
    timeSurvived: 1200, // 20:00 (Victory)
    kills: 1490,
    level: 39,
    damage: 162000,
    victory: true,
    score: 58450,
    date: Date.now() - 86400000 * 3,
  },
  {
    id: 'legend-3',
    playerName: 'فارس الصواعق (Thorin)',
    avatar: 'blade',
    tier: 'diamond',
    timeSurvived: 1115, // 18:35
    kills: 1220,
    level: 35,
    damage: 138000,
    victory: false,
    score: 31200,
    date: Date.now() - 86400000 * 4,
  },
  {
    id: 'legend-4',
    playerName: 'قاهر الوحوش (Tariq)',
    avatar: 'berserker',
    tier: 'platinum',
    timeSurvived: 940, // 15:40
    kills: 980,
    level: 30,
    damage: 104000,
    victory: false,
    score: 19800,
    date: Date.now() - 86400000 * 5,
  },
  {
    id: 'legend-5',
    playerName: 'حارس النور (Aiden)',
    avatar: 'paladin',
    tier: 'gold',
    timeSurvived: 750, // 12:30
    kills: 690,
    level: 24,
    damage: 72000,
    victory: false,
    score: 9500,
    date: Date.now() - 86400000 * 6,
  },
  {
    id: 'legend-6',
    playerName: 'مستكشف الكهوف (Rayan)',
    avatar: 'hunter',
    tier: 'silver',
    timeSurvived: 510, // 08:30
    kills: 410,
    level: 18,
    damage: 39000,
    victory: false,
    score: 4200,
    date: Date.now() - 86400000 * 7,
  },
];

class PlayerAuthService {
  private accounts: Map<string, PlayerAccount> = new Map();
  private currentUser: PlayerAccount | null = null;
  private leaderboard: LeaderboardRecord[] = [];
  private listeners: Set<(user: PlayerAccount) => void> = new Set();

  constructor() {
    this.loadState();
    this.initFirebaseAuthListener();
    this.refreshRemoteLeaderboard();
  }

  public subscribe(listener: (user: PlayerAccount) => void): () => void {
    this.listeners.add(listener);
    // Call immediately with current user
    if (this.currentUser) {
      listener(this.currentUser);
    }
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners() {
    if (this.currentUser) {
      this.listeners.forEach((l) => l(this.currentUser!));
    }
  }

  private initFirebaseAuthListener() {
    try {
      onAuthStateChanged(auth, async (fbUser) => {
        if (fbUser) {
          // If already set as current user with same id, no need to overwrite
          if (this.currentUser && this.currentUser.id === fbUser.uid) {
            return;
          }

          // Check if profile exists in Firestore
          const remoteAccount = await loadPlayerFromFirestore(fbUser.uid);
          if (remoteAccount) {
            this.accounts.set(remoteAccount.id, remoteAccount);
            this.currentUser = remoteAccount;
          } else {
            // Check local accounts
            const existingLocal = this.accounts.get(fbUser.uid);
            if (existingLocal) {
              existingLocal.email = fbUser.email || existingLocal.email;
              existingLocal.photoURL = fbUser.photoURL || existingLocal.photoURL;
              existingLocal.authProvider = 'google';
              existingLocal.isGuest = false;
              this.currentUser = existingLocal;
            } else {
              // Create new Google Player Account
              const newGoogleAcc: PlayerAccount = {
                id: fbUser.uid,
                username: fbUser.displayName || fbUser.email?.split('@')[0] || 'بطل الصمود',
                email: fbUser.email || undefined,
                photoURL: fbUser.photoURL || undefined,
                authProvider: 'google',
                avatar: 'blade',
                title: 'مقاتل مبتدئ',
                tier: 'bronze',
                rankScore: 0,
                isGuest: false,
                stats: {
                  bestSurvivalTime: 0,
                  bestKills: 0,
                  highestLevel: 1,
                  totalDamage: 0,
                  totalRuns: 0,
                  totalKills: 0,
                  victories: 0,
                  lastPlayed: Date.now(),
                },
                history: [],
              };

              // Migrate current guest progress if any
              if (this.currentUser && this.currentUser.isGuest) {
                newGoogleAcc.stats = { ...this.currentUser.stats, lastPlayed: Date.now() };
                newGoogleAcc.rankScore = this.currentUser.rankScore;
                newGoogleAcc.tier = this.currentUser.tier;
                newGoogleAcc.title = this.currentUser.title;
                newGoogleAcc.history = [...this.currentUser.history];
                newGoogleAcc.avatar = this.currentUser.avatar;
              }

              this.accounts.set(fbUser.uid, newGoogleAcc);
              this.currentUser = newGoogleAcc;
              savePlayerToFirestore(newGoogleAcc);
            }
          }

          this.saveAccounts();
          this.saveCurrentUser();
          this.syncCurrentToLeaderboard();
          this.notifyListeners();
        }
      });
    } catch (e) {
      console.warn('Firebase Auth listener init warning:', e);
    }
  }

  public async refreshRemoteLeaderboard(): Promise<void> {
    try {
      const remote = await fetchGlobalLeaderboard();
      if (remote && remote.length > 0) {
        // Merge remote with local records by ID
        const map = new Map<string, LeaderboardRecord>();
        for (const r of this.leaderboard) {
          map.set(r.id, r);
        }
        for (const rem of remote) {
          const local = map.get(rem.id);
          if (!local || rem.score > local.score) {
            map.set(rem.id, rem);
          }
        }
        this.leaderboard = Array.from(map.values()).sort((a, b) => b.score - a.score);
        this.saveLeaderboard();
      }
    } catch (e) {
      console.warn('Could not sync remote leaderboard:', e);
    }
  }

  private loadState() {
    try {
      // 1. Load accounts
      const accountsJson = localStorage.getItem(STORAGE_ACCOUNTS_KEY);
      if (accountsJson) {
        const parsed: PlayerAccount[] = JSON.parse(accountsJson);
        for (const acc of parsed) {
          this.accounts.set(acc.id, acc);
        }
      }

      // 2. Load leaderboard
      const lbJson = localStorage.getItem(STORAGE_LEADERBOARD_KEY);
      if (lbJson) {
        this.leaderboard = JSON.parse(lbJson);
      } else {
        this.leaderboard = [...BENCHMARK_LEADERBOARD];
        this.saveLeaderboard();
      }

      // 3. Load active user
      const currentUid = localStorage.getItem(STORAGE_CURRENT_USER_KEY);
      if (currentUid && this.accounts.has(currentUid)) {
        this.currentUser = this.accounts.get(currentUid)!;
      } else {
        // Create an automatic initial survivor profile so the player is immediately logged in
        this.loginAsGuest('blade');
      }
    } catch (e) {
      console.error('Error loading player auth state:', e);
      this.loginAsGuest('blade');
    }
  }

  private saveAccounts() {
    try {
      const arr = Array.from(this.accounts.values());
      localStorage.setItem(STORAGE_ACCOUNTS_KEY, JSON.stringify(arr));
    } catch (e) {
      console.warn('Could not save accounts to localStorage', e);
    }
  }

  private saveCurrentUser() {
    try {
      if (this.currentUser) {
        localStorage.setItem(STORAGE_CURRENT_USER_KEY, this.currentUser.id);
      } else {
        localStorage.removeItem(STORAGE_CURRENT_USER_KEY);
      }
    } catch (e) {
      console.warn('Could not save current user to localStorage', e);
    }
  }

  private saveLeaderboard() {
    try {
      localStorage.setItem(STORAGE_LEADERBOARD_KEY, JSON.stringify(this.leaderboard));
    } catch (e) {
      console.warn('Could not save leaderboard to localStorage', e);
    }
  }

  public getCurrentUser(): PlayerAccount {
    if (!this.currentUser) {
      return this.loginAsGuest('blade');
    }
    return this.currentUser;
  }

  public register(
    username: string,
    pin: string,
    avatar: PlayerAvatar = 'blade'
  ): { success: boolean; error?: string; account?: PlayerAccount } {
    const trimmed = username.trim();
    if (!trimmed || trimmed.length < 2) {
      return { success: false, error: 'يجب أن يتكون اسم البطل من حرفين على الأقل' };
    }
    if (trimmed.length > 20) {
      return { success: false, error: 'اسم البطل طويل جداً (الحد الأقصى 20 حرفاً)' };
    }

    // Check unique username
    for (const acc of this.accounts.values()) {
      if (!acc.isGuest && acc.username.toLowerCase() === trimmed.toLowerCase()) {
        return { success: false, error: 'اسم البطل هذا مسجل مسبقاً، الرجاء اختيار اسم آخر أو تسجيل الدخول' };
      }
    }

    const id = 'user_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
    const newAcc: PlayerAccount = {
      id,
      username: trimmed,
      pin: pin ? pin.trim() : undefined,
      avatar,
      title: 'مقاتل مبتدئ',
      tier: 'bronze',
      rankScore: 0,
      isGuest: false,
      stats: {
        bestSurvivalTime: 0,
        bestKills: 0,
        highestLevel: 1,
        totalDamage: 0,
        totalRuns: 0,
        totalKills: 0,
        victories: 0,
        lastPlayed: Date.now(),
      },
      history: [],
    };

    // If current was a guest with stats, migrate their stats to new account!
    if (this.currentUser && this.currentUser.isGuest) {
      newAcc.stats = { ...this.currentUser.stats, lastPlayed: Date.now() };
      newAcc.rankScore = this.currentUser.rankScore;
      newAcc.tier = this.currentUser.tier;
      newAcc.title = this.currentUser.title;
      newAcc.history = [...this.currentUser.history];
    }

    this.accounts.set(id, newAcc);
    this.currentUser = newAcc;
    this.saveAccounts();
    this.saveCurrentUser();
    this.syncCurrentToLeaderboard();

    return { success: true, account: newAcc };
  }

  public login(username: string, pin?: string): { success: boolean; error?: string; account?: PlayerAccount } {
    const trimmed = username.trim().toLowerCase();
    let found: PlayerAccount | null = null;

    for (const acc of this.accounts.values()) {
      if (acc.username.toLowerCase() === trimmed) {
        found = acc;
        break;
      }
    }

    if (!found) {
      return { success: false, error: 'لم يتم العثور على بطل بهذا الاسم. هل تريد إنشاء حساب جديد؟' };
    }

    if (found.pin && pin && found.pin !== pin.trim()) {
      return { success: false, error: 'الرمز السري (PIN) غير صحيح لهذا البطل' };
    }

    this.currentUser = found;
    this.saveCurrentUser();
    return { success: true, account: found };
  }

  public loginAsGuest(avatar: PlayerAvatar = 'blade', customName?: string): PlayerAccount {
    const guestNum = Math.floor(100 + Math.random() * 900);
    const id = 'guest_' + Date.now();
    const guestAcc: PlayerAccount = {
      id,
      username: customName || `البطل_${guestNum}`,
      avatar,
      title: 'مقاتل مبتدئ',
      tier: 'bronze',
      rankScore: 0,
      isGuest: true,
      stats: {
        bestSurvivalTime: 0,
        bestKills: 0,
        highestLevel: 1,
        totalDamage: 0,
        totalRuns: 0,
        totalKills: 0,
        victories: 0,
        lastPlayed: Date.now(),
      },
      history: [],
    };

    this.accounts.set(id, guestAcc);
    this.currentUser = guestAcc;
    this.saveAccounts();
    this.saveCurrentUser();
    return guestAcc;
  }

  public async loginWithGoogleAccount(): Promise<{
    success: boolean;
    error?: string;
    errorCode?: string;
    account?: PlayerAccount;
  }> {
    try {
      const res = await firebaseLoginWithGoogle();
      if (!res.success || !res.user) {
        return {
          success: false,
          error: res.error || 'تعذر تسجيل الدخول بحساب جوجل',
          errorCode: res.errorCode,
        };
      }

      const fbUser = res.user;

      // Check remote Firestore first
      let account = await loadPlayerFromFirestore(fbUser.uid);

      if (account) {
        // Existing remote profile found
        if (fbUser.displayName && !account.username) {
          account.username = fbUser.displayName;
        }
        account.email = fbUser.email || account.email;
        account.photoURL = fbUser.photoURL || account.photoURL;
        account.authProvider = 'google';
        account.isGuest = false;
      } else if (this.accounts.has(fbUser.uid)) {
        // Existing local profile found
        account = this.accounts.get(fbUser.uid)!;
        account.email = fbUser.email || account.email;
        account.photoURL = fbUser.photoURL || account.photoURL;
        account.authProvider = 'google';
        account.isGuest = false;
      } else {
        // Create new Google Player Account
        account = {
          id: fbUser.uid,
          username: fbUser.displayName || fbUser.email?.split('@')[0] || 'بطل الصمود',
          email: fbUser.email || undefined,
          photoURL: fbUser.photoURL || undefined,
          authProvider: 'google',
          avatar: 'blade',
          title: 'مقاتل مبتدئ',
          tier: 'bronze',
          rankScore: 0,
          isGuest: false,
          stats: {
            bestSurvivalTime: 0,
            bestKills: 0,
            highestLevel: 1,
            totalDamage: 0,
            totalRuns: 0,
            totalKills: 0,
            victories: 0,
            lastPlayed: Date.now(),
          },
          history: [],
        };

        // Seamlessly migrate current guest progress if any so player doesn't lose current game record
        if (this.currentUser && this.currentUser.isGuest) {
          account.stats = { ...this.currentUser.stats, lastPlayed: Date.now() };
          account.rankScore = this.currentUser.rankScore;
          account.tier = this.currentUser.tier;
          account.title = this.currentUser.title;
          account.history = [...this.currentUser.history];
          account.avatar = this.currentUser.avatar;
        }
      }

      this.accounts.set(account.id, account);
      this.currentUser = account;
      this.saveAccounts();
      this.saveCurrentUser();
      this.syncCurrentToLeaderboard();
      savePlayerToFirestore(account);
      this.notifyListeners();

      return { success: true, account };
    } catch (err: any) {
      console.error('loginWithGoogleAccount uncaught error:', err);
      return {
        success: false,
        error: err?.message || 'حدث خطأ غير متوقع أثناء تسجيل الدخول بحساب Google',
        errorCode: err?.code,
      };
    }
  }

  public updateProfile(updates: { username?: string; avatar?: PlayerAvatar; pin?: string }): boolean {
    if (!this.currentUser) return false;

    if (updates.username) {
      const trimmed = updates.username.trim();
      if (trimmed.length >= 2 && trimmed.length <= 20) {
        this.currentUser.username = trimmed;
      }
    }
    if (updates.avatar) {
      this.currentUser.avatar = updates.avatar;
    }
    if (updates.pin !== undefined) {
      this.currentUser.pin = updates.pin.trim() || undefined;
    }

    this.accounts.set(this.currentUser.id, this.currentUser);
    this.saveAccounts();
    this.syncCurrentToLeaderboard();
    savePlayerToFirestore(this.currentUser);
    this.notifyListeners();
    return true;
  }

  public logout(): void {
    if (this.currentUser && this.currentUser.authProvider === 'google') {
      logoutFirebase();
    }
    // Switch to a new fresh guest account
    this.loginAsGuest('blade');
    this.notifyListeners();
  }

  public recordRun(stats: GameRunStats): {
    score: number;
    isNewBest: boolean;
    tier: TierInfo;
    rankPosition: number;
  } {
    const user = this.getCurrentUser();
    const runScore = calculateScore(stats.timeSurvived, stats.enemiesKilled, stats.level, stats.victory);

    const isNewBest = runScore > user.rankScore;
    if (isNewBest) {
      user.rankScore = runScore;
    }

    // Update lifetime stats
    user.stats.totalRuns += 1;
    user.stats.totalKills += stats.enemiesKilled;
    user.stats.totalDamage += stats.damageDealt;
    if (stats.timeSurvived > user.stats.bestSurvivalTime) {
      user.stats.bestSurvivalTime = stats.timeSurvived;
    }
    if (stats.enemiesKilled > user.stats.bestKills) {
      user.stats.bestKills = stats.enemiesKilled;
    }
    if (stats.level > user.stats.highestLevel) {
      user.stats.highestLevel = stats.level;
    }
    if (stats.victory) {
      user.stats.victories += 1;
    }
    user.stats.lastPlayed = Date.now();

    // Recalculate tier
    const tierInfo = determineTier(user.rankScore);
    user.tier = tierInfo.tier;
    user.title = tierInfo.titleAr;

    // Append to match history (keep last 20)
    const runRecord: PlayerRunHistory = {
      date: Date.now(),
      timeSurvived: stats.timeSurvived,
      kills: stats.enemiesKilled,
      level: stats.level,
      damage: stats.damageDealt,
      victory: stats.victory,
      score: runScore,
    };
    user.history.unshift(runRecord);
    if (user.history.length > 20) {
      user.history.pop();
    }

    this.accounts.set(user.id, user);
    this.saveAccounts();

    // Sync to cloud if user is registered or Google user
    if (!user.isGuest) {
      savePlayerToFirestore(user);
    }

    // Update Leaderboard
    const rankPos = this.syncCurrentToLeaderboard(runRecord);

    this.notifyListeners();

    return {
      score: runScore,
      isNewBest,
      tier: tierInfo,
      rankPosition: rankPos,
    };
  }

  private syncCurrentToLeaderboard(latestRun?: PlayerRunHistory): number {
    const user = this.getCurrentUser();
    if (user.rankScore <= 0 && (!user.history || user.history.length === 0)) {
      return -1;
    }

    // Find best run
    let bestRun = user.history[0];
    for (const h of user.history) {
      if (h.score > (bestRun?.score || 0)) {
        bestRun = h;
      }
    }

    const timeSurvived = bestRun ? bestRun.timeSurvived : user.stats.bestSurvivalTime;
    const kills = bestRun ? bestRun.kills : user.stats.bestKills;
    const level = bestRun ? bestRun.level : user.stats.highestLevel;
    const damage = bestRun ? bestRun.damage : user.stats.totalDamage;
    const victory = bestRun ? bestRun.victory : user.stats.victories > 0;
    const score = bestRun ? bestRun.score : user.rankScore;

    const existingIdx = this.leaderboard.findIndex((r) => r.id === user.id);
    const rec: LeaderboardRecord = {
      id: user.id,
      playerName: user.username,
      avatar: user.avatar,
      tier: user.tier,
      timeSurvived,
      kills,
      level,
      damage,
      victory,
      score,
      date: bestRun ? bestRun.date : Date.now(),
      isCurrentPlayer: true,
    };

    if (existingIdx >= 0) {
      // Update existing if new score is higher
      if (score >= this.leaderboard[existingIdx].score) {
        this.leaderboard[existingIdx] = rec;
      }
    } else {
      this.leaderboard.push(rec);
    }

    // Sort by score descending
    this.leaderboard.sort((a, b) => b.score - a.score);
    this.saveLeaderboard();

    // Return current position (1-indexed)
    const pos = this.leaderboard.findIndex((r) => r.id === user.id);
    return pos >= 0 ? pos + 1 : 1;
  }

  public getLeaderboard(filter: LeaderboardFilter = 'score'): LeaderboardRecord[] {
    const currentId = this.currentUser?.id;
    const copy = this.leaderboard.map((item) => ({
      ...item,
      isCurrentPlayer: item.id === currentId,
    }));

    switch (filter) {
      case 'time':
        return copy.sort((a, b) => b.timeSurvived - a.timeSurvived || b.kills - a.kills);
      case 'kills':
        return copy.sort((a, b) => b.kills - a.kills || b.timeSurvived - a.timeSurvived);
      case 'level':
        return copy.sort((a, b) => b.level - a.level || b.score - a.score);
      case 'score':
      default:
        return copy.sort((a, b) => b.score - a.score);
    }
  }

  public getAllAccounts(): PlayerAccount[] {
    return Array.from(this.accounts.values()).filter((a) => !a.isGuest);
  }

  public getTierInfo(tier: PlayerTier): TierInfo {
    return TIERS_CONFIG[tier] || TIERS_CONFIG.bronze;
  }
}

export const playerAuthService = new PlayerAuthService();
