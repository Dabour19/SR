import React, { useState } from 'react';
import {
  X,
  User,
  Trophy,
  Timer,
  Skull,
  Sparkles,
  LogOut,
  UserPlus,
  LogIn,
  CheckCircle2,
  AlertCircle,
  Clock,
  Loader2,
  Globe,
  Cloud,
  Mail,
  ExternalLink,
  Zap,
} from 'lucide-react';
import {
  AVATAR_OPTIONS,
  TIERS_CONFIG,
  playerAuthService,
} from '../services/playerAuthService';
import { PlayerAccount, PlayerAvatar } from '../types';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUserChanged: (user: PlayerAccount) => void;
}

type TabType = 'profile' | 'login' | 'register';

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onUserChanged,
}) => {
  const [currentUser, setCurrentUser] = useState<PlayerAccount>(() =>
    playerAuthService.getCurrentUser()
  );
  const [activeTab, setActiveTab] = useState<TabType>(() =>
    currentUser.isGuest ? 'register' : 'profile'
  );

  // Form states
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPin, setLoginPin] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regPin, setRegPin] = useState('');
  const [regAvatar, setRegAvatar] = useState<PlayerAvatar>('blade');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  if (!isOpen) return null;

  const currentTier = TIERS_CONFIG[currentUser.tier] || TIERS_CONFIG.bronze;
  const avatarObj =
    AVATAR_OPTIONS.find((a) => a.id === currentUser.avatar) || AVATAR_OPTIONS[0];

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await playerAuthService.loginWithGoogleAccount();
      if (res.success && res.account) {
        setCurrentUser(res.account);
        onUserChanged(res.account);
        setSuccessMsg(
          `أهلاً بك يا ${res.account.username}! تم تسجيل الدخول بنجاح عبر حساب Google ومزامنة إحصائياتك سحابياً.`
        );
        setTimeout(() => {
          setActiveTab('profile');
          setSuccessMsg(null);
        }, 900);
      } else {
        setErrorMsg(res.error || 'تعذر تسجيل الدخول بحساب Google');
      }
    } catch (err: any) {
      setErrorMsg(
        'حدث خطأ أثناء محاولة الاتصال بخدمة Google. غالباً ما يكون ذلك بسبب فتح اللعبة داخل نافذة المعاينة (iFrame) أو قيود النطاقات التجريبية.'
      );
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleInstantHero = () => {
    setErrorMsg(null);
    const chosenName = regUsername.trim() || loginUsername.trim() || 'بطل الصمود';
    const res = playerAuthService.register(chosenName, '', regAvatar);
    if (res.success && res.account) {
      setCurrentUser(res.account);
      onUserChanged(res.account);
      setSuccessMsg(`أهلاً بك يا ${res.account.username}! تم إنشاء ملفك بنجاح وبدء حفظ أرقامك القياسية.`);
      setTimeout(() => {
        setActiveTab('profile');
        setSuccessMsg(null);
      }, 700);
    } else {
      const guest = playerAuthService.loginAsGuest(regAvatar, chosenName);
      setCurrentUser(guest);
      onUserChanged(guest);
      setSuccessMsg(`أهلاً بك يا ${guest.username}! تم تسجيل الدخول الفوري.`);
      setTimeout(() => {
        setActiveTab('profile');
        setSuccessMsg(null);
      }, 700);
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const res = playerAuthService.login(loginUsername, loginPin);
    if (res.success && res.account) {
      setCurrentUser(res.account);
      onUserChanged(res.account);
      setSuccessMsg(`مرحباً بعودتك أيها البطل ${res.account.username}!`);
      setTimeout(() => {
        setActiveTab('profile');
        setSuccessMsg(null);
      }, 700);
    } else {
      setErrorMsg(res.error || 'فشل تسجيل الدخول');
    }
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const res = playerAuthService.register(regUsername, regPin, regAvatar);
    if (res.success && res.account) {
      setCurrentUser(res.account);
      onUserChanged(res.account);
      setSuccessMsg(`تم إنشاء حساب البطل بنجاح! تم ربط إحصائياتك السابقة.`);
      setTimeout(() => {
        setActiveTab('profile');
        setSuccessMsg(null);
      }, 800);
    } else {
      setErrorMsg(res.error || 'فشل إنشاء الحساب');
    }
  };

  const handleLogout = () => {
    playerAuthService.logout();
    const guest = playerAuthService.getCurrentUser();
    setCurrentUser(guest);
    onUserChanged(guest);
    setActiveTab('login');
    setSuccessMsg('تم تسجيل الخروج بنجاح. أنت الآن في وضع البطل الضيف.');
    setTimeout(() => setSuccessMsg(null), 2500);
  };

  return (
    <div
      id="auth-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in duration-150 overflow-y-auto"
    >
      <div className="w-full max-w-lg bg-[#1e293b] border-2 border-cyan-400/40 rounded-3xl p-6 sm:p-7 shadow-[0_10px_30px_rgba(34,211,238,0.2)] text-right my-8 max-h-[90vh] overflow-y-auto relative">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#334155] pb-4 mb-5">
          <button
            id="btn-close-auth-modal"
            onClick={onClose}
            className="p-1.5 rounded-xl bg-[#0f172a] hover:bg-[#334155] text-slate-400 hover:text-white border border-[#334155] transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3">
            <div>
              <h2 className="text-xl sm:text-2xl font-black italic tracking-tight text-white">
                👤 حساب البطل وتسجيل الدخول
              </h2>
              <p className="text-xs font-mono font-semibold uppercase tracking-wider text-cyan-400">
                SURVIVOR PROFILE & RANK
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center text-cyan-300 shadow-[0_0_12px_rgba(34,211,238,0.25)] text-lg">
              {avatarObj.icon}
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1.5 bg-[#0f172a] p-1.5 rounded-2xl border border-[#334155] mb-5">
          <button
            id="tab-btn-profile"
            onClick={() => {
              setActiveTab('profile');
              setErrorMsg(null);
            }}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'profile'
                ? 'bg-cyan-500 text-slate-950 shadow-md'
                : 'text-slate-300 hover:bg-[#1e293b]'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>ملفي وإحصائياتي</span>
          </button>

          <button
            id="tab-btn-register"
            onClick={() => {
              setActiveTab('register');
              setErrorMsg(null);
            }}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'register'
                ? 'bg-cyan-500 text-slate-950 shadow-md'
                : 'text-slate-300 hover:bg-[#1e293b]'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>إنشاء حساب بطل</span>
          </button>

          <button
            id="tab-btn-login"
            onClick={() => {
              setActiveTab('login');
              setErrorMsg(null);
            }}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'login'
                ? 'bg-cyan-500 text-slate-950 shadow-md'
                : 'text-slate-300 hover:bg-[#1e293b]'
            }`}
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>تسجيل الدخول</span>
          </button>
        </div>

        {/* Status Alerts */}
        {errorMsg && (
          <div className="p-3.5 bg-rose-950/70 border border-rose-500/50 rounded-2xl text-rose-200 text-xs font-medium mb-4 animate-in fade-in space-y-2.5">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="font-bold text-rose-300 text-xs sm:text-[13px] mb-1">
                  تنبيه تسجيل الدخول:
                </div>
                <div className="text-slate-200 leading-relaxed text-xs">
                  {errorMsg}
                </div>
              </div>
            </div>

            {/* Quick Resolution Actions */}
            <div className="pt-2 border-t border-rose-500/30 flex flex-wrap gap-2 items-center">
              <button
                type="button"
                onClick={() => window.open(window.location.href, '_blank')}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-[11px] flex items-center gap-1.5 transition cursor-pointer shadow-sm"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>فتح اللعبة في نافذة جديدة</span>
              </button>
              <button
                type="button"
                onClick={handleInstantHero}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-[11px] flex items-center gap-1.5 transition cursor-pointer shadow-sm"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>دخول فوري كبطل (بدون Google)</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setErrorMsg(null);
                  setActiveTab('register');
                }}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-bold text-[11px] flex items-center gap-1.5 transition cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>تسجيل محلي باسم ورمز</span>
              </button>
            </div>
          </div>
        )}
        {successMsg && (
          <div className="flex items-center gap-2 p-3 bg-emerald-950/50 border border-emerald-500/50 rounded-xl text-emerald-300 text-xs font-medium mb-4 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* TAB 1: PROFILE VIEW */}
        {activeTab === 'profile' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            {/* Player Card Banner */}
            <div className="bg-[#0f172a] border border-[#334155] rounded-2xl p-4 sm:p-5 relative overflow-hidden shadow-inner">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-2xl bg-[#1e293b] border-2 border-cyan-400/50 flex items-center justify-center text-3xl shadow-[0_0_15px_rgba(34,211,238,0.25)] overflow-hidden">
                    {currentUser.photoURL ? (
                      <img
                        src={currentUser.photoURL}
                        alt={currentUser.username}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      avatarObj.icon
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg sm:text-xl font-black text-white">
                        {currentUser.username}
                      </h3>
                      {currentUser.authProvider === 'google' ? (
                        <span className="text-[10px] bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full border border-blue-500/40 font-bold flex items-center gap-1">
                          <span className="font-sans font-bold">G</span> حساب Google
                        </span>
                      ) : currentUser.isGuest ? (
                        <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full border border-slate-700">
                          حساب ضيف مؤقت
                        </span>
                      ) : (
                        <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/40 font-bold">
                          بطل موثق
                        </span>
                      )}
                    </div>
                    {currentUser.email && (
                      <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                        <Mail className="w-3 h-3 text-slate-400" />
                        <span>{currentUser.email}</span>
                      </div>
                    )}
                    <div className="text-xs text-cyan-400 font-semibold mt-0.5">
                      {avatarObj.nameAr} • {currentTier.titleAr}
                    </div>
                  </div>
                </div>

                {/* Tier Badge */}
                <div
                  className={`px-3 py-1.5 rounded-xl border text-center font-bold text-xs shadow-md ${currentTier.bgBadge} ${currentTier.borderBadge}`}
                  style={{ color: currentTier.color }}
                >
                  <div className="text-[10px] uppercase opacity-80">الرتبة التنافسية</div>
                  <div>{currentTier.labelAr}</div>
                </div>
              </div>

              {/* Cloud Sync Status info */}
              {currentUser.authProvider === 'google' && (
                <div className="mt-3.5 pt-2.5 border-t border-[#1e293b] flex items-center justify-between text-[11px] text-emerald-400">
                  <span className="flex items-center gap-1.5">
                    <Cloud className="w-3.5 h-3.5 text-emerald-400" />
                    <span>مزامنة سحابية نشطة مع قاعدة بيانات Firebase</span>
                  </span>
                  <span className="text-slate-400 text-[10px]">محدث سحابياً</span>
                </div>
              )}

              {/* Rank Points Progress */}
              <div className="mt-4 pt-3 border-t border-[#334155]">
                <div className="flex justify-between items-center text-xs mb-1.5">
                  <span className="text-slate-400 font-medium">نقاط الصمود التنافسية:</span>
                  <span className="font-mono font-bold text-yellow-400">
                    {currentUser.rankScore.toLocaleString()} نقطة
                  </span>
                </div>
                <div className="w-full h-2 bg-[#1e293b] rounded-full overflow-hidden border border-[#334155]">
                  <div
                    className="h-full bg-gradient-to-r from-cyan-500 to-yellow-400 transition-all duration-300"
                    style={{
                      width: `${Math.min(100, Math.max(8, (currentUser.rankScore / 35000) * 100))}%`,
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Lifetime Stats Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="bg-[#0f172a] p-3 rounded-xl border border-[#334155] text-center">
                <Timer className="w-4 h-4 text-amber-400 mx-auto mb-1" />
                <div className="text-[10px] text-slate-400">أطول صمود</div>
                <div className="text-sm font-mono font-black text-amber-300">
                  {formatTime(currentUser.stats.bestSurvivalTime)}
                </div>
              </div>

              <div className="bg-[#0f172a] p-3 rounded-xl border border-[#334155] text-center">
                <Skull className="w-4 h-4 text-rose-400 mx-auto mb-1" />
                <div className="text-[10px] text-slate-400">أعلى وحوش بالجولة</div>
                <div className="text-sm font-mono font-black text-rose-300">
                  {currentUser.stats.bestKills}
                </div>
              </div>

              <div className="bg-[#0f172a] p-3 rounded-xl border border-[#334155] text-center">
                <Sparkles className="w-4 h-4 text-cyan-400 mx-auto mb-1" />
                <div className="text-[10px] text-slate-400">أعلى مستوى</div>
                <div className="text-sm font-mono font-black text-cyan-300">
                  LVL {currentUser.stats.highestLevel}
                </div>
              </div>

              <div className="bg-[#0f172a] p-3 rounded-xl border border-[#334155] text-center">
                <Trophy className="w-4 h-4 text-yellow-400 mx-auto mb-1" />
                <div className="text-[10px] text-slate-400">مرات النصر (20 د)</div>
                <div className="text-sm font-mono font-black text-yellow-300">
                  {currentUser.stats.victories}
                </div>
              </div>
            </div>

            {/* Match History Preview */}
            <div className="bg-[#0f172a] rounded-2xl p-4 border border-[#334155] shadow-inner">
              <h4 className="text-xs font-bold text-slate-200 mb-2 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-cyan-400" />
                <span>سجل آخر الجولات والمباريات:</span>
              </h4>

              {currentUser.history.length === 0 ? (
                <div className="text-center py-4 text-xs text-slate-500">
                  لم تلعب أي جولة بعد. انطلق إلى المعركة لتسجيل أرقامك في التصنيف!
                </div>
              ) : (
                <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                  {currentUser.history.slice(0, 5).map((h, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between p-2 rounded-lg bg-[#1e293b] border border-[#334155] text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-cyan-300 font-bold">
                          ⏱️ {formatTime(h.timeSurvived)}
                        </span>
                        <span className="text-slate-400">|</span>
                        <span className="text-rose-300">💀 {h.kills} وحش</span>
                        <span className="text-slate-400">|</span>
                        <span className="text-yellow-300">⭐ مست {h.level}</span>
                      </div>
                      <div className="font-mono font-bold text-slate-200">
                        {h.score.toLocaleString()} نقطة
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Actions: Logout / Switch */}
            <div className="flex items-center justify-between pt-2">
              {!currentUser.isGuest && (
                <button
                  id="btn-logout"
                  onClick={handleLogout}
                  className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-rose-400 transition cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>تسجيل الخروج من الحساب</span>
                </button>
              )}
              {currentUser.isGuest && (
                <button
                  onClick={() => setActiveTab('register')}
                  className="text-xs text-cyan-400 hover:text-cyan-300 font-bold underline transition cursor-pointer"
                >
                  💡 هل تريد حفظ أرقامك بحساب دائم؟ اضغط هنا لإنشاء حساب
                </button>
              )}

              <button
                onClick={onClose}
                className="px-5 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs rounded-xl shadow-md transition cursor-pointer"
              >
                حفظ وإغلاق
              </button>
            </div>
          </div>
        )}

        {/* TAB 2: REGISTER VIEW */}
        {activeTab === 'register' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            {/* Google Fast Register Option */}
            <div className="bg-gradient-to-r from-blue-950/40 via-cyan-950/40 to-blue-950/40 border border-cyan-400/40 rounded-2xl p-4 text-right space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                  <span>تسجيل الدخول السريع بحساب Google (موصى به)</span>
                </span>
                <span className="text-[10px] bg-cyan-400/20 text-cyan-300 px-2 py-0.5 rounded-full border border-cyan-400/30 font-bold">
                  بنقرة واحدة
                </span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                سجل حسابك فورياً عبر حساب Google لحفظ أرقامك القياسية سحابياً ومزامنة نقاط الصمود عبر أي جهاز.
              </p>
              <button
                id="btn-google-register"
                type="button"
                disabled={isGoogleLoading}
                onClick={handleGoogleSignIn}
                className="w-full py-3 px-4 bg-white hover:bg-slate-100 text-slate-950 font-black text-xs sm:text-sm rounded-xl shadow-[0_0_20px_rgba(255,255,255,0.2)] transition flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isGoogleLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-cyan-600" />
                    <span>جارٍ فتح نافذة تسجيل الدخول بحساب Google...</span>
                  </>
                ) : (
                  <>
                    <div className="w-5 h-5 rounded-full bg-slate-100 border border-slate-300 flex items-center justify-center font-bold font-sans text-xs text-blue-600">
                      G
                    </div>
                    <span>تسجيل المستخدم عبر حساب Google</span>
                  </>
                )}
              </button>

              <div className="flex items-center justify-between pt-1 text-[11px] text-slate-400">
                <button
                  type="button"
                  onClick={handleInstantHero}
                  className="text-cyan-400 hover:text-cyan-300 font-bold flex items-center gap-1 cursor-pointer transition"
                >
                  <Zap className="w-3 h-3" />
                  <span>دخول سريع كبطل بنقرة واحدة</span>
                </button>
                <button
                  type="button"
                  onClick={() => window.open(window.location.href, '_blank')}
                  className="text-slate-400 hover:text-slate-200 flex items-center gap-1 cursor-pointer transition"
                  title="فتح في نافذة مستقلة لتجنب قيود المتصفح أو الإطار"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span>فتح بنافذة جديدة</span>
                </button>
              </div>
            </div>

            {/* Divider */}
            <div className="relative flex py-1 items-center">
              <div className="flex-grow border-t border-[#334155]"></div>
              <span className="flex-shrink mx-3 text-[11px] text-slate-400 font-semibold">
                أو إنشاء حساب بطل محلي بالاسم والرمز
              </span>
              <div className="flex-grow border-t border-[#334155]"></div>
            </div>

            <form onSubmit={handleRegister} className="space-y-4">
              <p className="text-xs text-slate-300">
                أنشئ حساب بطل جديد لحفظ نقاطك وأرقامك القياسية والتنافس على قائمة المتصدرين:
              </p>

            {/* Username Input */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                اسم البطل (Survivor Nickname) *
              </label>
              <input
                id="input-register-username"
                type="text"
                required
                maxLength={20}
                placeholder="مثال: فارس الظلام، صقر الصمود"
                value={regUsername}
                onChange={(e) => setRegUsername(e.target.value)}
                className="w-full bg-[#0f172a] border border-[#334155] rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-400 transition"
              />
            </div>

            {/* PIN / Password Input */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1 flex items-center justify-between">
                <span>رمز حماية الحساب (PIN اختياري)</span>
                <span className="text-[10px] text-slate-500">لحماية حسابك عند الدخول لاحقاً</span>
              </label>
              <input
                id="input-register-pin"
                type="password"
                maxLength={10}
                placeholder="رمز سري أو أرقام PIN (اختياري)"
                value={regPin}
                onChange={(e) => setRegPin(e.target.value)}
                className="w-full bg-[#0f172a] border border-[#334155] rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-400 transition"
              />
            </div>

            {/* Avatar Selector */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                اختر فئة البطل وشخصيتك المفضلة:
              </label>
              <div className="grid grid-cols-3 gap-2">
                {AVATAR_OPTIONS.map((av) => (
                  <button
                    type="button"
                    key={av.id}
                    onClick={() => setRegAvatar(av.id)}
                    className={`p-2.5 rounded-xl border text-center transition cursor-pointer flex flex-col items-center gap-1 ${
                      regAvatar === av.id
                        ? 'bg-cyan-500/20 border-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.3)]'
                        : 'bg-[#0f172a] border-[#334155] hover:bg-[#1e293b]'
                    }`}
                  >
                    <span className="text-2xl">{av.icon}</span>
                    <span className="text-xs font-bold text-slate-200">{av.nameAr}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <button
                id="btn-submit-register"
                type="submit"
                className="w-full py-3 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-sm rounded-xl shadow-[0_0_20px_rgba(34,211,238,0.35)] transition cursor-pointer"
              >
                تأكيد وإنشاء حساب البطل المحلي
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 3: LOGIN VIEW */}
      {activeTab === 'login' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {/* Google Fast Login Option */}
          <div className="bg-gradient-to-r from-blue-950/40 via-cyan-950/40 to-blue-950/40 border border-cyan-400/40 rounded-2xl p-4 text-right space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-cyan-400" />
                <span>المتابعة السريعة عبر Google</span>
              </span>
              <span className="text-[10px] bg-cyan-400/20 text-cyan-300 px-2 py-0.5 rounded-full border border-cyan-400/30 font-bold">
                سحابي
              </span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              إذا كنت قد سجلت مسبقاً بحساب Google، اضغط هنا لتسجيل الدخول الفوري واسترجاع رتبتك ونقاطك:
            </p>
            <button
              id="btn-google-login"
              type="button"
              disabled={isGoogleLoading}
              onClick={handleGoogleSignIn}
              className="w-full py-3 px-4 bg-white hover:bg-slate-100 text-slate-950 font-black text-xs sm:text-sm rounded-xl shadow-[0_0_20px_rgba(255,255,255,0.2)] transition flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isGoogleLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-cyan-600" />
                  <span>جارٍ فتح نافذة تسجيل الدخول بحساب Google...</span>
                </>
              ) : (
                <>
                  <div className="w-5 h-5 rounded-full bg-slate-100 border border-slate-300 flex items-center justify-center font-bold font-sans text-xs text-blue-600">
                    G
                  </div>
                  <span>المتابعة باستخدام حساب Google</span>
                </>
              )}
            </button>

            <div className="flex items-center justify-between pt-1 text-[11px] text-slate-400">
              <button
                type="button"
                onClick={handleInstantHero}
                className="text-cyan-400 hover:text-cyan-300 font-bold flex items-center gap-1 cursor-pointer transition"
              >
                <Zap className="w-3 h-3" />
                <span>دخول سريع كبطل بنقرة واحدة</span>
              </button>
              <button
                type="button"
                onClick={() => window.open(window.location.href, '_blank')}
                className="text-slate-400 hover:text-slate-200 flex items-center gap-1 cursor-pointer transition"
                title="فتح في نافذة مستقلة لتجنب قيود المتصفح أو الإطار"
              >
                <ExternalLink className="w-3 h-3" />
                <span>فتح بنافذة جديدة</span>
              </button>
            </div>
          </div>

          {/* Divider */}
          <div className="relative flex py-1 items-center">
            <div className="flex-grow border-t border-[#334155]"></div>
            <span className="flex-shrink mx-3 text-[11px] text-slate-400 font-semibold">
              أو الدخول باسم البطل المحلي ورمز PIN
            </span>
            <div className="flex-grow border-t border-[#334155]"></div>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            {/* Username Input */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                اسم البطل المسجل
              </label>
              <input
                id="input-login-username"
                type="text"
                required
                placeholder="أدخل اسم البطل..."
                value={loginUsername}
                onChange={(e) => setLoginUsername(e.target.value)}
                className="w-full bg-[#0f172a] border border-[#334155] rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-400 transition"
              />
            </div>

            {/* PIN Input */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                الرمز السري (PIN)
              </label>
              <input
                id="input-login-pin"
                type="password"
                placeholder="أدخل الرمز السري إن وجد..."
                value={loginPin}
                onChange={(e) => setLoginPin(e.target.value)}
                className="w-full bg-[#0f172a] border border-[#334155] rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-400 transition"
              />
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <button
                id="btn-submit-login"
                type="submit"
                className="w-full py-3 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-sm rounded-xl shadow-[0_0_20px_rgba(34,211,238,0.35)] transition cursor-pointer"
              >
                تسجيل الدخول ومتابعة الصمود
              </button>
            </div>
          </form>
        </div>
      )}
      </div>
    </div>
  );
};
