import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import {
  Coins,
  Store,
  Users,
  Package,
  Check,
  Lock,
  Sparkles,
  Play,
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
import { DUNGEON_DIFFICULTY } from '../game/cityScene';
import { CrateOpeningModal } from './CrateOpeningModal';
import { HelpModal } from './HelpModal';
import { playerAuthService, determineTier } from '../services/playerAuthService';
import { friendsService } from '../services/friendsService';

type Tab = 'hub' | 'home' | 'characters' | 'shop' | 'crates' | 'friends';

interface LobbyProps {
  onBack: () => void;
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
  };
}

function formatTime(secs: number) {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export function Lobby({ onBack, onStartGame, onOpenAuth, onOpenLeaderboard, isMuted, onToggleMute }: LobbyProps) {
  const state = useLobbyState();
  const { friends, requests } = useFriends();
  const [tab, setTab] = useState<Tab>('hub');
  const [toast, setToast] = useState<string | null>(null);
  const [openingCrate, setOpeningCrate] = useState<CrateId | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [searchName, setSearchName] = useState('');
  const [joinCode, setJoinCode] = useState('');

  const user = playerAuthService.getCurrentUser();
  const tier = determineTier(user.rankScore);
  const selectedChar = getCharacter(state.selectedCharacter);

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2200);
  };

  const handleBuyCharacter = (id: (typeof CHARACTERS)[number]['id'], price: number) => {
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
    /* Dungeon gates in the wilderness: start the battle with a difficulty modifier. */
    if (id === 'dungeon1' || id === 'dungeon2' || id === 'dungeon3') {
      onStartGame(DUNGEON_DIFFICULTY[id] ?? 1);
      return;
    }
    if (id === 'shop' || id === 'characters' || id === 'crates' || id === 'friends') {
      setTab(id);
      return;
    }
    /* leaderboard / profile / help are overlays inside the hub — no tab change. */
    if (id === 'help') setShowHelp(true);
  };

  const tabs: { id: Tab; label: string; icon: ReactNode }[] = [
    { id: 'hub', label: 'الساحة', icon: <Sparkles className="w-4 h-4" /> },
    { id: 'home', label: 'الرئيسية', icon: <User className="w-4 h-4" /> },
    { id: 'characters', label: 'الشخصيات', icon: <Users className="w-4 h-4" /> },
    { id: 'shop', label: 'المتجر', icon: <Store className="w-4 h-4" /> },
    { id: 'crates', label: 'الصناديق', icon: <Package className="w-4 h-4" /> },
    { id: 'friends', label: 'الأصدقاء', icon: <UserPlus className="w-4 h-4" /> },
  ];

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
            <button
              onClick={onBack}
              className="px-3 py-2 rounded-xl bg-[#0f172a] hover:bg-[#334155] text-slate-300 border border-[#334155] text-xs font-bold transition cursor-pointer"
            >
              رجوع ←
            </button>
          </div>
        </div>

        {/* Tabs (hidden in hub — arena is fullscreen) */}
        <div className="flex gap-2 p-3 pb-0 shrink-0">
          {tabs.filter((t) => t.id !== 'hub').map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-t-xl text-xs sm:text-sm font-bold transition cursor-pointer border-b-2 ${
                tab === t.id
                  ? 'bg-[#0f172a] text-cyan-300 border-cyan-400'
                  : 'bg-transparent text-slate-400 border-transparent hover:text-slate-200'
              }`}
            >
              {t.icon}
              <span>{t.label}</span>
            </button>
          ))}
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
                    onClick={() => handleBuyCharacter(c.id, c.price)}
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

        {/* Footer: Start */}
        <div className="p-3 border-t border-[#334155] shrink-0 flex gap-2">
          <button
            onClick={() => setTab('hub')}
            className="px-4 py-3 rounded-2xl bg-[#0f172a] hover:bg-[#334155] text-cyan-300 border border-cyan-500/40 font-black text-sm transition cursor-pointer"
          >
            🗺️ الساحة
          </button>
          <button
            onClick={() => onStartGame()}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-cyan-500 hover:bg-cyan-400 text-slate-900 font-black text-base shadow-[0_0_20px_rgba(34,211,238,0.4)] transition cursor-pointer"
          >
            ▶ ابدأ المعركة بالشخصية المختارة
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
