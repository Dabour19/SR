/**
 * Friends & Team (multiplayer) service.
 * Uses Firebase Firestore with real-time snapshots.
 * Guests are auto-upgraded to anonymous Firebase auth so they can join teams.
 */
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  where,
  onSnapshot,
  runTransaction,
  arrayUnion,
} from 'firebase/firestore';
import { connectivityService } from './connectivityService';
import { auth, db, loginAnonymously } from './firebase';
import { connectivityService } from './connectivityService';
import type { FriendDoc, TeamDoc, TeamMember, CharacterId, PlayerAvatar } from '../types';
import { playerAuthService } from './playerAuthService';

const MAX_TEAM_MEMBERS = 4;

function meId(): string {
  return playerAuthService.getCurrentUser().id;
}

function makeMember(selectedCharacter: CharacterId, isHost: boolean): TeamMember {
  const user = playerAuthService.getCurrentUser();
  return {
    id: user.id,
    name: user.username,
    avatar: (user.avatar || 'blade') as PlayerAvatar,
    isHost,
    selectedCharacter,
    joinedAt: Date.now(),
    lastSeen: Date.now(),
    ready: isHost,
  };
}

class FriendsService {
  private friends: FriendDoc[] = [];
  private requestsIn: FriendDoc[] = [];
  private invites: Array<{ id: string; code: string; hostName: string; targetId: string; createdAt: number }> = [];
  private team: TeamDoc | null = null;
  private listeners = new Set<() => void>();
  private unsubFriends: (() => void) | null = null;
  private unsubRequests: (() => void) | null = null;
  private unsubTeam: (() => void) | null = null;
  private unsubInvites: (() => void) | null = null;
  private started: boolean = false;
  private fbReady = false;

  /** Ensure the player has a firebase session (anonymous is enough to write docs). */
  private async ensureAuth(): Promise<boolean> {
    if (this.fbReady) return true;
    try {
      if (!auth.currentUser) {
        const res = await loginAnonymously();
        if (!res.success) return false;
      }
      this.fbReady = true;
      return true;
    } catch {
      return false;
    }
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  private notify() {
    this.listeners.forEach((l) => l());
  }

  getFriends(): FriendDoc[] {
    return this.friends;
  }
  getRequests(): FriendDoc[] {
    return this.requestsIn;
  }
  getTeam(): TeamDoc | null {
    return this.team;
  }
  getInvites() {
    return this.invites;
  }

  /** Remove a team invite after accepting/dismissing it. */
  async dismissInvite(id: string): Promise<void> {
    this.invites = this.invites.filter((i) => i.id !== id);
    this.notify();
    try {
      await deleteDoc(doc(db, 'teamInvites', id));
    } catch (e) {
      console.warn('dismissInvite error', e);
    }
  }

  /** Begin listening (call once from Lobby). */
  async start(): Promise<void> {
    if (this.started) return;
    // Offline: cloud sync is unavailable; retry automatically once back online.
    if (connectivityService.isOffline()) {
      connectivityService.onceOnline(() => {
        this.start();
      });
      return;
    }
    const ok = await this.ensureAuth();
    if (!ok) return;
    this.started = true;

    const uid = meId();

    // Friends + incoming requests (single collection, client-side filter)
    try {
      const q1 = query(collection(db, 'friends'), where('status', '==', 'accepted'));
      const q2 = query(collection(db, 'friends'), where('targetId', '==', uid), where('status', '==', 'pending'));
      this.unsubFriends = onSnapshot(q1, (snap) => {
        this.friends = snap.docs
          .map((d) => d.data() as FriendDoc)
          .filter((f) => f.requesterId === uid || f.targetId === uid);
        this.notify();
      });
      this.unsubRequests = onSnapshot(q2, (snap) => {
        this.requestsIn = snap.docs.map((d) => d.data() as FriendDoc);
        this.notify();
      });
      // Team invites addressed to me
      const q3 = query(collection(db, 'teamInvites'), where('targetId', '==', uid));
      this.unsubInvites = onSnapshot(q3, (snap) => {
        this.invites = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
        this.notify();
      });
    } catch (e) {
      console.warn('friends snapshot error', e);
      this.started = false;
    }
  }

  stop(): void {
    this.stopHeartbeat();
    this.unsubFriends?.();
    this.unsubRequests?.();
    this.unsubTeam?.();
    this.unsubInvites?.();
    this.unsubFriends = null;
    this.unsubRequests = null;
    this.unsubTeam = null;
    this.unsubInvites = null;
    this.started = false;
  }

  /** Search players by exact username (registered users are synced to /users). */
  async searchUser(username: string): Promise<{ id: string; username: string; avatar: PlayerAvatar } | null> {
    try {
      const snap = await getDocs(
        query(collection(db, 'users'), where('username', '==', username.trim()))
      );
      if (snap.empty) return null;
      const d = snap.docs[0].data();
      return { id: d.id, username: d.username, avatar: (d.avatar || 'blade') as PlayerAvatar };
    } catch (e) {
      console.warn('searchUser error', e);
      return null;
    }
  }

  async sendFriendRequest(target: { id: string; username: string; avatar: PlayerAvatar }): Promise<{ success: boolean; error?: string }> {
    const ok = await this.ensureAuth();
    if (!ok) return { success: false, error: 'تعذر الاتصال بالخادم' };
    const me = playerAuthService.getCurrentUser();
    if (target.id === me.id) return { success: false, error: 'لا يمكنك إضافة نفسك' };
    if (this.friends.some((f) => f.requesterId === target.id || f.targetId === target.id)) {
      return { success: false, error: 'هذا اللاعب موجود بالفعل في قائمة أصدقائك' };
    }
    const id = `${me.id}_${target.id}`;
    try {
      await setDoc(doc(db, 'friends', id), {
        id,
        requesterId: me.id,
        requesterName: me.username,
        requesterAvatar: me.avatar,
        targetId: target.id,
        targetName: target.username,
        targetAvatar: target.avatar,
        status: 'pending',
        createdAt: Date.now(),
      });
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e?.message || 'فشل إرسال الطلب' };
    }
  }

