import React, { useState, useRef, useEffect } from 'react';
import {
  accountService,
  UserAccount,
  PRESET_AVATARS,
  compressAvatarImage,
  parseActiveDevices,
  getDeviceId,
} from '../services/accountService';
import {
  X,
  Camera,
  Save,
  KeyRound,
  User,
  Laptop,
  Calendar,
  Trash2,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Shield,
} from 'lucide-react';

interface UserProfileModalProps {
  isOpen: boolean;
  account: UserAccount | null;
  onClose: () => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  isOpen,
  account,
  onClose,
}) => {
  const [displayName, setDisplayName] = useState('');
  const [avatar, setAvatar] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );
  const [isSaving, setIsSaving] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isOpen && account) {
      setDisplayName(account.displayName);
      setAvatar(account.avatar);
      setNewPassword('');
      setConfirmPassword('');
      setStatusMsg(null);
    }
  }, [isOpen, account]);

  if (!isOpen || !account) return null;

  const activeDevices = parseActiveDevices(account);
  const currentDeviceId = getDeviceId();
  const daysRemaining = Math.ceil((account.expiresAt - Date.now()) / 86400000);

  const handleUploadAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressAvatarImage(file);
      setAvatar(compressed);
      setStatusMsg(null);
    } catch (err) {
      setStatusMsg({
        type: 'error',
        text: err instanceof Error ? err.message : 'Không thể tải ảnh đại diện',
      });
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMsg(null);

    if (newPassword.trim().length > 0 && newPassword !== confirmPassword) {
      setStatusMsg({ type: 'error', text: 'Mật khẩu xác nhận không khớp!' });
      return;
    }

    setIsSaving(true);
    try {
      const res = await accountService.updateOwnProfile({
        displayName,
        avatar,
        newPassword: newPassword.trim().length > 0 ? newPassword.trim() : undefined,
      });

      if (res.success) {
        setStatusMsg({ type: 'success', text: res.message });
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setStatusMsg({ type: 'error', text: res.message });
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-3 sm:p-4 animate-fade-in">
      <div className="bg-white border border-slate-200 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-sky-600 via-indigo-600 to-purple-600 px-6 py-4 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <img
              src={avatar || PRESET_AVATARS[1].url}
              alt={account.displayName}
              className="w-11 h-11 rounded-full object-cover border-2 border-white shadow-md bg-white"
            />
            <div>
              <h2 className="text-base font-extrabold tracking-tight leading-tight">
                Hồ Sơ Cá Nhân & Cài Đặt
              </h2>
              <div className="flex items-center gap-2 text-[11px] text-sky-100 font-medium mt-0.5">
                <span className="font-mono bg-white/20 px-1.5 py-0.2 rounded">
                  @{account.username}
                </span>
                <span>•</span>
                <span>{account.role === 'admin' ? '👑 Quản trị viên' : '👨‍🏫 Giáo viên'}</span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-white/10 hover:bg-white/25 text-white transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSave} className="p-6 overflow-y-auto space-y-4">
          {statusMsg && (
            <div
              className={`p-3 rounded-2xl text-xs font-bold flex items-center gap-2 border ${
                statusMsg.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                  : 'bg-rose-50 border-rose-200 text-rose-700'
              }`}
            >
              {statusMsg.type === 'success' ? (
                <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle size={16} className="text-rose-600 shrink-0" />
              )}
              <span>{statusMsg.text}</span>
            </div>
          )}

          {/* Avatar Section */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col items-center gap-3">
            <div className="flex items-center gap-4">
              <div className="relative">
                <img
                  src={avatar || PRESET_AVATARS[1].url}
                  alt="Avatar Preview"
                  className="w-20 h-20 rounded-full object-cover border-4 border-indigo-500 shadow-lg bg-white"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute bottom-0 right-0 bg-indigo-600 hover:bg-indigo-700 text-white p-2 rounded-full shadow-md cursor-pointer transition-transform hover:scale-105"
                  title="Tải ảnh đại diện từ máy tính"
                >
                  <Camera size={14} />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleUploadAvatar}
                  className="hidden"
                />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs font-extrabold text-slate-800">
                  Ảnh đại diện (Avatar)
                </span>
                <p className="text-[11px] text-slate-500">
                  Tải ảnh từ máy tính hoặc chọn nhanh biểu tượng bên dưới:
                </p>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-1 px-3 py-1.5 rounded-xl bg-white hover:bg-indigo-50 text-indigo-600 border border-indigo-200 text-xs font-bold w-fit cursor-pointer transition-colors"
                >
                  📷 Chọn ảnh từ máy tính...
                </button>
              </div>
            </div>

            <div className="w-full pt-2 border-t border-slate-200/80">
              <div className="flex items-center justify-center gap-1.5 flex-wrap">
                {PRESET_AVATARS.map((av) => (
                  <button
                    key={av.id}
                    type="button"
                    onClick={() => setAvatar(av.url)}
                    className={`w-8 h-8 rounded-full overflow-hidden border-2 transition-all cursor-pointer ${
                      avatar === av.url
                        ? 'border-indigo-600 scale-110 shadow-sm'
                        : 'border-transparent opacity-70 hover:opacity-100'
                    }`}
                    title={av.label}
                  >
                    <img src={av.url} alt={av.label} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Display Name & Account Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Tên đăng nhập (Cố định)
              </label>
              <div className="px-3.5 py-2 rounded-xl bg-slate-100 border border-slate-200 text-sm font-mono font-bold text-slate-600 flex items-center justify-between">
                <span>{account.username}</span>
                <Shield size={14} className="text-slate-400" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Thời hạn tài khoản
              </label>
              <div
                className={`px-3 py-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 ${
                  account.role === 'admin' || daysRemaining > 7
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                    : daysRemaining > 0
                    ? 'bg-amber-50 border-amber-200 text-amber-700'
                    : 'bg-rose-50 border-rose-200 text-rose-700'
                }`}
              >
                <Calendar size={14} className="shrink-0" />
                <span>
                  {account.role === 'admin'
                    ? 'Vĩnh viễn (Admin)'
                    : daysRemaining > 0
                    ? `Còn ${daysRemaining} ngày (${new Date(
                        account.expiresAt
                      ).toLocaleDateString('vi-VN')})`
                    : `Đã hết hạn (${new Date(account.expiresAt).toLocaleDateString('vi-VN')})`}
                </span>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Tên hiển thị
            </label>
            <div className="relative">
              <User
                size={16}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Nhập tên hiển thị..."
                className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-300 text-sm font-semibold text-slate-900 focus:border-indigo-500 outline-none"
              />
            </div>
          </div>

          {/* Change Password Section */}
          <div className="bg-amber-50/60 border border-amber-200/80 rounded-2xl p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
                <KeyRound size={14} className="text-amber-600" />
                <span>Đổi mật khẩu mới (Để trống nếu giữ nguyên)</span>
              </span>
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="text-[11px] font-bold text-indigo-600 hover:underline flex items-center gap-1 cursor-pointer"
              >
                {showPassword ? <EyeOff size={13} /> : <Eye size={13} />}
                <span>{showPassword ? 'Ẩn' : 'Hiện mật khẩu'}</span>
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <input
                type={showPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Mật khẩu mới..."
                className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-xs font-semibold text-slate-900 focus:border-indigo-500 outline-none"
              />
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Nhập lại mật khẩu mới..."
                className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-xs font-semibold text-slate-900 focus:border-indigo-500 outline-none"
              />
            </div>
          </div>

          {/* Active Devices Section (Max 2 Devices) */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
                <Laptop size={14} className="text-sky-600" />
                <span>Thiết bị đang đăng nhập</span>
              </span>
              <span className="text-[11px] font-extrabold px-2 py-0.5 rounded-full bg-sky-100 text-sky-800">
                {activeDevices.length} / {account.maxDevices} máy tối đa
              </span>
            </div>

            <div className="space-y-1.5">
              {activeDevices.map((dev, idx) => {
                const isThisMachine = dev.deviceId === currentDeviceId;
                return (
                  <div
                    key={dev.deviceId}
                    className="flex items-center justify-between bg-white px-3 py-2 rounded-xl border border-slate-200 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 font-bold flex items-center justify-center text-[10px]">
                        {idx + 1}
                      </span>
                      <div>
                        <div className="font-bold text-slate-800 flex items-center gap-1.5">
                          <span>{dev.deviceName}</span>
                          {isThisMachine && (
                            <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.2 rounded font-extrabold">
                              Máy này
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          Hoạt động: {new Date(dev.lastActiveAt).toLocaleString('vi-VN')}
                        </div>
                      </div>
                    </div>
                    {!isThisMachine && (
                      <button
                        type="button"
                        onClick={() =>
                          accountService.removeDeviceSession(account.username, dev.deviceId)
                        }
                        className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                        title="Đăng xuất thiết bị này"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Footer Save Button */}
          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
            >
              Đóng
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold shadow-md flex items-center gap-1.5 cursor-pointer"
            >
              <Save size={15} />
              <span>{isSaving ? 'Đang lưu...' : 'Lưu Thay Đổi'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
