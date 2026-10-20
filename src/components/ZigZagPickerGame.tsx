import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Student } from '../types';
import { sound } from '../services/sound';
import { getShortName, getInitials } from '../utils/defaultData';
import { ConfettiEngine } from '../services/confetti';
import {
  Volume2,
  VolumeX,
  RotateCcw,
  Play,
  Pause,
  Maximize2,
  Minimize2,
  Users,
  Edit3,
  X,
  Trophy,
  Sparkles,
  Crown,
  UserMinus,
  CheckSquare,
  Square,
  RefreshCw,
  CheckCircle2,
} from 'lucide-react';

const RANDOM_AVATAR_EMOJIS = [
  '🦁', '🌸', '🚀', '🦄', '⚡', '🐬', '🔥', '🌺',
  '⚽', '🌟', '🎀', '🌲', '💎', '👑', '❄️', '🎯',
  '🦊', '🐼', '🐯', '🐸', '🐱', '🐶', '🐻', '🐰',
  '🐥', '🐙', '🎨', '🌈', '🏆', '👾', '⭐', '🎈'
];

function generateRandomStudentAvatarSvg(studentId: string, name: string, color: string, index: number): string {
  let charSum = 0;
  for (let i = 0; i < (studentId || '').length; i++) {
    charSum += studentId.charCodeAt(i);
  }
  const emoji = RANDOM_AVATAR_EMOJIS[(charSum + index) % RANDOM_AVATAR_EMOJIS.length];

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
    <circle cx="50" cy="50" r="48" fill="${color || '#3b82f6'}"/>
    <circle cx="35" cy="35" r="22" fill="#ffffff" opacity="0.3"/>
    <text x="50" y="56" font-size="44" text-anchor="middle" dominant-baseline="middle" font-family="sans-serif">${emoji}</text>
  </svg>`;
  return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
}

interface ZigZagPickerGameProps {
  students: Student[];
  onSelectWinner: (student: Student) => void;
  onResetCalled: () => void;
  noRepeat?: boolean;
  onToggleNoRepeat?: (val: boolean) => void;
}

interface StageDefinition {
  id: number;
  name: string;
  description: string;
  type: string;
}

interface SpinnerObstacle {
  id: string;
  x: number;
  y: number;
  radius: number;
  numBlades: number;
  angle: number;
  speed: number;
  color: string;
  hubRadius: number;
}

interface FunnelObstacle {
  id: string;
  topY: number;
  bottomY: number;
  topWidth: number;
  bottomWidth: number;
  centerX: number;
  color: string;
  label: string;
}

const STAGES: StageDefinition[] = [
  { id: 1, name: 'Chặng 1', description: 'Xuất phát & Bàn đinh', type: 'pegs' },
  { id: 2, name: 'Chặng 2', description: 'Góc nghiêng & Cánh quạt', type: 'fan' },
  { id: 3, name: 'Chặng 3', description: 'Góc cua & Hố phễu', type: 'funnel' },
  { id: 4, name: 'Chặng 4', description: 'Góc lượn & Quạt xoáy', type: 'pinwheel' },
  { id: 5, name: 'Chặng 5', description: 'Đệm nảy & Dốc tăng tốc', type: 'target' },
  { id: 6, name: 'Chặng 6', description: 'Góc hẹp & Phễu bứt phá', type: 'triple_fan' },
  { id: 7, name: 'Chặng 7', description: 'Cầu bập bồng thăng bằng', type: 'seesaw' },
  { id: 8, name: 'Chặng 8', description: 'Cán đích vinh quang', type: 'finish' },
];

interface MarbleRacer {
  student: Student;
  number: number; // 1 to N
  initials: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number; // Rotation angle for rolling effect
  radius: number;
  color: string;
  finished: boolean;
  finishTime?: number;
  rank?: number;
  lastBounceTime: number;
  stuckFrames?: number;
}

interface RaceLog {
  id: string;
  timeStr: string;
  icon: string;
  studentName: string;
  message: string;
}

interface CornerDeflector {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color?: string;
}

interface DynamicTrackLayout {
  seed: number;
  spinners: SpinnerObstacle[];
  funnels: FunnelObstacle[];
  ramps: { x1: number; y1: number; x2: number; y2: number; color?: string }[];
  pegs: { x: number; y: number; r: number }[];
  seesawPivot: { x: number; y: number; length: number };
}

// Track Physical Constants & Dimensions
const TRACK_WIDTH = 560;
const TRACK_HEIGHT = 1600; // Multi-stage cascading height
const Y_START = 80; // Fixed starting line height for static marbles before race

function getWallLeft(y: number): number {
  if (y < 80) {
    return 15 + (y / 80) * 50;
  } else if (y <= 1420) {
    return 65;
  } else if (y < 1500) {
    return 65 - ((y - 1420) / 80) * 50;
  } else {
    return 15;
  }
}

function getWallRight(y: number): number {
  return TRACK_WIDTH - getWallLeft(y);
}

function generateDynamicTrackLayout(seed: number): DynamicTrackLayout {
  let s = seed;
  const rand = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };

  // 1. Dual Rotating Spinners (Stage 2: Y 370 - 500)
  const spinners: SpinnerObstacle[] = [
    {
      id: `fan-1-${seed}`,
      x: 185 + (rand() - 0.5) * 20,
      y: 430,
      radius: 55,
      numBlades: 3,
      angle: rand() * Math.PI * 2,
      speed: 0.045,
      color: '#ec4899',
      hubRadius: 12,
    },
    {
      id: `fan-2-${seed}`,
      x: 375 + (rand() - 0.5) * 20,
      y: 430,
      radius: 55,
      numBlades: 3,
      angle: rand() * Math.PI * 2,
      speed: -0.045,
      color: '#3b82f6',
      hubRadius: 12,
    },
  ];

  // 2. Funnels (Phễu 1 & Phễu 2)
  const funnels: FunnelObstacle[] = [
    // Upper Funnel (Stage 3: Y 540 - 670)
    {
      id: `funnel-1-${seed}`,
      topY: 540,
      bottomY: 670,
      topWidth: 470,
      bottomWidth: 140,
      centerX: TRACK_WIDTH / 2,
      color: '#06b6d4',
      label: '',
    },
    // Lower Funnel (Stage 5: Y 1040 - 1170)
    {
      id: `funnel-2-${seed}`,
      topY: 1040,
      bottomY: 1170,
      topWidth: 470,
      bottomWidth: 140,
      centerX: TRACK_WIDTH / 2,
      color: '#8b5cf6',
      label: '',
    },
  ];

  // 3. Corner Path Shapes & Ziczac Downward Ramps
  const cornerDeflectors: CornerDeflector[] = [
    // Top Left Corner Guide
    { x1: 15, y1: 140, x2: 80, y2: 195, color: '#00f2fe' },
    // Top Right Corner Guide
    { x1: TRACK_WIDTH - 15, y1: 140, x2: TRACK_WIDTH - 80, y2: 195, color: '#00f2fe' },

    // Stage 4 Left Corner Deflector
    { x1: 15, y1: 700, x2: 85, y2: 745, color: '#38bdf8' },
    // Stage 4 Right Corner Deflector
    { x1: TRACK_WIDTH - 15, y1: 850, x2: TRACK_WIDTH - 85, y2: 895, color: '#38bdf8' },

    // Lower Left Corner Deflector
    { x1: 15, y1: 1010, x2: 85, y2: 1055, color: '#f59e0b' },
    // Lower Right Corner Deflector
    { x1: TRACK_WIDTH - 15, y1: 1010, x2: TRACK_WIDTH - 85, y2: 1055, color: '#f59e0b' },
  ];

  // 4. Smooth Ziczac Downward Ramps (Stage 4: Y 720 - 1000)
  const ramps = [
    ...cornerDeflectors,
    // Slope 1: Left -> Right Ziczac Slide (slanting downwards)
    { x1: 20, y1: 720, x2: 430, y2: 830, color: '#3b82f6' },
    // Slope 2: Right -> Left Ziczac Slide (slanting downwards)
    { x1: TRACK_WIDTH - 20, y1: 890, x2: 130, y2: 1000, color: '#3b82f6' },
  ];

  // 5. Pegs (Bàn đinh so le Stage 1)
  const pegs: { x: number; y: number; r: number }[] = [];
  const startY = 150;
  const dy = 42;
  for (let row = 0; row < 4; row++) {
    const y = startY + row * dy;
    const isEven = row % 2 === 0;
    const count = isEven ? 5 : 4;
    const startX = isEven ? 70 : 125;
    const stepX = (TRACK_WIDTH - 140) / (count - 1);
    for (let c = 0; c < count; c++) {
      const offsetX = (rand() - 0.5) * 6;
      pegs.push({ x: startX + c * stepX + offsetX, y, r: 5 });
    }
  }

  // Outer Pinball Bumper Pegs
  pegs.push({ x: 75, y: 1240, r: 12 });
  pegs.push({ x: TRACK_WIDTH - 75, y: 1240, r: 12 });

  // Seesaw Pivot
  const seesawPivot = { x: TRACK_WIDTH / 2, y: 1400, length: 220 };

  return {
    seed,
    spinners,
    funnels,
    ramps,
    pegs,
    seesawPivot,
  };
}

export const ZigZagPickerGame: React.FC<ZigZagPickerGameProps> = ({
  students = [],
  onSelectWinner = () => {},
  noRepeat = true,
}) => {
  // Deselected / Excluded student IDs state
  const [deselectedIds, setDeselectedIds] = useState<Set<string>>(new Set());
  const [finishedStudentIds, setFinishedStudentIds] = useState<Set<string>>(new Set());

  // Ensure we ALWAYS have students to race
  const safeStudents = useMemo(() => (students || []).filter(Boolean), [students]);
  const uncalledStudents = useMemo(
    () => safeStudents.filter((s) => !s.called && !s.excluded && !deselectedIds.has(s.id)),
    [safeStudents, deselectedIds]
  );
  const activeStudents = useMemo(
    () => (uncalledStudents.length > 0 ? uncalledStudents : safeStudents.filter((s) => !s.excluded && !deselectedIds.has(s.id))),
    [uncalledStudents, safeStudents, deselectedIds]
  );

  // Toggle single student deselection
  const handleToggleStudentSelection = useCallback((studentId: string) => {
    setDeselectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(studentId)) {
        next.delete(studentId);
      } else {
        next.add(studentId);
      }
      return next;
    });
  }, []);

  // Deselect all finished students
  const handleDeselectFinishedStudents = useCallback(() => {
    setDeselectedIds((prev) => {
      const next = new Set(prev);
      finishedStudentIds.forEach((id) => next.add(id));
      racersRef.current.forEach((r) => {
        if (r.finished && r.student?.id) {
          next.add(r.student.id);
        }
      });
      return next;
    });
  }, [finishedStudentIds]);

  // Select all students
  const handleSelectAllStudents = useCallback(() => {
    setDeselectedIds(new Set());
    setFinishedStudentIds(new Set());
  }, []);

  // Deselect winner/finished student and immediately reset for next race
  const handleDeselectAndRaceAgain = useCallback((targetStudentId?: string) => {
    setDeselectedIds((prev) => {
      const next = new Set(prev);
      if (targetStudentId) next.add(targetStudentId);
      finishedStudentIds.forEach((id) => next.add(id));
      racersRef.current.forEach((r) => {
        if (r.finished && r.student?.id) {
          next.add(r.student.id);
        }
      });
      return next;
    });
    setWinnerCard(null);
  }, [finishedStudentIds]);

  const [gameState, setGameState] = useState<'idle' | 'countdown' | 'racing' | 'paused' | 'finished'>('idle');
  const [speedMultiplier, setSpeedMultiplier] = useState<number>(1.0); // 0.5x, 0.75x, 1x, 1.5x, 2x
  const [elapsedMs, setElapsedMs] = useState<number>(0);
  const [isMuted, setIsMuted] = useState<boolean>(() => sound.getMuted());
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Custom student list modal
  const [showImportModal, setShowImportModal] = useState<boolean>(false);
  const [customListText, setCustomListText] = useState<string>('');

  // Live Event Commentary Logs
  const [logs, setLogs] = useState<RaceLog[]>([]);

  // Winner card modal
  const [winnerCard, setWinnerCard] = useState<{ student: Student; timeStr: string } | null>(null);

  // Canvas & Engine refs
  const rootContainerRef = useRef<HTMLDivElement | null>(null);
  const mainCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const mainViewportRef = useRef<HTMLDivElement | null>(null);
  const miniMapCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const confettiCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const confettiEngineRef = useRef<ConfettiEngine | null>(null);

  const racersRef = useRef<MarbleRacer[]>([]);
  const gameStateRef = useRef<'idle' | 'countdown' | 'racing' | 'paused' | 'finished'>('idle');
  const speedMultiplierRef = useRef<number>(1.0);
  const cameraYRef = useRef<number>(0); // Smooth camera tracking position
  const imageCache = useRef<Map<string, HTMLImageElement>>(new Map());
  const logContainerRef = useRef<HTMLDivElement | null>(null);

  const elapsedMsRef = useRef<number>(0);
  const lastLeaderboardSyncRef = useRef<number>(0);
  const lastStateSyncTimeRef = useRef<number>(0);

  // Leaderboard state (sorted racers by Y position descending)
  const [leaderboard, setLeaderboard] = useState<MarbleRacer[]>([]);

  // Seesaw state (pivoting see-saw obstacle at Stage 7)
  const seesawAngleRef = useRef<number>(0);
  const seesawAngularVelRef = useRef<number>(0);

  // Palette for student badge circles
  const badgeColors = [
    '#2563eb', '#dc2626', '#16a34a', '#d97706',
    '#9333ea', '#0891b2', '#ea580c', '#4f46e5',
    '#059669', '#db2777', '#ca8a04', '#0284c7',
  ];

  // Synchronous State Synchronizer
  const updateGameState = (newState: 'idle' | 'countdown' | 'racing' | 'paused' | 'finished') => {
    setGameState(newState);
    gameStateRef.current = newState;
  };

  useEffect(() => {
    speedMultiplierRef.current = speedMultiplier;
  }, [speedMultiplier]);

  // Preload student avatars (custom uploaded photo OR random graphic avatar)
  useEffect(() => {
    safeStudents.forEach((student, idx) => {
      if (student && student.id) {
        const avatarSrc = student.avatar || generateRandomStudentAvatarSvg(student.id, student.name, student.color || badgeColors[idx % badgeColors.length], idx);
        const existingImg = imageCache.current.get(student.id);
        if (!existingImg || (student.avatar && existingImg.src !== student.avatar)) {
          const img = new Image();
          img.src = avatarSrc;
          img.onload = () => {
            imageCache.current.set(student.id, img);
          };
        }
      }
    });
  }, [safeStudents]);

  // Format stopwatch string: "00:32,6"
  const formatStopwatch = (ms: number) => {
    const totalSec = Math.floor(ms / 1000);
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    const tenths = Math.floor((ms % 1000) / 100);

    const mm = String(mins).padStart(2, '0');
    const ss = String(secs).padStart(2, '0');
    return `${mm}:${ss},${tenths}`;
  };

  // Add event log to feed
  const addLog = useCallback((studentName: string, icon: string, message: string) => {
    const timeStr = formatStopwatch(elapsedMsRef.current);
    const newLog: RaceLog = {
      id: `${Date.now()}-${Math.random()}`,
      timeStr,
      icon,
      studentName,
      message,
    };
    setLogs((prev) => [newLog, ...prev.slice(0, 40)]);
  }, []);

  // Scroll log container to top on new entry
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = 0;
    }
  }, [logs]);

  // Track Layout Reference
  const trackLayoutRef = useRef<DynamicTrackLayout>(generateDynamicTrackLayout(12345));

  // Initialize Marbles Spawn Position & Generate Fresh Racetrack Layout!
  const initRacers = useCallback(() => {
    const pool = activeStudents.length > 0 ? activeStudents : safeStudents;
    const count = pool.length;
    cameraYRef.current = 0; // Reset camera to top

    // Generate fresh procedural track layout for every race!
    const newSeed = Date.now() + Math.floor(Math.random() * 100000);
    trackLayoutRef.current = generateDynamicTrackLayout(newSeed);

    if (count === 0) {
      racersRef.current = [];
      setLeaderboard([]);
      return;
    }

    // Single row or multi-row neat arrangement at the top gate
    const cols = Math.min(count, 10);
    const rows = Math.ceil(count / cols);
    const rowSpacing = 32;
    const paddingX = 40;
    const usableW = TRACK_WIDTH - paddingX * 2;

    racersRef.current = pool.map((s, idx) => {
      const rowIndex = Math.floor(idx / cols);
      const colIndex = idx % cols;
      const countInRow = rowIndex === rows - 1 ? count - rowIndex * cols : cols;
      
      const colSpacing = countInRow > 1 ? usableW / (countInRow - 1) : 0;
      const startX = countInRow > 1 ? paddingX + colIndex * colSpacing : TRACK_WIDTH / 2;
      const startY = Y_START - (rows - 1 - rowIndex) * rowSpacing;
      const avatarSrc = s.avatar || generateRandomStudentAvatarSvg(s.id, s.name, s.color || badgeColors[idx % badgeColors.length], idx);
      if (!imageCache.current.has(s.id)) {
        const img = new Image();
        img.src = avatarSrc;
        img.onload = () => {
          imageCache.current.set(s.id, img);
        };
      }

      return {
        student: s,
        number: idx + 1,
        initials: getInitials(s.name),
        x: startX,
        y: startY,
        vx: 0,
        vy: 0,
        rotation: 0,
        radius: 14,
        color: badgeColors[idx % badgeColors.length],
        finished: false,
        lastBounceTime: 0,
      };
    });

    setLeaderboard([...racersRef.current]);
    elapsedMsRef.current = 0;
    lastLeaderboardSyncRef.current = 0;
    lastStateSyncTimeRef.current = 0;
    setElapsedMs(0);
    setLogs([]);
    setWinnerCard(null);
    seesawAngleRef.current = 0;
    seesawAngularVelRef.current = 0;
  }, [activeStudents, safeStudents]);

  // Only init racers when game is idle (never reset during a race)
  useEffect(() => {
    if (gameStateRef.current === 'idle') {
      initRacers();
    }
  }, [initRacers]);

  // Seesaw Pivot & Finish Y
  const finishY = 1520;

  // Physics Simulation Step
  const updatePhysics = () => {
    if (gameStateRef.current !== 'racing') return;

    const mult = speedMultiplierRef.current;
    const gravity = 0.28 * mult;
    let firstFinishedRacer: MarbleRacer | null = null;
    const layout = trackLayoutRef.current;

    // Update Spinner Fan Rotations
    layout.spinners.forEach((sp) => {
      sp.angle += sp.speed * mult;
    });

    // Seesaw angular physics
    seesawAngleRef.current += seesawAngularVelRef.current;
    seesawAngularVelRef.current *= 0.94;
    seesawAngleRef.current *= 0.96;

    racersRef.current.forEach((racer) => {
      if (racer.finished) return;

      racer.vy += gravity;
      racer.vx += (Math.random() - 0.5) * 0.14;
      racer.vx *= 0.988;
      racer.vy *= 0.995;

      // Anti-stuck Watchdog
      const speedSq = racer.vx * racer.vx + racer.vy * racer.vy;
      if (speedSq < 0.25) {
        racer.stuckFrames = (racer.stuckFrames || 0) + 1;
        if (racer.stuckFrames > 20) {
          racer.vy += 1.4 + Math.random() * 0.8;
          racer.vx += (Math.random() - 0.5) * 2.5;
          racer.stuckFrames = 0;
        }
      } else {
        racer.stuckFrames = 0;
      }

      racer.x += racer.vx * mult;
      racer.y += racer.vy * mult;
      racer.rotation += (racer.vx * 0.08 + racer.vy * 0.02) * mult;

      // Continuous Outer Side Wall Physics Bounces
      const wLeft = getWallLeft(racer.y);
      const wRight = getWallRight(racer.y);

      if (racer.x - racer.radius < wLeft) {
        racer.x = wLeft + racer.radius;
        racer.vx = Math.abs(racer.vx) * 0.75 + 0.8;
      } else if (racer.x + racer.radius > wRight) {
        racer.x = wRight - racer.radius;
        racer.vx = -Math.abs(racer.vx) * 0.75 - 0.8;
      }

      // 1. Collisions with Ramps & Corner Deflectors
      layout.ramps.forEach((ramp) => {
        const dx = ramp.x2 - ramp.x1;
        const dy = ramp.y2 - ramp.y1;
        const len = Math.hypot(dx, dy);
        if (len === 0) return;

        const nx = -dy / len;
        const ny = dx / len;

        const mx = racer.x - ramp.x1;
        const my = racer.y - ramp.y1;

        const proj = (mx * dx + my * dy) / (len * len);
        if (proj >= 0 && proj <= 1) {
          const distNormal = mx * nx + my * ny;
          if (Math.abs(distNormal) < racer.radius + 3) {
            if (distNormal > 0) {
              racer.x = ramp.x1 + proj * dx + nx * (racer.radius + 3);
              racer.y = ramp.y1 + proj * dy + ny * (racer.radius + 3);
            } else {
              racer.x = ramp.x1 + proj * dx - nx * (racer.radius + 3);
              racer.y = ramp.y1 + proj * dy - ny * (racer.radius + 3);
            }

            const dot = racer.vx * nx + racer.vy * ny;
            racer.vx = (racer.vx - 1.6 * dot * nx) * 0.85 + (dx / len) * 1.6;
            racer.vy = Math.max(1.8 * mult, (racer.vy - 1.6 * dot * ny) * 0.85 + (dy / len) * 1.6);

            if (Date.now() - racer.lastBounceTime > 1500 && Math.random() < 0.1) {
              racer.lastBounceTime = Date.now();
              addLog(racer.student.name, '🌀', 'va gờ cua chệch hướng bứt phá!');
            }
          }
        }
      });

      // 2. Collisions with Pegs
      layout.pegs.forEach((peg) => {
        const dx = racer.x - peg.x;
        const dy = racer.y - peg.y;
        const dist = Math.hypot(dx, dy);
        const minDist = racer.radius + peg.r;

        if (dist < minDist && dist > 0) {
          const nx = dx / dist;
          const ny = dy / dist;

          racer.x = peg.x + nx * minDist;
          racer.y = peg.y + ny * minDist;

          const dot = racer.vx * nx + racer.vy * ny;
          racer.vx = (racer.vx - 1.8 * dot * nx) + nx * 2.0;
          racer.vy = (racer.vy - 1.8 * dot * ny) + ny * 2.0;

          sound.playTick(1.4);

          if (Date.now() - racer.lastBounceTime > 2000) {
            racer.lastBounceTime = Date.now();
            addLog(racer.student.name, '💥', 'va đinh nảy bật ngoạn mục!');
          }
        }
      });

      // 3. Collisions with Spinners
      layout.spinners.forEach((sp) => {
        const cDx = racer.x - sp.x;
        const cDy = racer.y - sp.y;
        const cDist = Math.hypot(cDx, cDy);

        if (cDist < sp.radius + racer.radius + 10) {
          if (cDist < sp.hubRadius + racer.radius && cDist > 0) {
            const nx = cDx / cDist;
            const ny = cDy / cDist;
            racer.x = sp.x + nx * (sp.hubRadius + racer.radius);
            racer.y = sp.y + ny * (sp.hubRadius + racer.radius);

            const dot = racer.vx * nx + racer.vy * ny;
            racer.vx = (racer.vx - 1.8 * dot * nx) + nx * 2.0;
            racer.vy = (racer.vy - 1.8 * dot * ny) + ny * 2.0;
            sound.playTick(1.5);
          }

          for (let b = 0; b < sp.numBlades; b++) {
            const bladeAngle = sp.angle + (Math.PI * 2 / sp.numBlades) * b;
            const bx2 = sp.x + Math.cos(bladeAngle) * sp.radius;
            const by2 = sp.y + Math.sin(bladeAngle) * sp.radius;

            const dx = bx2 - sp.x;
            const dy = by2 - sp.y;
            const lenSq = dx * dx + dy * dy;
            if (lenSq === 0) continue;

            const proj = Math.max(0, Math.min(1, ((racer.x - sp.x) * dx + (racer.y - sp.y) * dy) / lenSq));
            const nearestX = sp.x + proj * dx;
            const nearestY = sp.y + proj * dy;

            const distDx = racer.x - nearestX;
            const distDy = racer.y - nearestY;
            const dist = Math.hypot(distDx, distDy);
            const bladeThickness = 7;

            if (dist < racer.radius + bladeThickness && dist > 0) {
              const nx = distDx / dist;
              const ny = distDy / dist;

              racer.x = nearestX + nx * (racer.radius + bladeThickness);
              racer.y = nearestY + ny * (racer.radius + bladeThickness);

              const distFromHub = proj * sp.radius;
              const vBladeTangent = sp.speed * distFromHub * 0.8;
              const tanX = -Math.sin(bladeAngle) * vBladeTangent;
              const tanY = Math.cos(bladeAngle) * vBladeTangent;

              const dot = racer.vx * nx + racer.vy * ny;
              racer.vx = (racer.vx - 1.6 * dot * nx) * 0.7 + nx * 3.2 + tanX * 1.2;
              racer.vy = (racer.vy - 1.6 * dot * ny) * 0.7 + ny * 3.2 + tanY * 1.2;

              sound.playTick(1.8);

              if (Date.now() - racer.lastBounceTime > 1800) {
                racer.lastBounceTime = Date.now();
                addLog(racer.student?.name || 'Học sinh', '🌀', 'va cánh quạt quay bật văng cực nhanh!');
              }
            }
          }
        }
      });

      // 4. Funnel Swirl Physics
      layout.funnels.forEach((f) => {
        if (racer.y >= f.topY - 10 && racer.y <= f.bottomY + 20) {
          const distFromCenter = racer.x - f.centerX;
          const progress = Math.min(1, Math.max(0, (racer.y - f.topY) / (f.bottomY - f.topY)));
          const currentHalfWidth = ((f.topWidth * (1 - progress) + f.bottomWidth * progress) / 2);

          if (Math.abs(distFromCenter) <= currentHalfWidth + 15) {
            const inwardDirection = distFromCenter > 0 ? -1 : 1;
            racer.vx += inwardDirection * 0.18 * mult;

            const swirlForce = (distFromCenter > 0 ? -1 : 1) * 0.14 * mult;
            racer.vx += swirlForce;

            if (racer.y >= f.bottomY - 25 && Math.abs(distFromCenter) < f.bottomWidth) {
              racer.vy += 0.35 * mult;
            }

            if (Date.now() - racer.lastBounceTime > 2500 && Math.random() < 0.05) {
              racer.lastBounceTime = Date.now();
              addLog(racer.student?.name || 'Học sinh', '🔻', 'đang xoáy tròn cuồn cuộn qua lòng hố phễu!');
            }
          }
        }
      });

      // 5. Seesaw Physics
      const ssAngle = seesawAngleRef.current;
      const cosA = Math.cos(ssAngle);
      const sinA = Math.sin(ssAngle);

      const seesawPivot = layout.seesawPivot;
      const relX = racer.x - seesawPivot.x;
      const relY = racer.y - seesawPivot.y;
      const localX = relX * cosA + relY * sinA;
      const localY = -relX * sinA + relY * cosA;

      const halfLen = seesawPivot.length / 2;
      if (Math.abs(localX) <= halfLen && Math.abs(localY) <= racer.radius + 5) {
        if (localY < 0) {
          racer.y = seesawPivot.y + localX * sinA - (racer.radius + 5) * cosA;
          racer.vy = -Math.abs(racer.vy) * 0.6;
        } else {
          racer.y = seesawPivot.y + localX * sinA + (racer.radius + 5) * cosA;
          racer.vy = Math.abs(racer.vy) * 0.6;
        }

        const torque = (localX / halfLen) * 0.02;
        seesawAngularVelRef.current += torque;

        if (Date.now() - racer.lastBounceTime > 2000) {
          racer.lastBounceTime = Date.now();
          addLog(racer.student?.name || 'Học sinh', '⚖️', 'vừa giữ thăng bằng vượt qua cầu bập bồng!');
        }
      }

      // 6. Elastic collisions between marbles
      racersRef.current.forEach((other) => {
        if (other === racer || other.finished) return;
        const dx = other.x - racer.x;
        const dy = other.y - racer.y;
        const dist = Math.hypot(dx, dy);
        const minD = racer.radius + other.radius;

        if (dist < minD && dist > 0) {
          const nx = dx / dist;
          const ny = dy / dist;

          const overlap = 0.5 * (minD - dist);
          racer.x -= nx * overlap;
          racer.y -= ny * overlap;
          other.x += nx * overlap;
          other.y += ny * overlap;

          const kx = racer.vx - other.vx;
          const ky = racer.vy - other.vy;
          const p = 1.0 * (nx * kx + ny * ky);

          racer.vx -= p * nx;
          racer.vy -= p * ny;
          other.vx += p * nx;
          other.vy += p * ny;
        }
      });

      // 7. Check Finish Line Crossing
      if (racer.y >= finishY && !racer.finished) {
        racer.finished = true;
        if (racer.student?.id) {
          setFinishedStudentIds((prev) => new Set(prev).add(racer.student.id));
        }
        if (!firstFinishedRacer) {
          firstFinishedRacer = racer;
        }
      }
    });

    const now = Date.now();
    if (now - lastLeaderboardSyncRef.current > 100 || firstFinishedRacer) {
      lastLeaderboardSyncRef.current = now;
      const sorted = [...racersRef.current].sort((a, b) => b.y - a.y);
      setLeaderboard(sorted);
    }

    if (firstFinishedRacer) {
      const winner = firstFinishedRacer as MarbleRacer;
      updateGameState('finished');
      sound.playFanfare();

      if (confettiCanvasRef.current) {
        if (!confettiEngineRef.current) {
          confettiEngineRef.current = new ConfettiEngine(confettiCanvasRef.current);
        }
        confettiEngineRef.current.fireCelebration();
      }

      const timeStr = formatStopwatch(elapsedMsRef.current);
      if (winner && winner.student) {
        setWinnerCard({ student: winner.student, timeStr });
        addLog(winner.student.name || 'Học sinh', '👑', `đã xuất sắc CÁN ĐÍCH VỀ NHẤT trong ${timeStr}!`);
        onSelectWinner(winner.student);
      }
    }
  };

  // Main Render Animation Loop
  useEffect(() => {
    let animationFrameId: number;

    const render = () => {
      const mainCanvas = mainCanvasRef.current;
      const miniMapCanvas = miniMapCanvasRef.current;

      if (!mainCanvas || !miniMapCanvas) {
        animationFrameId = requestAnimationFrame(render);
        return;
      }
      const ctx = mainCanvas.getContext('2d');
      const miniCtx = miniMapCanvas.getContext('2d');
      if (!ctx || !miniCtx) {
        animationFrameId = requestAnimationFrame(render);
        return;
      }

      const parent = mainViewportRef.current;
      if (parent) {
        const rect = parent.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          if (mainCanvas.width !== rect.width || mainCanvas.height !== rect.height) {
            mainCanvas.width = rect.width;
            mainCanvas.height = rect.height;
          }
        }
      }

      if (miniMapCanvas.width !== 180 || miniMapCanvas.height !== 280) {
        miniMapCanvas.width = 180;
        miniMapCanvas.height = 280;
      }

      const W = mainCanvas.width || 600;
      const H = mainCanvas.height || 500;
      const layout = trackLayoutRef.current;

      // Update Physics if Racing
      if (gameStateRef.current === 'racing') {
        const delta = 16.6 * speedMultiplierRef.current;
        elapsedMsRef.current += delta;

        if (Date.now() - lastStateSyncTimeRef.current > 100) {
          lastStateSyncTimeRef.current = Date.now();
          setElapsedMs(elapsedMsRef.current);
        }

        updatePhysics();
      }

      // Calculate Lead Y from actual current marble positions
      let leadY = Y_START;
      if (racersRef.current.length > 0) {
        for (let i = 0; i < racersRef.current.length; i++) {
          if (racersRef.current[i].y > leadY) {
            leadY = racersRef.current[i].y;
          }
        }
      }

      const scale = W / TRACK_WIDTH;
      const visibleH = H / scale;

      const targetCameraY =
        gameStateRef.current === 'idle' || gameStateRef.current === 'countdown'
          ? 0
          : Math.max(0, Math.min(TRACK_HEIGHT - visibleH, leadY - visibleH * 0.38));

      cameraYRef.current += (targetCameraY - cameraYRef.current) * 0.12;
      const cameraY = cameraYRef.current;

      // 1. RENDER MAIN VIEWPORT ARENA
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(0, 0, W, H);

      ctx.save();
      ctx.scale(scale, scale);
      ctx.translate(0, -cameraY);

      // Track Grid Subtle Pattern
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 1;
      for (let gy = 0; gy < TRACK_HEIGHT; gy += 80) {
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.lineTo(TRACK_WIDTH, gy);
        ctx.stroke();
      }

      // CONTINUOUS OUTER FRAME BOUNDARIES (Thương hiệu nét liền mạch nhất quán)
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      // Left Outer Frame Line
      ctx.beginPath();
      ctx.moveTo(15, 0);
      ctx.lineTo(65, 80);
      ctx.lineTo(65, 1420);
      ctx.lineTo(15, 1500);
      ctx.lineTo(15, TRACK_HEIGHT);
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 14;
      ctx.stroke();

      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 4;
      ctx.stroke();

      // Right Outer Frame Line
      ctx.beginPath();
      ctx.moveTo(TRACK_WIDTH - 15, 0);
      ctx.lineTo(TRACK_WIDTH - 65, 80);
      ctx.lineTo(TRACK_WIDTH - 65, 1420);
      ctx.lineTo(TRACK_WIDTH - 15, 1500);
      ctx.lineTo(TRACK_WIDTH - 15, TRACK_HEIGHT);
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 14;
      ctx.stroke();

      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 4;
      ctx.stroke();

      // Starting Gate Barrier Beam
      if (gameStateRef.current === 'idle' || gameStateRef.current === 'countdown') {
        ctx.save();
        ctx.fillStyle = 'rgba(239, 68, 68, 0.9)';
        ctx.strokeStyle = '#dc2626';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.roundRect(65, Y_START + 18, TRACK_WIDTH - 130, 8, 4);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }

      // Render 3D Funnels (Matching Thick Solid Line Frame)
      layout.funnels.forEach((f) => {
        ctx.save();
        const topLx = f.centerX - f.topWidth / 2;
        const topRx = f.centerX + f.topWidth / 2;
        const botLx = f.centerX - f.bottomWidth / 2;
        const botRx = f.centerX + f.bottomWidth / 2;

        const bowlGrad = ctx.createLinearGradient(0, f.topY, 0, f.bottomY);
        bowlGrad.addColorStop(0, 'rgba(226, 232, 240, 0.6)');
        bowlGrad.addColorStop(0.5, `${f.color}20`);
        bowlGrad.addColorStop(1, 'rgba(241, 245, 249, 0.8)');

        ctx.fillStyle = bowlGrad;
        ctx.beginPath();
        ctx.moveTo(topLx, f.topY);
        ctx.lineTo(topRx, f.topY);
        ctx.lineTo(botRx, f.bottomY);
        ctx.lineTo(botLx, f.bottomY);
        ctx.closePath();
        ctx.fill();

        const numRings = 5;
        for (let r = 0; r <= numRings; r++) {
          const t = r / numRings;
          const ry = f.topY + t * (f.bottomY - f.topY);
          const rw = (f.topWidth * (1 - t) + f.bottomWidth * t) / 2;

          ctx.strokeStyle = `${f.color}${Math.floor((1 - t * 0.4) * 160).toString(16).padStart(2, '0')}`;
          ctx.lineWidth = t === 0 || t === 1 ? 3 : 1.5;
          ctx.beginPath();
          ctx.ellipse(f.centerX, ry, rw, Math.max(6, rw * 0.16), 0, 0, Math.PI * 2);
          ctx.stroke();
        }

        ctx.fillStyle = '#0f172a';
        ctx.strokeStyle = f.color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(f.centerX, f.bottomY, f.bottomWidth / 2, 10, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Thick Continuous Outer Slanted Funnel Walls
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 10;
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(topLx, f.topY); ctx.lineTo(botLx, f.bottomY);
        ctx.moveTo(topRx, f.topY); ctx.lineTo(botRx, f.bottomY);
        ctx.stroke();

        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(topLx, f.topY); ctx.lineTo(botLx, f.bottomY);
        ctx.moveTo(topRx, f.topY); ctx.lineTo(botRx, f.bottomY);
        ctx.stroke();

        ctx.restore();
      });

      // Render Corner Chutes & Ramps (Matching Thick Solid Line Frame)
      layout.ramps.forEach((ramp) => {
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 10;
        ctx.beginPath();
        ctx.moveTo(ramp.x1, ramp.y1);
        ctx.lineTo(ramp.x2, ramp.y2);
        ctx.stroke();

        ctx.strokeStyle = ramp.color || '#38bdf8';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(ramp.x1, ramp.y1);
        ctx.lineTo(ramp.x2, ramp.y2);
        ctx.stroke();
      });

      // Render Pinball Pegs & Plinko Grid
      layout.pegs.forEach((peg) => {
        ctx.fillStyle = '#f59e0b';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2.0;
        ctx.beginPath();
        ctx.arc(peg.x, peg.y, peg.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#fef3c7';
        ctx.beginPath();
        ctx.arc(peg.x, peg.y, peg.r * 0.4, 0, Math.PI * 2);
        ctx.fill();
      });

      // Render Spinner Fans (Cánh Quạt Quay)
      layout.spinners.forEach((sp) => {
        ctx.save();
        ctx.translate(sp.x, sp.y);

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(0, 0, sp.radius, 0, Math.PI * 2);
        ctx.stroke();

        ctx.save();
        ctx.rotate(sp.angle);

        for (let b = 0; b < sp.numBlades; b++) {
          ctx.save();
          ctx.rotate((Math.PI * 2 / sp.numBlades) * b);

          const grad = ctx.createLinearGradient(0, 0, sp.radius, 0);
          grad.addColorStop(0, '#f87171');
          grad.addColorStop(0.5, sp.color);
          grad.addColorStop(1, '#ffffff');

          ctx.fillStyle = grad;
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.5;

          ctx.beginPath();
          ctx.moveTo(sp.hubRadius, -5);
          ctx.lineTo(sp.radius, -8);
          ctx.arc(sp.radius, 0, 8, -Math.PI / 2, Math.PI / 2);
          ctx.lineTo(sp.hubRadius, 5);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();

          ctx.restore();
        }
        ctx.restore();

        const hubGrad = ctx.createRadialGradient(0, 0, 2, 0, 0, sp.hubRadius);
        hubGrad.addColorStop(0, '#fef08a');
        hubGrad.addColorStop(0.7, '#eab308');
        hubGrad.addColorStop(1, '#78350f');

        ctx.fillStyle = hubGrad;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, sp.hubRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.restore();
      });

      // Render Seesaw Beam
      const ssAngle = seesawAngleRef.current;
      const seesawPivot = layout.seesawPivot;
      ctx.save();
      ctx.translate(seesawPivot.x, seesawPivot.y);
      ctx.fillStyle = '#94a3b8';
      ctx.beginPath();
      ctx.moveTo(-10, 18); ctx.lineTo(10, 18); ctx.lineTo(0, 0);
      ctx.closePath();
      ctx.fill();

      ctx.rotate(ssAngle);
      ctx.strokeStyle = '#22c55e';
      ctx.lineWidth = 8;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-seesawPivot.length / 2, 0);
      ctx.lineTo(seesawPivot.length / 2, 0);
      ctx.stroke();
      ctx.restore();

      // Render Finish Line
      ctx.save();
      ctx.translate(0, finishY);
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(15, -6, TRACK_WIDTH - 30, 12);

      const numBlocks = 18;
      const blockW = (TRACK_WIDTH - 30) / numBlocks;
      for (let i = 0; i < numBlocks; i++) {
        ctx.fillStyle = i % 2 === 0 ? '#ffffff' : '#000000';
        ctx.fillRect(15 + i * blockW, -5, blockW, 10);
      }
      ctx.restore();

      // Render All Marbles
      const sortedByY = [...racersRef.current].sort((a, b) => a.y - b.y);

      sortedByY.forEach((racer) => {
        ctx.save();
        ctx.translate(racer.x, racer.y);

        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.beginPath();
        ctx.ellipse(0, racer.radius + 2, racer.radius * 0.85, 4, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.save();
        ctx.rotate(racer.rotation || 0);

        ctx.fillStyle = racer.color;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(0, 0, racer.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(0, 0, racer.radius * 0.5, 0.4, Math.PI * 1.3);
        ctx.stroke();

        let img = racer.student?.id ? imageCache.current.get(racer.student.id) : undefined;
        if (!img && racer.student?.id) {
          const avatarSrc = racer.student.avatar || generateRandomStudentAvatarSvg(racer.student.id, racer.student.name, racer.color, racer.number);
          const newImg = new Image();
          newImg.src = avatarSrc;
          newImg.onload = () => {
            if (racer.student?.id) imageCache.current.set(racer.student.id, newImg);
          };
        }

        if (img) {
          ctx.save();
          ctx.beginPath();
          ctx.arc(0, 0, racer.radius - 1, 0, Math.PI * 2);
          ctx.clip();
          ctx.drawImage(img, -racer.radius + 1, -racer.radius + 1, (racer.radius - 1) * 2, (racer.radius - 1) * 2);
          ctx.restore();
        } else {
          ctx.save();
          ctx.beginPath();
          ctx.arc(0, 0, racer.radius - 1, 0, Math.PI * 2);
          ctx.clip();
          ctx.fillStyle = racer.color;
          ctx.fillRect(-racer.radius, -racer.radius, racer.radius * 2, racer.radius * 2);

          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 10px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(racer.initials || getInitials(racer.student?.name || 'HS'), 0, 0);
          ctx.restore();
        }
        ctx.restore();

        const nameText = getShortName(racer.student?.name || '');
        ctx.font = '700 10px sans-serif';
        const tw = ctx.measureText(nameText).width;

        ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
        ctx.strokeStyle = racer.color;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(-tw / 2 - 4, -racer.radius - 18, tw + 8, 14, 5);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.fillText(nameText, 0, -racer.radius - 8);

        ctx.restore();
      });

      ctx.restore();

      // 2. RENDER MINIMAP
      const mW = 180;
      const mH = 280;
      const scaleY = mH / TRACK_HEIGHT;
      const scaleX = mW / TRACK_WIDTH;

      miniCtx.fillStyle = '#0f172a';
      miniCtx.fillRect(0, 0, mW, mH);

      // MiniMap Outer Frame Boundaries
      miniCtx.strokeStyle = '#38bdf8';
      miniCtx.lineWidth = 2;
      miniCtx.beginPath();
      miniCtx.moveTo(15 * scaleX, 0);
      miniCtx.lineTo(65 * scaleX, 80 * scaleY);
      miniCtx.lineTo(65 * scaleX, 1420 * scaleY);
      miniCtx.lineTo(15 * scaleX, 1500 * scaleY);
      miniCtx.lineTo(15 * scaleX, mH);
      miniCtx.stroke();

      miniCtx.beginPath();
      miniCtx.moveTo((TRACK_WIDTH - 15) * scaleX, 0);
      miniCtx.lineTo((TRACK_WIDTH - 65) * scaleX, 80 * scaleY);
      miniCtx.lineTo((TRACK_WIDTH - 65) * scaleX, 1420 * scaleY);
      miniCtx.lineTo((TRACK_WIDTH - 15) * scaleX, 1500 * scaleY);
      miniCtx.lineTo((TRACK_WIDTH - 15) * scaleX, mH);
      miniCtx.stroke();

      miniCtx.strokeStyle = '#64748b';
      miniCtx.lineWidth = 1.5;
      layout.ramps.forEach((ramp) => {
        miniCtx.beginPath();
        miniCtx.moveTo(ramp.x1 * scaleX, ramp.y1 * scaleY);
        miniCtx.lineTo(ramp.x2 * scaleX, ramp.y2 * scaleY);
        miniCtx.stroke();
      });

      layout.funnels.forEach((f) => {
        miniCtx.fillStyle = `${f.color}55`;
        miniCtx.strokeStyle = f.color;
        miniCtx.lineWidth = 1;
        miniCtx.beginPath();
        miniCtx.moveTo((f.centerX - f.topWidth / 2) * scaleX, f.topY * scaleY);
        miniCtx.lineTo((f.centerX + f.topWidth / 2) * scaleX, f.topY * scaleY);
        miniCtx.lineTo((f.centerX + f.bottomWidth / 2) * scaleX, f.bottomY * scaleY);
        miniCtx.lineTo((f.centerX - f.bottomWidth / 2) * scaleX, f.bottomY * scaleY);
        miniCtx.closePath();
        miniCtx.fill();
        miniCtx.stroke();
      });

      miniCtx.fillStyle = '#f59e0b';
      layout.pegs.forEach((peg) => {
        miniCtx.beginPath();
        miniCtx.arc(peg.x * scaleX, peg.y * scaleY, 1.5, 0, Math.PI * 2);
        miniCtx.fill();
      });

      miniCtx.strokeStyle = '#ec4899';
      miniCtx.lineWidth = 1.5;
      layout.spinners.forEach((sp) => {
        miniCtx.save();
        miniCtx.translate(sp.x * scaleX, sp.y * scaleY);
        miniCtx.rotate(sp.angle);
        const mR = sp.radius * scaleX;
        miniCtx.beginPath();
        miniCtx.moveTo(-mR, 0); miniCtx.lineTo(mR, 0);
        miniCtx.moveTo(0, -mR); miniCtx.lineTo(0, mR);
        miniCtx.stroke();
        miniCtx.restore();
      });

      miniCtx.strokeStyle = '#ef4444';
      miniCtx.lineWidth = 2;
      miniCtx.beginPath();
      miniCtx.moveTo(0, finishY * scaleY);
      miniCtx.lineTo(mW, finishY * scaleY);
      miniCtx.stroke();

      let leaderRacer: MarbleRacer | null = null;
      let maxYInRacers = -1;

      racersRef.current.forEach((racer) => {
        if (racer.y > maxYInRacers) {
          maxYInRacers = racer.y;
          leaderRacer = racer;
        }

        miniCtx.fillStyle = racer.color;
        miniCtx.beginPath();
        miniCtx.arc(racer.x * scaleX, racer.y * scaleY, 3, 0, Math.PI * 2);
        miniCtx.fill();
      });

      if (leaderRacer) {
        const lx = (leaderRacer as MarbleRacer).x * scaleX;
        const ly = (leaderRacer as MarbleRacer).y * scaleY;
        miniCtx.strokeStyle = '#f59e0b';
        miniCtx.lineWidth = 1.5;
        miniCtx.beginPath();
        miniCtx.arc(lx, ly, 6, 0, Math.PI * 2);
        miniCtx.stroke();
      }

      const boxH = Math.min(mH, H * scaleY);
      const boxY = Math.max(0, Math.min(mH - boxH, cameraY * scaleY));

      miniCtx.strokeStyle = '#ef4444';
      miniCtx.lineWidth = 2;
      miniCtx.strokeRect(2, boxY, mW - 4, boxH);

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  // Current active stage title based on leading marble Y position
  const leadY = leaderboard && leaderboard[0] ? leaderboard[0].y : 0;
  const rawStageIndex = Math.floor((leadY / TRACK_HEIGHT) * STAGES.length);
  const currentStageIndex = Math.max(0, Math.min(STAGES.length - 1, isNaN(rawStageIndex) ? 0 : rawStageIndex));
  const currentStage = STAGES[currentStageIndex] || STAGES[0];

  // Play / Pause / Reset
  const handleTogglePlay = () => {
    const pool = activeStudents.length > 0 ? activeStudents : safeStudents;
    if (pool.length === 0) return;

    if (gameStateRef.current === 'idle') {
      sound.playSelect();
      initRacers();
      sound.playWhistle();
      sound.startBgMusic();
      // GATE OPENS IMMEDIATELY! Give marbles initial downward gravity drop impulse
      racersRef.current.forEach((racer) => {
        racer.vy = 1.5 + Math.random() * 1.5;
        racer.vx = (Math.random() - 0.5) * 2.5;
      });
      updateGameState('racing');
    } else if (gameStateRef.current === 'racing') {
      updateGameState('paused');
      sound.stopBgMusic();
    } else if (gameStateRef.current === 'paused') {
      updateGameState('racing');
      sound.startBgMusic();
    } else if (gameStateRef.current === 'finished') {
      initRacers();
      sound.playWhistle();
      sound.startBgMusic();
      racersRef.current.forEach((racer) => {
        racer.vy = 1.5 + Math.random() * 1.5;
        racer.vx = (Math.random() - 0.5) * 2.5;
      });
      updateGameState('racing');
    }
  };

  const handleReset = () => {
    sound.playSelect();
    initRacers();
    updateGameState('idle');
  };

  const handleToggleFullscreen = () => {
    if (!rootContainerRef.current) return;
    if (!document.fullscreenElement) {
      rootContainerRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const handleToggleSound = () => {
    const muted = sound.toggleMute();
    setIsMuted(muted);
  };

  // Import custom list
  const handleSaveCustomList = () => {
    if (!customListText.trim()) return;
    const lines = customListText
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length > 0) {
      const newStudents: Student[] = lines.map((name, i) => ({
        id: `custom-${Date.now()}-${i}`,
        name,
        className: 'Tùy chỉnh',
        color: badgeColors[i % badgeColors.length],
        called: false,
        calledCount: 0,
      }));

      racersRef.current = newStudents.map((s, idx) => ({
        student: s,
        number: idx + 1,
        initials: getInitials(s.name),
        x: TRACK_WIDTH / 2,
        y: Y_START,
        vx: 0,
        vy: 0,
        rotation: 0,
        radius: 14,
        color: badgeColors[idx % badgeColors.length],
        finished: false,
        lastBounceTime: 0,
      }));

      setLeaderboard([...racersRef.current]);
      setShowImportModal(false);
      setCustomListText('');
      updateGameState('idle');
      sound.playWhistle();
    }
  };

  const currentPool = activeStudents.length > 0 ? activeStudents : safeStudents;

  return (
    <div
      ref={rootContainerRef}
      className="flex flex-col h-full bg-slate-950 text-slate-100 overflow-hidden font-sans select-none"
    >
      {/* 1. HEADER TOOLBAR CONTROL BAR */}
      <div className="flex flex-wrap items-center justify-between px-4 py-2.5 bg-slate-900 border-b border-slate-800 shadow-md gap-3 z-20">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-700">
            <Sparkles className="w-5 h-5 text-amber-400 animate-pulse" />
            <span className="font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-orange-300 to-yellow-200 text-sm">
              ĐUA BI MARBLE ZÍC-ZẮC VƯỢT ẢI
            </span>
          </div>

          <button
            onClick={() => setShowImportModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl transition-all cursor-pointer"
          >
            <Edit3 className="w-3.5 h-3.5 text-sky-400" />
            Nhập danh sách ({currentPool.length})
          </button>
        </div>

        {/* Speed Controls & Main Game Actions */}
        <div className="flex items-center gap-2">
          {/* Speed selector buttons */}
          <div className="hidden sm:flex items-center bg-slate-800/90 rounded-xl p-1 border border-slate-700 text-xs font-semibold">
            <span className="px-2 text-slate-400">Tốc độ:</span>
            {[
              { label: '0.5x', val: 0.5 },
              { label: '1x', val: 1.0 },
              { label: '1.5x', val: 1.5 },
              { label: '2x', val: 2.0 },
            ].map((s) => (
              <button
                key={s.label}
                onClick={() => setSpeedMultiplier(s.val)}
                className={`px-2 py-1 rounded-lg transition-all cursor-pointer ${
                  speedMultiplier === s.val
                    ? 'bg-amber-500 text-slate-950 font-bold shadow'
                    : 'text-slate-300 hover:bg-slate-700'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* PLAY / PAUSE BUTTON */}
          <button
            onClick={handleTogglePlay}
            disabled={currentPool.length === 0}
            className={`flex items-center gap-2 px-5 py-2 rounded-xl font-black text-sm shadow-lg transition-all transform active:scale-95 cursor-pointer ${
              currentPool.length === 0
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                : gameState === 'racing'
                ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/20'
                : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/20'
            }`}
          >
            {gameState === 'racing' ? (
              <>
                <Pause className="w-4 h-4 fill-current" /> TẠM DỪNG
              </>
            ) : gameState === 'countdown' ? (
              <span className="animate-pulse">CHUẨN BỊ...</span>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current" /> BẮT ĐẦU ĐUA
              </>
            )}
          </button>

          <button
            onClick={handleReset}
            className="p-2 text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl transition-all cursor-pointer"
            title="Làm mới cuộc đua"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <button
            onClick={handleToggleSound}
            className="p-2 text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl transition-all cursor-pointer"
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
          </button>

          <button
            onClick={handleToggleFullscreen}
            className="p-2 text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl transition-all cursor-pointer"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* 2. MAIN THREE-COLUMN RACE LAYOUT */}
      <div className="flex-1 flex overflow-hidden p-2 gap-2 relative">
        {/* COLUMN 1: LEFT PANEL - STUDENT PARTICIPANT LIST & SELECTION CONTROL */}
        <div className="w-60 sm:w-68 bg-slate-900/90 border border-slate-800 rounded-2xl flex flex-col overflow-hidden shadow-xl">
          <div className="p-3 bg-slate-800/90 border-b border-slate-700 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Users className="w-4 h-4 text-amber-400" />
                <span className="font-extrabold text-xs text-slate-200 uppercase tracking-wide">
                  THAM GIA ({currentPool.length}/{safeStudents.length})
                </span>
              </div>
              <span className="text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full border border-amber-500/30">
                {formatStopwatch(elapsedMs)}
              </span>
            </div>

            {/* Quick Batch Actions for Deselecting / Selecting Students */}
            <div className="flex items-center gap-1.5 pt-1 border-t border-slate-700/60">
              <button
                onClick={handleDeselectFinishedStudents}
                disabled={finishedStudentIds.size === 0 && Array.from(deselectedIds).length === 0}
                className="flex-1 flex items-center justify-center gap-1 px-2 py-1 text-[10px] font-bold bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                title="Bỏ chọn các học sinh đã về đích"
              >
                <UserMinus className="w-3 h-3" />
                Bỏ chọn HS về đích
              </button>

              {deselectedIds.size > 0 && (
                <button
                  onClick={handleSelectAllStudents}
                  className="flex items-center justify-center gap-1 px-2 py-1 text-[10px] font-bold bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/30 rounded-lg transition-all cursor-pointer"
                  title="Chọn lại tất cả học sinh"
                >
                  <RefreshCw className="w-3 h-3" />
                  Chọn tất cả
                </button>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1.5 custom-scrollbar">
            {safeStudents.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-xs">Chưa có học sinh nào.</div>
            ) : (
              safeStudents.map((student, idx) => {
                const isDeselected = deselectedIds.has(student.id);
                const isFinished = finishedStudentIds.has(student.id);

                return (
                  <div
                    key={student.id}
                    className={`flex items-center justify-between p-2 rounded-xl border transition-all text-xs ${
                      isDeselected
                        ? 'bg-slate-900/40 border-slate-800/60 text-slate-500 opacity-60'
                        : isFinished
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                        : idx === 0
                        ? 'bg-amber-500/15 border-amber-500/40 text-amber-200 font-bold'
                        : 'bg-slate-800/50 border-slate-700/60 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {/* Selection Checkbox */}
                      <button
                        onClick={() => handleToggleStudentSelection(student.id)}
                        className="p-0.5 text-slate-400 hover:text-amber-400 transition-colors cursor-pointer shrink-0"
                        title={isDeselected ? 'Chọn lại học sinh này' : 'Bỏ chọn học sinh này'}
                      >
                        {isDeselected ? (
                          <Square className="w-3.5 h-3.5 text-slate-600" />
                        ) : (
                          <CheckSquare className="w-3.5 h-3.5 text-amber-400" />
                        )}
                      </button>

                      <div
                        className="w-3.5 h-3.5 rounded-full border border-white/40 shrink-0"
                        style={{ backgroundColor: student.color || badgeColors[idx % badgeColors.length] }}
                      />

                      <span className={`truncate font-medium ${isDeselected ? 'line-through' : ''}`}>
                        {student.name || 'Học sinh'}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {isDeselected ? (
                        <span className="text-[9px] font-bold text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700">
                          BỎ CHỌN
                        </span>
                      ) : isFinished ? (
                        <span className="text-[9px] font-black text-emerald-400 bg-emerald-500/20 px-1.5 py-0.5 rounded border border-emerald-500/30 flex items-center gap-1">
                          <CheckCircle2 className="w-2.5 h-2.5" /> ĐÃ ĐÍCH
                        </span>
                      ) : null}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* COLUMN 2: CENTER MAIN CANYON ARENA & VIEWPORT (MAXIMIZED VERTICAL SPACE) */}
        <div className="flex-1 flex flex-col bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden relative shadow-2xl">
          {/* Active Stage Indicator Header */}
          <div className="px-4 py-2 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between z-10 shrink-0">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
              <span className="font-black text-xs text-amber-300 tracking-wide">
                {currentStage.name}
              </span>
            </div>
            <span className="text-[11px] text-slate-400 italic hidden sm:inline">
              {currentStage.description}
            </span>
          </div>

          {/* Main Interactive Canvas Area (Fills entire column 2) */}
          <div ref={mainViewportRef} className="flex-1 relative overflow-hidden bg-slate-950">
            <canvas ref={mainCanvasRef} className="w-full h-full block" />

            {/* COUNTDOWN OVERLAY */}
            {gameState === 'countdown' && (
              <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm flex flex-col items-center justify-center z-30 animate-in fade-in">
                <div className="text-6xl font-black text-amber-400 animate-bounce tracking-widest">
                  3... 2... 1...
                </div>
                <div className="text-xl font-bold text-white mt-4 uppercase tracking-widest">
                  SẴN SÀNG THẢ BI!
                </div>
              </div>
            )}
          </div>
        </div>

        {/* COLUMN 3: RIGHT PANEL - TOÀN ĐƯỜNG ĐUA MINI-MAP + DIỄN BIẾN ĐƯỜNG ĐUA BELOW */}
        <div className="w-64 sm:w-72 bg-slate-900/90 border border-slate-800 rounded-2xl flex flex-col overflow-hidden shadow-xl p-2.5 space-y-2">
          {/* 1. TOÀN ĐƯỜNG ĐUA MINI MAP HEADER */}
          <div className="flex items-center justify-between pb-1.5 border-b border-slate-800 shrink-0">
            <div className="flex items-center gap-1.5">
              <Trophy className="w-4 h-4 text-amber-400" />
              <span className="font-black text-xs text-slate-200 uppercase tracking-wide">
                TOÀN ĐƯỜNG ĐUA
              </span>
            </div>
            <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/20 px-1.5 py-0.5 rounded border border-emerald-500/30">
              MINI-MAP
            </span>
          </div>

          {/* Minimap Canvas Container */}
          <div className="h-48 bg-slate-950 rounded-xl border border-slate-800 p-1 flex items-center justify-center relative overflow-hidden shrink-0">
            <canvas ref={miniMapCanvasRef} className="w-[140px] h-[180px] block rounded" />
          </div>

          {/* Leader Quick Card info */}
          <div className="bg-slate-800/80 p-2 rounded-xl border border-slate-700/80 text-xs space-y-0.5 shrink-0">
            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
              VIÊN BI DẪN ĐẦU:
            </div>
            {leaderboard[0] && leaderboard[0].student ? (
              <div className="flex items-center gap-2">
                <Crown className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="font-black text-amber-300 truncate">
                  {leaderboard[0].student.name || 'Học sinh'}
                </span>
              </div>
            ) : (
              <span className="text-slate-500 italic">Chưa xác định</span>
            )}
          </div>

          {/* 2. DIỄN BIẾN ĐƯỜNG ĐUA (RIGHT SIDE, DIRECTLY BELOW MINI-MAP) */}
          <div className="flex-1 flex flex-col min-h-0 bg-slate-950 rounded-xl border border-slate-800 p-2 overflow-hidden">
            <div className="flex items-center justify-between pb-1.5 mb-1 text-[11px] font-extrabold text-slate-400 uppercase tracking-wider border-b border-slate-800/80 shrink-0">
              <span>DIỄN BIẾN ĐƯỜNG ĐUA</span>
              <span className="text-amber-400 font-mono text-[10px]">{logs.length} SỰ KIỆN</span>
            </div>

            <div
              ref={logContainerRef}
              className="flex-1 overflow-y-auto space-y-1 p-0.5 custom-scrollbar"
            >
              {logs.length === 0 ? (
                <div className="text-slate-600 text-[11px] text-center py-4 italic">
                  Nhấn BẮT ĐẦU ĐUA để thả bi và xem diễn biến...
                </div>
              ) : (
                logs.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-start gap-1.5 text-[11px] py-1 px-1.5 rounded bg-slate-900/80 border border-slate-800/60 animate-in fade-in leading-tight"
                  >
                    <span className="text-[9px] font-mono text-slate-500 shrink-0 mt-0.5">{log.timeStr}</span>
                    <span className="text-xs shrink-0">{log.icon}</span>
                    <div className="min-w-0 flex-1">
                      <span className="font-bold text-amber-300 mr-1">{log.studentName}</span>
                      <span className="text-slate-300">{log.message}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* CONFETTI CANVAS FOR CELEBRATION */}
      <canvas
        ref={confettiCanvasRef}
        className="fixed inset-0 pointer-events-none z-50 w-full h-full"
      />

      {/* WINNER CELEBRATION MODAL WITH DESELECTION ACTIONS */}
      {winnerCard && winnerCard.student && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in duration-300">
          <div className="bg-slate-900 border-2 border-amber-400/80 rounded-3xl p-6 max-w-md w-full shadow-2xl text-center space-y-5 relative">
            <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-tr from-amber-500 via-yellow-300 to-amber-200 p-1 shadow-lg shadow-amber-500/30">
              <div className="w-full h-full rounded-full bg-slate-950 flex items-center justify-center">
                <Trophy className="w-10 h-10 text-amber-400 animate-bounce" />
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-xs font-black text-amber-400 uppercase tracking-widest">
                👑 CHIẾN THẮNG CUỘC ĐUA ZÍC-ZẮC 👑
              </span>
              <h2 className="text-3xl font-black text-white">{winnerCard.student.name || 'Học sinh'}</h2>
              <p className="text-xs text-slate-400">
                Thành tích cán đích: <span className="font-mono text-amber-300 font-bold">{winnerCard.timeStr}</span>
              </p>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <button
                onClick={() => {
                  handleDeselectAndRaceAgain(winnerCard.student.id);
                  handleReset();
                }}
                className="w-full py-3 bg-gradient-to-r from-amber-500 via-orange-400 to-emerald-400 hover:from-amber-400 hover:to-emerald-300 text-slate-950 font-black rounded-2xl shadow-lg shadow-amber-500/20 transition-all cursor-pointer flex items-center justify-center gap-2 text-sm"
              >
                <UserMinus className="w-4 h-4" />
                BỎ CHỌN [{winnerCard.student.name}] & ĐUA LẠI
              </button>

              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setWinnerCard(null);
                    handleReset();
                  }}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl border border-slate-700 transition-all cursor-pointer text-xs"
                >
                  Giữ lại tất cả & Đua lại
                </button>

                <button
                  onClick={() => setWinnerCard(null)}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white font-bold rounded-xl border border-slate-700 transition-all cursor-pointer text-xs"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CUSTOM STUDENT LIST IMPORT MODAL */}
      {showImportModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 max-w-lg w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-extrabold text-slate-100 text-base">
                Nhập danh sách học sinh tham gia
              </h3>
              <button
                onClick={() => setShowImportModal(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Dán danh sách tên học sinh (mỗi dòng 1 tên) để tham gia cuộc đua bi Zíc-Zắc:
            </p>

            <textarea
              value={customListText}
              onChange={(e) => setCustomListText(e.target.value)}
              placeholder="Nguyễn Văn A&#10;Trần Thị B&#10;Lê Văn C..."
              className="w-full h-44 bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-slate-200 focus:outline-none focus:border-amber-500 custom-scrollbar font-sans"
            />

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowImportModal(false)}
                className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white bg-slate-800 rounded-xl"
              >
                HỦY
              </button>
              <button
                onClick={handleSaveCustomList}
                className="px-5 py-2 text-xs font-black text-slate-950 bg-amber-500 hover:bg-amber-400 rounded-xl shadow cursor-pointer"
              >
                ÁP DỤNG DANH SÁCH
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
