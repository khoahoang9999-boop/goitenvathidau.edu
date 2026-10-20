import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Student } from '../types';
import { sound } from '../services/sound';
import { getShortName, getInitials } from '../utils/defaultData';
import { ConfettiEngine } from '../services/confetti';
import {
  Play,
  Sparkles,
  Users,
  RotateCcw,
  Clock,
  X,
} from 'lucide-react';

interface CarouselSelectorProps {
  students: Student[];
  onSelectWinner: (student: Student) => void;
  onResetCalled: () => void;
  noRepeat?: boolean;
  onToggleNoRepeat?: (val: boolean) => void;
}

export const CarouselSelector: React.FC<CarouselSelectorProps> = ({
  students,
  onSelectWinner,
  onResetCalled,
  noRepeat = true,
  onToggleNoRepeat,
}) => {
  const activeStudents = (noRepeat ? students.filter((s) => !s.called) : students).filter((s) => !s.excluded);
  const [isSpinning, setIsSpinning] = useState<boolean>(false);
  const [spinSpeed, setSpinSpeed] = useState<'normal' | 'fast' | 'dramatic'>('normal');

  // Mini Winner Card state (appears below conveyor without popup)
  const [latestWinner, setLatestWinner] = useState<{
    student: Student;
    time: string;
  } | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const confettiCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const confettiEngineRef = useRef<ConfettiEngine | null>(null);

  // Logical dimension tracker
  const dimensionsRef = useRef<{ width: number; height: number }>({ width: 900, height: 320 });

  // Immutable snapshot of student list rendered on the conveyor belt during and after a spin
  const beltListRef = useRef<Student[]>(activeStudents.length > 0 ? activeStudents : students);
  const currentClassTrackerRef = useRef<string>('');

  // Cached images
  const imageCache = useRef<Map<string, HTMLImageElement>>(new Map());

  // Physical parameters of cards
  const CARD_WIDTH = 180;
  const CARD_HEIGHT = 230;
  const CARD_GAP = 18;
  const STRIDE = CARD_WIDTH + CARD_GAP;

  // Animation physics state in ref
  const animState = useRef({
    isSpinning: false,
    offset: 0,
    startOffset: 0,
    targetOffset: 0,
    startTime: 0,
    duration: 5500,
    lastTickCard: -1,
    rafId: 0,
    winner: null as Student | null,
  });

  // Check if class changed from outside (e.g. user selected another class in header)
  const firstStudentClass = students[0]?.className || '';
  useEffect(() => {
    if (currentClassTrackerRef.current !== firstStudentClass) {
      currentClassTrackerRef.current = firstStudentClass;
      beltListRef.current = activeStudents.length > 0 ? activeStudents : students;
      animState.current.offset = 0;
      setLatestWinner(null);
      drawCarouselRef.current(0);
    }
  }, [firstStudentClass, students, activeStudents]);

  // Preload student avatars into cache
  useEffect(() => {
    students.forEach((student) => {
      if (student.avatar && !imageCache.current.has(student.id)) {
        const img = new Image();
        img.src = student.avatar;
        img.onload = () => {
          imageCache.current.set(student.id, img);
          if (!animState.current.isSpinning) {
            drawCarouselRef.current(animState.current.offset);
          }
        };
      }
    });
  }, [students]);

  // Draw an individual student card
  const drawCard = (
    ctx: CanvasRenderingContext2D,
    student: Student,
    x: number,
    y: number,
    isCenter: boolean,
    scale: number
  ) => {
    ctx.save();
    ctx.translate(x + CARD_WIDTH / 2, y + CARD_HEIGHT / 2);
    ctx.scale(scale, scale);
    ctx.translate(-CARD_WIDTH / 2, -CARD_HEIGHT / 2);

    // Card background & shadow
    ctx.beginPath();
    ctx.roundRect(0, 0, CARD_WIDTH, CARD_HEIGHT, 16);

    if (isCenter) {
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = 'rgba(245, 158, 11, 0.45)';
      ctx.shadowBlur = 20;
      ctx.shadowOffsetY = 6;
      ctx.fill();

      // Golden gradient border
      ctx.lineWidth = 3.5;
      ctx.strokeStyle = '#f59e0b';
      ctx.stroke();
    } else {
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.08)';
      ctx.shadowBlur = 10;
      ctx.shadowOffsetY = 4;
      ctx.fill();

      ctx.lineWidth = 1.5;
      ctx.strokeStyle = '#e2e8f0';
      ctx.stroke();
    }

    // Top header band
    ctx.beginPath();
    ctx.roundRect(0, 0, CARD_WIDTH, 44, [16, 16, 0, 0]);
    ctx.fillStyle = student.color || '#3b82f6';
    ctx.fill();

    // Top label
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('HỌC SINH', CARD_WIDTH / 2, 22);

    // Circular Avatar
    const avatarCenterX = CARD_WIDTH / 2;
    const avatarCenterY = 105;
    const avatarRadius = 38;

    ctx.save();
    ctx.beginPath();
    ctx.arc(avatarCenterX, avatarCenterY, avatarRadius, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();

    const cachedImg = imageCache.current.get(student.id);
    if (cachedImg && cachedImg.complete && cachedImg.naturalWidth > 0) {
      ctx.drawImage(
        cachedImg,
        avatarCenterX - avatarRadius,
        avatarCenterY - avatarRadius,
        avatarRadius * 2,
        avatarRadius * 2
      );
    } else {
      ctx.fillStyle = student.color || '#3b82f6';
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 24px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(getInitials(student.name), avatarCenterX, avatarCenterY);
    }
    ctx.restore();

    // Avatar white ring
    ctx.beginPath();
    ctx.arc(avatarCenterX, avatarCenterY, avatarRadius, 0, Math.PI * 2);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Student Full Name
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 15px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const short = getShortName(student.name);
    ctx.fillText(short, CARD_WIDTH / 2, 168);

    // Full name muted below
    ctx.fillStyle = '#64748b';
    ctx.font = '500 11.5px "Plus Jakarta Sans", sans-serif';
    const displayFullName =
      student.name.length > 20 ? student.name.substring(0, 18) + '...' : student.name;
    ctx.fillText(displayFullName, CARD_WIDTH / 2, 192);

    // Class tag
    ctx.fillStyle = '#94a3b8';
    ctx.font = '600 10px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(student.className, CARD_WIDTH / 2, 210);

    ctx.restore();
  };

  // Main Canvas Carousel Renderer with DPI scaling
  const drawCarousel = useCallback(
    (offset: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const { width, height } = dimensionsRef.current;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);

      // Reset transform scale
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);

      const centerY = height / 2;
      const centerX = width / 2;

      const displayList = beltListRef.current;
      if (!displayList || displayList.length === 0) {
        ctx.fillStyle = '#64748b';
        ctx.font = 'bold 16px "Plus Jakarta Sans", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('Đã gọi hết tất cả học sinh!', centerX, centerY - 10);
        ctx.font = '12px "Plus Jakarta Sans", sans-serif';
        ctx.fillText('Nhấn "Khôi phục tất cả" để tiếp tục', centerX, centerY + 14);
        return;
      }

      const total = displayList.length;

      // Draw subtle background track line
      ctx.strokeStyle = 'rgba(226, 232, 240, 0.8)';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.moveTo(0, centerY);
      ctx.lineTo(width, centerY);
      ctx.stroke();
      ctx.setLineDash([]);

      // Compute which cards are visible
      const startCardIndex = Math.floor((-offset - width) / STRIDE) - 2;
      const endCardIndex = Math.ceil((-offset + width * 2) / STRIDE) + 2;

      for (let i = startCardIndex; i <= endCardIndex; i++) {
        let studentIdx = ((i % total) + total) % total;
        const student = displayList[studentIdx];
        if (!student) continue;

        const cardX = centerX + offset + i * STRIDE - CARD_WIDTH / 2;
        const cardY = centerY - CARD_HEIGHT / 2;

        if (cardX + CARD_WIDTH < -60 || cardX > width + 60) continue;

        const distFromCenter = Math.abs(cardX + CARD_WIDTH / 2 - centerX);
        const isCenterTarget = distFromCenter < STRIDE * 0.45;
        const scale = Math.max(0.86, 1.05 - (distFromCenter / (width * 0.5)) * 0.2);

        drawCard(ctx, student, cardX, cardY, isCenterTarget, scale);
      }

      // Center Selection Frame (Yellow Game Target)
      const frameW = CARD_WIDTH + 20;
      const frameH = CARD_HEIGHT + 20;
      const frameX = centerX - frameW / 2;
      const frameY = centerY - frameH / 2;

      // Top indicator arrow
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(centerX, frameY - 2);
      ctx.lineTo(centerX - 14, frameY - 18);
      ctx.lineTo(centerX + 14, frameY - 18);
      ctx.closePath();
      ctx.fillStyle = '#f59e0b';
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Bottom indicator arrow
      ctx.beginPath();
      ctx.moveTo(centerX, frameY + frameH + 2);
      ctx.lineTo(centerX - 14, frameY + frameH + 18);
      ctx.lineTo(centerX + 14, frameY + frameH + 18);
      ctx.closePath();
      ctx.fillStyle = '#f59e0b';
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Golden glowing border for target frame
      ctx.beginPath();
      ctx.roundRect(frameX, frameY, frameW, frameH, 18);
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 3.5;
      ctx.stroke();

      // Left and Right vignette fade gradients
      const gradLeft = ctx.createLinearGradient(0, 0, 140, 0);
      gradLeft.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
      gradLeft.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = gradLeft;
      ctx.fillRect(0, 0, 140, height);

      const gradRight = ctx.createLinearGradient(width - 140, 0, width, 0);
      gradRight.addColorStop(0, 'rgba(255, 255, 255, 0)');
      gradRight.addColorStop(1, 'rgba(255, 255, 255, 0.95)');
      ctx.fillStyle = gradRight;
      ctx.fillRect(width - 140, 0, 140, height);

      ctx.restore();
    },
    [STRIDE]
  );

  const drawCarouselRef = useRef(drawCarousel);
  useEffect(() => {
    drawCarouselRef.current = drawCarousel;
  }, [drawCarousel]);

  // Easing function for realistic deceleration
  const easeOutQuart = (x: number): number => 1 - Math.pow(1 - x, 4);

  // Start spinning conveyor belt
  const startSpin = () => {
    if (animState.current.isSpinning || activeStudents.length === 0) return;

    // 1. Establish the active pool for this spin
    const pool = [...activeStudents];
    beltListRef.current = pool;
    const total = pool.length;

    // 2. Pick random winner student from pool
    const winnerIdx = Math.floor(Math.random() * total);
    const winner = pool[winnerIdx];
    animState.current.winner = winner;

    animState.current.isSpinning = true;
    setIsSpinning(true);
    sound.startBgMusic();

    let durationMs = 5000;
    let cycles = 6;
    if (spinSpeed === 'fast') {
      durationMs = 3500;
      cycles = 4;
    } else if (spinSpeed === 'dramatic') {
      durationMs = 7000;
      cycles = 8;
    }

    // 3. Exact target card calculation
    // Current card closest to center
    const currentI = Math.round(-animState.current.offset / STRIDE);
    const currentMod = ((currentI % total) + total) % total;
    let diff = (winnerIdx - currentMod + total) % total;
    if (diff === 0) diff = total; // ensure forward movement

    const totalCardsForward = cycles * total + diff;
    const targetCardI = currentI + totalCardsForward;
    const targetOffset = -targetCardI * STRIDE;

    animState.current.startTime = 0;
    animState.current.duration = durationMs;
    animState.current.startOffset = animState.current.offset;
    animState.current.targetOffset = targetOffset;
    animState.current.lastTickCard = -1;

    const animate = (timestamp: number) => {
      const state = animState.current;
      if (!state.startTime) state.startTime = timestamp;

      const elapsed = timestamp - state.startTime;
      const progress = Math.min(1, elapsed / state.duration);
      const eased = easeOutQuart(progress);

      const computedOffset =
        state.startOffset + (state.targetOffset - state.startOffset) * eased;
      state.offset = computedOffset;

      // Tick sound as each card crosses the center line
      const currentCardPassed = Math.floor(-computedOffset / STRIDE);
      if (currentCardPassed !== state.lastTickCard) {
        state.lastTickCard = currentCardPassed;
        const speed = Math.max(0.25, 1 - progress * 0.75);
        sound.playTick(speed);
      }

      drawCarouselRef.current(computedOffset);

      if (progress < 1) {
        state.rafId = requestAnimationFrame(animate);
      } else {
        // Ensure exact final snap to targetOffset
        state.offset = state.targetOffset;
        drawCarouselRef.current(state.targetOffset);

        state.isSpinning = false;
        setIsSpinning(false);
        sound.stopBgMusic();
        sound.playFanfare();

        const currentTimeStr = new Date().toLocaleTimeString('vi-VN', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        });

        // 4. Determine student physically at center
        const centerI = Math.round(-state.targetOffset / STRIDE);
        const centerIdx = ((centerI % pool.length) + pool.length) % pool.length;
        const exactCenterStudent = pool[centerIdx] || winner;

        // Show Mini Winner Card with exact center student
        setLatestWinner({
          student: exactCenterStudent,
          time: currentTimeStr,
        });

        // Trigger celebratory confetti
        if (confettiCanvasRef.current) {
          if (!confettiEngineRef.current) {
            confettiEngineRef.current = new ConfettiEngine(confettiCanvasRef.current);
          }
          confettiEngineRef.current.resize();
          confettiEngineRef.current.fireCelebration(140);
        }

        // Notify parent of selected winner
        onSelectWinner(exactCenterStudent);
      }
    };

    animState.current.rafId = requestAnimationFrame(animate);
  };

  // Handle reset called
  const handleReset = () => {
    onResetCalled();
    beltListRef.current = students;
    animState.current.offset = 0;
    setLatestWinner(null);
    drawCarouselRef.current(0);
  };

  // Resize canvas according to container dimensions
  const updateDimensions = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const w = container.clientWidth || 900;
    const h = 300;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    dimensionsRef.current = { width: w, height: h };

    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;

    drawCarouselRef.current(animState.current.offset);
  }, []);

  useEffect(() => {
    updateDimensions();
    const handleResize = () => updateDimensions();
    window.addEventListener('resize', handleResize);

    let resizeRafId = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(resizeRafId);
      resizeRafId = requestAnimationFrame(() => {
        updateDimensions();
      });
    });

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(resizeRafId);
      observer.disconnect();
      if (animState.current.rafId) {
        cancelAnimationFrame(animState.current.rafId);
      }
    };
  }, [updateDimensions]);

  return (
    <div className="relative flex flex-col items-center justify-center w-full max-w-5xl mx-auto py-1">
      {/* Confetti canvas */}
      <canvas
        ref={confettiCanvasRef}
        className="absolute inset-0 pointer-events-none z-30 w-full h-full"
      />

      {/* Top info and status bar */}
      <div className="flex items-center justify-between w-full px-3 mb-2">
        <div className="flex items-center gap-2 text-xs sm:text-sm text-slate-600 bg-white/90 backdrop-blur-xs px-3.5 py-1 rounded-full border border-slate-200 shadow-2xs">
          <Users size={15} className="text-amber-500" />
          <span>Học sinh trong danh sách:</span>
          <strong className="font-bold text-slate-900 font-mono tabular-nums">
            {activeStudents.length} / {students.length}
          </strong>
        </div>

        {activeStudents.length === 0 && (
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-1 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-full transition-colors cursor-pointer"
          >
            <RotateCcw size={13} /> Khôi phục tất cả
          </button>
        )}
      </div>

      {/* Carousel Track Container */}
      <div
        ref={containerRef}
        className="w-full relative overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-lg p-1 select-none"
      >
        <canvas ref={canvasRef} className="w-full block" />
      </div>

      {/* Mini Winner Card Banner (Appears when spin finishes) */}
      {latestWinner && (
        <div className="mt-3 w-full max-w-xl p-3.5 rounded-2xl bg-gradient-to-r from-amber-500 via-rose-500 to-indigo-600 text-white shadow-xl relative overflow-hidden animate-fade-in flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            {/* Avatar */}
            <div className="w-14 h-14 rounded-full border-2 border-white shadow-md overflow-hidden bg-white/20 flex items-center justify-center shrink-0">
              {latestWinner.student.avatar ? (
                <img
                  src={latestWinner.student.avatar}
                  alt={latestWinner.student.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-white font-black text-xl">
                  {getInitials(latestWinner.student.name)}
                </span>
              )}
            </div>

            {/* Info */}
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-xs font-extrabold text-amber-200 uppercase tracking-wide">
                <Sparkles size={13} />
                <span>Học sinh được chọn</span>
              </div>
              <h3 className="text-lg font-black text-white leading-tight truncate">
                {latestWinner.student.name}
              </h3>
              <div className="flex items-center gap-2 mt-0.5 text-xs text-white/85">
                <span className="bg-white/25 px-1.5 py-0.2 rounded font-bold">
                  {latestWinner.student.className}
                </span>
                <span className="flex items-center gap-0.5 text-[10px]">
                  <Clock size={10} />
                  {latestWinner.time}
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={() => setLatestWinner(null)}
            className="p-1.5 hover:bg-white/20 rounded-full transition-colors text-white/80 hover:text-white cursor-pointer shrink-0"
            title="Đóng thông báo"
          >
            <X size={18} />
          </button>
        </div>
      )}

      {/* Compact Action Buttons Bar */}
      <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
        <button
          disabled={isSpinning || activeStudents.length === 0}
          onClick={startSpin}
          className={`px-6 py-2.5 rounded-xl font-black text-sm sm:text-base shadow-md tracking-wide flex items-center gap-2 transition-all transform active:scale-95 cursor-pointer ${
            isSpinning || activeStudents.length === 0
              ? 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none'
              : 'bg-gradient-to-r from-amber-500 via-orange-500 to-rose-600 text-white hover:brightness-110 hover:shadow-lg hover:scale-102'
          }`}
        >
          <Play size={20} className={isSpinning ? 'animate-spin' : ''} fill="currentColor" />
          {isSpinning ? 'ĐANG QUAY THẺ...' : 'QUAY THẺ NGẪU NHIÊN!'}
        </button>

        {/* Speed presets */}
        <div className="flex items-center gap-1.5 text-xs text-slate-600 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-2xs">
          <Sparkles size={14} className="text-amber-500" />
          <span>Chế độ:</span>
          <select
            value={spinSpeed}
            onChange={(e) => setSpinSpeed(e.target.value as 'normal' | 'fast' | 'dramatic')}
            disabled={isSpinning}
            className="bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5 text-slate-800 font-semibold cursor-pointer outline-none text-xs"
          >
            <option value="fast">Nhanh (3.5s)</option>
            <option value="normal">Chuẩn (5s)</option>
            <option value="dramatic">Hồi hộp (7s)</option>
          </select>
        </div>

        {/* Checkbox Không gọi trùng */}
        {onToggleNoRepeat && (
          <label className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white border border-slate-200 rounded-xl shadow-2xs cursor-pointer select-none">
            <input
              type="checkbox"
              checked={noRepeat}
              onChange={(e) => onToggleNoRepeat(e.target.checked)}
              disabled={isSpinning}
              className="w-3.5 h-3.5 rounded text-amber-600 accent-amber-600 cursor-pointer"
            />
            <span className={noRepeat ? 'text-slate-800 font-bold' : 'text-slate-500'}>
              Không gọi trùng
            </span>
          </label>
        )}
      </div>
    </div>
  );
};
