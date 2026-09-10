import { useEffect, useState, useSyncExternalStore } from 'react';
import {
  Coins,
  Users,
  Package,
  Check,
  Lock,
  Sparkles,
  User,
  UserPlus,
  Search,
  Trophy,
  Timer,
  Skull,
  Gem,
  Swords,
  Trash2,
  Volume2,
  VolumeX,
  HelpCircle,
} from 'lucide-react';
import {
  CHARACTERS,
  CRATES,
  SHOP_ITEMS,
  lobbyService,
  RARITY_CONFIG,
  getCharacter,
} from '../services/lobbyService';
import type { CrateId, LobbyState, FriendDoc } from '../types';
import { LobbyHub, type HubStationId } from './LobbyHub';
import { CrateOpeningModal } from './CrateOpeningModal';
import { HelpModal } from './HelpModal';
import { playerAuthService, determineTier } from '../services/playerAuthService';
import { friendsService } from '../services/friendsService';
import {
  getSkillTree,
  getNodeRank,
  xpForNextLevel,
  MAX_CHARACTER_LEVEL,
  SIGNATURE_WEAPON_UNLOCK_LEVEL,
  CHARACTER_EXCLUSIVE_WEAPON,
} from '../game/skillTree';
import { WEAPON_REGISTRY } from '../game/weapons';
import { getDungeonGate, updateDungeonSpawns } from '../game/cityScene';

/**
 * Random dungeon gates (ids like 'dg1'...'dg10') live in cityScene.ts —
 * their tier carries the difficulty multiplier and minimum level.
 */

type Tab = 'hub' | 'home' | 'characters' | 'skills' | 'shop' | 'crates' | 'friends';

interface LobbyProps {
  onStartGame: (difficulty?: number) => void;
  onOpenAuth: () => void;
  onOpenLeaderboard: () => void;
  isMuted: boolean;
  onToggleMute: () => void;
}

const AVATAR_ICONS: Record<string, string> = {
  blade: '⚔️', mage: '🧙', hunter: '🏹', paladin: '🛡️',
  wraith: '👻', berserker: '🪓',
};

function useLobbyState(): LobbyState {
  return useSyncExternalStore(
    (cb) => lobbyService.subscribe(cb),
    () => lobbyService.getState()
  );
}

function useFriends() {
  const [, force] = useState(0);
  useEffect(() => {
    friendsService.start();
    const unsub = friendsService.subscribe(() => force((n) => n + 1));
    return () => unsub();
  }, []);
  return {
    friends: friendsService.getFriends(),
    requests: friendsService.getRequests(),
    team: friendsService.getTeam(),
    invites: friendsService.getInvites(),
  };
}

