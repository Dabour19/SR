import React, { useEffect, useState } from 'react';
import { WifiOff, Wifi } from 'lucide-react';
import { connectivityService } from '../services/connectivityService';

export const OfflineIndicator: React.FC = () => {
  const [isOnline, setIsOnline] = useState(connectivityService.isOnline());
  const [showReconnected, setShowReconnected] = useState(false);

  useEffect(() => {
    const unsub = connectivityService.subscribe((online) => {
      if (online) {
        setShowReconnected(true);
        window.setTimeout(() => setShowReconnected(false), 3000);
      }
      setIsOnline(online);
    });
    return () => unsub();
  }, []);

  if (isOnline && !showReconnected) return null;

  if (!isOnline) {
    return (
      <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-xl bg-amber-600/90 backdrop-blur-md px-3 py-1.5 text-xs font-bold text-white shadow-xl border border-amber-400/30 animate-pulse">
        <WifiOff className="w-4 h-4" />
        <span>وضع عدم الاتصال — اللعبة تعمل بالكامل أوفلاين وستتزامن بياناتك لاحقاً</span>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-xl bg-emerald-600/90 backdrop-blur-md px-3 py-1.5 text-xs font-bold text-white shadow-xl border border-emerald-400/30">
      <Wifi className="w-4 h-4" />
      <span>تم استعادة الاتصال — مزامنة السحابة جارية</span>
    </div>
  );
};
