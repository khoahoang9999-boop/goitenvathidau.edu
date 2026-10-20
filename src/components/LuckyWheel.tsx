import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Student } from '../types';
import { sound } from '../services/sound';
import { getShortName, getInitials } from '../utils/defaultData';
import { ConfettiEngine } from '../services/confetti';
import {
  Play,
  RotateCcw,
  Users,
  Trophy,
  History,
  Trash2,
  Copy,
  Check,
  Clock,
  Sparkles,
  ArrowUpDown,
  X,
  Award,
} from 'lucide-react';

interface LuckyWheelProps {
  students: Student[];
  onSelectWinner: (student: Student) => void;
  onResetCalled: () => void;
  noRepeat?: boolean;
  onToggleNoRepeat?: (val: boolean) => void;
}

export interface SpinHistoryItem {
  id: string;
  roundNumber: number;
  student: Student;
  time: string;
}

const STORAGE_HISTORY_KEY = 'classroom_picker_wheel_history_v1';

export const LuckyWheel: React.FC<LuckyWheelProps> = ({
  students,
  onSelectWinner,
  onResetCalled,
  noRepeat = true,
  onToggleNoRepeat,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const confettiCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const confettiEngineRef = useRef<ConfettiEngine | null>(null);
  const logicalSizeRef = useRef<number>(620);

  // Active students based on noRepeat flag and excluded status
  const activeStudents = (noRepeat ? students.filter((s) => !s.called) : students).filter((s) => !s.excluded);

  // Frozen wheel students to prevent slice count shift after spin
  const [wheelStudents, setWheelStudents] = useState<Student[]>(() => activeStudents);
  const wheelStudentsRef = useRef<Student[]>(activeStudents);
  wheelStudentsRef.current = wheelStudents;

  const [isSpinning, setIsSpinning] = useState<boolean>(false);
  const [spinDuration, setSpinDuration] = useState<number>(6); // seconds
  const [copied, setCopied] = useState<boolean>(false);
  const [sortAscending, setSortAscending] = useState<boolean>(false);
  const [confirmClearAll, setConfirmClearAll] = useState<boolean>(false);

  // Latest Winner Card state shown on the right panel
  const [latestWinner, setLatestWinner] = useState<{
    student: Student;
    roundNumber: number;
    time: string;
  } | null>(null);

  // Spin History List (persisted in localStorage)
  const [spinHistory, setSpinHistory] = useState<SpinHistoryItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_HISTORY_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  });

  // Save history on change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_HISTORY_KEY, JSON.stringify(spinHistory));
    } catch {}
  }, [spinHistory]);

  // Sync wheel students when idle (class change or reset)
  const prevActiveStudentsCountRef = useRef<number>(activeStudents.length);
  const prevStudentIdsRef = useRef<string>(students.map((s) => s.id).join(','));

  useEffect(() => {
    const currentStudentIds = students.map((s) => s.id).join(',');
    const idsChanged = prevStudentIdsRef.current !== currentStudentIds;
    const isReset = activeStudents.length > prevActiveStudentsCountRef.current;

    prevStudentIdsRef.current = currentStudentIds;
    prevActiveStudentsCountRef.current = activeStudents.length;

    // Only auto-sync wheel students if not currently spinning and it's a reset / class switch
    if (!isSpinning && (idsChanged || isReset || wheelStudents.length === 0)) {
      setWheelStudents(activeStudents);
    }
  }, [students, activeStudents, isSpinning, wheelStudents.length]);

  // Physics animation state in ref to avoid React render cycles interfering with RAF
  const spinState = useRef({
    isSpinning: false,
    rotation: 0,
    startRotation: 0,
    targetRotation: 0,
    startTime: 0,
    duration: 6000,
    lastTickIndex: -1,
    rafId: 0,
  });

  // Preloaded image cache for avatars
  const imageCache = useRef<Map<string, HTMLImageElement>>(new Map());

  // Vibrant rich color palette for slices
  const sliceColors = [
    '#3B82F6', '#EF4444', '#10B981', '#F59E0B',
    '#8B5CF6', '#EC4899', '#06B6D4', '#F97316',
    '#14B8A6', '#6366F1', '#84CC16', '#D946EF',
    '#0EA5E9', '#E11D48', '#059669', '#D97706',
    '#7C3AED', '#DB2777', '#0891B2', '#EA580C',
  ];

  // Draw Pointer at Top (12 o'clock position)
  const drawPointer = (ctx: CanvasRenderingContext2D, px: number, py: number) => {
    ctx.save();
    ctx.translate(px, py);

    // Arrow shadow
    ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 4;

    // Arrow shape pointing down into the wheel
    ctx.beginPath();
    ctx.moveTo(0, 26); // tip pointing down into wheel
    ctx.lineTo(-20, -16);
    ctx.lineTo(20, -16);
    ctx.closePath();

    ctx.fillStyle = '#e11d48'; // Bright crimson
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3.5;
    ctx.stroke();

    // Round head pin
    ctx.beginPath();
    ctx.arc(0, -16, 9, 0, Math.PI * 2);
    ctx.fillStyle = '#fbbf24';
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    ctx.restore();
  };

  // Main Wheel Renderer: High-DPI Sharp, Handles up to 50+ students cleanly
  const drawWheel = useCallback(
    (currentAngle: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const d = logicalSizeRef.current || 620;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, d, d);

      const center = d / 2;
      const radius = center - 24;

      const currentPool = wheelStudentsRef.current;

      if (currentPool.length === 0) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(center, center, radius, 0, Math.PI * 2);
        ctx.fillStyle = '#f8fafc';
        ctx.fill();
        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 6;
        ctx.stroke();

        ctx.fillStyle = '#64748b';
        ctx.font = 'bold 20px "Plus Jakarta Sans", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('Đã gọi hết học sinh!', center, center - 16);
        ctx.font = '14px "Plus Jakarta Sans", sans-serif';
        ctx.fillText('Nhấn "Khôi phục tất cả" để tiếp tục', center, center + 16);
        ctx.restore();

        drawPointer(ctx, center, center - radius - 6);
        return;
      }

      const total = currentPool.length;
      const arc = (Math.PI * 2) / total;

      ctx.save();
      ctx.translate(center, center);
      ctx.rotate(currentAngle);

      const avatarDist = total > 35 ? radius * 0.84 : radius * 0.74;
      const sliceWidthAtAvatar = avatarDist * arc;
      const avatarRadius = Math.min(22, Math.max(7, sliceWidthAtAvatar * 0.42));

      let fontSize = 14;
      if (total > 42) fontSize = 10;
      else if (total > 30) fontSize = 11.5;
      else if (total > 18) fontSize = 13;

      for (let i = 0; i < total; i++) {
        const student = currentPool[i];
        const angle = i * arc;
        const color = student.color || sliceColors[i % sliceColors.length];

        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, radius, angle, angle + arc);
        ctx.closePath();

        ctx.fillStyle = color;
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = total > 40 ? 1.5 : total > 25 ? 2.2 : 3;
        ctx.stroke();

        ctx.save();
        ctx.rotate(angle + arc / 2);

        ctx.save();
        ctx.beginPath();
        ctx.arc(avatarDist, 0, avatarRadius, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();

        const cachedImg = imageCache.current.get(student.id);
        if (cachedImg && cachedImg.complete && cachedImg.naturalWidth > 0) {
          ctx.drawImage(
            cachedImg,
            avatarDist - avatarRadius,
            -avatarRadius,
            avatarRadius * 2,
            avatarRadius * 2
          );
        } else {
          ctx.fillStyle = '#ffffff';
          ctx.fill();
          ctx.fillStyle = color;
          ctx.font = `bold ${Math.round(avatarRadius * 0.95)}px "Plus Jakarta Sans", sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(getInitials(student.name), avatarDist, 0);
        }
        ctx.restore();

        ctx.beginPath();
        ctx.arc(avatarDist, 0, avatarRadius, 0, Math.PI * 2);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = total > 40 ? 1.5 : 2.5;
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.font = `700 ${fontSize}px "Plus Jakarta Sans", sans-serif`;
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
        ctx.shadowBlur = 3;

        const displayName = getShortName(student.name);
        const textRightEdge = avatarDist - avatarRadius - (total > 40 ? 4 : 7);
        ctx.fillText(displayName, textRightEdge, 0);

        ctx.restore();
      }

      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 7;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(0, 0, radius + 5, 0, Math.PI * 2);
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 3;
      ctx.stroke();

      const bulbCount = total >= 36 ? Math.min(total, 64) : Math.max(24, total * 2);
      for (let b = 0; b < bulbCount; b++) {
        const bulbAngle = (b * Math.PI * 2) / bulbCount;
        const bx = Math.cos(bulbAngle) * (radius + 12);
        const by = Math.sin(bulbAngle) * (radius + 12);

        ctx.beginPath();
        ctx.arc(bx, by, 3.5, 0, Math.PI * 2);
        ctx.fillStyle = b % 2 === 0 ? '#fef08a' : '#ffffff';
        ctx.shadowColor = '#fbbf24';
        ctx.shadowBlur = 6;
        ctx.fill();
      }

      ctx.restore();

      ctx.save();
      ctx.beginPath();
      ctx.arc(center, center, 36, 0, Math.PI * 2);
      ctx.fillStyle = '#0f172a';
      ctx.shadowColor = 'rgba(0,0,0,0.35)';
      ctx.shadowBlur = 12;
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 5;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(center, center, 14, 0, Math.PI * 2);
      ctx.fillStyle = spinState.current.isSpinning ? '#38bdf8' : '#fbbf24';
      ctx.fill();
      ctx.restore();

      drawPointer(ctx, center, center - radius - 6);
    },
    []
  );

  const drawWheelRef = useRef(drawWheel);
  useEffect(() => {
    drawWheelRef.current = drawWheel;
  }, [drawWheel]);

  // Load avatar images into cache
  useEffect(() => {
    students.forEach((student) => {
      if (student.avatar && !imageCache.current.has(student.id)) {
        const img = new Image();
        img.src = student.avatar;
        img.onload = () => {
          imageCache.current.set(student.id, img);
          if (!spinState.current.isSpinning) {
            drawWheelRef.current(spinState.current.rotation);
          }
        };
      }
    });
  }, [students]);

  // Dynamically calculate canvas size to maximize screen space up to 680px without scrollbar
  const updateCanvasDimensions = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const viewportHeight = window.innerHeight || 800;
    const availableHeight = Math.max(300, viewportHeight - 145);

    const containerWidth = container.clientWidth || 600;
    const availableWidth = Math.max(300, containerWidth - 12);

    const d = Math.floor(Math.min(availableWidth, availableHeight, 680));
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    logicalSizeRef.current = d;
    canvas.width = Math.round(d * dpr);
    canvas.height = Math.round(d * dpr);
    canvas.style.width = `${d}px`;
    canvas.style.height = `${d}px`;

    drawWheelRef.current(spinState.current.rotation);
  }, []);

  useEffect(() => {
    updateCanvasDimensions();
    const handleResize = () => updateCanvasDimensions();
    window.addEventListener('resize', handleResize);

    let resizeRafId = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(resizeRafId);
      resizeRafId = requestAnimationFrame(() => {
        updateCanvasDimensions();
      });
    });

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(resizeRafId);
      observer.disconnect();
      if (spinState.current.rafId) {
        cancelAnimationFrame(spinState.current.rafId);
      }
    };
  }, [updateCanvasDimensions]);

  // Start spinning the wheel with 100% mathematical guarantee on target student
  const startSpin = () => {
    if (spinState.current.isSpinning) return;

    // Check pool
    const pool = noRepeat ? students.filter((s) => !s.called) : students;
    if (pool.length === 0) return;

    // Sync pool into wheel
    setWheelStudents(pool);
    wheelStudentsRef.current = pool;

    spinState.current.isSpinning = true;
    setIsSpinning(true);
    sound.startBgMusic();

    const total = pool.length;
    const arc = (Math.PI * 2) / total;
    const winnerIndex = Math.floor(Math.random() * total);
    const winnerStudent = pool[winnerIndex];

    // Mathematical calibration:
    // Pointer is at 12 o'clock = 1.5 * Math.PI (or -Math.PI / 2)
    // Slice winnerIndex center is: (winnerIndex * arc + arc / 2)
    // When wheel rotates by R: slice center = R + sliceCenter = 1.5 * Math.PI (mod 2*PI)
    // => R = 1.5 * Math.PI - sliceCenter
    const pointerAngle = Math.PI * 1.5;
    const sliceCenter = winnerIndex * arc + arc / 2;

    // Target base rotation normalized to [0, 2*PI)
    let targetBaseAngle = ((pointerAngle - sliceCenter) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);

    const currentRot = spinState.current.rotation;
    const currentNormalized = ((currentRot % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);

    let diff = ((targetBaseAngle - currentNormalized) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);

    const fullSpins = (6 + Math.floor(Math.random() * 3)) * Math.PI * 2;
    const totalDelta = fullSpins + diff;

    spinState.current.startRotation = currentRot;
    spinState.current.targetRotation = currentRot + totalDelta;
    spinState.current.startTime = 0;
    spinState.current.duration = spinDuration * 1000;
    spinState.current.lastTickIndex = -1;

    const easeOutQuart = (x: number): number => 1 - Math.pow(1 - x, 4);

    const animate = (timestamp: number) => {
      const s = spinState.current;
      if (!s.startTime) s.startTime = timestamp;

      const elapsed = timestamp - s.startTime;
      const progress = Math.min(1, elapsed / s.duration);
      const eased = easeOutQuart(progress);

      const rot = s.startRotation + (s.targetRotation - s.startRotation) * eased;
      s.rotation = rot;

      let norm = (pointerAngle - (rot % (Math.PI * 2))) % (Math.PI * 2);
      if (norm < 0) norm += Math.PI * 2;
      const currentPeg = Math.floor(norm / arc) % total;
      if (currentPeg !== s.lastTickIndex) {
        s.lastTickIndex = currentPeg;
        const speedFactor = Math.max(0.25, 1 - progress * 0.75);
        sound.playTick(speedFactor);
      }

      drawWheelRef.current(rot);

      if (progress < 1) {
        s.rafId = requestAnimationFrame(animate);
      } else {
        s.isSpinning = false;
        setIsSpinning(false);
        sound.stopBgMusic();

        // Sound fanfare
        sound.playFanfare();

        const currentTimeStr = new Date().toLocaleTimeString('vi-VN', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        });
        const currentRound = spinHistory.length + 1;

        // Record spin into spin history list
        const newRecord: SpinHistoryItem = {
          id: `spin-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          roundNumber: currentRound,
          student: winnerStudent,
          time: currentTimeStr,
        };
        setSpinHistory((prev) => [newRecord, ...prev]);

        // Set Winner Card on right panel
        setLatestWinner({
          student: winnerStudent,
          roundNumber: currentRound,
          time: currentTimeStr,
        });

        // Trigger gentle confetti over the card
        if (confettiCanvasRef.current) {
          if (!confettiEngineRef.current) {
            confettiEngineRef.current = new ConfettiEngine(confettiCanvasRef.current);
          }
          confettiEngineRef.current.resize();
          confettiEngineRef.current.fireCelebration(120);
        }

        // Notify parent to mark student called without popping up full-screen modal
        onSelectWinner(winnerStudent);
      }
    };

    spinState.current.rafId = requestAnimationFrame(animate);
  };

  // Copy history list to clipboard
  const handleCopyHistory = () => {
    if (spinHistory.length === 0) return;
    const text = spinHistory
      .slice()
      .reverse()
      .map(
        (item) =>
          `Lượt ${item.roundNumber}: ${item.student.name} (${item.student.className}) - ${item.time}`
      )
      .join('\n');

    navigator.clipboard.writeText(`DANH SÁCH LƯỢT QUAY:\n${text}`).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    });
  };

  // Clear single history item
  const handleDeleteHistoryItem = (id: string) => {
    setSpinHistory((prev) => prev.filter((item) => item.id !== id));
  };

  // Clear all history directly in UI
  const handleClearAllHistory = () => {
    setSpinHistory([]);
    setConfirmClearAll(false);
    setLatestWinner(null);
    try {
      localStorage.removeItem(STORAGE_HISTORY_KEY);
    } catch {}
  };

  // Sorted items based on user choice
  const displayedHistory = sortAscending
    ? spinHistory.slice().reverse()
    : spinHistory;

  return (
    <div className="relative w-full h-full flex flex-col lg:flex-row items-center justify-center gap-4 lg:gap-6 py-1 max-h-full">
      {/* Discreet confetti canvas for celebration */}
      <canvas
        ref={confettiCanvasRef}
        className="absolute inset-0 pointer-events-none z-30 w-full h-full"
      />

      {/* LEFT COLUMN: LARGE WHEEL & COMPACT CONTROLS */}
      <div className="flex-1 flex flex-col items-center justify-center w-full max-w-[760px] min-h-0">
        {/* Top status info pill - Compact */}
        <div className="flex items-center justify-between w-full px-2 mb-1">
          <div className="flex items-center gap-1.5 text-xs text-slate-600 bg-white/95 backdrop-blur-xs px-3 py-0.5 rounded-full border border-slate-200 shadow-2xs">
            <Users size={13} className="text-sky-600" />
            <span>Sẵn sàng:</span>
            <strong className="font-bold text-slate-900 font-mono tabular-nums">
              {activeStudents.length} / {students.length}
            </strong>
            <span className="text-[10px] text-slate-400 font-normal">
              (Sức chứa tối đa 50+ học sinh)
            </span>
          </div>

          {activeStudents.length === 0 && (
            <button
              onClick={() => {
                onResetCalled();
                setWheelStudents(students);
              }}
              className="flex items-center gap-1 px-2.5 py-0.5 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-full transition-colors cursor-pointer"
            >
              <RotateCcw size={12} /> Khôi phục tất cả
            </button>
          )}
        </div>

        {/* Wheel Canvas Container */}
        <div
          ref={containerRef}
          className="relative flex items-center justify-center p-0.5 rounded-full cursor-pointer select-none w-full"
          onClick={!isSpinning ? startSpin : undefined}
        >
          <canvas
            ref={canvasRef}
            className="rounded-full shadow-2xl filter drop-shadow-lg"
          />
        </div>

        {/* Compact Action Button & Controls Bar */}
        <div className="mt-2.5 flex flex-wrap items-center justify-center gap-2.5 w-full">
          {/* Main Spin Button */}
          <button
            disabled={isSpinning || activeStudents.length === 0}
            onClick={startSpin}
            className={`px-6 py-2.5 rounded-xl font-black text-sm sm:text-base shadow-md tracking-wide flex items-center gap-2 transition-all transform active:scale-95 cursor-pointer ${
              isSpinning || activeStudents.length === 0
                ? 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none'
                : 'bg-gradient-to-r from-amber-500 via-rose-500 to-indigo-600 text-white hover:brightness-110 hover:shadow-lg hover:scale-102'
            }`}
          >
            <Play
              size={18}
              className={isSpinning ? 'animate-spin' : 'fill-white'}
            />
            {isSpinning ? 'ĐANG QUAY...' : 'QUAY NGAY! (SPIN)'}
          </button>

          {/* Spin Duration Selector */}
          <div className="flex items-center gap-1.5 text-xs text-slate-600 bg-white px-2.5 py-1.5 rounded-xl border border-slate-200 shadow-2xs">
            <Clock size={13} className="text-amber-500" />
            <span className="text-[11px] text-slate-500 font-medium">Thời gian:</span>
            <select
              value={spinDuration}
              onChange={(e) => setSpinDuration(Number(e.target.value))}
              disabled={isSpinning}
              className="bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5 text-xs text-slate-800 font-bold cursor-pointer outline-none"
            >
              <option value={4}>4 giây (Nhanh)</option>
              <option value={6}>6 giây (Chuẩn)</option>
              <option value={8}>8 giây (Hồi hộp)</option>
              <option value={10}>10 giây (Kịch tính)</option>
            </select>
          </div>

          {/* Checkbox Không gọi trùng */}
          {onToggleNoRepeat && (
            <label className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold bg-white border border-slate-200 rounded-xl shadow-2xs cursor-pointer select-none">
              <input
                type="checkbox"
                checked={noRepeat}
                onChange={(e) => onToggleNoRepeat(e.target.checked)}
                disabled={isSpinning}
                className="w-3.5 h-3.5 rounded text-sky-600 accent-sky-600 cursor-pointer"
              />
              <span className={noRepeat ? 'text-slate-800 font-bold' : 'text-slate-500'}>
                Không gọi trùng
              </span>
            </label>
          )}
        </div>
      </div>

      {/* RIGHT COLUMN: REFINED WINNER SHOWCASE & SCROLLABLE ROUND HISTORY */}
      <div className="w-full lg:w-[360px] xl:w-[390px] h-full flex flex-col justify-between bg-white rounded-3xl border border-slate-200 p-3 sm:p-4 shadow-sm overflow-hidden shrink-0">
        {/* TOP: WINNER SHOWCASE CARD */}
        {latestWinner ? (
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-500 via-rose-500 to-indigo-600 p-0.5 shadow-md mb-2 shrink-0 animate-fade-in">
            <div className="bg-gradient-to-b from-slate-900/90 to-slate-950/95 backdrop-blur-md rounded-[14px] p-3 text-white flex items-center gap-3">
              {/* Avatar Presentation */}
              <div className="relative shrink-0">
                <div className="w-13 h-13 rounded-full border-2 border-amber-300 shadow-md overflow-hidden bg-white/10 flex items-center justify-center ring-2 ring-amber-400/50">
                  {latestWinner.student.avatar ? (
                    <img
                      src={latestWinner.student.avatar}
                      alt={latestWinner.student.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-white font-black text-lg">
                      {getInitials(latestWinner.student.name)}
                    </span>
                  )}
                </div>
                <div className="absolute -top-1.5 -right-1 bg-amber-400 text-slate-950 text-[9px] font-black px-1.5 py-0.2 rounded-full shadow-xs flex items-center gap-0.5">
                  <Trophy size={10} /> #{latestWinner.roundNumber}
                </div>
              </div>

              {/* Student Meta */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1 text-[10px] font-extrabold text-amber-300 uppercase tracking-wider">
                  <Sparkles size={11} className="text-amber-300 animate-spin" />
                  <span>Học Sinh Vừa Trúng Tuyển!</span>
                </div>
                <h3 className="text-base font-black text-white leading-tight truncate mt-0.5">
                  {latestWinner.student.name}
                </h3>
                <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-300">
                  <span className="bg-white/15 px-1.5 py-0.2 rounded font-semibold text-white">
                    {latestWinner.student.className}
                  </span>
                  <span className="flex items-center gap-0.5 text-[10px] text-slate-400">
                    <Clock size={10} /> {latestWinner.time}
                  </span>
                </div>
              </div>

              {/* Dismiss button */}
              <button
                onClick={() => setLatestWinner(null)}
                className="text-white/60 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors cursor-pointer"
                title="Đóng thẻ này"
              >
                <X size={15} />
              </button>
            </div>
          </div>
        ) : (
          <div className="p-2.5 rounded-2xl bg-slate-50 border border-slate-200/80 mb-2 flex items-center gap-2.5 text-slate-500 text-xs shrink-0">
            <div className="p-2 bg-amber-100 text-amber-700 rounded-xl">
              <Award size={16} />
            </div>
            <div>
              <p className="font-bold text-slate-800">Chưa có lượt quay nào</p>
              <p className="text-[11px] text-slate-500">
                Nhấn "QUAY NGAY" để chọn học sinh ngẫu nhiên
              </p>
            </div>
          </div>
        )}

        {/* BOTTOM: SCROLLABLE SPIN HISTORY */}
        <div className="flex-1 flex flex-col min-h-0 bg-slate-50/70 rounded-2xl border border-slate-200/90 p-2.5 overflow-hidden">
          {/* History Header & Controls */}
          <div className="flex items-center justify-between pb-2 mb-1.5 border-b border-slate-200 shrink-0">
            <div className="flex items-center gap-1.5">
              <History size={14} className="text-indigo-600" />
              <h4 className="text-xs font-black text-slate-800 tracking-tight">
                Lịch Sử Lượt Quay
              </h4>
              <span className="text-[10px] font-extrabold bg-indigo-100 text-indigo-700 px-1.5 py-0.2 rounded-full">
                {spinHistory.length}
              </span>
            </div>

            {/* Utility action icons */}
            <div className="flex items-center gap-1">
              {/* Sort toggle */}
              <button
                onClick={() => setSortAscending(!sortAscending)}
                disabled={spinHistory.length === 0}
                className="p-1 hover:bg-slate-200 text-slate-600 rounded-md transition-colors cursor-pointer disabled:opacity-30"
                title={sortAscending ? 'Sắp xếp: Mới nhất trước' : 'Sắp xếp: Cũ nhất trước'}
              >
                <ArrowUpDown size={13} />
              </button>

              {/* Copy list */}
              <button
                onClick={handleCopyHistory}
                disabled={spinHistory.length === 0}
                className="p-1 hover:bg-slate-200 text-slate-600 rounded-md transition-colors cursor-pointer disabled:opacity-30"
                title="Sao chép danh sách lịch sử"
              >
                {copied ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
              </button>

              {/* Clear all */}
              <button
                onClick={() => setConfirmClearAll(true)}
                disabled={spinHistory.length === 0}
                className="p-1 hover:bg-rose-100 text-slate-400 hover:text-rose-600 rounded-md transition-colors cursor-pointer disabled:opacity-30"
                title="Xóa toàn bộ lịch sử"
              >
                <Trash2 size={13} />
              </button>
            </div>
          </div>

          {/* History Item List */}
          <div className="flex-1 overflow-y-auto space-y-1.5 pr-0.5">
            {spinHistory.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-4 text-slate-400">
                <Trophy size={28} className="text-slate-300 mb-1.5 stroke-[1.5]" />
                <p className="text-xs font-semibold text-slate-500">Chưa có dữ liệu</p>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Các bạn trúng tuyển sẽ tự động hiển thị ở đây
                </p>
              </div>
            ) : (
              displayedHistory.map((item, idx) => {
                const isVeryFirst = !sortAscending && idx === 0;
                return (
                  <div
                    key={item.id}
                    className={`group relative flex items-center justify-between p-2 rounded-xl transition-all border ${
                      isVeryFirst
                        ? 'bg-amber-50/90 border-amber-300/80 shadow-2xs'
                        : 'bg-white hover:bg-slate-100/80 border-slate-200/70'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {/* Round badge */}
                      <span
                        className={`w-6 h-6 rounded-lg flex items-center justify-center font-black text-[10px] shrink-0 ${
                          isVeryFirst
                            ? 'bg-amber-500 text-white shadow-2xs'
                            : 'bg-slate-100 text-slate-600 border border-slate-200'
                        }`}
                      >
                        #{item.roundNumber}
                      </span>

                      {/* Small avatar */}
                      <div className="w-6 h-6 rounded-full overflow-hidden bg-slate-200 flex items-center justify-center shrink-0 border border-slate-200">
                        {item.student.avatar ? (
                          <img
                            src={item.student.avatar}
                            alt={item.student.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="text-[9px] font-black text-slate-600">
                            {getInitials(item.student.name)}
                          </span>
                        )}
                      </div>

                      {/* Name & Class */}
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h5 className="font-black text-xs text-slate-900 truncate">
                            {item.student.name}
                          </h5>
                          {isVeryFirst && (
                            <span className="text-[9px] font-black bg-rose-500 text-white px-1 py-0.2 rounded-full">
                              Mới
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-slate-400">
                          <span>{item.student.className}</span>
                          <span>·</span>
                          <span>{item.time}</span>
                        </div>
                      </div>
                    </div>

                    {/* Delete single item */}
                    <button
                      onClick={() => handleDeleteHistoryItem(item.id)}
                      className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-rose-500 p-1 rounded-md transition-opacity cursor-pointer shrink-0"
                      title="Xóa dòng này"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {/* Quick Footer stats in history box */}
          {spinHistory.length > 0 && (
            <div className="pt-1.5 mt-1 border-t border-slate-200/80 flex items-center justify-between text-[10px] text-slate-500 shrink-0 font-medium">
              <span>Tổng cộng: <strong className="text-slate-800">{spinHistory.length}</strong> lượt</span>
              <button
                onClick={handleCopyHistory}
                className="text-indigo-600 hover:underline font-bold cursor-pointer"
              >
                {copied ? 'Đã sao chép!' : 'Sao chép kết quả'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* MODAL: CONFIRM CLEAR ALL HISTORY */}
      {confirmClearAll && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-xs p-5 shadow-2xl border border-slate-200 flex flex-col text-center animate-fade-in">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-3">
              <Trash2 size={24} />
            </div>
            <h3 className="text-base font-black text-slate-900">Xóa Lịch Sử Quay?</h3>
            <p className="text-xs text-slate-500 mt-1 mb-4">
              Toàn bộ {spinHistory.length} lượt quay trước đó sẽ bị xóa. Bạn có chắc chắn không?
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setConfirmClearAll(false)}
                className="flex-1 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 border border-slate-200 cursor-pointer"
              >
                Hủy
              </button>
              <button
                onClick={handleClearAllHistory}
                className="flex-1 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-md cursor-pointer"
              >
                Xóa tất cả
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
