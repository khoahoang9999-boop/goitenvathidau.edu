import React, { useEffect, useState } from 'react';
import { Download, WifiOff, CheckCircle2, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsInstalled(isStandalone);

    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIOSDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIOSDevice);

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const install = async () => {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
      setDeferredPrompt(null);
      return true;
    }
    return false;
  };

  return {
    isInstallable: !!deferredPrompt,
    isInstalled,
    isIOS,
    install,
  };
}

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        onClick={install}
        className="px-2 py-1.5 rounded-xl bg-teal-50 text-teal-700 border border-teal-200 hover:bg-teal-100 transition-colors cursor-pointer flex items-center gap-1 text-xs font-bold shrink-0"
        title="Cài đặt ứng dụng về máy tính / điện thoại để chơi Offline không cần mạng"
      >
        <Download size={14} />
        <span className="hidden 2xl:inline">Cài App</span>
      </button>
    );
  }

  return (
    <>
      <button
        onClick={() => setShowGuide(true)}
        className="px-2 py-1.5 rounded-xl bg-teal-50 text-teal-700 border border-teal-200 hover:bg-teal-100 transition-colors cursor-pointer flex items-center gap-1 text-xs font-bold shrink-0"
        title="Hướng dẫn dùng Offline không cần mạng"
      >
        <Download size={14} />
        <span className="hidden 2xl:inline">Offline</span>
      </button>

      {showGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4 animate-fade-in">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-slate-200 text-slate-800">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-teal-100 text-teal-700">
                  <CheckCircle2 size={20} />
                </div>
                <h3 className="text-base font-extrabold text-slate-900">
                  Chế Độ Chơi Offline (Không Cần Mạng)
                </h3>
              </div>
              <button
                onClick={() => setShowGuide(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-4 space-y-3 text-xs sm:text-sm text-slate-600 leading-relaxed">
              <p className="font-semibold text-teal-800 bg-teal-50 border border-teal-200 rounded-xl p-3">
                ✅ Ứng dụng đã tích hợp công nghệ <strong>PWA Offline</strong> và bộ nhớ <strong>IndexedDB</strong> dung lượng lớn! Sau khi mở trang web 1 lần, bạn có thể tắt mạng Wi-Fi vẫn chơi được bình thường.
              </p>

              {isIOS ? (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1.5">
                  <div className="font-bold text-slate-900">📲 Cài ra màn hình chính iPhone / iPad:</div>
                  <p>1. Bấm nút <strong>Chia sẻ (Share)</strong> trên thanh công cụ Safari.</p>
                  <p>2. Chọn <strong>Thêm vào Màn hình chính (Add to Home Screen)</strong>.</p>
                </div>
              ) : (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1.5">
                  <div className="font-bold text-slate-900">💻 Cài đặt App ra màn hình Desktop (Chrome / Edge / Cốc Cốc):</div>
                  <p>1. Nhìn lên góc phải thanh địa chỉ trình duyệt (URL), bấm vào biểu tượng <strong>Cài đặt (Install / Màn hình có mũi tên tải xuống)</strong>.</p>
                  <p>2. Hoặc vào menu <strong>⋮ (3 chấm)</strong> &rarr; <strong>Lưu và chia sẻ</strong> &rarr; <strong>Cài đặt trang làm ứng dụng</strong>.</p>
                  <p>3. Ứng dụng sẽ nằm ngay trên màn hình Desktop của bạn và mở trực tiếp không cần Internet!</p>
                </div>
              )}
            </div>

            <button
              onClick={() => setShowGuide(false)}
              className="mt-5 w-full rounded-xl bg-teal-600 hover:bg-teal-700 py-2.5 text-xs font-extrabold text-white shadow-md cursor-pointer transition-colors"
            >
              Đã Hiểu
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-xl bg-amber-600 px-3.5 py-2 text-xs font-extrabold text-white shadow-xl border border-amber-400">
      <WifiOff size={15} className="animate-pulse" />
      <span>Đang Chơi Offline — Toàn bộ dữ liệu học sinh, ảnh & nhạc lấy từ máy tính.</span>
    </div>
  );
};