function formatTime(secs: number) {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export function Lobby({ onStartGame, onOpenAuth, onOpenLeaderboard, isMuted, onToggleMute }: LobbyProps) {
  const state = useLobbyState();
  const { friends, requests, team, invites } = useFriends();
  const user = playerAuthService.getCurrentUser();
  const myId = user.id;
  const isHost = !!team && team.hostId === myId;

  /* Keep my team row in sync when I change character. */
  useEffect(() => {
    friendsService.setMyCharacter(state.selectedCharacter);
  }, [team?.code, state.selectedCharacter]);

  /* Team actions */
  const handleCreateTeam = async () => {
    const res = await friendsService.createTeam(state.selectedCharacter);
    showToast(res.success ? `تم إنشاء الفريق! الرمز: ${res.code} 🎉` : res.error || 'فشل إنشاء الفريق');
  };
  const handleJoinTeam = async () => {
    if (!joinCode.trim()) return;
    const res = await friendsService.joinTeam(joinCode, state.selectedCharacter);
    showToast(res.success ? 'تم الانضمام للفريق ✅' : res.error || 'فشل الانضمام');
    if (res.success) setJoinCode('');
  };
  const handleTeamStart = async (overrideDifficulty?: number) => {
    if (!team) return;
    if (overrideDifficulty === undefined && !team.members.every((m) => m.ready || m.isHost)) {
      showToast('في انتظار جهوزية جميع الأعضاء ⏳');
      return;
    }
    /* The host's dungeon difficulty is published with the match so every
       member launches the SAME dungeon (same difficulty) together. */
    const lvl = lobbyService.getProgress(state.selectedCharacter).level;
    const difficulty = overrideDifficulty ?? +(1 + (lvl - 1) * 0.28).toFixed(2);
    const res = await friendsService.startMatch(difficulty);
    showToast(res.success ? 'بدأت المعركة التعاونية! ⚔️' : res.error || 'فشل بدء المعركة');
    if (res.success) {
      onStartGame(difficulty);
    }
  };

  /* Co-op match start watcher: all members auto-launch when the host starts,
     using the host's shared dungeon difficulty so everyone enters the SAME
     dungeon (not one scaled to each member's own level).
     The 20s recency guard prevents a stale matchStartedAt from re-launching
     a member who opens the lobby long after a previous match started. */
  useEffect(() => {
    if (team?.matchStartedAt && Date.now() - team.matchStartedAt < 20000) {
      friendsService.clearMatchStart();
      const lvl = lobbyService.getProgress(state.selectedCharacter).level;
      const diff = typeof team.matchDifficulty === 'number' && team.matchDifficulty > 0
        ? team.matchDifficulty
        : +(1 + (lvl - 1) * 0.28).toFixed(2);
      onStartGame(diff);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [team?.matchStartedAt]);

  const handleInviteFriend = async (f: FriendDoc) => {
    const other = f.requesterId === user.id ? { id: f.targetId, name: f.targetName } : { id: f.requesterId, name: f.requesterName };
    const res = await friendsService.inviteToTeam(f);
    showToast(res.success ? `تمت دعوة ${other.name} للفريق ✅` : res.error || 'فشل إرسال الدعوة');
  };
  const [tab, setTab] = useState<Tab>('hub');
  const [toast, setToast] = useState<string | null>(null);
  const [openingCrate, setOpeningCrate] = useState<CrateId | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [searchName, setSearchName] = useState('');
  const [joinCode, setJoinCode] = useState('');

  const tier = determineTier(user.rankScore);
  const selectedChar = getCharacter(state.selectedCharacter);

  /* Seed/refresh dungeon portals for the selected character's level zones.
     In a team, generation is seeded by the team code so every member sees
     and enters the SAME dungeons. */
  useEffect(() => {
    updateDungeonSpawns(lobbyService.getProgress(state.selectedCharacter).level, Date.now(), team?.code ?? null);
  }, [state.selectedCharacter, team?.code]);


  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2200);
  };

  const handleBuyCharacter = (id: (typeof CHARACTERS)[number]['id']) => {
    if (state.ownedCharacters.includes(id)) {
      lobbyService.selectCharacter(id);
      // Keep profile avatar in sync with the selected character (lobby = in-game look)
      playerAuthService.updateProfile({ avatar: id });
      showToast('تم اختيار الشخصية ✅');
      return;
    }
    const res = lobbyService.buyCharacter(id);
    showToast(res.success ? 'تم شراء الشخصية! 🎉' : res.error || 'فشل الشراء');
  };

  const handleBuyItem = (id: (typeof SHOP_ITEMS)[number]['id']) => {
    const res = lobbyService.buyShopItem(id);
    showToast(res.success ? 'تم شراء الترقية! 🎉' : res.error || 'فشل الشراء');
  };

  const handleOpenCrate = (id: CrateId) => {
    const crate = CRATES.find((c) => c.id === id)!;
    if (state.coins < crate.price) {
      showToast('عملات غير كافية لهذا الصندوق');
      return;
    }
    setOpeningCrate(id);
  };

  const handleAddFriend = async () => {
    if (!searchName.trim()) return;
    const target = await friendsService.searchUser(searchName);
    if (!target) {
      showToast('لم يتم العثور على لاعب بهذا الاسم');
      return;
    }
    const res = await friendsService.sendFriendRequest(target);
    showToast(res.success ? 'تم إرسال طلب الصداقة ✅' : res.error || 'فشل إرسال الطلب');
    if (res.success) setSearchName('');
  };

  const handleHubStation = (id: HubStationId) => {
    if (id === 'start') {
      onStartGame();
      return;
    }
    /* Dungeon gates in the wilderness: start the battle with the gate's tier difficulty.
       Gates are gated behind the selected character's level. */
    const gate = getDungeonGate(id);
    if (gate) {
      const required = gate.tier.minLevel;
      const charLevel = lobbyService.getProgress(state.selectedCharacter).level;
      if (charLevel < required) {
        showToast(`هذا الدنجن يتطلب مستوى الشخصية ${required} (مستواك: ${charLevel}) 🔒`);
        return;
      }
      /* In a team, the chosen gate becomes the TEAM dungeon: the host publishes
         its difficulty to the team doc and all members auto-launch together. */
      if (team) {
        if (!isHost) {
          showToast('فقط قائد الفريق يختار الدنجن — انتظر بدء المعركة ⏳');
          return;
        }
        handleTeamStart(gate.tier.difficulty);
        return;
      }
      onStartGame(gate.tier.difficulty);
      return;
    }
    if (id === 'shop' || id === 'characters' || id === 'crates' || id === 'friends') {
      setTab(id as Tab);
      return;
    }
    /* leaderboard / profile / help are overlays inside the hub — no tab change. */
    if (id === 'help') setShowHelp(true);
  };

  const homeStats = [
    { icon: <Timer className="w-4 h-4" />, label: 'أطول صمود', value: formatTime(user.stats.bestSurvivalTime), color: 'text-amber-300', bg: 'bg-amber-500/15 border-amber-500/30' },
    { icon: <Skull className="w-4 h-4" />, label: 'إجمالي الوحوش', value: user.stats.totalKills.toLocaleString(), color: 'text-rose-300', bg: 'bg-rose-500/15 border-rose-500/30' },
    { icon: <Swords className="w-4 h-4" />, label: 'عدد الجولات', value: user.stats.totalRuns.toLocaleString(), color: 'text-cyan-300', bg: 'bg-cyan-500/15 border-cyan-500/30' },
    { icon: <Trophy className="w-4 h-4" />, label: 'انتصارات', value: user.stats.victories.toLocaleString(), color: 'text-yellow-300', bg: 'bg-yellow-500/15 border-yellow-500/30' },
  ];

  /* Fullscreen arena mode: hub is the entire screen, no menus. */
  if (tab === 'hub') {
    return (
      <div className="absolute inset-0 z-40">
        <LobbyHub
          state={state}
          onStation={handleHubStation}
          onOpenAuth={onOpenAuth}
          isMuted={isMuted}
          onToggleMute={onToggleMute}
        />

        {/* Crate opening modal */}
        {openingCrate && (
          <CrateOpeningModal
            crateId={openingCrate}
            onClose={() => setOpeningCrate(null)}
          />
        )}

        {/* Help modal */}
        {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}

        {/* Toast */}
        {toast && (
          <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl bg-[#0f172a] border border-cyan-400/50 text-cyan-200 text-xs font-bold shadow-lg animate-in fade-in">
            {toast}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/70 backdrop-blur-md p-3 sm:p-4">
      <div className="w-full max-w-3xl max-h-[95vh] flex flex-col bg-[#1e293b]/95 border-2 border-cyan-400/40 rounded-3xl shadow-[0_10px_30px_rgba(34,211,238,0.2)] overflow-hidden">
        {/* Header: profile + coins */}
        <div className="flex items-center justify-between gap-2 p-3 border-b border-[#334155] shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <button
              onClick={onOpenAuth}
              title="الملف الشخصي"
              className="flex items-center gap-2 p-1.5 pl-2.5 rounded-xl bg-[#0f172a] hover:bg-[#334155] border border-[#334155] hover:border-cyan-400/50 transition cursor-pointer min-w-0"
            >
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-cyan-500/30 to-blue-600/30 border border-cyan-400/40 flex items-center justify-center text-lg shrink-0">
                {AVATAR_ICONS[user.avatar] || user.avatar}
              </div>
              <div className="text-right min-w-0">
                <div className="text-xs font-black text-white truncate max-w-[120px]">{user.username}</div>
                <div className="text-[10px] font-bold" style={{ color: tier.color }}>
                  {tier.title}
                </div>
              </div>
            </button>

            <div className="flex items-center gap-1.5 px-2.5 py-2 rounded-xl bg-amber-500/15 border border-amber-400/50">
              <Coins className="w-4 h-4 text-amber-400" />
              <span className="font-mono font-black text-amber-300 text-sm">
                {state.coins.toLocaleString()}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setShowHelp(true)}
              title="كيف تلعب وتكسب؟"
              className="p-2 rounded-xl bg-[#0f172a] hover:bg-[#334155] text-cyan-300 border border-[#334155] transition cursor-pointer animate-pulse"
            >
              <HelpCircle className="w-4 h-4" />
            </button>
            <button
              onClick={onToggleMute}
              title={isMuted ? 'تشغيل الصوت' : 'كتم الصوت'}
              className="p-2 rounded-xl bg-[#0f172a] hover:bg-[#334155] text-slate-300 border border-[#334155] transition cursor-pointer"
            >
              {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-cyan-400" />}
            </button>
            <button
              onClick={onOpenLeaderboard}
              title="الصدارة"
              className="p-2 rounded-xl bg-[#0f172a] hover:bg-[#334155] text-slate-300 border border-[#334155] transition cursor-pointer"
            >
              <Trophy className="w-4 h-4 text-yellow-400" />
            </button>
          </div>
        </div>

        {/* Content (panel mode — hub is fullscreen separately) */}
        <div className="flex-1 overflow-y-auto p-4 bg-[#0f172a]/60">
          {tab === 'home' && (
            <div className="space-y-4">
              {/* Profile banner */}
              <div
                onClick={onOpenAuth}
                className="flex items-center gap-3 p-3.5 rounded-2xl bg-[#1e293b] border border-[#334155] hover:border-cyan-400/50 transition cursor-pointer"
              >
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500/30 to-blue-600/30 border border-cyan-400/40 flex items-center justify-center text-2xl shrink-0">
                  {AVATAR_ICONS[user.avatar] || user.avatar}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-black text-white">{user.username}</span>
                    {user.isGuest ? (
                      <span className="text-[10px] px-1.5 py-0.5 bg-slate-800 text-slate-400 rounded-md border border-slate-700">ضيف</span>
                    ) : (
                      <span className="text-[10px] px-1.5 py-0.5 bg-emerald-950 text-emerald-400 rounded-md border border-emerald-700 font-bold">عضو مسجل</span>
                    )}
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    {user.title} • <span style={{ color: tier.color }} className="font-bold">{tier.title}</span>
                  </div>
                  <div className="text-[11px] text-cyan-300 font-mono mt-0.5">
                    نقاط التصنيف: {user.rankScore.toLocaleString()}
                  </div>
                </div>
                <User className="w-5 h-5 text-cyan-400 shrink-0" />
              </div>

              {/* Currency + selected character progress */}
              <div className="grid grid-cols-2 gap-2.5">
                <div className="flex items-center gap-2 p-3 rounded-2xl bg-[#1e293b] border border-emerald-500/40">
                  <Gem className="w-5 h-5 text-emerald-400 shrink-0" />
                  <div>
                    <div className="text-[10px] text-slate-400">الجواهر (خبرة)</div>
                    <div className="font-mono font-black text-emerald-300 text-sm">{user.stats.highestLevel}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 p-3 rounded-2xl bg-[#1e293b] border border-fuchsia-500/40">
                  <Package className="w-5 h-5 text-fuchsia-400 shrink-0" />
                  <div>
                    <div className="text-[10px] text-slate-400">صناديق مفتوحة</div>
                    <div className="font-mono font-black text-fuchsia-300 text-sm">{state.cratesOpened}</div>
                  </div>
                </div>
              </div>

              {/* Selected character card */}
              <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-[#1e293b] border border-cyan-500/40">
                <div className="text-4xl w-14 h-14 flex items-center justify-center rounded-2xl bg-[#0f172a] border border-[#334155] shrink-0">
                  {selectedChar.emoji}
                </div>
                <div className="flex-1">
                  <div className="font-black text-white text-sm">الشخصية المختارة: {selectedChar.nameAr}</div>
                  <div className="text-[11px] text-slate-400">{selectedChar.titleAr}</div>
                </div>
                <button
                  onClick={() => setTab('characters')}
                  className="px-3 py-1.5 rounded-xl bg-[#0f172a] hover:bg-[#334155] text-cyan-300 border border-cyan-500/40 text-xs font-bold transition cursor-pointer shrink-0"
                >
                  تغيير
                </button>
              </div>

              {/* Player stats grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {homeStats.map((s) => (
                  <div key={s.label} className={`flex items-center gap-2 p-3 rounded-2xl bg-[#1e293b] border ${s.bg}`}>
                    <div className="shrink-0">{s.icon}</div>
                    <div>
                      <div className="text-[10px] text-slate-400">{s.label}</div>
                      <div className={`font-mono font-black text-sm ${s.color}`}>{s.value}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Quick actions */}
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  onClick={() => setTab('friends')}
                  className="flex items-center justify-center gap-2 py-3 rounded-2xl bg-[#1e293b] hover:bg-[#334155] text-cyan-300 border border-[#334155] text-xs font-bold transition cursor-pointer"
                >
                  <UserPlus className="w-4 h-4" />
                  الأصدقاء ({friends.length}){requests.length > 0 ? ` • ${requests.length} طلب جديد` : ''}
                </button>
                <button
                  onClick={() => setTab('crates')}
                  className="flex items-center justify-center gap-2 py-3 rounded-2xl bg-[#1e293b] hover:bg-[#334155] text-fuchsia-300 border border-[#334155] text-xs font-bold transition cursor-pointer"
                >
                  <Package className="w-4 h-4" />
                  فتح الصناديق
                </button>
              </div>
            </div>
          )}

          {tab === 'friends' && (
            <div className="space-y-4">
              {/* Add friend */}
              <div className="p-3.5 rounded-2xl bg-[#1e293b] border border-[#334155]">
                <div className="text-xs font-bold text-cyan-300 mb-2 flex items-center gap-1.5">
                  <Search className="w-4 h-4" /> إضافة صديق (ابحث باسم اللاعب)
                </div>
                <div className="flex gap-2">
                  <input
                    value={searchName}
                    onChange={(e) => setSearchName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddFriend()}
                    placeholder="اسم اللاعب..."
                    className="flex-1 px-3 py-2 rounded-xl bg-[#0f172a] border border-[#334155] text-sm text-white placeholder:text-slate-500 outline-none focus:border-cyan-400/60"
                  />
                  <button
                    onClick={handleAddFriend}
                    className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-900 text-xs font-black transition cursor-pointer"
                  >
                    إضافة
                  </button>
                </div>
              </div>

              {/* Incoming requests */}
              {requests.length > 0 && (
                <div className="p-3.5 rounded-2xl bg-[#1e293b] border border-amber-500/40">
                  <div className="text-xs font-bold text-amber-300 mb-2">طلبات الصداقة ({requests.length})</div>
                  <div className="space-y-2">
                    {requests.map((r) => (
                      <div key={r.id} className="flex items-center gap-2 p-2 rounded-xl bg-[#0f172a] border border-[#334155]">
                        <div className="text-xl w-9 h-9 flex items-center justify-center rounded-lg bg-[#1e293b] border border-[#334155]">
                          {AVATAR_ICONS[r.requesterAvatar] || '🎮'}
                        </div>
                        <span className="flex-1 text-sm font-bold text-white truncate">{r.requesterName}</span>
                        <button
                          onClick={() => { friendsService.respondToRequest(r, true); showToast('تم قبول الطلب ✅'); }}
                          className="px-2.5 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-bold hover:bg-emerald-500/30 transition cursor-pointer"
                        >
                          قبول
                        </button>
                        <button
                          onClick={() => { friendsService.respondToRequest(r, false); showToast('تم رفض الطلب'); }}
                          className="px-2.5 py-1.5 rounded-lg bg-rose-500/20 text-rose-300 border border-rose-500/40 text-xs font-bold hover:bg-rose-500/30 transition cursor-pointer"
                        >
                          رفض
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
                )}

              {/* Incoming team invites */}
              {invites.length > 0 && (
                <div className="p-3.5 rounded-2xl bg-[#1e293b] border border-emerald-500/40">
                  <div className="text-xs font-bold text-emerald-300 mb-2">دعوات الفريق ({invites.length})</div>
                  <div className="space-y-2">
                    {invites.map((inv: any) => (
                      <div key={inv.id} className="flex items-center gap-2 p-2 rounded-xl bg-[#0f172a] border border-[#334155]">
                        <span className="flex-1 text-sm font-bold text-white truncate">
                          {inv.hostName} يدعوك للفريق ({inv.code})
                        </span>
                        <button
                          onClick={async () => {
                            const res = await friendsService.joinTeam(inv.code, state.selectedCharacter);
                            showToast(res.success ? 'تم الانضمام للفريق ✅' : res.error || 'فشل الانضمام');
                            friendsService.dismissInvite(inv.id);
                          }}
                          className="px-2.5 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-bold hover:bg-emerald-500/30 transition cursor-pointer"
                        >
                          قبول
                        </button>
                        <button
                          onClick={() => friendsService.dismissInvite(inv.id)}
                          className="px-2.5 py-1.5 rounded-lg bg-rose-500/20 text-rose-300 border border-rose-500/40 text-xs font-bold hover:bg-rose-500/30 transition cursor-pointer"
                        >
                          رفض
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Friends list */}
              <div className="p-3.5 rounded-2xl bg-[#1e293b] border border-[#334155]">
                <div className="text-xs font-bold text-cyan-300 mb-2 flex items-center gap-1.5">
                  <Users className="w-4 h-4" /> قائمة الأصدقاء ({friends.length})
                </div>
                {friends.length === 0 ? (
                  <div className="text-center text-xs text-slate-500 py-4">لا توجد أصدقاء بعد — أضف أصدقاء من الأعلى!</div>
                ) : (
                  <div className="space-y-2">
                    {friends.map((f) => {
                      const other = f.requesterId === user.id
                        ? { name: f.targetName, avatar: f.targetAvatar }
                        : { name: f.requesterName, avatar: f.requesterAvatar };
                      return (
                        <div key={f.id} className="flex items-center gap-2 p-2 rounded-xl bg-[#0f172a] border border-[#334155]">
                          <div className="text-xl w-9 h-9 flex items-center justify-center rounded-lg bg-[#1e293b] border border-[#334155]">
                            {AVATAR_ICONS[other.avatar] || '🎮'}
                          </div>
                          <span className="flex-1 text-sm font-bold text-white truncate">{other.name}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-emerald-950 text-emerald-400 border border-emerald-700 font-bold">صديق</span>
                          {team && team.members.length < 4 && !team.members.some((m) => m.id === (f.requesterId === user.id ? f.targetId : f.requesterId)) && (
                            <button
                              onClick={() => handleInviteFriend(f)}
                              title="دعوة للفريق"
                              className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25 transition cursor-pointer"
                            >
                              <UserPlus className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            onClick={() => { friendsService.removeFriend(f); showToast('تمت إزالة الصديق'); }}
                            title="إزالة"
                            className="p-1.5 rounded-lg bg-rose-500/10 text-rose-300 border border-rose-500/30 hover:bg-rose-500/25 transition cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* ==================== TEAM / CO-OP ==================== */}
              <div className="p-3.5 rounded-2xl bg-[#1e293b] border-emerald-500/40">
                <div className="text-xs font-bold text-emerald-300 mb-2 flex items-center gap-1.5">
                  <Users className="w-4 h-4" /> الفريق (لعب تعاوني — حتى 4 لاعبين)
                </div>

                {!team ? (
                  <div className="space-y-3">
                    <button
                      onClick={handleCreateTeam}
                      className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-900 text-xs font-black transition cursor-pointer"
                    >
                      ➕ إنشاء فريق
                    </button>
                    <div className="flex gap-2">
                      <input
                        value={joinCode}
                        onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                        onKeyDown={(e) => e.key === 'Enter' && handleJoinTeam()}
                        placeholder="رمز الانضمام (6 أحرف)..."
                        maxLength={6}
                        className="flex-1 px-3 py-2 rounded-xl bg-[#0f172a] border-[#334155] text-sm text-white placeholder:text-slate-500 outline-none focus:border-emerald-400/60 font-mono tracking-widest text-center uppercase"
                      />
                      <button
                        onClick={handleJoinTeam}
                        className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-900 text-xs font-black transition cursor-pointer"
                      >
                        انضمام
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* Join code */}
                    <div className="flex items-center gap-2">
                      <div className="flex-1 px-3 py-2 rounded-xl bg-[#0f172a] border-emerald-500/40 text-center">
                        <div className="text-[10px] text-slate-400">رمز الفريق — شاركه مع أصدقائك</div>
                        <div className="font-mono font-black text-emerald-300 text-lg tracking-[0.3em]">{team.code}</div>
                      </div>
                      <button
                        onClick={() => { navigator.clipboard?.writeText(team.code); showToast('تم نسخ الرمز 📋'); }}
                        className="px-3 py-2 rounded-xl bg-[#0f172a] hover:bg-[#334155] text-emerald-300 border-[#334155] text-xs font-bold transition cursor-pointer"
                      >
                        نسخ
                      </button>
                      <button
                        onClick={() => { friendsService.leaveTeam(); showToast('غادرت الفريق'); }}
                        className="px-3 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/25 text-rose-300 border-rose-500/30 text-xs font-bold transition cursor-pointer"
                      >
                        خروج
                      </button>
                    </div>

                    {/* Members */}
                    <div className="space-y-1.5">
                      {team.members.map((m) => (
                        <div key={m.id} className="flex items-center gap-2 p-2 rounded-xl bg-[#0f172a] border-[#334155]">
                          <div className="text-xl w-8 h-8 flex items-center justify-center rounded-lg bg-[#1e293b] border-[#334155]">
                            {AVATAR_ICONS[m.avatar] || '🎮'}
                          </div>
                          <span className="flex-1 text-sm font-bold text-white truncate">
                            {m.name}{m.id === myId ? ' (أنت)' : ''}
                          </span>
                          {m.isHost && <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-amber-500/15 text-amber-300 border-amber-500/30 font-bold">قائد 👑</span>}
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-md border font-bold ${m.ready || m.isHost ? 'bg-emerald-950 text-emerald-400 border-emerald-700' : 'bg-slate-800 text-slate-400 border-slate-700'}`}>
                            {m.ready || m.isHost ? 'جاهز' : 'غير جاهز'}
                          </span>
                          <span className="text-lg" title={getCharacter(m.selectedCharacter).nameAr}>{getCharacter(m.selectedCharacter).emoji}</span>
                        </div>
                      ))}
                    </div>

                    {/* Ready / start buttons */}
                    <div className="flex gap-2">
                      {!isHost && (
                        <button
                          onClick={() => friendsService.setReady(!team.members.find((m) => m.id === myId)?.ready)}
                          className="flex-1 py-2.5 rounded-xl bg-[#0f172a] hover:bg-[#334155] text-emerald-300 border-emerald-500/40 text-xs font-black transition cursor-pointer"
                        >
                          {team.members.find((m) => m.id === myId)?.ready ? 'إلغاء الجاهزية' : 'أنا جاهز ✅'}
                        </button>
                      )}
                      {isHost && (
                        <button
                          onClick={() => handleTeamStart()}
                          disabled={team.members.length < 1}
                          className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-900 text-xs font-black transition cursor-pointer"
                        >
                          ⚔️ ابدأ المعركة التعاونية
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === 'characters' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {CHARACTERS.map((c) => {
                const owned = state.ownedCharacters.includes(c.id);
                const selected = state.selectedCharacter === c.id;
                const rar = RARITY_CONFIG[c.rarity];
                const canAfford = state.coins >= c.price;
                return (
                  <button
                    key={c.id}
                    onClick={() => handleBuyCharacter(c.id)}
                    disabled={selected}
                    className={`text-right p-4 rounded-2xl border-2 transition cursor-pointer relative overflow-hidden ${
                      selected
                        ? 'border-cyan-400 bg-cyan-500/10 shadow-[0_0_20px_rgba(34,211,238,0.25)]'
                        : owned
                        ? 'border-[#334155] bg-[#1e293b] hover:border-cyan-400/50'
                        : `border-[#334155] bg-[#1e293b] hover:border-amber-400/50 ${canAfford ? '' : 'opacity-60'}`
                    }`}
                  >
                    <div
                      className="absolute top-2 left-2 text-[10px] px-1.5 py-0.5 rounded-md font-bold"
                      style={{ color: rar.color, background: rar.bg, border: `1px solid ${rar.color}55` }}
                    >
                      {rar.labelAr}
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="text-4xl w-14 h-14 flex items-center justify-center rounded-2xl bg-[#0f172a] border border-[#334155] shrink-0">
                        {c.emoji}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-black text-white text-sm">{c.nameAr}</div>
                        <div className="text-[11px] text-slate-400 mb-1.5">{c.titleAr}</div>
                        <div className="text-[10px] text-slate-400 leading-relaxed">{c.descriptionAr}</div>
                        <div className="flex flex-wrap gap-1 mt-2 text-[10px] font-mono">
                          <span className="px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-300 border border-rose-500/30">❤️ {c.baseHp}</span>
                          <span className="px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">👟 x{c.speedMultiplier}</span>
                          <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">⚔️ x{c.damageMultiplier}</span>
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      {selected ? (
                        <span className="flex items-center gap-1 text-xs font-black text-cyan-300">
                          <Check className="w-4 h-4" /> مُختارة
                        </span>
                      ) : owned ? (
                        <span className="text-xs font-bold text-emerald-400">اضغط للاختيار</span>
                      ) : (
                        <span className={`flex items-center gap-1 text-xs font-bold ${canAfford ? 'text-amber-300' : 'text-slate-500'}`}>
                          <Lock className="w-3 h-3" />
                          <Coins className="w-3 h-3" /> {c.price.toLocaleString()}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {tab === 'skills' && (() => {
            const charId = state.selectedCharacter;
            const progress = lobbyService.getProgress(charId);
            const xpNeed = xpForNextLevel(progress.level);
            const tree = getSkillTree(charId);
            const sigWeapon = WEAPON_REGISTRY[CHARACTER_EXCLUSIVE_WEAPON[charId]];
            const sigUnlocked = progress.level >= SIGNATURE_WEAPON_UNLOCK_LEVEL;
            const handleUpgradeNode = (nodeId: string) => {
              const res = lobbyService.upgradeSkillNode(charId, nodeId);
              showToast(res.success ? 'تم ترقية المهارة! ✨' : res.error || 'فشل الترقية');
            };
            return (
              <div className="space-y-4">
                {/* Level & XP banner */}
                <div className="p-4 rounded-2xl bg-[#1e293b] border border-cyan-500/40">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="text-3xl w-11 h-11 flex items-center justify-center rounded-xl bg-[#0f172a] border border-[#334155]">
                        {selectedChar.emoji}
                      </div>
                      <div>
                        <div className="font-black text-white text-sm">شجرة مهارات: {selectedChar.nameAr}</div>
                        <div className="text-[11px] text-slate-400">المستوى {progress.level} / {MAX_CHARACTER_LEVEL}</div>
                      </div>
                    </div>
                    <span className={`px-2.5 py-1 rounded-lg text-xs font-black border ${progress.skillPoints > 0 ? 'bg-amber-500/20 border-amber-400/60 text-amber-300 animate-pulse' : 'bg-slate-800 border-slate-700 text-slate-400'}`}>
                      نقاط المهارة: {progress.skillPoints}
                    </span>
                  </div>
                  <div className="h-3 rounded-full bg-[#0f172a] border border-[#334155] overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400 transition-all"
                      style={{ width: `${Math.min(100, (progress.xp / xpNeed) * 100)}%` }}
                    />
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1 font-mono">
                    خبرة: {progress.xp} / {xpNeed}
                  </div>
                </div>

                {/* Signature weapon status */}
                <div className={`p-3.5 rounded-2xl border ${sigUnlocked ? 'bg-emerald-950/40 border-emerald-500/50' : 'bg-[#1e293b] border-[#334155]'}`}>
                  <div className="flex items-center gap-3">
                    <div className="text-3xl w-11 h-11 flex items-center justify-center rounded-xl bg-[#0f172a] border border-[#334155]">
                      ⚔️
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-black text-white text-sm">سلاح حصري: {sigWeapon.nameAr}</div>
                      <div className="text-[11px] text-slate-400">{sigWeapon.descriptionAr}</div>
                    </div>
                    {sigUnlocked ? (
                      <span className="text-xs font-black text-emerald-400 shrink-0">مفتوح ✅</span>
                    ) : (
                      <span className="text-xs font-bold text-amber-300 shrink-0">🔒 مستوى {SIGNATURE_WEAPON_UNLOCK_LEVEL}</span>
                    )}
                  </div>
                </div>

                {/* Skill nodes grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {tree.map((node) => {
                    const rank = getNodeRank(progress.unlockedNodes, node.id);
                    const maxed = rank >= node.maxRank;
                    const canUp = !maxed && progress.skillPoints > 0;
                    const missingReq = node.requires?.some((r) => getNodeRank(progress.unlockedNodes, r) < 1) ?? false;
                    return (
                      <button
                        key={node.id}
                        onClick={() => handleUpgradeNode(node.id)}
                        disabled={maxed || !canUp || missingReq}
                        className={`text-right p-3.5 rounded-2xl border-2 transition cursor-pointer ${
                          maxed
                            ? 'border-emerald-500/50 bg-emerald-500/5'
                            : canUp && !missingReq
                            ? 'border-[#334155] bg-[#1e293b] hover:border-amber-400/60'
                            : 'border-[#334155] bg-[#1e293b] opacity-60 cursor-not-allowed'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="text-2xl w-10 h-10 flex items-center justify-center rounded-xl bg-[#0f172a] border border-[#334155] shrink-0">
                            {node.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-black text-white text-sm">{node.nameAr}</span>
                              <span className="text-[10px] font-mono text-cyan-300">{rank}/{node.maxRank}</span>
                            </div>
                            <div className="text-[11px] text-slate-400 mt-0.5">{node.descriptionAr}</div>
                            {missingReq && !maxed && (
                              <div className="text-[10px] text-rose-300 mt-1">🔒 يتطلب فتح المهارة السابقة</div>
                            )}
                          </div>
                          {maxed ? (
                            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                          ) : (
                            <span className={`text-[10px] font-black shrink-0 px-1.5 py-1 rounded-md border ${progress.skillPoints > 0 && !missingReq ? 'text-amber-300 border-amber-400/50 bg-amber-500/10' : 'text-slate-500 border-slate-700'}`}>
                              +1 مستوى
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
                <div className="text-center text-[11px] text-slate-500">
                  اكسب الخبرة من الجولات (الوقت + الوحوش + المستوى) لترفع مستوى الشخصية وتحصل على نقاط مهارة
                </div>
              </div>
            );
          })()}

          {tab === 'shop' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {SHOP_ITEMS.map((item) => {
                const owned = state.ownedShopItems.includes(item.id);
                const rar = RARITY_CONFIG[item.rarity];
                const canAfford = state.coins >= item.price;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleBuyItem(item.id)}
                    disabled={owned}
                    className={`text-right p-4 rounded-2xl border-2 transition cursor-pointer ${
                      owned
                        ? 'border-emerald-500/50 bg-emerald-500/5'
                        : `border-[#334155] bg-[#1e293b] hover:border-amber-400/50 ${canAfford ? '' : 'opacity-60'}`
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="text-3xl w-12 h-12 flex items-center justify-center rounded-xl bg-[#0f172a] border border-[#334155] shrink-0">
                        {item.emoji}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-black text-white text-sm">{item.nameAr}</span>
                          <span
                            className="text-[10px] px-1.5 py-0.5 rounded-md font-bold"
                            style={{ color: rar.color, background: rar.bg }}
                          >
                            {rar.labelAr}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 mt-1 leading-relaxed">{item.descriptionAr}</div>
                      </div>
                    </div>
                    <div className="mt-3">
                      {owned ? (
                        <span className="flex items-center gap-1 text-xs font-black text-emerald-400">
                          <Check className="w-4 h-4" /> مملوكة (تُفعّل تلقائياً)
                        </span>
                      ) : (
                        <span className={`flex items-center gap-1 text-xs font-bold ${canAfford ? 'text-amber-300' : 'text-slate-500'}`}>
                          <Coins className="w-3 h-3" /> {item.price.toLocaleString()}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {tab === 'crates' && (
            <div>
              <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mb-3">
                <Sparkles className="w-3.5 h-3.5 text-fuchsia-400" />
                <span>افتح الصناديق واحظ فرصك: كل صندوق يمنح شخصية جديدة أو عملات حسب الحظ!</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {CRATES.map((crate) => {
                  const canAfford = state.coins >= crate.price;
                  return (
                    <button
                      key={crate.id}
                      onClick={() => handleOpenCrate(crate.id)}
                      className={`text-right p-4 rounded-2xl border-2 border-[#334155] bg-[#1e293b] transition cursor-pointer hover:border-amber-400/60 ${canAfford ? '' : 'opacity-60'}`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="text-4xl w-14 h-14 flex items-center justify-center rounded-2xl bg-[#0f172a] border border-[#334155] shrink-0 animate-bounce-slow"
                          style={{ boxShadow: `0 0 15px ${crate.color}44` }}
                        >
                          {crate.emoji}
                        </div>
                        <div className="flex-1">
                          <div className="font-black text-white text-sm">{crate.nameAr}</div>
                          <div className="flex flex-wrap gap-1 mt-1.5 text-[10px] font-mono">
                            <span className="px-1.5 py-0.5 rounded bg-slate-500/15 text-slate-300 border border-slate-400/30">{crate.dropWeights.common}% عادي</span>
                            <span className="px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">{crate.dropWeights.rare}% نادر</span>
                            <span className="px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-300 border border-purple-500/30">{crate.dropWeights.epic}% أسطوري</span>
                            <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">{crate.dropWeights.legendary}% خارق</span>
                          </div>
                        </div>
                      </div>
                      <div className="mt-3 flex items-center justify-between">
                        <span className={`flex items-center gap-1 text-sm font-black ${canAfford ? 'text-amber-300' : 'text-slate-500'}`}>
                          <Coins className="w-4 h-4" /> {crate.price.toLocaleString()}
                        </span>
                        <span className="text-xs font-bold text-cyan-300">افتح الصندوق →</span>
                      </div>
                    </button>
                  );
                })}
              </div>
              {state.cratesOpened > 0 && (
                <div className="mt-3 text-center text-[11px] text-slate-500">
                  فتحت {state.cratesOpened} صندوق حتى الآن
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer: back to arena hub */}
        <div className="p-3 border-t border-[#334155] shrink-0">
          <button
            onClick={() => setTab('hub')}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-[#0f172a] hover:bg-[#334155] text-cyan-300 border border-cyan-500/40 font-black text-sm transition cursor-pointer"
          >
            🗺️ الساحة
          </button>
        </div>
      </div>

      {/* Crate opening modal */}
      {openingCrate && (
        <CrateOpeningModal
          crateId={openingCrate}
          onClose={() => setOpeningCrate(null)}
        />
      )}

      {/* Help / how-to-play modal */}
      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}

      {/* Toast */}
      {toast && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl bg-[#0f172a] border border-cyan-400/50 text-cyan-200 text-xs font-bold shadow-lg animate-in fade-in">
          {toast}
        </div>
      )}
    </div>
  );
}
