import type { ReactNode } from 'react';
import { X, Coins, Package, Trophy, Swords, UserPlus, Sparkles } from 'lucide-react';

interface HelpModalProps {
  onClose: () => void;
}

const TOPICS: { icon: ReactNode; title: string; color: string; items: string[] }[] = [
  {
    icon: <Coins className="w-4 h-4" />,
    title: 'كيف أحصل على العملات 🪙',
    color: 'text-amber-300 border-amber-500/40',
    items: [
      'العب أي جولة: تكسب عملات حسب وقت الصمود + عدد الوحوش التي قتلتها + مستواك.',
      'الانتصار في الجولة (هزيمة كل الزعماء) يمنحك مكافأة إضافية كبيرة.',
      'افتح الصناديق — قد تسحب جوائز عملات حتى 2,500 عملة.',
      'اشترِ ترقية "عملات مضاعفة" (🪙) من المتجر لتتضاعف أرباحك ×2 بشكل دائم.',
    ],
  },
  {
    icon: <Package className="w-4 h-4" />,
    title: 'الصناديق والجوائز 📦',
    color: 'text-fuchsia-300 border-fuchsia-500/40',
    items: [
      'كل صندوق يمنحك شخصية جديدة (70% فرصة إن وُجدت) أو مكافأة عملات.',
      'كلما كان الصندوق أغلى (خشبي ← فضي ← ذهبي ← أسطوري) زادت فرص الجوائز النادرة.',
      'ترقية "التميمة المحظوظة" 🧿 تقلل الجوائز العادية وتزيد فرصة الأسطورية ×1.5.',
    ],
  },
  {
    icon: <Swords className="w-4 h-4" />,
    title: 'أثناء المعركة ⚔️',
    color: 'text-cyan-300 border-cyan-500/40',
    items: [
      'الهجوم تلقائي — ركّز على الحركة والمراوغة (WASD / الأسهم / العصا الافتراضية).',
      'اجمع الجواهر الخضراء من الوحوش للترقية واختيار أسلحة وقدرات جديدة.',
      'كل شخصية لها لون وسلاح مبتدئ مختلف — جرّبها كلها من تبويب الشخصيات!',
      'الوحوش الزعماء تظهر في أوقات محددة — كن مستعداً!',
    ],
  },
  {
    icon: <Trophy className="w-4 h-4" />,
    title: 'التصنيف والأصدقاء 🏆',
    color: 'text-yellow-300 border-yellow-500/40',
    items: [
      'نقاط التصنيف تزيد مع أفضل نتائجك — وترتفع رتبتك (برونزي ← خارق).',
      'أضف أصدقاء بالبحث عن اسمهم، ثم أنشئ فريقاً وابدأوا المعركة معاً (حتى 4 لاعبين).',
    ],
  },
];

export function HelpModal({ onClose }: HelpModalProps) {
  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg max-h-[88vh] overflow-y-auto bg-[#1e293b]/97 border-2 border-cyan-400/40 rounded-3xl p-5 shadow-[0_10px_30px_rgba(34,211,238,0.2)] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-cyan-300 font-black">
            <Sparkles className="w-5 h-5" />
            <span className="text-base">كيف تلعب وتكسب؟</span>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-[#0f172a] hover:bg-[#334155] text-slate-300 border border-[#334155] transition cursor-pointer"
            title="إغلاق"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3">
          {TOPICS.map((t) => (
            <div key={t.title} className={`p-3.5 rounded-2xl bg-[#0f172a] border ${t.color}`}>
              <div className="flex items-center gap-2 text-sm font-black mb-2">
                {t.icon}
                <span>{t.title}</span>
              </div>
              <ul className="space-y-1.5">
                {t.items.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-[12px] text-slate-300 leading-relaxed">
                    <span className="text-cyan-400 font-black shrink-0 mt-0.5">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-4 flex items-center justify-center gap-2 text-[11px] text-slate-400">
          <UserPlus className="w-3.5 h-3.5" />
          <span>نصيحة: ابدأ بالصناديق الخشبية الرخيصة لجمع الشخصيات مبكراً!</span>
        </div>

        <button
          onClick={onClose}
          className="mt-4 w-full py-3 rounded-2xl bg-cyan-500 hover:bg-cyan-400 text-slate-900 font-black text-sm shadow-[0_0_20px_rgba(34,211,238,0.4)] transition cursor-pointer"
        >
          فهمت، لنبدأ! 🎮
        </button>
      </div>
    </div>
  );
}
