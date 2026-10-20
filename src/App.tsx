/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from 'react';
import { Student, GameMode, PickerGameMode, ClassGroup } from './types';
import {
  loadSavedStudents,
  loadSavedStudentsAsync,
  saveStudents,
  loadSavedClasses,
  loadSavedClassesAsync,
  saveClasses,
  STORAGE_ACTIVE_CLASS_KEY,
} from './utils/defaultData';
import { sound } from './services/sound';
import { LuckyWheel } from './components/LuckyWheel';
import { CarouselSelector } from './components/CarouselSelector';
import { VisualRace } from './components/VisualRace';
import { Space3DSelector } from './components/Space3DSelector';
import { ZigZagPickerGame } from './components/ZigZagPickerGame';
import { ClassroomQuiz } from './components/ClassroomQuiz';
import { TugOfWarGame } from './components/TugOfWarGame';
import { StudentManager } from './components/StudentManager';
import { WinnerModal } from './components/WinnerModal';
import { MusicManagerModal } from './components/MusicManagerModal';
import { AuthModal } from './components/AuthModal';
import { UserProfileModal } from './components/UserProfileModal';
import { AdminAccountModal } from './components/AdminAccountModal';
import { PWAInstallButton, OfflineIndicator } from './components/PWAInstallButton';
import { DataBackupModal } from './components/DataBackupModal';
import { accountService, UserAccount, PRESET_AVATARS } from './services/accountService';
import {
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  Users,
  Compass,
  LayoutGrid,
  Flag,
  Orbit,
  Sparkles,
  School,
  HelpCircle,
  ChevronDown,
  Dices,
  BookOpen,
  Swords,
  Shuffle,
  Music,
  LogIn,
  UserPlus,
  LogOut,
  ShieldAlert,
  Settings,
  Database,
} from 'lucide-react';

