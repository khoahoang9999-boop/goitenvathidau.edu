import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Student, RaceTheme } from '../types';
import { sound } from '../services/sound';
import { getShortName, getInitials } from '../utils/defaultData';
import { ConfettiEngine } from '../services/confetti';
import {
  Flag,
  Trophy,
  Play,
  RotateCcw,
  Sparkles,
  Users,
  Clock,
  Zap,
  Flame,
  Award,
  X,
  Maximize2,
  Minimize2,
} from 'lucide-react';

interface VisualRaceProps {
  students: Student[];
  onSelectWinner: (student: Student) => void;
  onResetCalled: () => void;
  noRepeat?: boolean;
  onToggleNoRepeat?: (val: boolean) => void;
}

interface Racer {
  student: Student;
  x: number; // 0 to 100%
  speed: number;
  targetSpeed: number;
  boostTimer: number;
  lane: number;
  rank: number;
  finished: boolean;
  finishTime?: number;
  colorVariant: string;
}

export const VisualRace: React.FC<VisualRaceProps> = ({
  students,
  onSelectWinner,
  onResetCalled,
  noRepeat = true,
  onToggleNoRepeat,
}) => {
  const activeStudents = (noRepeat ? students.filter((s) => !s.called) : students).filter((s) => !s.excluded);
  const [theme, setTheme] = useState<RaceTheme>('horse');
  const [gameState, setGameState] = useState<'idle' | 'countdown' | 'racing' | 'finished'>('idle');
  const [countdownText, setCountdownText] = useState<string>('3');
  const [raceDuration, setRaceDuration] = useState<number>(8); // 5s, 8s, 12s, 16s
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  const [winnerCard, setWinnerCard] = useState<{
    student: Student;
    rank: number;
    time: string;
  } | null>(null);

  const rootContainerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const confettiCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const confettiEngineRef = useRef<ConfettiEngine | null>(null);

  // Mutable refs for rock-solid RAF loop
  const racersRef = useRef<Racer[]>([]);
  const gameStateRef = useRef<'idle' | 'countdown' | 'racing' | 'finished'>('idle');
  const themeRef = useRef<RaceTheme>('horse');
  const raceDurationRef = useRef<number>(8);
  const startTimeRef = useRef<number>(0);
  const imageCache = useRef<Map<string, HTMLImageElement>>(new Map());
  const onSelectWinnerRef = useRef(onSelectWinner);

  // Sync refs
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);
  useEffect(() => {
    themeRef.current = theme;
  }, [theme]);
  useEffect(() => {
    raceDurationRef.current = raceDuration;
  }, [raceDuration]);
  useEffect(() => {
    onSelectWinnerRef.current = onSelectWinner;
  }, [onSelectWinner]);

  // Leaderboard state for UI display
  const [top3, setTop3] = useState<Student[]>([]);
  const lastLeaderUpdateRef = useRef<number>(0);

  // Preload student avatars
  useEffect(() => {
    students.forEach((student) => {
      if (student.avatar && !imageCache.current.has(student.id)) {
        const img = new Image();
        img.src = student.avatar;
        img.onload = () => {
          imageCache.current.set(student.id, img);
        };
      }
    });
  }, [students]);

  // Color palettes for vehicles / mounts
  const mountColors = [
    '#dc2626', '#2563eb', '#16a34a', '#d97706',
    '#9333ea', '#0891b2', '#ea580c', '#4f46e5',
    '#059669', '#db2777', '#ca8a04', '#0284c7',
  ];

  // Initialize racers at starting gate
  const initRacers = useCallback(() => {
    const baseSpeedIncrement = 100 / (raceDurationRef.current * 60);
    racersRef.current = activeStudents.map((s, idx) => ({
      student: s,
      x: 0,
      speed: baseSpeedIncrement * (0.9 + Math.random() * 0.2),
      targetSpeed: baseSpeedIncrement * (0.95 + Math.random() * 0.25),
      boostTimer: Math.floor(Math.random() * 20),
      lane: idx,
      rank: idx + 1,
      finished: false,
      colorVariant: mountColors[idx % mountColors.length],
    }));
  }, [activeStudents]);

  // Safe synchronization: Only re-initialize when students list actually changes by ID
  const studentIdsKey = activeStudents.map((s) => s.id).join(',');
  const prevKeyRef = useRef<string>('');
  useEffect(() => {
    if (prevKeyRef.current !== studentIdsKey) {
      prevKeyRef.current = studentIdsKey;
      initRacers();
      setTop3(activeStudents.slice(0, 3));
    }
  }, [studentIdsKey, initRacers, activeStudents]);

  // Toggle Fullscreen on parent element
  const toggleFullscreen = () => {
    if (!rootContainerRef.current) return;
    if (!document.fullscreenElement) {
      rootContainerRef.current.requestFullscreen?.().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen?.().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  // =========================================================================
  // REALISTIC CHARACTER RENDERING ENGINES
  // =========================================================================

  // 1. NGỰA ĐUA SIÊU THỰC (Thoroughbred Racehorse with dynamic galloping legs & dust)
  const drawRealisticHorse = (
    ctx: CanvasRenderingContext2D,
    racer: Racer,
    laneH: number,
    animTime: number,
    scale: number,
    isRacing: boolean
  ) => {
    ctx.save();
    ctx.scale(scale, scale);

    const gallopSpeed = isRacing ? 0.024 : 0.008;
    const gallopPhase = (animTime * gallopSpeed + racer.lane * 1.7) % (Math.PI * 2);
    const bodyBob = Math.sin(gallopPhase * 2) * (isRacing ? 3 : 1.2);

    // Dust particles kicked up behind when racing
    if (isRacing && racer.x > 1 && racer.x < 98) {
      ctx.fillStyle = 'rgba(217, 119, 6, 0.45)';
      const dustCount = 3;
      for (let d = 0; d < dustCount; d++) {
        const dx = -26 - d * 7 - Math.sin(animTime * 0.03 + d) * 4;
        const dy = 10 + Math.sin(animTime * 0.04 + d) * 3;
        const dr = 2.5 + (d * 1.2);
        ctx.beginPath();
        ctx.arc(dx, dy, dr, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.translate(0, bodyBob);

    // Front legs & Hind legs dynamic gallop kinematics
    const swingAmp = isRacing ? 0.85 : 0.35;
    const frontLeg1Angle = Math.sin(gallopPhase) * swingAmp - 0.2;
    const frontLeg2Angle = Math.sin(gallopPhase + 0.6) * swingAmp - 0.2;
    const hindLeg1Angle = -Math.sin(gallopPhase) * swingAmp + 0.3;
    const hindLeg2Angle = -Math.sin(gallopPhase + 0.6) * swingAmp + 0.3;

    const horseCoat = racer.lane % 3 === 0 ? '#78350f' : racer.lane % 3 === 1 ? '#451a03' : '#b45309';
    const darkCoat = '#271003';
    const maneColor = racer.lane % 2 === 0 ? '#1c1917' : '#fafaf9';

    // Far Legs (Behind Body)
    ctx.strokeStyle = darkCoat;
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';

    // Far Hind Leg
    ctx.beginPath();
    ctx.moveTo(-16, 6);
    const fhx = -16 + Math.sin(hindLeg2Angle) * 16;
    const fhy = 6 + Math.cos(hindLeg2Angle) * 16;
    ctx.lineTo(fhx, fhy);
    ctx.lineTo(fhx + 4, fhy + 4);
    ctx.stroke();

    // Far Front Leg
    ctx.beginPath();
    ctx.moveTo(12, 6);
    const ffx = 12 + Math.sin(frontLeg2Angle) * 16;
    const ffy = 6 + Math.cos(frontLeg2Angle) * 16;
    ctx.lineTo(ffx, ffy);
    ctx.lineTo(ffx + 3, ffy + 3);
    ctx.stroke();

    // Muscular Horse Torso
    ctx.fillStyle = horseCoat;
    ctx.beginPath();
    ctx.ellipse(-2, 2, 21, 10, -0.05, 0, Math.PI * 2);
    ctx.fill();

    // Chest & Rump curves
    ctx.beginPath();
    ctx.arc(10, 1, 9, 0, Math.PI * 2);
    ctx.arc(-14, 0, 9.5, 0, Math.PI * 2);
    ctx.fill();

    // Flowing Tail
    const tailWag = Math.sin(gallopPhase) * 0.4;
    ctx.fillStyle = maneColor;
    ctx.beginPath();
    ctx.moveTo(-20, -2);
    ctx.quadraticCurveTo(-34 + tailWag * 10, -6, -38, 8);
    ctx.quadraticCurveTo(-28, 2, -18, 5);
    ctx.closePath();
    ctx.fill();

    // Near Legs (In Front of Body)
    ctx.strokeStyle = horseCoat;
    ctx.lineWidth = 4;

    // Near Hind Leg
    ctx.beginPath();
    ctx.moveTo(-12, 6);
    const nhx = -12 + Math.sin(hindLeg1Angle) * 17;
    const nhy = 6 + Math.cos(hindLeg1Angle) * 17;
    ctx.lineTo(nhx, nhy);
    ctx.strokeStyle = '#171717';
    ctx.lineTo(nhx + 4, nhy + 4);
    ctx.stroke();

    // Near Front Leg
    ctx.strokeStyle = horseCoat;
    ctx.beginPath();
    ctx.moveTo(14, 6);
    const nfx = 14 + Math.sin(frontLeg1Angle) * 17;
    const nfy = 6 + Math.cos(frontLeg1Angle) * 17;
    ctx.lineTo(nfx, nfy);
    ctx.strokeStyle = '#171717';
    ctx.lineTo(nfx + 3, nfy + 3);
    ctx.stroke();

    // Neck & Head with alert ears
    ctx.fillStyle = horseCoat;
    ctx.beginPath();
    ctx.moveTo(8, -1);
    ctx.lineTo(20, -16);
    ctx.lineTo(26, -11);
    ctx.lineTo(19, 0);
    ctx.lineTo(12, 6);
    ctx.closePath();
    ctx.fill();

    // Ears
    ctx.beginPath();
    ctx.moveTo(17, -17);
    ctx.lineTo(19, -23);
    ctx.lineTo(21, -17);
    ctx.closePath();
    ctx.fill();

    // Flowing Mane
    ctx.fillStyle = maneColor;
    ctx.beginPath();
    ctx.moveTo(10, -5);
    ctx.quadraticCurveTo(8, -18, 17, -19);
    ctx.lineTo(12, -8);
    ctx.closePath();
    ctx.fill();

    // Leather Saddle & Stirrup
    ctx.fillStyle = racer.colorVariant;
    ctx.beginPath();
    ctx.roundRect(-8, -7, 14, 8, 3);
    ctx.fill();
    ctx.strokeStyle = '#fef08a';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.restore();
  };

  // 2. XE ĐUA F1 SIÊU THỰC (Formula 1 Supercar with spinning alloy rims & nitro exhaust)
  const drawRealisticF1Car = (
    ctx: CanvasRenderingContext2D,
    racer: Racer,
    laneH: number,
    animTime: number,
    scale: number,
    isRacing: boolean
  ) => {
    ctx.save();
    ctx.scale(scale, scale);

    const carVibration = (Math.random() - 0.5) * (isRacing ? 1.5 : 0.5);
    ctx.translate(0, carVibration);

    // Nitro exhaust fire & speed smoke
    if (isRacing && racer.x > 1 && racer.x < 99) {
      const flameLength = 14 + Math.sin(animTime * 0.05) * 8;
      const flameGrad = ctx.createLinearGradient(-26, 0, -26 - flameLength, 0);
      flameGrad.addColorStop(0, '#ffffff');
      flameGrad.addColorStop(0.25, '#38bdf8');
      flameGrad.addColorStop(0.65, '#f97316');
      flameGrad.addColorStop(1, 'rgba(239, 68, 68, 0)');

      ctx.fillStyle = flameGrad;
      ctx.beginPath();
      ctx.moveTo(-24, -3);
      ctx.lineTo(-24 - flameLength, 0);
      ctx.lineTo(-24, 3);
      ctx.closePath();
      ctx.fill();

      // Speed smoke puffs
      ctx.fillStyle = 'rgba(241, 245, 249, 0.35)';
      ctx.beginPath();
      ctx.arc(-30 - Math.random() * 8, -4, 3 + Math.random() * 3, 0, Math.PI * 2);
      ctx.arc(-32 - Math.random() * 8, 4, 3 + Math.random() * 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Car Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.beginPath();
    ctx.ellipse(0, 11, 28, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Aerodynamic Chassis body
    const primaryColor = racer.colorVariant;
    ctx.fillStyle = primaryColor;
    ctx.beginPath();
    ctx.moveTo(-22, 6);
    ctx.lineTo(-22, -6);
    ctx.lineTo(8, -5);
    ctx.lineTo(26, -1);
    ctx.lineTo(26, 1);
    ctx.lineTo(8, 5);
    ctx.closePath();
    ctx.fill();

    // Cockpit windshield
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.ellipse(0, 0, 8, 4.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.ellipse(2, 0, 4, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Front Wing / Splitter
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(24, -10, 4, 20);
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(26, -9, 1.5, 18);

    // Rear Downforce Spoiler
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(-26, -11, 4, 22);
    ctx.fillStyle = primaryColor;
    ctx.fillRect(-28, -10, 3, 20);

    // 4 Wide Racing Wheels with spinning alloy rims
    const spinSpeed = isRacing ? 0.06 : 0.01;
    const spinAngle = (animTime * spinSpeed) % (Math.PI * 2);
    const drawWheel = (wx: number, wy: number) => {
      ctx.save();
      ctx.translate(wx, wy);

      ctx.fillStyle = '#171717';
      ctx.beginPath();
      ctx.roundRect(-7, -4.5, 14, 9, 2.5);
      ctx.fill();

      ctx.fillStyle = '#334155';
      ctx.fillRect(-6, -3, 12, 1);
      ctx.fillRect(-6, 2, 12, 1);

      ctx.fillStyle = '#e2e8f0';
      ctx.beginPath();
      ctx.arc(0, 0, 2.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(Math.cos(spinAngle) * 3, Math.sin(spinAngle) * 3);
      ctx.lineTo(-Math.cos(spinAngle) * 3, -Math.sin(spinAngle) * 3);
      ctx.stroke();

      ctx.restore();
    };

    drawWheel(-14, -8);
    drawWheel(12, -8);
    drawWheel(-14, 8);
    drawWheel(12, 8);

    ctx.restore();
  };

  // 3. VỊT ĐUA BƠI LỘI SIÊU THỰC (Realistic Swimming Duck)
  const drawRealisticDuck = (
    ctx: CanvasRenderingContext2D,
    racer: Racer,
    laneH: number,
    animTime: number,
    scale: number,
    isRacing: boolean
  ) => {
    ctx.save();
    ctx.scale(scale, scale);

    const swimSpeed = isRacing ? 0.02 : 0.008;
    const swimPhase = (animTime * swimSpeed + racer.lane * 1.5) % (Math.PI * 2);
    const swimBob = Math.sin(swimPhase * 2) * (isRacing ? 2.5 : 1.2);
    ctx.translate(0, swimBob);

    // Expanding Water Wake & Ripples behind
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-12, 8);
    ctx.quadraticCurveTo(-26, 4, -36, 12);
    ctx.moveTo(-12, -4);
    ctx.quadraticCurveTo(-26, -2, -36, -8);
    ctx.stroke();

    // Duck Plump Body
    const bodyColor = '#facc15';
    ctx.fillStyle = bodyColor;
    ctx.beginPath();
    ctx.ellipse(-4, 2, 19, 12, -0.08, 0, Math.PI * 2);
    ctx.fill();

    // Flapping Wing with feather layers
    const wingFlap = Math.sin(swimPhase) * (isRacing ? 4.5 : 1.5);
    ctx.fillStyle = '#eab308';
    ctx.beginPath();
    ctx.ellipse(-6, -1 - wingFlap * 0.5, 12, 7, 0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ca8a04';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Tail Feathers
    ctx.fillStyle = '#eab308';
    ctx.beginPath();
    ctx.moveTo(-20, 0);
    ctx.lineTo(-27, -6);
    ctx.lineTo(-22, 5);
    ctx.closePath();
    ctx.fill();

    // Head
    ctx.fillStyle = bodyColor;
    ctx.beginPath();
    ctx.arc(14, -6, 9.5, 0, Math.PI * 2);
    ctx.fill();

    // Eye
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(17, -8, 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(17.6, -8.6, 0.8, 0, Math.PI * 2);
    ctx.fill();

    // Beak
    ctx.fillStyle = '#ea580c';
    ctx.beginPath();
    ctx.moveTo(21, -9);
    ctx.lineTo(31, -5);
    ctx.lineTo(21, -3);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  };

  // 4. TÊN LỬA KHÔNG GIAN SIÊU THỰC (Cosmic Space Rocket)
  const drawRealisticRocket = (
    ctx: CanvasRenderingContext2D,
    racer: Racer,
    laneH: number,
    animTime: number,
    scale: number,
    isRacing: boolean
  ) => {
    ctx.save();
    ctx.scale(scale, scale);

    const rocketJitter = (Math.random() - 0.5) * (isRacing ? 1.5 : 0.4);
    ctx.translate(0, rocketJitter);

    // Plasma Fire Jet Exhaust
    if (isRacing && racer.x > 1 && racer.x < 99) {
      const fireLen = 16 + Math.sin(animTime * 0.08) * 10;
      const plasmaGrad = ctx.createLinearGradient(-18, 0, -18 - fireLen, 0);
      plasmaGrad.addColorStop(0, '#ffffff');
      plasmaGrad.addColorStop(0.2, '#38bdf8');
      plasmaGrad.addColorStop(0.5, '#ec4899');
      plasmaGrad.addColorStop(1, 'rgba(239, 68, 68, 0)');

      ctx.fillStyle = plasmaGrad;
      ctx.beginPath();
      ctx.moveTo(-16, -6);
      ctx.lineTo(-16 - fireLen, 0);
      ctx.lineTo(-16, 6);
      ctx.closePath();
      ctx.fill();
    }

    // Rocket Body
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.moveTo(-16, -7);
    ctx.lineTo(12, -7);
    ctx.quadraticCurveTo(28, 0, 12, 7);
    ctx.lineTo(-16, 7);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Colored Nose Cone
    ctx.fillStyle = racer.colorVariant;
    ctx.beginPath();
    ctx.moveTo(12, -7);
    ctx.quadraticCurveTo(28, 0, 12, 7);
    ctx.closePath();
    ctx.fill();

    // Cockpit window
    ctx.fillStyle = '#0284c7';
    ctx.beginPath();
    ctx.arc(4, 0, 4.5, 0, Math.PI * 2);
    ctx.fill();

    // Delta Fins
    ctx.fillStyle = racer.colorVariant;
    ctx.beginPath();
    ctx.moveTo(-8, -7);
    ctx.lineTo(-18, -14);
    ctx.lineTo(-14, -7);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(-8, 7);
    ctx.lineTo(-18, 14);
    ctx.lineTo(-14, 7);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  };

  // 5. VẬN ĐỘNG VIÊN ĐIỀN KINH (Olympic Sprinter)
  const drawRealisticRunner = (
    ctx: CanvasRenderingContext2D,
    racer: Racer,
    laneH: number,
    animTime: number,
    scale: number,
    isRacing: boolean
  ) => {
    ctx.save();
    ctx.scale(scale, scale);

    const runSpeed = isRacing ? 0.026 : 0.008;
    const stridePhase = (animTime * runSpeed + racer.lane * 1.5) % (Math.PI * 2);
    const runBob = Math.abs(Math.sin(stridePhase)) * (isRacing ? 3.5 : 1.2);
    ctx.translate(0, -runBob);

    const strideAmp = isRacing ? 0.95 : 0.4;
    const leg1Angle = Math.sin(stridePhase) * strideAmp;
    const leg2Angle = -Math.sin(stridePhase) * strideAmp;
    const arm1Angle = -Math.sin(stridePhase) * strideAmp;
    const arm2Angle = Math.sin(stridePhase) * strideAmp;

    ctx.strokeStyle = '#f87171';
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';

    // Far Leg
    ctx.beginPath();
    ctx.moveTo(-2, 4);
    const flx = -2 + Math.sin(leg2Angle) * 15;
    const fly = 4 + Math.cos(leg2Angle) * 15;
    ctx.lineTo(flx, fly);
    ctx.strokeStyle = '#38bdf8';
    ctx.lineTo(flx + 4, fly);
    ctx.stroke();

    // Far Arm
    ctx.strokeStyle = '#fca5a5';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(2, -6);
    ctx.lineTo(2 + Math.sin(arm2Angle) * 12, -6 + Math.cos(arm2Angle) * 12);
    ctx.stroke();

    // Torso
    ctx.fillStyle = racer.colorVariant;
    ctx.beginPath();
    ctx.roundRect(-5, -9, 11, 14, 3);
    ctx.fill();

    // Near Leg
    ctx.strokeStyle = '#f87171';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(2, 4);
    const nlx = 2 + Math.sin(leg1Angle) * 15;
    const nly = 4 + Math.cos(leg1Angle) * 15;
    ctx.lineTo(nlx, nly);
    ctx.strokeStyle = '#fbbf24';
    ctx.lineTo(nlx + 4, nly);
    ctx.stroke();

    // Near Arm
    ctx.strokeStyle = '#fca5a5';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-1, -6);
    ctx.lineTo(-1 + Math.sin(arm1Angle) * 12, -6 + Math.cos(arm1Angle) * 12);
    ctx.stroke();

    // Head
    ctx.fillStyle = '#fca5a5';
    ctx.beginPath();
    ctx.arc(3, -15, 6, 0, Math.PI * 2);
    ctx.fill();

    // Headband
    ctx.fillStyle = racer.colorVariant;
    ctx.fillRect(0, -17, 7, 2.5);

    ctx.restore();
  };

  // Draw individual racer entity + Student Avatar Badge
  const drawRacerEntity = (
    ctx: CanvasRenderingContext2D,
    racer: Racer,
    rx: number,
    ry: number,
    laneH: number,
    now: number,
    scale: number,
    isRacing: boolean,
    currentTheme: RaceTheme
  ) => {
    ctx.save();
    ctx.translate(rx, ry);

    if (currentTheme === 'duck') {
      drawRealisticDuck(ctx, racer, laneH, now, scale, isRacing);
    } else if (currentTheme === 'horse') {
      drawRealisticHorse(ctx, racer, laneH, now, scale, isRacing);
    } else if (currentTheme === 'car') {
      drawRealisticF1Car(ctx, racer, laneH, now, scale, isRacing);
    } else if (currentTheme === 'rocket') {
      drawRealisticRocket(ctx, racer, laneH, now, scale, isRacing);
    } else {
      drawRealisticRunner(ctx, racer, laneH, now, scale, isRacing);
    }

    // Student Avatar Badge (Jockey / Driver Helmet / Pilot)
    const avatarRadius = Math.max(9, Math.min(16, laneH * 0.32));
    const avatarY = -avatarRadius - (laneH * 0.12);

    ctx.save();
    ctx.beginPath();
    ctx.arc(0, avatarY, avatarRadius, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();

    const cachedImg = imageCache.current.get(racer.student.id);
    if (cachedImg && cachedImg.complete && cachedImg.naturalWidth > 0) {
      ctx.drawImage(
        cachedImg,
        -avatarRadius,
        avatarY - avatarRadius,
        avatarRadius * 2,
        avatarRadius * 2
      );
    } else {
      ctx.fillStyle = racer.student.color || '#3b82f6';
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${Math.round(avatarRadius * 0.95)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(getInitials(racer.student.name), 0, avatarY);
    }
    ctx.restore();

    // White rim around avatar
    ctx.beginPath();
    ctx.arc(0, avatarY, avatarRadius, 0, Math.PI * 2);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Student Name Tag floating behind
    if (laneH >= 18) {
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = 'rgba(0,0,0,0.9)';
      ctx.shadowBlur = 4;
      ctx.font = `700 ${Math.max(9, Math.min(12, laneH * 0.36))}px "Plus Jakarta Sans", sans-serif`;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(getShortName(racer.student.name), -avatarRadius - 5, avatarY);
    }

    // Live Rank Tag (#1, #2, #3)
    if (racer.rank <= 3 && isRacing) {
      const badgeColor = racer.rank === 1 ? '#f59e0b' : racer.rank === 2 ? '#94a3b8' : '#cd7f32';
      ctx.fillStyle = badgeColor;
      ctx.beginPath();
      ctx.arc(avatarRadius + 4, avatarY - 4, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 8px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${racer.rank}`, avatarRadius + 4, avatarY - 4);
    }

    ctx.restore();
  };

  // Continuous High-FPS Game Loop with Ref Sync
  useEffect(() => {
    let animId = 0;

    const loop = () => {
      const canvas = canvasRef.current;
      if (!canvas) {
        animId = requestAnimationFrame(loop);
        return;
      }
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        animId = requestAnimationFrame(loop);
        return;
      }

      const dpr = window.devicePixelRatio || 1;
      const width = canvas.width / dpr;
      const height = canvas.height / dpr;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);

      const racers = racersRef.current;
      const totalRacers = racers.length;
      const currentTheme = themeRef.current;
      const currentState = gameStateRef.current;
      const isRacing = currentState === 'racing';
      const now = performance.now();

      if (totalRacers === 0) {
        ctx.fillStyle = '#64748b';
        ctx.font = 'bold 16px "Plus Jakarta Sans", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('Đã gọi hết tất cả học sinh!', width / 2, height / 2);
        animId = requestAnimationFrame(loop);
        return;
      }

      // Exact lane height so 100% of racers fit inside canvas viewport
      const laneHeight = height / totalRacers;
      const startX = 65;
      const finishX = width - 90;

      // 1. UPDATE PHYSICS IF RACING
      if (isRacing) {
        const elapsed = Date.now() - startTimeRef.current;
        const baseSpeedIncrement = (100 / (raceDurationRef.current * 60)) * 1.05;

        let hasWinner = false;
        let winningStudent: Student | null = null;

        racers.forEach((racer) => {
          if (racer.finished) return;

          racer.boostTimer--;
          if (racer.boostTimer <= 0) {
            racer.boostTimer = 15 + Math.floor(Math.random() * 30);
            // Dynamic overtakes and surges
            const surgeFactor = 0.75 + Math.random() * 0.65; // 0.75 to 1.40
            racer.targetSpeed = baseSpeedIncrement * surgeFactor;
          }

          // Responsive acceleration towards target speed
          racer.speed += (racer.targetSpeed - racer.speed) * 0.15;
          racer.x += racer.speed;

          if (racer.x >= 100) {
            racer.x = 100;
            racer.finished = true;
            racer.finishTime = elapsed;
            if (!hasWinner) {
              hasWinner = true;
              winningStudent = racer.student;
            }
          }
        });

        // Update ranks based on current x
        const sorted = [...racers].sort((a, b) => b.x - a.x);
        sorted.forEach((r, idx) => {
          r.rank = idx + 1;
        });

        // Throttled Top 3 update (every 250ms) to avoid high frequency React re-renders
        if (now - lastLeaderUpdateRef.current > 250) {
          lastLeaderUpdateRef.current = now;
          setTop3(sorted.slice(0, 3).map((r) => r.student));
        }

        if (hasWinner && winningStudent) {
          gameStateRef.current = 'finished';
          setGameState('finished');
          sound.stopBgMusic();
          sound.playFanfare();

          const finalWinner = winningStudent;
          const finishTimeStr = `${(elapsed / 1000).toFixed(1)}s`;

          setTop3(sorted.slice(0, 3).map((r) => r.student));
          setWinnerCard({
            student: finalWinner,
            rank: 1,
            time: finishTimeStr,
          });

          if (confettiCanvasRef.current) {
            if (!confettiEngineRef.current) {
              confettiEngineRef.current = new ConfettiEngine(confettiCanvasRef.current);
            }
            confettiEngineRef.current.resize();
            confettiEngineRef.current.fireCelebration(140);
          }

          setTimeout(() => {
            onSelectWinnerRef.current(finalWinner);
          }, 400);
        }
      }

      // 2. DRAW TRACK LANES
      for (let i = 0; i < totalRacers; i++) {
        const y = i * laneHeight;

        if (currentTheme === 'duck') {
          const waterGrad = ctx.createLinearGradient(0, y, 0, y + laneHeight);
          if (i % 2 === 0) {
            waterGrad.addColorStop(0, '#0284c7');
            waterGrad.addColorStop(1, '#0369a1');
          } else {
            waterGrad.addColorStop(0, '#0369a1');
            waterGrad.addColorStop(1, '#075985');
          }
          ctx.fillStyle = waterGrad;
          ctx.fillRect(0, y, width, laneHeight);

          ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(0, y + laneHeight);
          ctx.lineTo(width, y + laneHeight);
          ctx.stroke();
        } else if (currentTheme === 'horse') {
          ctx.fillStyle = i % 2 === 0 ? '#15803d' : '#166534';
          ctx.fillRect(0, y, width, laneHeight);

          ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
          ctx.lineWidth = 1.5;
          ctx.setLineDash([8, 8]);
          ctx.beginPath();
          ctx.moveTo(0, y + laneHeight);
          ctx.lineTo(width, y + laneHeight);
          ctx.stroke();
          ctx.setLineDash([]);
        } else if (currentTheme === 'car') {
          ctx.fillStyle = i % 2 === 0 ? '#1e293b' : '#0f172a';
          ctx.fillRect(0, y, width, laneHeight);

          ctx.strokeStyle = 'rgba(248, 250, 252, 0.3)';
          ctx.lineWidth = 1.5;
          ctx.setLineDash([12, 12]);
          ctx.beginPath();
          ctx.moveTo(0, y + laneHeight);
          ctx.lineTo(width, y + laneHeight);
          ctx.stroke();
          ctx.setLineDash([]);
        } else if (currentTheme === 'rocket') {
          ctx.fillStyle = i % 2 === 0 ? '#0b0f19' : '#030712';
          ctx.fillRect(0, y, width, laneHeight);

          ctx.strokeStyle = 'rgba(56, 189, 248, 0.15)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(0, y + laneHeight);
          ctx.lineTo(width, y + laneHeight);
          ctx.stroke();
        } else {
          ctx.fillStyle = i % 2 === 0 ? '#b91c1c' : '#991b1b';
          ctx.fillRect(0, y, width, laneHeight);

          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(0, y + laneHeight);
          ctx.lineTo(width, y + laneHeight);
          ctx.stroke();
        }

        // Lane numbers
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.font = `bold ${Math.max(10, Math.min(13, laneHeight * 0.38))}px "Plus Jakarta Sans", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${i + 1}`, 20, y + laneHeight / 2);
      }

      // Start Line
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(startX, 0);
      ctx.lineTo(startX, height);
      ctx.stroke();

      // Checkered Finish Line
      const checkSize = Math.max(8, Math.min(14, laneHeight * 0.45));
      for (let fy = 0; fy < height; fy += checkSize) {
        for (let fx = 0; fx < 24; fx += checkSize) {
          const isBlack = (Math.floor(fy / checkSize) + Math.floor(fx / checkSize)) % 2 === 0;
          ctx.fillStyle = isBlack ? '#0f172a' : '#ffffff';
          ctx.fillRect(finishX + fx, fy, checkSize, checkSize);
        }
      }

      // Finish banner on top
      ctx.save();
      ctx.fillStyle = '#dc2626';
      ctx.beginPath();
      ctx.roundRect(finishX - 4, 2, 32, 18, 4);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('ĐÍCH', finishX + 12, 11);
      ctx.restore();

      // 3. DRAW RACERS
      const racerScale = Math.max(0.44, Math.min(0.95, laneHeight / 44));
      racers.forEach((racer) => {
        const y = racer.lane * laneHeight + laneHeight / 2;
        const racerX = startX + (racer.x / 100) * (finishX - startX);
        drawRacerEntity(ctx, racer, racerX, y, laneHeight, now, racerScale, isRacing, currentTheme);
      });

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(animId);
    };
  }, []);

  // Start race countdown
  const startCountdown = () => {
    if (activeStudents.length === 0 || gameStateRef.current === 'racing') return;

    setWinnerCard(null);
    initRacers();
    setGameState('countdown');
    gameStateRef.current = 'countdown';
    setCountdownText('3');
    sound.playCountdown(false);

    setTimeout(() => {
      setCountdownText('2');
      sound.playCountdown(false);
    }, 500);

    setTimeout(() => {
      setCountdownText('1');
      sound.playCountdown(false);
    }, 1000);

    setTimeout(() => {
      setCountdownText('XUẤT PHÁT!');
      sound.playCountdown(true);
      sound.startBgMusic();

      // Initialize all racers at non-zero speed immediately upon start
      const baseSpeedIncrement = (100 / (raceDurationRef.current * 60)) * 1.05;
      racersRef.current.forEach((racer) => {
        racer.x = 0;
        racer.speed = baseSpeedIncrement * (0.9 + Math.random() * 0.2);
        racer.targetSpeed = baseSpeedIncrement * (0.95 + Math.random() * 0.3);
      });

      setGameState('racing');
      gameStateRef.current = 'racing';
      startTimeRef.current = Date.now();
    }, 1500);
  };

  // Adjust canvas size to fill the exact middle container without any overflow or mouse scrolling
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;

      const w = container.clientWidth || 900;
      const h = container.clientHeight || 450;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);

      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    const observer = new ResizeObserver(() => {
      handleResize();
    });
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      observer.disconnect();
    };
  }, [activeStudents.length]);

  return (
    <div
      ref={rootContainerRef}
      className={`relative flex flex-col justify-between w-full h-full max-w-full overflow-hidden select-none ${
        isFullscreen ? 'fixed inset-0 z-50 bg-slate-900 p-2' : 'p-0.5'
      }`}
    >
      {/* Confetti Canvas */}
      <canvas
        ref={confettiCanvasRef}
        className="absolute inset-0 pointer-events-none z-30 w-full h-full"
      />

      {/* Top Compact Bar: Theme switcher, Live Leaderboard & Fullscreen toggle */}
      <div className="flex flex-wrap items-center justify-between w-full px-1 mb-1.5 gap-1.5 shrink-0">
        {/* Theme tabs */}
        <div className="flex items-center gap-1 p-0.5 bg-white border border-slate-200 rounded-xl shadow-2xs">
          <button
            onClick={() => setTheme('horse')}
            disabled={gameState === 'racing'}
            className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all flex items-center gap-1 cursor-pointer ${
              theme === 'horse'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <span>🐎</span> Đua Ngựa
          </button>
          <button
            onClick={() => setTheme('car')}
            disabled={gameState === 'racing'}
            className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all flex items-center gap-1 cursor-pointer ${
              theme === 'car'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <span>🏎️</span> Đua Xe F1
          </button>
          <button
            onClick={() => setTheme('duck')}
            disabled={gameState === 'racing'}
            className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all flex items-center gap-1 cursor-pointer ${
              theme === 'duck'
                ? 'bg-sky-500 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <span>🦆</span> Đua Vịt
          </button>
          <button
            onClick={() => setTheme('rocket')}
            disabled={gameState === 'racing'}
            className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all flex items-center gap-1 cursor-pointer ${
              theme === 'rocket'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <span>🚀</span> Tên Lửa
          </button>
          <button
            onClick={() => setTheme('runner')}
            disabled={gameState === 'racing'}
            className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all flex items-center gap-1 cursor-pointer ${
              theme === 'runner'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <span>🏃</span> Điền Kinh
          </button>
        </div>

        {/* Live Top 3 Leaderboard & Fullscreen toggle */}
        <div className="flex items-center gap-1.5">
          <div className="flex items-center gap-2 bg-white px-2.5 py-1 rounded-xl border border-slate-200 text-xs shadow-2xs">
            <div className="flex items-center gap-1 font-extrabold text-amber-500">
              <Trophy size={13} /> Dẫn đầu:
            </div>
            <div className="flex items-center gap-2">
              {(top3.length > 0 ? top3 : activeStudents.slice(0, 3)).map((s, idx) => (
                <span key={s.id} className="flex items-center gap-1 text-slate-700">
                  <span className={`font-mono font-black text-[10px] px-1 rounded ${
                    idx === 0 ? 'bg-amber-100 text-amber-800' : idx === 1 ? 'bg-slate-200 text-slate-700' : 'bg-amber-50 text-amber-700'
                  }`}>
                    #{idx + 1}
                  </span>
                  <span className="font-bold text-slate-900 text-xs">{getShortName(s.name)}</span>
                </span>
              ))}
            </div>
          </div>

          <button
            onClick={toggleFullscreen}
            className="p-1.5 bg-white hover:bg-slate-100 text-slate-700 rounded-xl border border-slate-200 shadow-2xs cursor-pointer transition-colors"
            title={isFullscreen ? 'Thu nhỏ' : 'Mở toàn màn hình'}
          >
            {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
          </button>
        </div>
      </div>

      {/* Main Track Viewport: Dynamically expands to 100% available middle height */}
      <div
        ref={containerRef}
        className="relative flex-1 min-h-0 w-full overflow-hidden rounded-2xl border border-slate-300 shadow-lg bg-slate-950 select-none"
      >
        <canvas ref={canvasRef} className="block w-full h-full" />

        {/* Countdown Overlay */}
        {gameState === 'countdown' && (
          <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center z-20">
            <div className="text-center animate-bounce">
              <span className="text-6xl sm:text-7xl font-black text-amber-400 drop-shadow-[0_4px_16px_rgba(0,0,0,0.9)] tracking-wider">
                {countdownText}
              </span>
            </div>
          </div>
        )}

        {/* Floating Winner Mini Banner (Overlaid neatly without causing layout shifts) */}
        {winnerCard && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 w-full max-w-md p-2.5 rounded-2xl bg-gradient-to-r from-amber-500 via-rose-500 to-indigo-600 text-white shadow-2xl z-25 animate-fade-in flex items-center justify-between gap-3 border border-white/30 backdrop-blur-md">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-10 h-10 rounded-full border-2 border-white shadow-md overflow-hidden bg-white/20 flex items-center justify-center shrink-0">
                {winnerCard.student.avatar ? (
                  <img
                    src={winnerCard.student.avatar}
                    alt={winnerCard.student.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-white font-black text-base">
                    {getInitials(winnerCard.student.name)}
                  </span>
                )}
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-1 text-[10px] font-extrabold text-amber-200 uppercase tracking-wide">
                  <Trophy size={11} className="text-amber-300" />
                  <span>Vô Địch Cuộc Đua!</span>
                </div>
                <h3 className="text-sm font-black text-white leading-tight truncate">
                  {winnerCard.student.name}
                </h3>
                <div className="flex items-center gap-2 text-[10px] text-white/85">
                  <span className="bg-white/25 px-1 py-0.2 rounded font-bold">
                    {winnerCard.student.className}
                  </span>
                  <span className="flex items-center gap-0.5">
                    <Clock size={9} /> {winnerCard.time}
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={() => setWinnerCard(null)}
              className="p-1 hover:bg-white/20 rounded-full transition-colors text-white/80 hover:text-white cursor-pointer shrink-0"
              title="Đóng thông báo"
            >
              <X size={15} />
            </button>
          </div>
        )}
      </div>

      {/* Compact Controls & Action Button Bar */}
      <div className="mt-1.5 flex flex-wrap items-center justify-center gap-2 shrink-0 py-0.5">
        {/* Main Start Race Button */}
        <button
          disabled={gameState === 'racing' || activeStudents.length === 0}
          onClick={startCountdown}
          className={`px-6 py-2 rounded-xl font-black text-xs sm:text-sm shadow-md tracking-wide flex items-center gap-2 transition-all transform active:scale-95 cursor-pointer ${
            gameState === 'racing' || activeStudents.length === 0
              ? 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none'
              : 'bg-gradient-to-r from-emerald-500 via-teal-500 to-sky-600 text-white hover:brightness-110 hover:shadow-lg hover:scale-102'
          }`}
        >
          <Flag size={16} className={gameState === 'racing' ? 'animate-pulse' : ''} />
          {gameState === 'racing' ? 'CUỘC ĐUA ĐANG DIỄN RA...' : 'BẮT ĐẦU ĐUA! (START)'}
        </button>

        {/* Duration selector: 5s, 8s, 12s, 16s */}
        <div className="flex items-center gap-1 text-xs text-slate-600 bg-white px-2.5 py-1.5 rounded-xl border border-slate-200 shadow-2xs">
          <Clock size={12} className="text-emerald-600" />
          <span className="text-[11px] text-slate-500 font-medium">Thời gian:</span>
          <select
            value={raceDuration}
            onChange={(e) => setRaceDuration(Number(e.target.value))}
            disabled={gameState === 'racing'}
            className="bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5 text-xs text-slate-800 font-bold cursor-pointer outline-none"
          >
            <option value={5}>5s (Siêu tốc)</option>
            <option value={8}>8s (Chuẩn)</option>
            <option value={12}>12s (Kịch tính)</option>
            <option value={16}>16s (Hồi hộp)</option>
          </select>
        </div>

        {/* Checkbox Không gọi trùng */}
        {onToggleNoRepeat && (
          <label className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold bg-white border border-slate-200 rounded-xl shadow-2xs cursor-pointer select-none">
            <input
              type="checkbox"
              checked={noRepeat}
              onChange={(e) => onToggleNoRepeat(e.target.checked)}
              disabled={gameState === 'racing'}
              className="w-3.5 h-3.5 rounded text-emerald-600 accent-emerald-600 cursor-pointer"
            />
            <span className={noRepeat ? 'text-slate-800 font-bold text-[11px]' : 'text-slate-500 text-[11px]'}>
              Không gọi trùng
            </span>
          </label>
        )}

        {/* Reset button when all called */}
        {activeStudents.length === 0 && (
          <button
            onClick={onResetCalled}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition-colors cursor-pointer"
          >
            <RotateCcw size={12} /> Khôi phục tất cả
          </button>
        )}
      </div>
    </div>
  );
};