  async respondToRequest(friendDoc: FriendDoc, accept: boolean): Promise<void> {
    try {
      if (accept) {
        await setDoc(doc(db, 'friends', friendDoc.id), { status: 'accepted' }, { merge: true });
      } else {
        await deleteDoc(doc(db, 'friends', friendDoc.id));
      }
    } catch (e) {
      console.warn('respondToRequest error', e);
    }
  }

  async removeFriend(f: FriendDoc): Promise<void> {
    try {
      await deleteDoc(doc(db, 'friends', f.id));
    } catch (e) {
      console.warn('removeFriend error', e);
    }
  }

  /* ==================== TEAM ==================== */

  static genCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let c = '';
    for (let i = 0; i < 6; i++) c += chars[Math.floor(Math.random() * chars.length)];
    return c;
  }

  async createTeam(selectedCharacter: CharacterId): Promise<{ success: boolean; code?: string; error?: string }> {
    const ok = await this.ensureAuth();
    if (!ok) return { success: false, error: 'تعذر الاتصال بالخادم' };
    const code = FriendsService.genCode();
    const team: TeamDoc = {
      code,
      hostId: meId(),
      members: [makeMember(selectedCharacter, true)],
      createdAt: Date.now(),
    };
    try {
      await setDoc(doc(db, 'teams', code), team);
      this.listenTeam(code);
      this.notify();
      return { success: true, code };
    } catch (e: any) {
      return { success: false, error: e?.message || 'فشل إنشاء الفريق' };
    }
  }

  async joinTeam(code: string, selectedCharacter: CharacterId): Promise<{ success: boolean; error?: string }> {
    if (connectivityService.isOffline()) return { success: false, error: 'الانضمام للفريق يتطلب اتصالاً بالإنترنت' };
    const ok = await this.ensureAuth();
    if (!ok) return { success: false, error: 'تعذر الاتصال بالخادم' };
    const clean = code.trim().toUpperCase();
    try {
      /* Atomic join: read-modify-write inside a transaction so two players
         joining at the same instant can never push each other out (lost
         update), and the 4-player cap is enforced on the freshest data. */
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(doc(db, 'teams', clean));
        if (!snap.exists()) throw new Error('NO_TEAM');
        const team = snap.data() as TeamDoc;
        const me = makeMember(selectedCharacter, false);
        if (team.members.some((m) => m.id === me.id)) return; // already in
        // Drop members whose heartbeat is stale (>45s) to free a slot.
        const now = Date.now();
        const live = team.members.filter((m) => now - (m.lastSeen || m.joinedAt) < 45000 || m.isHost);
        if (live.some((m) => m.id === me.id)) return;
        if (live.length >= MAX_TEAM_MEMBERS) throw new Error('FULL');
        const hostLeft = !live.some((m) => m.isHost);
        const members = [...live, me];
        const patch: Record<string, unknown> = { members };
        // If the previous host is gone, promote the first live member.
        if (hostLeft) {
          members[0].isHost = true;
          patch.hostId = members[0].id;
        }
        tx.set(doc(db, 'teams', clean), patch, { merge: true });
      });
      this.listenTeam(clean);
      this.notify();
      return { success: true };
    } catch (e: any) {
      const msg = e?.message === 'NO_TEAM' ? 'لا يوجد فريق بهذا الرمز'
        : e?.message === 'FULL' ? 'الفريق ممتلئ (الحد الأقصى 4 لاعبين)'
        : e?.message || 'فشل الانضمام للفريق';
      return { success: false, error: msg };
    }
  }

  private listenTeam(code: string) {
    this.unsubTeam?.();
    this.unsubTeam = onSnapshot(
      doc(db, 'teams', code),
      (snap) => {
        if (!snap.exists()) {
          this.team = null;
          this.notify();
          return;
        }
        const t = snap.data() as TeamDoc;
        const prev = this.team?.matchStartedAt;
        this.team = { ...t, matchStartedAt: t.matchStartedAt ?? prev };
        this.notify();
      },
      (err) => console.warn('team snapshot error', err)
    );
    this.startHeartbeat();
  }

  /* Update only MY member row atomically (arrayFilter-like via transaction).
     A plain read-modify-write of the whole members array from a stale snapshot
     could drop members who joined in the meantime. */
  private async patchMyMember(patch: Partial<TeamMember>): Promise<void> {
    const t = this.team;
    if (!t || connectivityService.isOffline()) return;
    const myId = meId();
    try {
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(doc(db, 'teams', t.code));
        if (!snap.exists()) return;
        const cur = snap.data() as TeamDoc;
        let found = false;
        const members = cur.members.map((m) => {
          if (m.id !== myId) return m;
          found = true;
          return { ...m, ...patch, lastSeen: Date.now(), name: playerAuthService.getCurrentUser().username };
        });
        if (!found) return; // I'm not on this team anymore
        tx.set(doc(db, 'teams', t.code), { members }, { merge: true });
      });
    } catch (e) {
      console.warn('patchMyMember error', e);
    }
  }

  async setMyCharacter(selectedCharacter: CharacterId): Promise<void> {
    await this.patchMyMember({ selectedCharacter });
  }

  async setReady(ready: boolean): Promise<void> {
    await this.patchMyMember({ ready });
  }

  /* Heartbeat: keeps my lastSeen fresh so stale members can be auto-cleaned,
     and prunes disconnected members so slots free up for joiners. */
  private heartbeatTimer: number | null = null;
  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = window.setInterval(() => {
      const t = this.team;
      if (!t || connectivityService.isOffline()) return;
      const myId = meId();
      const now = Date.now();
      // prune members silent for >45s (never prune the host row)
      const dead = t.members.filter((m) => m.id !== myId && !m.isHost && now - (m.lastSeen || m.joinedAt) > 45000);
      if (dead.length > 0) {
        runTransaction(db, async (tx) => {
          const snap = await tx.get(doc(db, 'teams', t.code));
          if (!snap.exists()) return;
          const cur = snap.data() as TeamDoc;
          const live = cur.members.filter((m) => m.isHost || now - (m.lastSeen || m.joinedAt) <= 45000 || m.id === myId);
          if (live.length === cur.members.length) return;
          tx.set(doc(db, 'teams', t.code), { members: live }, { merge: true });
        }).catch(() => {});
      }
      this.patchMyMember({}).catch(() => {});
    }, 15000);
  }
  private stopHeartbeat(): void {
    if (this.heartbeatTimer !== null) {
      window.clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  async inviteToTeam(f: FriendDoc): Promise<{ success: boolean; error?: string }> {
    if (!this.team) return { success: false, error: 'أنشئ فريقاً أولاً' };
    const t = this.team;
    if (t.members.length >= MAX_TEAM_MEMBERS) return { success: false, error: 'الفريق ممتلئ' };
    // Ping the friend via a doc they listen to: reuse teams? Simpler: write an invite doc.
    try {
      const user = playerAuthService.getCurrentUser();
      await setDoc(doc(db, 'teamInvites', `${t.code}_${f.requesterId === user.id ? f.targetId : f.requesterId}`), {
        code: t.code,
        hostName: user.username,
        targetId: f.requesterId === user.id ? f.targetId : f.requesterId,
        createdAt: Date.now(),
      });
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e?.message || 'فشل إرسال الدعوة' };
    }
  }

  async leaveTeam(): Promise<void> {
    const t = this.team;
    this.stopHeartbeat();
    this.unsubTeam?.();
    this.unsubTeam = null;
    this.team = null;
    this.notify();
    if (!t) return;
    if (connectivityService.isOffline()) return; // cannot update the cloud doc
    try {
      /* Atomic leave: no lost updates if someone joins/leaves concurrently. */
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(doc(db, 'teams', t.code));
        if (!snap.exists()) return;
        const cur = snap.data() as TeamDoc;
        const members = cur.members.filter((m) => m.id !== meId());
        if (members.length === 0) {
          tx.delete(doc(db, 'teams', t.code));
          return;
        }
        const patch: Record<string, unknown> = { members };
        // If the host left, promote the first remaining member.
        if (cur.hostId === meId()) {
          members[0].isHost = true;
          patch.hostId = members[0].id;
        }
        tx.set(doc(db, 'teams', t.code), patch, { merge: true });
      });
    } catch (e) {
      console.warn('leaveTeam error', e);
    }
  }

  async startMatch(difficulty?: number): Promise<{ success: boolean; error?: string }> {
    const t = this.team;
    if (!t) return { success: false, error: 'لا يوجد فريق' };
    if (t.hostId !== meId()) return { success: false, error: 'فقط قائد الفريق يمكنه بدء المباراة' };
    try {
      /* Publish the shared difficulty so every member launches the SAME dungeon. */
      await setDoc(doc(db, 'teams', t.code), { matchStartedAt: Date.now(), matchDifficulty: difficulty ?? null }, { merge: true });
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e?.message || 'فشل بدء المباراة' };
    }
  }

  clearMatchStart(): void {
    const t = this.team;
    if (!t) return;
    setDoc(doc(db, 'teams', t.code), { matchStartedAt: null, matchDifficulty: null }, { merge: true }).catch(() => { });
  }
}

export const friendsService = new FriendsService();
