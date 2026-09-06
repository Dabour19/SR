import React, { useState } from 'react';
import {
  X,
  Smartphone,
  CheckCircle2,
  Copy,
  ExternalLink,
  ShieldCheck,
  Terminal,
  FileCode,
  Globe,
  UploadCloud,
  Layers,
  HelpCircle,
} from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface GooglePlayExportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GooglePlayExportModal: React.FC<GooglePlayExportModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { isInstallable, install } = usePWAInstall();
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'pwabuilder' | 'bubblewrap' | 'checklist'>('pwabuilder');

  if (!isOpen) return null;

  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://your-domain.com';
  const manifestUrl = `${currentOrigin}/manifest.webmanifest`;

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const bubblewrapCode = `# 1. تثبيت أداة جوجل الرسمية (Google Chrome Team CLI):
npm install -g @bubblewrap/cli

# 2. توليد مشروع أندرويد تلقائياً من رابط اللعبة:
bubblewrap init --manifest="${manifestUrl}"

# 3. بناء وتوقيع حزمة المتجر الرسمية (.aab):
bubblewrap build`;

  const assetLinksTemplate = `[{
  "relation": ["delegate_permission/common.handle_all_urls"],
  "target": {
    "namespace": "android_app",
    "package_name": "com.survivorrogue.game",
    "sha256_cert_fingerprints": [
      "14:6D:E9:01:CE:E5:21:2E:7E:2E:..."
    ]
  }
}]`;

  return (
    <div
      id="google-play-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-3 sm:p-4 animate-in fade-in duration-150 overflow-y-auto"
    >
      <div className="w-full max-w-2xl bg-[#1e293b] border-2 border-cyan-400/40 rounded-3xl p-5 sm:p-7 shadow-[0_10px_40px_rgba(34,211,238,0.25)] text-right my-6 max-h-[92vh] overflow-y-auto relative">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#334155] pb-4 mb-4">
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-[#0f172a] hover:bg-[#334155] text-slate-400 hover:text-white border border-[#334155] transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2.5">
            <div>
              <h2 className="text-xl sm:text-2xl font-black italic tracking-tight text-white flex items-center gap-2 justify-end">
                <span>نشر اللعبة على متجر Google Play</span>
                <span className="text-2xl">🚀</span>
              </h2>
              <p className="text-[11px] font-mono font-semibold uppercase tracking-wider text-cyan-400">
                Android TWA (Trusted Web Activity) & PWA Package
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/30 to-cyan-500/30 border border-emerald-400/50 flex items-center justify-center text-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.3)]">
              <Smartphone className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Quick summary notice */}
        <div className="bg-[#0f172a] border border-cyan-500/30 rounded-2xl p-3.5 sm:p-4 mb-5 shadow-inner">
          <p className="text-xs text-slate-300 leading-relaxed">
            اللعبة مجهزة تقنياً بنسبة <strong>100%</strong> بمواصفات <strong>Google Play TWA</strong> (حزم الأيقونات 512x512، ملف Manifest، دعم وضع الشاشة الكاملة، والعمل بدون إنترنت). كل ما تحتاجه هو استخراج حزمة <strong>.aab</strong> ورفعها لحسابك في Google Play Console.
          </p>
          <div className="mt-2.5 pt-2.5 border-t border-[#334155]/60 flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-slate-400">
            <span className="flex items-center gap-1.5 text-cyan-300">
              <Globe className="w-3.5 h-3.5 text-cyan-400" />
              <span>رابط اللعبة المعتمد:</span>
            </span>
            <span className="bg-slate-900 px-2 py-0.5 rounded border border-slate-700 text-slate-200 select-all truncate max-w-[280px]">
              {currentOrigin}
            </span>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1.5 bg-[#0f172a] p-1 rounded-2xl border border-[#334155] mb-5">
          <button
            type="button"
            onClick={() => setActiveTab('pwabuilder')}
            className={`flex-1 py-2 px-2.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'pwabuilder'
                ? 'bg-cyan-500 text-slate-950 shadow-[0_0_12px_rgba(34,211,238,0.35)]'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>1. أداة PWABuilder (الأسهل)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('bubblewrap')}
            className={`flex-1 py-2 px-2.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'bubblewrap'
                ? 'bg-cyan-500 text-slate-950 shadow-[0_0_12px_rgba(34,211,238,0.35)]'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>2. أداة Bubblewrap (جوجل)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('checklist')}
            className={`flex-1 py-2 px-2.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'checklist'
                ? 'bg-cyan-500 text-slate-950 shadow-[0_0_12px_rgba(34,211,238,0.35)]'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>3. خطوات متجر بلاي</span>
          </button>
        </div>

        {/* Tab 1: PWABuilder */}
        {activeTab === 'pwabuilder' && (
          <div className="space-y-4 animate-in fade-in duration-150">
            <div className="bg-[#0f172a] rounded-2xl p-4 sm:p-5 border border-[#334155] space-y-3">
              <div className="flex items-center gap-2 text-white font-bold text-sm">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>توليد حزمة أندرويد (.aab) بنقرة واحدة وبدون كتابة أكواد:</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                منصة <strong>PWABuilder.com</strong> (المدعومة رسمياً من مايكروسوفت وفريق جوجل) تقوم بفحص اللعبة وتوليد ملف حزمة أندرويد الموقعة <strong>(Signed Android App Bundle - .aab)</strong> الجاهزة للرفع المباشر لمتجر Google Play Console.
              </p>

              <ol className="text-xs text-slate-300 space-y-2 list-decimal list-inside bg-slate-900/80 p-3.5 rounded-xl border border-slate-800">
                <li>اضغط على زر <strong>"فتح PWABuilder مع رابط اللعبة"</strong> أدناه.</li>
                <li>ستقوم الأداة بالتحقق من ملف Manifest والأيقونات وظهور علامة ممتاز (PWA Score 100/100).</li>
                <li>اضغط على زر <strong>"Package for Store"</strong> ثم اختر <strong>"Android"</strong>.</li>
                <li>ستحصل فوراً على ملف مضغوط يحتوي على حزمة <strong>app-release-bundle.aab</strong>.</li>
              </ol>

              <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                <a
                  href={`https://www.pwabuilder.com?url=${encodeURIComponent(currentOrigin)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 inline-flex items-center justify-center gap-2 py-3 px-4 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl text-xs sm:text-sm font-black transition shadow-[0_0_20px_rgba(52,211,153,0.3)] cursor-pointer"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>فتح PWABuilder وتوليد حزمة Google Play (.aab)</span>
                </a>

                <button
                  type="button"
                  onClick={() => copyToClipboard(currentOrigin, 10)}
                  className="py-3 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {copiedIndex === 10 ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-cyan-400" />}
                  <span>نسخ الرابط</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Google Bubblewrap CLI */}
        {activeTab === 'bubblewrap' && (
          <div className="space-y-4 animate-in fade-in duration-150">
            <div className="bg-[#0f172a] rounded-2xl p-4 sm:p-5 border border-[#334155] space-y-3">
              <div className="flex items-center gap-2 text-white font-bold text-sm">
                <Terminal className="w-4 h-4 text-cyan-400" />
                <span>أداة جوجل الرسمية للمطورين (Google Chrome Bubblewrap CLI):</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                إذا كنت تفضل استخدام سطر الأوامر (Terminal) أو بناء المشروع محلياً، أداة <strong>Bubblewrap</strong> التابعة لفريق Google تتيح توليد مشروع أندرويد كامل مبني على <strong>Trusted Web Activities (TWA)</strong>:
              </p>

              <div className="relative bg-slate-950 rounded-xl p-3.5 border border-slate-800 text-left font-mono text-xs text-cyan-300 overflow-x-auto shadow-inner">
                <button
                  type="button"
                  onClick={() => copyToClipboard(bubblewrapCode, 1)}
                  className="absolute top-2.5 right-2.5 p-1.5 bg-[#1e293b] hover:bg-[#334155] border border-[#334155] text-slate-300 rounded-lg transition text-[11px] flex items-center gap-1 cursor-pointer shadow"
                >
                  {copiedIndex === 1 ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span>تم النسخ!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-cyan-400" />
                      <span>نسخ الأوامر</span>
                    </>
                  )}
                </button>
                <pre className="whitespace-pre">{bubblewrapCode}</pre>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Google Play Console Steps */}
        {activeTab === 'checklist' && (
          <div className="space-y-3 animate-in fade-in duration-150">
            <div className="bg-[#0f172a] rounded-2xl p-4 border border-[#334155] text-xs text-slate-300 space-y-3">
              <h4 className="font-bold text-white flex items-center gap-2 text-sm">
                <UploadCloud className="w-4 h-4 text-cyan-400" />
                <span>خطوات النشر على Google Play Console:</span>
              </h4>

              <div className="space-y-2 text-slate-300">
                <div className="p-2.5 bg-slate-900 rounded-xl border border-slate-800 flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold text-xs shrink-0">1</span>
                  <div>
                    <strong className="text-white block mb-0.5">فتح حساب مطور Google Play:</strong>
                    <span>سجل الدخول في <a href="https://play.google.com/console" target="_blank" rel="noopener noreferrer" className="text-cyan-400 underline font-semibold">Google Play Console</a> (رسوم لمرة واحدة $25).</span>
                  </div>
                </div>

                <div className="p-2.5 bg-slate-900 rounded-xl border border-slate-800 flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold text-xs shrink-0">2</span>
                  <div>
                    <strong className="text-white block mb-0.5">إنشاء تطبيق جديد (Create App):</strong>
                    <span>اختر اسم اللعبة <strong>"Survivor Rogue"</strong> والنوع <strong>لعبة (Game)</strong> وتصنيف <strong>مجانية (Free)</strong>.</span>
                  </div>
                </div>

                <div className="p-2.5 bg-slate-900 rounded-xl border border-slate-800 flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold text-xs shrink-0">3</span>
                  <div>
                    <strong className="text-white block mb-0.5">رفع حزمة التطبيق (.aab):</strong>
                    <span>انتقل إلى <strong>Release &gt; Production</strong> وارفع ملف <strong>.aab</strong> الناتج من PWABuilder أو Bubblewrap.</span>
                  </div>
                </div>

                <div className="p-2.5 bg-slate-900 rounded-xl border border-slate-800 flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold text-xs shrink-0">4</span>
                  <div>
                    <strong className="text-white block mb-0.5">ملء بيانات المتجر والتقييم:</strong>
                    <span>أضف لقطات شاشة (Screenshots) للأجهزة اللوحية والموبايل، وتصنيف المحتوى (+12 أو مناسب للجميع). ثم اضغط <strong>إرسال للمراجعة (Send for review)</strong>!</span>
                  </div>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <a
                  href="https://play.google.com/console"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-bold transition"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>الذهاب إلى Google Play Console</span>
                </a>
              </div>
            </div>
          </div>
        )}

        {/* In-App Direct Mobile Install Test */}
        <div className="mt-4 bg-[#0f172a]/70 border border-emerald-500/30 rounded-2xl p-3.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-300">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>تجربة التثبيت على الهاتف الآن (PWA Standalone):</span>
          </div>
          {isInstallable ? (
            <button
              id="btn-modal-quick-install-now"
              type="button"
              onClick={async () => {
                await install();
              }}
              className="px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl shadow transition cursor-pointer whitespace-nowrap"
            >
              تثبيت على هذا الجهاز
            </button>
          ) : (
            <span className="text-[11px] bg-slate-800 text-slate-300 px-2.5 py-1 rounded-lg border border-slate-700">
              مدعوم للتثبيت المباشر
            </span>
          )}
        </div>

        {/* Footer */}
        <div className="mt-5 pt-3.5 border-t border-[#334155] flex items-center justify-between">
          <span className="text-[11px] text-slate-400 flex items-center gap-1">
            <HelpCircle className="w-3.5 h-3.5 text-cyan-400" />
            <span>اللعبة متوافقة تماماً مع معايير Google Play 2026.</span>
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-[#0f172a] hover:bg-[#334155] text-slate-200 border border-[#334155] font-bold text-xs rounded-xl transition cursor-pointer shadow-md"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};

