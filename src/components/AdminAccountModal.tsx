import React, { useState, useEffect } from 'react';
import {
  accountService,
  UserAccount,
  parseActiveDevices,
  PRESET_AVATARS,
} from '../services/accountService';
import {
  X,
  UserPlus,
  ShieldAlert,
  Eye,
  EyeOff,
  Copy,
  Check,
  CalendarPlus,
  Laptop,
  RotateCcw,
  Trash2,
  Lock,
  Unlock,
  Search,
  KeyRound,
  Edit3,
  Save,
  Sparkles,
} from 'lucide-react';

interface AdminAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AdminAccountModal: React.FC<AdminAccountModalProps> = ({ isOpen, onClose }) => {
  const [accounts, setAccounts] = useState<UserAccount[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'expired' | 'locked'>('all');
  const [showAllPasswords, setShowAllPasswords] = useState(true);
  const [visiblePasswords, setVisiblePasswords] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Create Account Form State
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('123456');
  const [newDisplayName, setNewDisplayName] = useState('');
  const [newRole, setNewRole] = useState<'user' | 'admin'>('user');
  const [newDurationDays, setNewDurationDays] = useState<number>(30);
  const [newMaxDevices, setNewMaxDevices] = useState<number>(2);

  // Inline Edit Account State
  const [editingUsername, setEditingUsername] = useState<string | null>(null);
  const [editPassword, setEditPassword] = useState('');
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editMaxDevices, setEditMaxDevices] = useState<number>(2);
  const [editExpiryDate, setEditExpiryDate] = useState<string>('');

  const [bannerMsg, setBannerMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );

  useEffect(() => {
    const sync = () => {
      setAccounts(accountService.getAllAccounts());
    };
    sync();
    return accountService.subscribe(sync);
  }, [isOpen]);

  if (!isOpen) return null;

  const showNotice = (type: 'success' | 'error', text: string) => {
    setBannerMsg({ type, text });
    setTimeout(() => {
      setBannerMsg((prev) => (prev?.text === text ? null : prev));
    }, 3500);
  };

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await accountService.adminCreateAccount({
      username: newUsername,
      password: newPassword,
      displayName: newDisplayName || newUsername,
      role: newRole,
      durationDays: newDurationDays,
      maxDevices: newMaxDevices,
      avatar: PRESET_AVATARS[Math.floor(Math.random() * (PRESET_AVATARS.length - 1)) + 1].url,
    });