export default function App() {
  const [classes, setClasses] = useState<ClassGroup[]>(() => loadSavedClasses());
  const [selectedClass, setSelectedClass] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_ACTIVE_CLASS_KEY);
      if (saved) return saved;
    } catch {}
    return 'Lớp 6A1';
  });

  const [students, setStudents] = useState<Student[]>(() => loadSavedStudents());
  const [currentMode, setCurrentMode] = useState<GameMode>('wheel');
  const [lastPickerMode, setLastPickerMode] = useState<PickerGameMode>('wheel');
  const [isPickerDropdownOpen, setIsPickerDropdownOpen] = useState<boolean>(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  const [isMuted, setIsMuted] = useState<boolean>(() => sound.getMuted());
  const [isMusicModalOpen, setIsMusicModalOpen] = useState<boolean>(false);
  const [isBackupModalOpen, setIsBackupModalOpen] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const isInitialDbLoadedRef = useRef<boolean>(false);

  // Repeat prevention & Fly duration settings
  const [noRepeat, setNoRepeat] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('classroom_picker_no_repeat');
      if (saved !== null) return JSON.parse(saved);
    } catch {}
    return true;
  });

  const [flyDuration, setFlyDuration] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('classroom_picker_fly_duration');
      if (saved !== null) return JSON.parse(saved);
    } catch {}
    return 2.0;
  });

  // Winner celebration state
  const [winnerModalOpen, setWinnerModalOpen] = useState<boolean>(false);
  const [currentWinner, setCurrentWinner] = useState<Student | null>(null);

  // Account & Auth Modal states
  const [currentAccount, setCurrentAccount] = useState<UserAccount | null>(() =>
    accountService.getCurrentAccount()
  );
  const [authModalOpen, setAuthModalOpen] = useState<boolean>(false);
  const [authInitialTab, setAuthInitialTab] = useState<'login' | 'register'>('login');
  const [profileModalOpen, setProfileModalOpen] = useState<boolean>(false);
  const [adminModalOpen, setAdminModalOpen] = useState<boolean>(false);
  const [isAccountDropdownOpen, setIsAccountDropdownOpen] = useState<boolean>(false);
  const accountDropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const syncAccount = () => {
      setCurrentAccount(accountService.getCurrentAccount());
    };
    syncAccount();
    return accountService.subscribe(syncAccount);
  }, []);

  // Load full student list (including high-res avatars) & classes from IndexedDB on startup
  useEffect(() => {
    let mounted = true;
    Promise.all([loadSavedStudentsAsync(), loadSavedClassesAsync()])
      .then(([dbStudents, dbClasses]) => {
        if (!mounted) return;
        if (dbStudents && dbStudents.length > 0) {
          setStudents(dbStudents);
        } else {
          saveStudents(students);
        }
        if (dbClasses && dbClasses.length > 0) {
          setClasses(dbClasses);
        } else {
          saveClasses(classes);
        }
        isInitialDbLoadedRef.current = true;
      })
      .catch(() => {
        isInitialDbLoadedRef.current = true;
      });
    return () => {
      mounted = false;
    };
  }, []);

  // Save changes to IndexedDB + localStorage only after initial DB hydration completes
  useEffect(() => {
    if (!isInitialDbLoadedRef.current) return;
    saveStudents(students);
  }, [students]);

  useEffect(() => {
    if (!isInitialDbLoadedRef.current) return;
    saveClasses(classes);
  }, [classes]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_ACTIVE_CLASS_KEY, selectedClass);
    } catch {}
  }, [selectedClass]);

  useEffect(() => {
    try {
      localStorage.setItem('classroom_picker_no_repeat', JSON.stringify(noRepeat));
    } catch {}
  }, [noRepeat]);

  useEffect(() => {
    try {
      localStorage.setItem('classroom_picker_fly_duration', JSON.stringify(flyDuration));
    } catch {}
  }, [flyDuration]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsPickerDropdownOpen(false);
      }
      if (accountDropdownRef.current && !accountDropdownRef.current.contains(e.target as Node)) {
        setIsAccountDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Lock body overflow in single-screen modes to guarantee zero-scroll viewport fitting
  useEffect(() => {
    const isSingleScreen = currentMode === 'space3d' || currentMode === 'race' || currentMode === 'wheel' || currentMode === 'ziczac' || currentMode === 'quiz' || currentMode === 'tugofwar';
    if (isSingleScreen) {
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    };
  }, [currentMode]);

  // Fullscreen listener
  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  const handleToggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  const handleToggleSound = () => {
    const muted = sound.toggleMute();
    setIsMuted(muted);
  };

  // Winner selected from games
  const handleSelectWinner = (student: Student, openModal: boolean = true) => {
    const updated = students.map((s) =>
      s.id === student.id
        ? { ...s, called: true, calledCount: (s.calledCount || 0) + 1 }
        : s
    );
    setStudents(updated);
    setCurrentWinner(student);
    if (openModal) {
      setWinnerModalOpen(true);
    }
  };

  // Re-call / un-tick student
  const handleRecallStudent = (student: Student) => {
    const updated = students.map((s) =>
      s.id === student.id
        ? { ...s, called: false, calledCount: Math.max(0, (s.calledCount || 1) - 1) }
        : s
    );
    setStudents(updated);
  };

  // Reset called statuses for CURRENT class only
  const handleResetCalled = () => {
    const updated = students.map((s) => {
      if (selectedClass === 'ALL' || s.className === selectedClass) {
        return { ...s, called: false };
      }
      return s;
    });
    setStudents(updated);
    sound.playTick(1.2);
  };

  // Switch picker mode
  const selectPickerMode = (mode: PickerGameMode) => {
    setLastPickerMode(mode);
    setCurrentMode(mode);
    setIsPickerDropdownOpen(false);
  };

  // Check if active mode is one of the picker game modes
  const isPickerActive = ['wheel', 'carousel', 'race', 'space3d', 'ziczac'].includes(currentMode);

  const pickerGames = [
    { id: 'wheel' as PickerGameMode, name: 'Vòng Quay May Mắn', icon: Compass, color: 'text-sky-600', badgeBg: 'bg-sky-50' },
    { id: 'race' as PickerGameMode, name: 'Cuộc Đua Siêu Cấp', icon: Flag, color: 'text-emerald-600', badgeBg: 'bg-emerald-50' },
    { id: 'ziczac' as PickerGameMode, name: 'Đua Ziczac Vượt Ải', icon: Shuffle, color: 'text-purple-600', badgeBg: 'bg-purple-50' },
    { id: 'carousel' as PickerGameMode, name: 'Băng Chuyền Thẻ Tên', icon: LayoutGrid, color: 'text-amber-600', badgeBg: 'bg-amber-50' },
    { id: 'space3d' as PickerGameMode, name: 'Không Gian Vũ Trụ 3D', icon: Orbit, color: 'text-indigo-600', badgeBg: 'bg-indigo-50' },
  ];

  const activePickerGame = pickerGames.find((g) => g.id === (isPickerActive ? currentMode : lastPickerMode)) || pickerGames[0];

  // Active students for games based on selected class
  const activeClassStudents = selectedClass === 'ALL'
    ? students
    : students.filter((s) => s.className === selectedClass);

  // Callable students excluding absent/excluded students
  const callableStudents = activeClassStudents.filter((s) => !s.excluded);
  const excludedCount = activeClassStudents.filter((s) => s.excluded).length;

  const calledCount = callableStudents.filter((s) => s.called).length;
  const uncalledCount = callableStudents.length - calledCount;

  return (
    <div
      className={`bg-slate-100/70 text-slate-800 flex flex-col selection:bg-amber-200 ${
        currentMode === 'space3d' || currentMode === 'race' || currentMode === 'wheel' || currentMode === 'quiz' || currentMode === 'tugofwar' || currentMode === 'ziczac'
          ? 'h-screen max-h-screen overflow-hidden'
          : 'min-h-screen'
      }`}
    >
      {/* Top Header */}
      <header className="shrink-0 sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 px-2 sm:px-3.5 py-1.5 transition-shadow shadow-xs">
        <div className="w-full mx-auto flex flex-wrap xl:flex-nowrap items-center justify-between gap-1.5 sm:gap-2">
          {/* Zone 1: Wordmark / Brand & Class Quick Switcher */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <div className="flex items-center gap-1.5">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-gradient-to-tr from-sky-600 to-indigo-600 text-white flex items-center justify-center font-black text-xs sm:text-sm shadow-sm shrink-0">
                CP
              </div>
              <div className="hidden 2xl:block">
                <h1 className="text-xs font-extrabold tracking-tight text-slate-900 leading-tight">
                  Classroom Picker
                </h1>
                <div className="text-[9px] text-slate-500 font-medium">
                  Gọi Tên & Học Tập Vui
                </div>
              </div>
            </div>

            {/* Class / Grade Selector Dropdown */}
            <div className="flex items-center gap-1 bg-indigo-50 border border-indigo-200 px-2 py-1 rounded-xl shadow-2xs">
              <School size={13} className="text-indigo-600 shrink-0" />
              <div className="flex flex-col">
                <span className="text-[8px] font-bold text-indigo-700 uppercase tracking-wider leading-none">
                  Lớp đang chọn
                </span>
                <select
                  value={selectedClass}
                  onChange={(e) => setSelectedClass(e.target.value)}
                  className="bg-transparent text-[11px] sm:text-xs font-black text-slate-900 outline-none cursor-pointer pr-0.5 max-w-[135px] sm:max-w-[165px] truncate"
                >
                  <option value="ALL">
                    {classes.length > 1
                      ? `Tất cả (${classes.length} lớp · ${students.length} em)`
                      : `Tất cả học sinh (${students.length} em)`}
                  </option>
                  {classes.map((cls) => {
                    const count = students.filter((s) => s.className === cls.name).length;
                    return (
                      <option key={cls.id} value={cls.name}>
                        {cls.name} - {cls.grade} ({count} em)
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>
          </div>

          {/* Zone 2: Primary Clean Navigation Tabs */}
          <nav className="hidden md:flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200/80 gap-0.5 shrink-0">
            {/* TAB 1: Trò Chơi Gọi Tên (Dropdown List of 4 picker games) */}
            <div className="relative" ref={dropdownRef}>
              <div className="flex items-center">
                <button
                  onClick={() => {
                    if (!isPickerActive) {
                      setCurrentMode(lastPickerMode);
                    } else {
                      setIsPickerDropdownOpen(!isPickerDropdownOpen);
                    }
                  }}
                  className={`px-2.5 py-1.5 text-xs font-bold rounded-l-lg transition-all flex items-center gap-1 whitespace-nowrap cursor-pointer ${
                    isPickerActive
                      ? 'bg-white text-indigo-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                  }`}
                >
                  <Dices size={14} className={isPickerActive ? 'text-indigo-600' : 'text-slate-500'} />
                  <span>Trò Chơi Gọi Tên</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded font-extrabold ${
                    isPickerActive ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-200 text-slate-600'
                  }`}>
                    {activePickerGame.name.split(' ')[0]}
                  </span>
                </button>

                <button
                  onClick={() => setIsPickerDropdownOpen(!isPickerDropdownOpen)}
                  className={`px-1.5 py-1.5 text-xs font-bold rounded-r-lg border-l transition-all flex items-center justify-center cursor-pointer ${
                    isPickerActive
                      ? 'bg-white text-indigo-700 border-indigo-100 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 border-slate-200'
                  }`}
                  title="Chọn loại trò chơi gọi tên"
                >
                  <ChevronDown size={13} className={`transition-transform duration-200 ${isPickerDropdownOpen ? 'rotate-180' : ''}`} />
                </button>
              </div>

              {/* Dropdown Menu of Picker Games */}
              {isPickerDropdownOpen && (
                <div className="absolute top-full left-0 mt-1.5 w-60 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 p-1.5 animate-fade-in flex flex-col gap-1">
                  <div className="px-2 py-1 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                    Danh Sách Trò Chơi Gọi Tên
                  </div>
                  {pickerGames.map((game) => {
                    const IconComp = game.icon;
                    const isSelected = isPickerActive && currentMode === game.id;
                    return (
                      <button
                        key={game.id}
                        onClick={() => selectPickerMode(game.id)}
                        className={`w-full flex items-center justify-between p-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-indigo-50 text-indigo-900 border border-indigo-200 shadow-2xs'
                            : 'text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <div className={`p-1.5 rounded-lg ${game.badgeBg}`}>
                            <IconComp size={15} className={game.color} />
                          </div>
                          <span>{game.name}</span>
                        </div>
                        {isSelected && <span className="text-[10px] bg-indigo-600 text-white font-black px-1.5 py-0.2 rounded-full">Đang mở</span>}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* TAB 2: Kéo Co, Đua Về Đích & Leo Núi 2 Đội */}
            <button
              onClick={() => {
                setCurrentMode('quiz');
                setIsPickerDropdownOpen(false);
              }}
              className={`px-2.5 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1 whitespace-nowrap cursor-pointer ${
                currentMode === 'quiz'
                  ? 'bg-white text-rose-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <span className="text-xs">🪢</span>
              <span>Kéo Co & Đua 2 Đội</span>
            </button>

            {/* TAB 3: Quản Lý Danh Sách */}
            <button
              onClick={() => {
                setCurrentMode('students');
                setIsPickerDropdownOpen(false);
              }}
              className={`px-2.5 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1 whitespace-nowrap cursor-pointer ${
                currentMode === 'students'
                  ? 'bg-white text-sky-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <Users size={14} className={currentMode === 'students' ? 'text-sky-600' : 'text-slate-500'} />
              <span>Quản Lý Danh Sách</span>
            </button>
          </nav>

          {/* Zone 3: Metrics, Utilities & Unified Account Controls */}
          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0 ml-auto xl:ml-0">
            {/* Compact Status counter (for picker modes) */}
            {isPickerActive && (
              <div className="hidden 2xl:flex items-center gap-1 text-[11px] font-medium text-slate-500 bg-slate-50 border border-slate-200 px-2 py-1 rounded-xl shrink-0">
                <span>{noRepeat ? 'Chưa gọi:' : 'Đủ:'}</span>
                <span className="font-bold text-sky-600 font-mono tabular-nums">
                  {noRepeat ? uncalledCount : callableStudents.length}
                </span>
                <span>/</span>
                <span className="font-bold text-slate-700 font-mono tabular-nums">{callableStudents.length}</span>
              </div>
            )}

            {/* PWA Install / Offline Play Button */}
            <PWAInstallButton />

            {/* Data Backup & Restore */}
            <button
              onClick={() => setIsBackupModalOpen(true)}
              className="px-2 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors cursor-pointer flex items-center gap-1 text-xs font-bold shrink-0"
              title="Sao lưu & Khôi phục toàn bộ Học sinh, Ảnh, Nhạc nền và Ảnh Kéo co"
              aria-label="Sao lưu dữ liệu"
            >
              <Database size={14} />
              <span className="hidden lg:inline">Sao Lưu</span>
            </button>

            {/* Music Manager */}
            <button
              onClick={() => setIsMusicModalOpen(true)}
              className="px-2 py-1.5 rounded-xl bg-purple-50 text-purple-600 border border-purple-200 hover:bg-purple-100 transition-colors cursor-pointer flex items-center gap-1 text-xs font-bold shrink-0"
              title="Quản lý & Tải nhạc nền trò chơi"
              aria-label="Tải nhạc nền"
            >
              <Music size={14} />
              <span className="hidden lg:inline">Tải Nhạc</span>
            </button>

            {/* Sound toggle */}
            <button
              onClick={handleToggleSound}
              className={`p-1.5 rounded-xl border transition-colors cursor-pointer shrink-0 ${
                isMuted
                  ? 'bg-slate-100 text-slate-400 border-slate-200 hover:bg-slate-200'
                  : 'bg-sky-50 text-sky-600 border-sky-200 hover:bg-sky-100'
              }`}
              title={isMuted ? 'Bật âm thanh' : 'Tắt âm thanh'}
              aria-label="Toggle Sound"
            >
              {isMuted ? <VolumeX size={15} /> : <Volume2 size={15} />}
            </button>

            {/* Fullscreen toggle */}
            <button
              onClick={handleToggleFullscreen}
              className="p-1.5 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
              title={isFullscreen ? 'Thoát toàn màn hình' : 'Toàn màn hình trình chiếu'}
              aria-label="Toggle Fullscreen"
            >
              {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
            </button>

            {/* ACCOUNT MENU: 1 nút menu duy nhất (Chưa đăng nhập -> hiển thị "Tài Khoản" gồm Đăng nhập & Đăng ký; Đã đăng nhập -> hiển thị Tên người dùng gồm Hồ sơ, Quản lý TK & Đăng xuất) */}
            <div className="relative shrink-0" ref={accountDropdownRef}>
              <button
                type="button"
                onClick={() => setIsAccountDropdownOpen(!isAccountDropdownOpen)}
                className="flex items-center gap-2 pl-1.5 pr-2.5 py-1 rounded-xl bg-indigo-50/90 hover:bg-indigo-100 border border-indigo-200 transition-colors cursor-pointer shadow-2xs"
              >
                {currentAccount ? (
                  <>
                    <img
                      src={currentAccount.avatar || PRESET_AVATARS[1].url}
                      alt={currentAccount.displayName}
                      className="w-7 h-7 rounded-full object-cover border border-indigo-400 bg-white shrink-0"
                    />
                    <div className="flex flex-col items-start leading-none">
                      <span className="text-xs font-extrabold text-slate-900 max-w-[160px] truncate">
                        {currentAccount.displayName}
                      </span>
                      <span className="text-[9px] font-bold text-indigo-600 mt-0.5">
                        {currentAccount.role === 'admin'
                          ? '👑 Admin'
                          : `Còn ${Math.max(
                              0,
                              Math.ceil((currentAccount.expiresAt - Date.now()) / 86400000)
                            )} ngày`}
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="w-7 h-7 rounded-full bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                      <Users size={14} />
                    </div>
                    <div className="flex flex-col items-start leading-none">
                      <span className="text-xs font-extrabold text-slate-900">
                        Tài Khoản
                      </span>
                      <span className="text-[9px] font-bold text-slate-500 mt-0.5">
                        Đăng nhập / Đăng ký
                      </span>
                    </div>
                  </>
                )}
                <ChevronDown
                  size={14}
                  className={`text-slate-500 transition-transform ${
                    isAccountDropdownOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {/* Dropdown Menu */}
              {isAccountDropdownOpen && (
                <div className="absolute right-0 top-full mt-1.5 w-64 bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 p-2 animate-fade-in flex flex-col gap-1 text-slate-800">
                  {currentAccount ? (
                    <>
                      <div className="px-2.5 py-2 rounded-xl bg-slate-50 border border-slate-200/80 mb-1 flex items-center gap-2.5">
                        <img
                          src={currentAccount.avatar || PRESET_AVATARS[1].url}
                          alt={currentAccount.displayName}
                          className="w-9 h-9 rounded-full object-cover border border-indigo-300 bg-white shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-extrabold text-slate-900 truncate">
                            {currentAccount.displayName}
                          </div>
                          <div className="text-[10px] font-mono text-slate-500 truncate">
                            @{currentAccount.username} •{' '}
                            {currentAccount.role === 'admin' ? 'Quản trị viên' : 'Giáo viên'}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setIsAccountDropdownOpen(false);
                          setProfileModalOpen(true);
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors cursor-pointer text-left"
                      >
                        <Settings size={15} className="text-indigo-600 shrink-0" />
                        <span>Đổi Avatar, Tên & Mật khẩu</span>
                      </button>

                      {currentAccount.role === 'admin' && (
                        <button
                          type="button"
                          onClick={() => {
                            setIsAccountDropdownOpen(false);
                            setAdminModalOpen(true);
                          }}
                          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-extrabold text-amber-800 bg-amber-50/70 hover:bg-amber-100 transition-colors cursor-pointer text-left"
                        >
                          <ShieldAlert size={15} className="text-amber-600 shrink-0" />
                          <span>Quản Lý & Gia Hạn Tài Khoản</span>
                        </button>
                      )}

                      <div className="my-0.5 border-t border-slate-100" />

                      <button
                        type="button"
                        onClick={() => {
                          setIsAccountDropdownOpen(false);
                          accountService.logout();
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-extrabold text-rose-600 bg-rose-50/60 hover:bg-rose-100 transition-colors cursor-pointer text-left"
                      >
                        <LogOut size={15} className="text-rose-600 shrink-0" />
                        <span>Đăng xuất tài khoản</span>
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="px-2.5 py-1.5 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                        Tài Khoản Người Dùng
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setIsAccountDropdownOpen(false);
                          setAuthInitialTab('login');
                          setAuthModalOpen(true);
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-extrabold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors cursor-pointer text-left shadow-xs"
                      >
                        <LogIn size={15} className="shrink-0" />
                        <span>Đăng nhập tài khoản</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsAccountDropdownOpen(false);
                          setAuthInitialTab('register');
                          setAuthModalOpen(true);
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-extrabold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-colors cursor-pointer text-left"
                      >
                        <UserPlus size={15} className="text-emerald-600 shrink-0" />
                        <span>Đăng ký tài khoản mới</span>
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Mobile Navigation bar */}
        <div className="flex md:hidden overflow-x-auto gap-1.5 pt-2 mt-1 border-t border-slate-100 pb-0.5">
          <select
            value={isPickerActive ? currentMode : 'inactive'}
            onChange={(e) => {
              if (e.target.value !== 'inactive') {
                selectPickerMode(e.target.value as PickerGameMode);
              }
            }}
            className={`px-2.5 py-1 text-xs font-bold rounded-lg ${
              isPickerActive ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700'
            }`}
          >
            <option value="inactive" disabled>🎲 Trò Chơi Gọi Tên...</option>
            <option value="wheel">🎡 Vòng Quay</option>
            <option value="race">🐎 Cuộc Đua</option>
            <option value="ziczac">🌀 Đua Ziczac</option>
            <option value="carousel">🎴 Băng Chuyền</option>
            <option value="space3d">🌌 Không Gian 3D</option>
          </select>

          <button
            onClick={() => setCurrentMode('quiz')}
            className={`px-3 py-1 text-xs font-bold rounded-lg whitespace-nowrap ${
              currentMode === 'quiz' ? 'bg-rose-600 text-white' : 'bg-slate-100 text-slate-700'
            }`}
          >
            🪢 Kéo Co & Đua Đội
          </button>

          <button
            onClick={() => setCurrentMode('students')}
            className={`px-3 py-1 text-xs font-bold rounded-lg whitespace-nowrap ${
              currentMode === 'students' ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-700'
            }`}
          >
            Quản Lý Lớp
          </button>
        </div>
      </header>

      {/* Main Content Viewport */}
      <main
        className={`flex-1 min-h-0 w-full mx-auto flex flex-col ${
          currentMode === 'space3d' || currentMode === 'race' || currentMode === 'ziczac' || currentMode === 'quiz'
            ? 'p-1 sm:px-2 w-full max-w-[1800px] h-full overflow-hidden'
            : currentMode === 'wheel'
            ? 'p-1.5 sm:px-4 max-w-[1600px] overflow-hidden justify-center'
            : 'max-w-7xl p-4 sm:p-6 justify-center'
        }`}
      >
        {currentMode === 'wheel' && (
          <LuckyWheel
            students={callableStudents}
            onSelectWinner={(winner) => handleSelectWinner(winner, false)}
            onResetCalled={handleResetCalled}
            noRepeat={noRepeat}
            onToggleNoRepeat={setNoRepeat}
          />
        )}

        {currentMode === 'carousel' && (
          <CarouselSelector
            students={callableStudents}
            onSelectWinner={(winner) => handleSelectWinner(winner, false)}
            onResetCalled={handleResetCalled}
            noRepeat={noRepeat}
            onToggleNoRepeat={setNoRepeat}
          />
        )}

        {currentMode === 'race' && (
          <VisualRace
            students={callableStudents}
            onSelectWinner={(winner) => handleSelectWinner(winner, false)}
            onResetCalled={handleResetCalled}
            noRepeat={noRepeat}
            onToggleNoRepeat={setNoRepeat}
          />
        )}

        {currentMode === 'ziczac' && (
          <ZigZagPickerGame
            students={callableStudents}
            onSelectWinner={(winner) => handleSelectWinner(winner, false)}
            onResetCalled={handleResetCalled}
            noRepeat={noRepeat}
            onToggleNoRepeat={setNoRepeat}
          />
        )}

        {currentMode === 'space3d' && (
          <Space3DSelector
            students={callableStudents}
            onSelectWinner={(winner) => handleSelectWinner(winner, false)}
            onResetCalled={handleResetCalled}
            onRecallStudent={handleRecallStudent}
            noRepeat={noRepeat}
            onToggleNoRepeat={setNoRepeat}
          />
        )}

        {currentMode === 'quiz' && (
          <ClassroomQuiz
            students={callableStudents}
            onSelectWinner={(winner) => handleSelectWinner(winner, false)}
          />
        )}

        {currentMode === 'students' && (
          <StudentManager
            students={students}
            onUpdateStudents={setStudents}
            classes={classes}
            onUpdateClasses={setClasses}
            selectedClass={selectedClass}
            onSelectClass={setSelectedClass}
          />
        )}
      </main>

      {/* Offline Status Toast Indicator */}
      <OfflineIndicator />

      {/* Winner Modal */}
      <WinnerModal
        isOpen={winnerModalOpen}
        winner={currentWinner}
        onClose={() => setWinnerModalOpen(false)}
        onRecallStudent={handleRecallStudent}
        flyDuration={flyDuration}
        onUpdateFlyDuration={setFlyDuration}
      />

      {/* Music Manager Modal */}
      <MusicManagerModal
        isOpen={isMusicModalOpen}
        onClose={() => setIsMusicModalOpen(false)}
      />

      {/* Full Data Backup & Restore Modal */}
      <DataBackupModal
        isOpen={isBackupModalOpen}
        onClose={() => setIsBackupModalOpen(false)}
        students={students}
        classes={classes}
        selectedClass={selectedClass}
        onRestored={({ students: s, classes: c, selectedClass: sc }) => {
          setStudents(s);
          if (c.length > 0) setClasses(c);
          if (sc) setSelectedClass(sc);
        }}
      />

      {/* Auth Modal (Login / Register) */}
      <AuthModal
        isOpen={authModalOpen}
        initialTab={authInitialTab}
        onClose={() => setAuthModalOpen(false)}
      />

      {/* User Profile Modal (Avatar, DisplayName, Password, Devices) */}
      <UserProfileModal
        isOpen={profileModalOpen}
        account={currentAccount}
        onClose={() => setProfileModalOpen(false)}
      />

      {/* Admin Account Management Modal */}
      <AdminAccountModal
        isOpen={adminModalOpen}
        onClose={() => setAdminModalOpen(false)}
      />
    </div>
  );
}
