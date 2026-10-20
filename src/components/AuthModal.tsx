import React, { useState, useRef } from 'react';
import {
  accountService,
  PRESET_AVATARS,
  compressAvatarImage,
  DeviceSession,
  getDeviceName,
} from '../services/accountService';
import {
  X,
  LogIn,
  UserPlus,
  Eye,
  EyeOff,
  Laptop,
  Upload,
  ShieldCheck,
  AlertTriangle,
  Sparkles,
  KeyRound,
  User,
} from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  initialTab?: 'login' | 'register';
  onClose: () => void;
  onSuccess?: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  initialTab = 'login',
  onClose,
  onSuccess,
}) => {
  const [activeTab, setActiveTab] = useState<'login' | 'register'>(initialTab);

  // Login state
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPass, setShowLoginPass] = useState(false);

  // Register state
  const [regDisplayName, setRegDisplayName] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [showRegPass, setShowRegPass] = useState(false);
  const [regAvatar, setRegAvatar] = useState<string>(PRESET_AVATARS[1].url);

  // Status & Device Limit Conflict state
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [conflictDevices, setConflictDevices] = useState<DeviceSession[] | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  React.useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      setErrorMsg(null);
      setSuccessMsg(null);
      setConflictDevices(null);
    }
  }, [isOpen, initialTab]);

  if (!isOpen) return null;

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await compressAvatarImage(file);
      setRegAvatar(dataUrl);
      setErrorMsg(null);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Lỗi tải ảnh đại diện');
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent, forceKickOldest: boolean = false) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsLoading(true);

    try {
      const res = await accountService.login(loginUsername, loginPassword, forceKickOldest);
      if (!res.success) {
        if (res.code === 'MAX_DEVICES_REACHED' && res.activeDevices) {
          setConflictDevices(res.activeDevices);
        }
        setErrorMsg(res.message);
      } else {
        setConflictDevices(null);
        setSuccessMsg(res.message);
        setTimeout(() => {
          onSuccess?.();
          onClose();
        }, 400);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (regPassword !== regConfirmPassword) {
      setErrorMsg('Mật khẩu xác nhận không khớp!');
      return;
    }

    setIsLoading(true);
    try {
      const res = await accountService.registerAccount({
        username: regUsername,
        password: regPassword,
        displayName: regDisplayName,
        avatar: regAvatar,
      });

      if (!res.success) {
        setErrorMsg(res.message);
      } else {
        setSuccessMsg(res.message);
        setTimeout(() => {
          onSuccess?.();
          onClose();
        }, 500);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsLoading(true);
    try {
      const res = await accountService.loginWithGoogle();
      if (!res.success) {
        setErrorMsg(res.message);
      } else {
        setSuccessMsg(res.message);
        setTimeout(() => {
          onSuccess?.();
          onClose();
        }, 400);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-3 sm:p-4 animate-fade-in">
      <div className="bg-white border border-slate-200 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 via-sky-600 to-indigo-700 px-6 py-4 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center">
              <ShieldCheck size={20} className="text-white" />
            </div>
            <div>
              <h2 className="text-base font-extrabold tracking-tight leading-tight">
                {activeTab === 'login' ? 'Đăng Nhập Tài Khoản' : 'Đăng Ký Tài Khoản Mới'}
              </h2>
              <p className="text-[11px] text-indigo-100 font-medium">
                Hỗ trợ tối đa 2 thiết bị · Bảo mật & Đồng bộ
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-white/10 hover:bg-white/25 text-white transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Mode Switcher Tabs */}
        <div className="grid grid-cols-2 bg-slate-100 p-1.5 mx-6 mt-4 rounded-2xl border border-slate-200 shrink-0">
          <button
            type="button"
            onClick={() => {
              setActiveTab('login');
              setErrorMsg(null);
              setConflictDevices(null);
            }}
            className={`py-2 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'login'
                ? 'bg-white text-indigo-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <LogIn size={15} />
            <span>Đăng Nhập</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('register');
              setErrorMsg(null);
              setConflictDevices(null);
            }}
            className={`py-2 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'register'
                ? 'bg-white text-indigo-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <UserPlus size={15} />
            <span>Đăng Ký Tài Khoản</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="px-6 py-4 overflow-y-auto space-y-4">
          {/* Device Badge */}
          <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-50 border border-slate-200/80 text-[11px] text-slate-600">
            <span className="flex items-center gap-1.5 font-medium">
              <Laptop size={14} className="text-sky-600 shrink-0" />
              <span>Thiết bị hiện tại:</span>
            </span>
            <span className="font-bold text-slate-800">{getDeviceName()}</span>
          </div>

          {errorMsg && (
            <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-start gap-2">
              <AlertTriangle size={16} className="text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p>{errorMsg}</p>
                {conflictDevices && conflictDevices.length > 0 && (
                  <div className="mt-2.5 pt-2 border-t border-rose-200/80 space-y-1.5">
                    <div className="text-[11px] font-extrabold text-rose-800 uppercase">
                      Thiết bị đang đăng nhập ({conflictDevices.length}/2):
                    </div>
                    {conflictDevices.map((dev, idx) => (
                      <div
                        key={dev.deviceId}
                        className="flex items-center justify-between bg-white px-2.5 py-1.5 rounded-lg border border-rose-200 text-[11px]"
                      >
                        <span className="font-bold text-slate-800">
                          #{idx + 1}. {dev.deviceName}
                        </span>
                        <span className="text-slate-500">
                          {new Date(dev.lastActiveAt).toLocaleDateString('vi-VN')}
                        </span>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={(e) => handleLoginSubmit(e, true)}
                      className="w-full mt-2 py-2 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs shadow-xs transition-colors cursor-pointer"
                    >
                      Đăng xuất thiết bị cũ nhất & Đăng nhập vào máy này
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold flex items-center gap-2">
              <Sparkles size={16} className="text-emerald-600 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {activeTab === 'login' ? (
            <form onSubmit={(e) => handleLoginSubmit(e, false)} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Tên đăng nhập
                </label>
                <div className="relative">
                  <User
                    size={16}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    type="text"
                    required
                    value={loginUsername}
                    onChange={(e) => setLoginUsername(e.target.value)}
                    placeholder="Nhập tên đăng nhập (VD: admin, giaovien1)"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 text-sm font-semibold text-slate-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Mật khẩu
                </label>
                <div className="relative">
                  <KeyRound
                    size={16}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    type={showLoginPass ? 'text' : 'password'}
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="Nhập mật khẩu..."
                    className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-300 text-sm font-semibold text-slate-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPass(!showLoginPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                  >
                    {showLoginPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-sky-600 hover:from-indigo-700 hover:to-sky-700 text-white font-extrabold text-sm shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <LogIn size={17} />
                <span>{isLoading ? 'Đang xử lý...' : 'Đăng Nhập Ngay'}</span>
              </button>

              <div className="relative flex py-1 items-center">
                <div className="flex-grow border-t border-slate-200"></div>
                <span className="flex-shrink mx-3 text-[11px] font-bold text-slate-400 uppercase">
                  Hoặc đồng bộ đám mây
                </span>
                <div className="flex-grow border-t border-slate-200"></div>
              </div>

              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={isLoading}
                className="w-full py-2.5 px-4 rounded-xl bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs border border-slate-300 shadow-2xs transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                <span>Đăng nhập nhanh với Google</span>
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
              {/* Avatar Picker */}
              <div className="flex flex-col items-center gap-2 bg-slate-50 p-3 rounded-2xl border border-slate-200">
                <div className="relative group">
                  <img
                    src={regAvatar}
                    alt="Avatar"
                    className="w-16 h-16 rounded-full object-cover border-2 border-indigo-500 shadow-md bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute -bottom-1 -right-1 bg-indigo-600 hover:bg-indigo-700 text-white p-1.5 rounded-full shadow-md cursor-pointer"
                    title="Tải ảnh đại diện từ máy tính"
                  >
                    <Upload size={12} />
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarUpload}
                    className="hidden"
                  />
                </div>
                <span className="text-[11px] font-bold text-slate-500">
                  Chọn ảnh đại diện mẫu hoặc tải ảnh lên
                </span>
                <div className="flex items-center gap-1.5 flex-wrap justify-center">
                  {PRESET_AVATARS.slice(1, 9).map((av) => (
                    <button
                      key={av.id}
                      type="button"
                      onClick={() => setRegAvatar(av.url)}
                      className={`w-8 h-8 rounded-full overflow-hidden border-2 transition-transform cursor-pointer ${
                        regAvatar === av.url
                          ? 'border-indigo-600 scale-110 shadow-xs'
                          : 'border-transparent opacity-75 hover:opacity-100'
                      }`}
                      title={av.label}
                    >
                      <img src={av.url} alt={av.label} className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Tên hiển thị (Họ và tên)
                </label>
                <input
                  type="text"
                  required
                  value={regDisplayName}
                  onChange={(e) => setRegDisplayName(e.target.value)}
                  placeholder="VD: Thầy Nguyễn Văn A"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm font-semibold text-slate-900 focus:border-indigo-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Tên đăng nhập (viết liền không dấu)
                </label>
                <input
                  type="text"
                  required
                  value={regUsername}
                  onChange={(e) =>
                    setRegUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_\-]/g, ''))
                  }
                  placeholder="VD: nguyenvana"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm font-semibold text-slate-900 focus:border-indigo-500 outline-none font-mono"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Mật khẩu
                  </label>
                  <div className="relative">
                    <input
                      type={showRegPass ? 'text' : 'password'}
                      required
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      placeholder="Tối thiểu 3 ký tự"
                      className="w-full pl-3 pr-8 py-2 rounded-xl border border-slate-300 text-sm font-semibold text-slate-900 focus:border-indigo-500 outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowRegPass(!showRegPass)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                    >
                      {showRegPass ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nhập lại mật khẩu
                  </label>
                  <input
                    type={showRegPass ? 'text' : 'password'}
                    required
                    value={regConfirmPassword}
                    onChange={(e) => setRegConfirmPassword(e.target.value)}
                    placeholder="Xác nhận mật khẩu"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm font-semibold text-slate-900 focus:border-indigo-500 outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-extrabold text-sm shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <UserPlus size={17} />
                <span>{isLoading ? 'Đang tạo tài khoản...' : 'Hoàn Tất Đăng Ký'}</span>
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