    if (res.success) {
      showNotice('success', res.message);
      setNewUsername('');
      setNewDisplayName('');
      setNewPassword('123456');
    } else {
      showNotice('error', res.message);
    }
  };

  const handleQuickExtend = async (username: string, days: number) => {
    const res = await accountService.adminExtendAccount(username, days);
    showNotice(res.success ? 'success' : 'error', res.message);
  };

  const handleCopyCredentials = (acc: UserAccount) => {
    const text = `Tên đăng nhập: ${acc.username} | Mật khẩu: ${acc.password} | Hạn dùng: ${new Date(
      acc.expiresAt
    ).toLocaleDateString('vi-VN')} (Tối đa ${acc.maxDevices} máy)`;
    navigator.clipboard?.writeText(text).catch(() => {});
    setCopiedId(acc.username);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const startEditing = (acc: UserAccount) => {
    setEditingUsername(acc.username);
    setEditPassword(acc.password);
    setEditDisplayName(acc.displayName);
    setEditMaxDevices(acc.maxDevices);
    const d = new Date(acc.expiresAt);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    setEditExpiryDate(`${yyyy}-${mm}-${dd}`);
  };

  const handleSaveEdit = async (username: string) => {
    const expMs = editExpiryDate ? new Date(`${editExpiryDate}T23:59:59`).getTime() : undefined;
    const res = await accountService.adminUpdateAccount(username, {
      password: editPassword,
      displayName: editDisplayName,
      maxDevices: editMaxDevices,
      expiresAt: expMs && !isNaN(expMs) ? expMs : undefined,
    });
    showNotice(res.success ? 'success' : 'error', res.message);
    setEditingUsername(null);
  };

  const togglePassRow = (username: string) => {
    setVisiblePasswords((prev) => {
      const next = new Set(prev);
      if (next.has(username)) next.delete(username);
      else next.add(username);
      return next;
    });
  };

  const filteredAccounts = accounts.filter((acc) => {
    const q = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !q ||
      acc.username.toLowerCase().includes(q) ||
      acc.displayName.toLowerCase().includes(q);
    if (!matchesSearch) return false;

    const isExpired = acc.role !== 'admin' && Date.now() > acc.expiresAt;
    if (filterStatus === 'active') return acc.status === 'active' && !isExpired;
    if (filterStatus === 'expired') return isExpired;
    if (filterStatus === 'locked') return acc.status === 'locked';
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 w-screen h-screen bg-slate-50 flex flex-col overflow-hidden animate-fade-in">
      <div className="bg-white w-full h-full flex flex-col overflow-hidden">
        {/* Top Header */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 px-4 sm:px-8 py-3.5 text-white flex items-center justify-between shrink-0 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-300 shrink-0">
              <ShieldAlert size={22} />
            </div>
            <div>
              <h2 className="text-base sm:text-xl font-extrabold tracking-tight flex items-center gap-2.5 flex-wrap">
                <span>Quản Trị Tài Khoản & Gia Hạn Hệ Thống (Admin)</span>
                <span className="text-xs bg-amber-500 text-slate-950 font-black px-2.5 py-0.5 rounded-full">
                  {accounts.length} tài khoản
                </span>
              </h2>
              <p className="text-xs text-slate-300">
                Tạo tài khoản mới, xem tên đăng nhập & mật khẩu, gia hạn sử dụng và kiểm soát tối đa 2 máy đăng nhập
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-extrabold transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm"
              title="Đóng cửa sổ quản lý tài khoản"
            >
              <X size={16} />
              <span>Đóng</span>
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 lg:px-8 overflow-y-auto space-y-5 flex-1 bg-slate-50">
          {bannerMsg && (
            <div
              className={`px-4 py-3 rounded-2xl text-xs font-extrabold flex items-center justify-between border shadow-xs ${
                bannerMsg.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-rose-50 border-rose-200 text-rose-800'
              }`}
            >
              <span className="flex items-center gap-2">
                <Sparkles size={16} />
                <span>{bannerMsg.text}</span>
              </span>
              <button onClick={() => setBannerMsg(null)} className="text-slate-400 hover:text-slate-700">
                <X size={14} />
              </button>
            </div>
          )}

          {/* 1. CREATE NEW ACCOUNT CARD */}
          <form
            onSubmit={handleCreateAccount}
            className="bg-white border border-indigo-200/80 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-indigo-700 flex items-center gap-1.5">
                <UserPlus size={15} />
                <span>Tạo Tài Khoản Mới Cho Giáo Viên / Người Dùng</span>
              </h3>
              <button
                type="button"
                onClick={() => {
                  const randomPass = Math.random().toString(36).slice(-6);
                  setNewPassword(randomPass);
                }}
                className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-2.5 py-1 rounded-lg cursor-pointer"
              >
                🎲 Tạo mật khẩu ngẫu nhiên
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Tên đăng nhập *
                </label>
                <input
                  type="text"
                  required
                  value={newUsername}
                  onChange={(e) =>
                    setNewUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_\-]/g, ''))
                  }
                  placeholder="VD: giaovien2"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono font-bold text-slate-900 focus:border-indigo-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Mật khẩu *
                </label>
                <input
                  type="text"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Nhập mật khẩu"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono font-bold text-indigo-700 bg-indigo-50/40 focus:border-indigo-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Tên hiển thị
                </label>
                <input
                  type="text"
                  value={newDisplayName}
                  onChange={(e) => setNewDisplayName(e.target.value)}
                  placeholder="VD: Cô Trần Thị B"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-900 focus:border-indigo-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Thời hạn sử dụng
                </label>
                <select
                  value={newDurationDays}
                  onChange={(e) => setNewDurationDays(Number(e.target.value))}
                  className="w-full px-2.5 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-800 bg-white outline-none"
                >
                  <option value={7}>7 ngày (Dùng thử)</option>
                  <option value={30}>1 tháng (30 ngày)</option>
                  <option value={90}>3 tháng (90 ngày)</option>
                  <option value={180}>6 tháng (180 ngày)</option>
                  <option value={365}>1 năm (365 ngày)</option>
                  <option value={3650}>Vĩnh viễn (10 năm)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Giới hạn thiết bị & Quyền
                </label>
                <div className="flex items-center gap-1.5">
                  <select
                    value={newMaxDevices}
                    onChange={(e) => setNewMaxDevices(Number(e.target.value))}
                    className="w-1/2 px-2 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-800 bg-white outline-none"
                    title="Số máy đăng nhập tối đa"
                  >
                    <option value={1}>1 máy</option>
                    <option value={2}>2 máy</option>
                    <option value={3}>3 máy</option>
                    <option value={5}>5 máy</option>
                  </select>
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value as 'user' | 'admin')}
                    className="w-1/2 px-2 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-800 bg-white outline-none"
                  >
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
              </div>

              <div className="flex items-end">
                <button
                  type="submit"
                  className="w-full py-2 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs shadow-sm transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <UserPlus size={15} />
                  <span>Tạo Tài Khoản</span>
                </button>
              </div>
            </div>
          </form>

          {/* 2. FILTER & SEARCH BAR */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
            <div className="flex items-center gap-2 flex-1 min-w-[220px]">
              <div className="relative flex-1 max-w-xs">
                <Search
                  size={15}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Tìm theo tên đăng nhập hoặc tên hiển thị..."
                  className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800 focus:border-indigo-500 outline-none"
                />
              </div>

              <div className="flex items-center bg-slate-100 p-1 rounded-xl gap-1">
                {(
                  [
                    { id: 'all', label: 'Tất cả' },
                    { id: 'active', label: 'Còn hạn' },
                    { id: 'expired', label: 'Hết hạn' },
                    { id: 'locked', label: 'Đang khóa' },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setFilterStatus(tab.id)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                      filterStatus === tab.id
                        ? 'bg-white text-indigo-700 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowAllPasswords(!showAllPasswords)}
              className="px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-extrabold flex items-center gap-1.5 cursor-pointer"
            >
              {showAllPasswords ? <EyeOff size={14} /> : <Eye size={14} />}
              <span>{showAllPasswords ? 'Ẩn tất cả mật khẩu' : 'Hiện tất cả mật khẩu'}</span>
            </button>
          </div>

          {/* 3. ACCOUNTS TABLE */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100/90 border-b border-slate-200 text-[11px] font-extrabold text-slate-600 uppercase tracking-wider">
                    <th className="py-3 px-4">Người dùng</th>
                    <th className="py-3 px-4">Tên đăng nhập & Mật khẩu</th>
                    <th className="py-3 px-4">Thời hạn & Gia hạn nhanh</th>
                    <th className="py-3 px-4">Thiết bị (Tối đa 2 máy)</th>
                    <th className="py-3 px-4 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/70 text-xs">
                  {filteredAccounts.map((acc) => {
                    const isPassShown = showAllPasswords || visiblePasswords.has(acc.username);
                    const devices = parseActiveDevices(acc);
                    const daysLeft = Math.ceil((acc.expiresAt - Date.now()) / 86400000);
                    const isExpired = acc.role !== 'admin' && daysLeft <= 0;
                    const isEditing = editingUsername === acc.username;

                    return (
                      <tr
                        key={acc.username}
                        className={`hover:bg-slate-50/80 transition-colors ${
                          acc.status === 'locked' ? 'bg-rose-50/30' : ''
                        }`}
                      >
                        {/* User Avatar & Display Name */}
                        <td className="py-3 px-4 align-middle">
                          <div className="flex items-center gap-2.5">
                            <img
                              src={acc.avatar || PRESET_AVATARS[1].url}
                              alt={acc.displayName}
                              className="w-10 h-10 rounded-full object-cover border border-slate-300 bg-white shrink-0"
                            />
                            <div>
                              {isEditing ? (
                                <input
                                  type="text"
                                  value={editDisplayName}
                                  onChange={(e) => setEditDisplayName(e.target.value)}
                                  className="px-2 py-1 rounded-lg border border-indigo-400 text-xs font-bold w-36"
                                />
                              ) : (
                                <div className="font-extrabold text-slate-900 flex items-center gap-1.5">
                                  <span>{acc.displayName}</span>
                                  {acc.role === 'admin' && (
                                    <span className="text-[10px] bg-indigo-100 text-indigo-700 font-black px-1.5 py-0.2 rounded">
                                      ADMIN
                                    </span>
                                  )}
                                  {acc.status === 'locked' && (
                                    <span className="text-[10px] bg-rose-100 text-rose-700 font-black px-1.5 py-0.2 rounded">
                                      ĐÃ KHÓA
                                    </span>
                                  )}
                                </div>
                              )}
                              <div className="text-[11px] text-slate-400">
                                Quyền: {acc.role === 'admin' ? 'Quản trị viên' : 'Giáo viên'}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Username & Password */}
                        <td className="py-3 px-4 align-middle">
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] font-bold text-slate-400 uppercase w-14">
                                Tài khoản:
                              </span>
                              <span className="font-mono font-extrabold text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                                {acc.username}
                              </span>
                            </div>

                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] font-bold text-slate-400 uppercase w-14">
                                Mật khẩu:
                              </span>
                              {isEditing ? (
                                <input
                                  type="text"
                                  value={editPassword}
                                  onChange={(e) => setEditPassword(e.target.value)}
                                  className="px-2 py-0.5 rounded border border-indigo-400 font-mono font-bold text-xs w-28"
                                />
                              ) : (
                                <span className="font-mono font-extrabold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                                  {isPassShown ? acc.password : '••••••••'}
                                </span>
                              )}

                              <button
                                type="button"
                                onClick={() => togglePassRow(acc.username)}
                                className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
                                title="Ẩn/Hiện mật khẩu"
                              >
                                {isPassShown ? <EyeOff size={13} /> : <Eye size={13} />}
                              </button>

                              <button
                                type="button"
                                onClick={() => handleCopyCredentials(acc)}
                                className="p-1 text-indigo-600 hover:bg-indigo-50 rounded cursor-pointer flex items-center gap-0.5 text-[10px] font-bold"
                                title="Sao chép Tên đăng nhập & Mật khẩu"
                              >
                                {copiedId === acc.username ? (
                                  <>
                                    <Check size={13} className="text-emerald-600" />
                                    <span className="text-emerald-600">Đã chép</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy size={13} />
                                    <span>Copy</span>
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        </td>

                        {/* Expiration & Quick Renewal */}
                        <td className="py-3 px-4 align-middle">
                          <div className="space-y-1.5">
                            {isEditing ? (
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="date"
                                  value={editExpiryDate}
                                  onChange={(e) => setEditExpiryDate(e.target.value)}
                                  className="px-2 py-1 rounded-lg border border-indigo-400 text-xs font-bold"
                                />
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[11px] font-extrabold ${
                                    acc.role === 'admin'
                                      ? 'bg-indigo-100 text-indigo-800'
                                      : isExpired
                                      ? 'bg-rose-100 text-rose-700'
                                      : daysLeft <= 7
                                      ? 'bg-amber-100 text-amber-800'
                                      : 'bg-emerald-100 text-emerald-800'
                                  }`}
                                >
                                  {acc.role === 'admin'
                                    ? 'Vĩnh viễn'
                                    : isExpired
                                    ? `Đã hết hạn (${Math.abs(daysLeft)} ngày trước)`
                                    : `Còn ${daysLeft} ngày`}
                                </span>
                                <span className="text-[11px] text-slate-500 font-medium">
                                  ({new Date(acc.expiresAt).toLocaleDateString('vi-VN')})
                                </span>
                              </div>
                            )}

                            {/* Quick Extend Buttons */}
                            <div className="flex items-center gap-1 flex-wrap">
                              <span className="text-[10px] font-bold text-slate-400 flex items-center gap-0.5 mr-1">
                                <CalendarPlus size={11} />
                                Gia hạn:
                              </span>
                              {[
                                { label: '+1 Tháng', days: 30 },
                                { label: '+3 Tháng', days: 90 },
                                { label: '+6 Tháng', days: 180 },
                                { label: '+1 Năm', days: 365 },
                              ].map((btn) => (
                                <button
                                  key={btn.days}
                                  type="button"
                                  onClick={() => handleQuickExtend(acc.username, btn.days)}
                                  className="px-2 py-0.5 rounded-md bg-emerald-50 hover:bg-emerald-600 hover:text-white text-emerald-700 border border-emerald-200 text-[10px] font-extrabold transition-colors cursor-pointer"
                                >
                                  {btn.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        </td>

                        {/* Devices (Max 2 machines) */}
                        <td className="py-3 px-4 align-middle">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[11px] font-extrabold flex items-center gap-1 ${
                                  devices.length >= acc.maxDevices
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-sky-100 text-sky-800'
                                }`}
                              >
                                <Laptop size={12} />
                                <span>
                                  {devices.length} /{' '}
                                  {isEditing ? (
                                    <input
                                      type="number"
                                      min={1}
                                      max={10}
                                      value={editMaxDevices}
                                      onChange={(e) => setEditMaxDevices(Number(e.target.value))}
                                      className="w-10 px-1 rounded border border-indigo-400 text-center"
                                    />
                                  ) : (
                                    acc.maxDevices
                                  )}{' '}
                                  máy
                                </span>
                              </span>

                              {devices.length > 0 && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    accountService.adminResetDevices(acc.username);
                                    showNotice(
                                      'success',
                                      `Đã đăng xuất tất cả thiết bị của "${acc.username}"!`
                                    );
                                  }}
                                  className="px-2 py-0.5 rounded-md bg-slate-100 hover:bg-rose-100 text-slate-600 hover:text-rose-700 text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                                  title="Reset thiết bị về 0/2 máy"
                                >
                                  <RotateCcw size={11} />
                                  <span>Reset máy</span>
                                </button>
                              )}
                            </div>

                            {devices.length > 0 ? (
                              <div className="text-[10px] text-slate-500 space-y-0.5">
                                {devices.map((d, i) => (
                                  <div key={d.deviceId} className="truncate max-w-[180px]">
                                    • Máy {i + 1}: {d.deviceName}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="text-[10px] text-slate-400 italic">
                                Chưa có máy nào đăng nhập
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-4 align-middle text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {isEditing ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleSaveEdit(acc.username)}
                                  className="px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1 cursor-pointer"
                                >
                                  <Save size={13} />
                                  <span>Lưu</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingUsername(null)}
                                  className="px-2 py-1.5 rounded-xl bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer"
                                >
                                  Hủy
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={() => startEditing(acc)}
                                  className="p-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-600 transition-colors cursor-pointer"
                                  title="Sửa mật khẩu / tên hiển thị / hạn dùng"
                                >
                                  <Edit3 size={15} />
                                </button>

                                {acc.username !== 'admin' && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        accountService.adminUpdateAccount(acc.username, {
                                          status: acc.status === 'locked' ? 'active' : 'locked',
                                        })
                                      }
                                      className={`p-1.5 rounded-xl transition-colors cursor-pointer ${
                                        acc.status === 'locked'
                                          ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                                          : 'bg-amber-50 text-amber-600 hover:bg-amber-100'
                                      }`}
                                      title={
                                        acc.status === 'locked'
                                          ? 'Mở khóa tài khoản'
                                          : 'Khóa tài khoản tạm thời'
                                      }
                                    >
                                      {acc.status === 'locked' ? (
                                        <Unlock size={15} />
                                      ) : (
                                        <Lock size={15} />
                                      )}
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => {
                                        accountService.adminDeleteAccount(acc.username);
                                        showNotice('success', `Đã xóa tài khoản "${acc.username}"`);
                                      }}
                                      className="p-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 transition-colors cursor-pointer"
                                      title="Xóa tài khoản"
                                    >
                                      <Trash2 size={15} />
                                    </button>
                                  </>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                  {filteredAccounts.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-400 font-medium">
                        Không tìm thấy tài khoản nào phù hợp.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
