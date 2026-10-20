import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Student } from '../types';
import { sound } from '../services/sound';
import { getShortName, getInitials } from '../utils/defaultData';
import { ConfettiEngine } from '../services/confetti';
import {
  Trophy,
  RotateCcw,
  Sparkles,
  Flame,
  Shuffle,
  Edit3,
  Flag,
  Keyboard,
  Bot,
  Smile,
  Cat,
  Zap,
  Volume2,
  VolumeX,
  Play,
  PlayCircle,
} from 'lucide-react';

interface TugOfWarGameProps {
  students: Student[];
  onSelectWinner?: (student: Student) => void;
  noRepeat?: boolean;
  onToggleNoRepeat?: (val: boolean) => void;
  onResetCalled?: () => void;
}

export type CharacterStyle = 'chibi' | 'mascot' | 'robot' | 'ninja';

const DEFAULT_TEAM_NAMES = [
  { team1: '🐉 Đội Rồng Đỏ', team2: '🐅 Đội Hổ Xanh' },
  { team1: '🔥 Đội Lửa Thần', team2: '⚡ Đội Sấm Sét' },
  { team1: '🛡️ Đội Chiến Binh', team2: '🦅 Đội Đại Bàng' },
  { team1: '🔴 Tổ 1 & Tổ 2', team2: '🔵 Tổ 3 & Tổ 4' },
];

export const TugOfWarGame: React.FC<TugOfWarGameProps> = ({
  students,
  onSelectWinner,
}) => {
  // Team Setup State
  const [team1Name, setTeam1Name] = useState<string>('🐉 Đội Rồng Đỏ');
  const [team2Name, setTeam2Name] = useState<string>('🐅 Đội Hổ Xanh');
  const [team1Members, setTeam1Members] = useState<Student[]>([]);
  const [team2Members, setTeam2Members] = useState<Student[]>([]);
  const [team1Score, setTeam1Score] = useState<number>(0);
  const [team2Score, setTeam2Score] = useState<number>(0);

  // Character Theme & Customization
  const [characterStyle, setCharacterStyle] = useState<CharacterStyle>('chibi');

  // Match / Gameplay State
  // ropePosition: -100 (Team 1 wins completely on left) to +100 (Team 2 wins on right), 0 is center
  const [ropePosition, setRopePosition] = useState<number>(0);
  const [gameState, setGameState] = useState<'setup' | 'countdown' | 'playing' | 'finished'>('setup');
  const [countdownText, setCountdownText] = useState<string>('3');
  const [winnerTeam, setWinnerTeam] = useState<1 | 2 | null>(null);
  const [matchMode, setMatchMode] = useState<'keyboard' | 'quiz_point' | 'auto'>('keyboard');
  const [pullPower] = useState<number>(4);

  // Visual FX Trigger
  const [lastPullTeam, setLastPullTeam] = useState<1 | 2 | null>(null);

  // Canvas and animation refs
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const confettiCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const confettiEngineRef = useRef<ConfettiEngine | null>(null);
  const imageCache = useRef<Map<string, HTMLImageElement>>(new Map());

  // Mutable refs for rock-solid RAF loop
  const ropePosRef = useRef<number>(0);
  const gameStateRef = useRef<'setup' | 'countdown' | 'playing' | 'finished'>('setup');
  const animTimeRef = useRef<number>(0);
  const pullEffectTimerRef = useRef<{ team: 1 | 2; time: number } | null>(null);

  useEffect(() => {
    ropePosRef.current = ropePosition;
  }, [ropePosition]);

  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  // Preload student avatars
  useEffect(() => {
    students.forEach((s) => {
      if (s.avatar && !imageCache.current.has(s.id)) {
        const img = new Image();
        img.src = s.avatar;
        img.onload = () => {
          imageCache.current.set(s.id, img);
        };
      }
    });
  }, [students]);

  // Auto divide students into 2 teams evenly
  const autoDivideTeams = useCallback(() => {
    if (students.length === 0) return;
    const shuffled = [...students].sort(() => Math.random() - 0.5);
    const mid = Math.ceil(shuffled.length / 2);
    setTeam1Members(shuffled.slice(0, mid));
    setTeam2Members(shuffled.slice(mid));
    sound.playSelect();
  }, [students]);

  // Initial team division on load
  useEffect(() => {
    if (team1Members.length === 0 && team2Members.length === 0 && students.length > 0) {
      autoDivideTeams();
    }
  }, [students, autoDivideTeams, team1Members.length, team2Members.length]);

  // Perform a pull step
  const executePull = useCallback((team: 1 | 2, amount: number = 3.8) => {
    if (gameStateRef.current !== 'playing') return;

    sound.playPull();
    setLastPullTeam(team);
    pullEffectTimerRef.current = { team, time: performance.now() };

    setRopePosition((prev) => {
      const delta = team === 1 ? -amount : amount;
      const nextPos = Math.max(-100, Math.min(100, prev + delta));

      // Check victory condition (reach -65% or +65%)
      const winThreshold = 65;
      if (nextPos <= -winThreshold) {
        // Team 1 Wins!
        setGameState('finished');
        gameStateRef.current = 'finished';
        setWinnerTeam(1);
        setTeam1Score((s) => s + 1);
        sound.stopBgMusic();
        sound.playWhistle();
        sound.playFanfare();

        // Award winner if callback supplied
        if (onSelectWinner && team1Members.length > 0) {
          const randomWinner = team1Members[Math.floor(Math.random() * team1Members.length)];
          onSelectWinner(randomWinner);
        }

        if (confettiCanvasRef.current) {
          if (!confettiEngineRef.current) {
            confettiEngineRef.current = new ConfettiEngine(confettiCanvasRef.current);
          }
          confettiEngineRef.current.resize();
          confettiEngineRef.current.fireCelebration(140);
        }
        return -winThreshold;
      } else if (nextPos >= winThreshold) {
        // Team 2 Wins!
        setGameState('finished');
        gameStateRef.current = 'finished';
        setWinnerTeam(2);
        setTeam2Score((s) => s + 1);
        sound.stopBgMusic();
        sound.playWhistle();
        sound.playFanfare();

        if (onSelectWinner && team2Members.length > 0) {
          const randomWinner = team2Members[Math.floor(Math.random() * team2Members.length)];
          onSelectWinner(randomWinner);
        }

        if (confettiCanvasRef.current) {
          if (!confettiEngineRef.current) {
            confettiEngineRef.current = new ConfettiEngine(confettiCanvasRef.current);
          }
          confettiEngineRef.current.resize();
          confettiEngineRef.current.fireCelebration(140);
        }
        return winThreshold;
      }

      return nextPos;
    });
  }, [team1Members, team2Members, onSelectWinner]);

  // Keyboard controls listener (A for Team 1, L for Team 2)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameStateRef.current !== 'playing') return;
      const key = e.key.toUpperCase();

      if (key === 'A' || key === 'Q' || key === '1' || key === 'ARROWLEFT') {
        executePull(1, pullPower);
      } else if (key === 'L' || key === 'P' || key === '0' || key === 'ARROWRIGHT') {
        executePull(2, pullPower);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [executePull, pullPower]);

  // Auto simulation loop if in auto mode
  useEffect(() => {
    let autoInterval: any = null;
    if (gameState === 'playing' && matchMode === 'auto') {
      autoInterval = setInterval(() => {
        const puller = Math.random() > 0.5 ? 1 : 2;
        const randomPower = 2 + Math.random() * 4.2;
        executePull(puller, randomPower);
      }, 300);
    }
    return () => clearInterval(autoInterval);
  }, [gameState, matchMode, executePull]);

  // Start Match with Referee Countdown
  const startMatch = () => {
    if (team1Members.length === 0 || team2Members.length === 0) {
      alert('Vui lòng chia thành viên vào cả 2 đội trước khi bắt đầu!');
      return;
    }

    setRopePosition(0);
    ropePosRef.current = 0;
    setWinnerTeam(null);
    setGameState('countdown');
    gameStateRef.current = 'countdown';
    setCountdownText('3');
    sound.playCountdown(false);

    setTimeout(() => {
      setCountdownText('2');
      sound.playCountdown(false);
    }, 600);

    setTimeout(() => {
      setCountdownText('1');
      sound.playCountdown(false);
    }, 1200);

    setTimeout(() => {
      setCountdownText('KÉO CO!');
      sound.playCountdown(true);
      sound.playWhistle();
      sound.startBgMusic();

      setGameState('playing');
      gameStateRef.current = 'playing';
    }, 1800);
  };

  // Reset arena
  const resetMatch = () => {
    setRopePosition(0);
    ropePosRef.current = 0;
    setWinnerTeam(null);
    setGameState('setup');
    sound.stopBgMusic();
  };

  // =========================================================================
  // HIGH-FPS 2D CANVAS GRAPHICS ENGINE - RECREATED CHARACTERS & ANIMATIONS
  // =========================================================================
  useEffect(() => {
    let animId = 0;

    const loop = (timestamp: number) => {
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

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = canvas.width / dpr;
      const height = canvas.height / dpr;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);

      animTimeRef.current = timestamp;
      const curState = gameStateRef.current;
      const isPlaying = curState === 'playing';
      const isFinished = curState === 'finished';
      const rPos = ropePosRef.current; // -100 to +100

      // Geometry Setup
      const groundY = height * 0.74;
      const centerX = width / 2;
      const ropeY = groundY - 32;

      // --- 1. STADIUM & COURT BACKGROUND ---
      // Sky Gradient with Stadium Atmosphere
      const skyGrad = ctx.createLinearGradient(0, 0, 0, groundY);
      skyGrad.addColorStop(0, '#020617');
      skyGrad.addColorStop(0.5, '#0f172a');
      skyGrad.addColorStop(1, '#1e293b');
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, width, groundY);

      // Stadium Lights Beam Effects
      ctx.save();
      const beamGrad = ctx.createLinearGradient(0, 0, centerX, groundY);
      beamGrad.addColorStop(0, 'rgba(251, 191, 36, 0.12)');
      beamGrad.addColorStop(1, 'rgba(251, 191, 36, 0)');

      ctx.fillStyle = beamGrad;
      ctx.beginPath();
      ctx.moveTo(width * 0.1, 0);
      ctx.lineTo(centerX - 160, groundY);
      ctx.lineTo(centerX + 160, groundY);
      ctx.lineTo(width * 0.9, 0);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // Grass Field / Competition Court
      const courtGrad = ctx.createLinearGradient(0, groundY, 0, height);
      courtGrad.addColorStop(0, '#16a34a');
      courtGrad.addColorStop(0.3, '#15803d');
      courtGrad.addColorStop(0.8, '#166534');
      courtGrad.addColorStop(1, '#14532d');
      ctx.fillStyle = courtGrad;
      ctx.fillRect(0, groundY, width, height - groundY);

      // Court Lines & Turf Stripes
      ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
      for (let x = 0; x < width; x += 80) {
        if ((Math.floor(x / 80) % 2) === 0) {
          ctx.fillRect(x, groundY, 40, height - groundY);
        }
      }

      // Center Line & Win Markings
      ctx.save();
      // Center line
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      ctx.setLineDash([8, 6]);
      ctx.beginPath();
      ctx.moveTo(centerX, groundY - 40);
      ctx.lineTo(centerX, height);
      ctx.stroke();
      ctx.setLineDash([]);

      // Win Boundary Thresholds
      const winPixelOffset = width * 0.22;
      // Red Team Win Threshold Line (Left)
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.6)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(centerX - winPixelOffset, groundY - 20);
      ctx.lineTo(centerX - winPixelOffset, height);
      ctx.stroke();

      // Blue Team Win Threshold Line (Right)
      ctx.strokeStyle = 'rgba(59, 130, 246, 0.6)';
      ctx.beginPath();
      ctx.moveTo(centerX + winPixelOffset, groundY - 20);
      ctx.lineTo(centerX + winPixelOffset, height);
      ctx.stroke();
      ctx.restore();

      // Physical Rope Offset Calculation
      const pixelShift = (rPos / 100) * winPixelOffset * 1.05;
      const ropeCenterX = centerX + pixelShift;

      // --- DUST & DIRT PARTICLES FROM FEET ---
      if (isPlaying) {
        ctx.fillStyle = 'rgba(254, 240, 138, 0.45)';
        for (let d = 0; d < 8; d++) {
          const px = centerX + (Math.sin(timestamp * 0.01 + d) * width * 0.38);
          const py = groundY + Math.random() * 10;
          ctx.beginPath();
          ctx.arc(px, py, 2 + Math.random() * 3.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // --- PULL FLASH / ENERGY AURA EFFECT ON RECENT PULL ---
      if (pullEffectTimerRef.current && (performance.now() - pullEffectTimerRef.current.time) < 250) {
        const elapsed = performance.now() - pullEffectTimerRef.current.time;
        const alpha = 1 - (elapsed / 250);
        const pTeam = pullEffectTimerRef.current.team;

        ctx.save();
        ctx.fillStyle = pTeam === 1 ? `rgba(239, 68, 68, ${alpha * 0.25})` : `rgba(59, 130, 246, ${alpha * 0.25})`;
        ctx.fillRect(0, 0, width, height);
        ctx.restore();
      }

      // =====================================================================
      // DRAW RECREATED TUG-OF-WAR CHARACTERS (NHÂN VẬT KÉO CO TÍ HON/CHIBI)
      // =====================================================================

      const maxDisplayTeam1 = Math.min(6, team1Members.length);
      const team1Spacing = Math.min(52, (width * 0.32) / Math.max(1, maxDisplayTeam1));

      const maxDisplayTeam2 = Math.min(6, team2Members.length);
      const team2Spacing = Math.min(52, (width * 0.32) / Math.max(1, maxDisplayTeam2));

      // helper: draw detailed character
      const drawTugCharacter = (
        student: Student,
        x: number,
        isLeftTeam: boolean,
        index: number,
        isAnchor: boolean,
        isLead: boolean
      ) => {
        ctx.save();
        ctx.translate(x, groundY);

        // Dynamic Heave & Rhythm
        const heaveSpeed = isPlaying ? 0.012 : 0.003;
        const heavePhase = timestamp * heaveSpeed + index * 0.6;
        const heaveY = isPlaying ? Math.sin(heavePhase) * 4 : Math.sin(heavePhase) * 1.5;

        // Lean angle calculation:
        // When playing: leans hard backward (-0.45 rad for Left, +0.45 rad for Right)
        // If losing badly (opposite team pulling): tumbles slightly forward
        let leanAngle = isLeftTeam ? -0.42 : 0.42;
        if (isFinished) {
          const didWin = (winnerTeam === 1 && isLeftTeam) || (winnerTeam === 2 && !isLeftTeam);
          if (didWin) {
            leanAngle = isLeftTeam ? -0.1 : 0.1; // Standing proud cheer
          } else {
            leanAngle = isLeftTeam ? 0.35 : -0.35; // Tumbled forward in defeat
          }
        }

        ctx.translate(0, heaveY);

        const primaryColor = isLeftTeam ? '#dc2626' : '#2563eb';
        const secondaryColor = isLeftTeam ? '#f87171' : '#60a5fa';
        const skinTone = '#ffedd5';

        // Anchor character size scaling (Back pillar character is bigger/stronger)
        const scaleFactor = isAnchor ? 1.15 : (isLead ? 1.05 : 0.95);
        ctx.scale(scaleFactor, scaleFactor);

        // 1. FEET & SNEAKERS (Digging into dirt)
        ctx.save();
        ctx.fillStyle = '#1e293b'; // Shoe base
        ctx.strokeStyle = primaryColor;
        ctx.lineWidth = 2;

        // Front foot planted
        const frontFootX = isLeftTeam ? -18 : 18;
        const backFootX = isLeftTeam ? 14 : -14;

        // Shoe 1
        ctx.beginPath();
        ctx.ellipse(frontFootX, -3, 11, 6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Shoe sole highlight
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(frontFootX - 8, -2, 16, 3);

        // Shoe 2
        ctx.fillStyle = '#1e293b';
        ctx.beginPath();
        ctx.ellipse(backFootX, -2, 10, 5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();

        // 2. LEGS & SHORTS
        ctx.save();
        ctx.strokeStyle = skinTone;
        ctx.lineWidth = 6;
        ctx.lineCap = 'round';

        // Legs bent straining
        ctx.beginPath();
        if (isLeftTeam) {
          ctx.moveTo(-6, -26);
          ctx.lineTo(-16, -14);
          ctx.lineTo(-18, -4);

          ctx.moveTo(6, -26);
          ctx.lineTo(10, -14);
          ctx.lineTo(14, -3);
        } else {
          ctx.moveTo(6, -26);
          ctx.lineTo(16, -14);
          ctx.lineTo(18, -4);

          ctx.moveTo(-6, -26);
          ctx.lineTo(-10, -14);
          ctx.lineTo(-14, -3);
        }
        ctx.stroke();

        // Athletic Shorts
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.roundRect(-12, -34, 24, 14, 4);
        ctx.fill();
        ctx.strokeStyle = secondaryColor;
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.restore();

        // 3. TORSO / ATHLETIC JERSEY WITH LEAN ANGLE
        ctx.save();
        ctx.rotate(leanAngle);

        // Jersey body
        ctx.fillStyle = primaryColor;
        ctx.beginPath();
        ctx.roundRect(-13, -64, 26, 32, 6);
        ctx.fill();

        // Collar & Side Stripes
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(-13, -64, 26, 4); // collar line
        ctx.fillRect(isLeftTeam ? -13 : 10, -60, 3, 26); // side stripe

        // Jersey Number
        ctx.fillStyle = '#ffffff';
        ctx.font = '900 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${index + 1}`, 0, -48);

        // 4. CHARACTER HEAD & EXPRESSIONS (RECREATED CHIBI/AVATAR)
        const headY = -78;
        const headRadius = 18;

        // Head shadow/glow
        if (isLead) {
          ctx.shadowColor = primaryColor;
          ctx.shadowBlur = 12;
        }

        // Check if student image avatar exists
        const cachedImg = imageCache.current.get(student.id);

        if (cachedImg && cachedImg.complete && cachedImg.naturalWidth > 0) {
          // Render photo inside circular badge on character head
          ctx.save();
          ctx.beginPath();
          ctx.arc(0, headY, headRadius, 0, Math.PI * 2);
          ctx.closePath();
          ctx.clip();
          ctx.drawImage(
            cachedImg,
            -headRadius,
            headY - headRadius,
            headRadius * 2,
            headRadius * 2
          );
          ctx.restore();

          // Gold / Team Border frame around head
          ctx.beginPath();
          ctx.arc(0, headY, headRadius, 0, Math.PI * 2);
          ctx.strokeStyle = isLead ? '#fbbf24' : '#ffffff';
          ctx.lineWidth = 3;
          ctx.stroke();
        } else {
          // Render Recreated Cartoon Chibi Character Face based on selected theme
          ctx.fillStyle = skinTone;
          ctx.beginPath();
          ctx.arc(0, headY, headRadius, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = primaryColor;
          ctx.lineWidth = 2.5;
          ctx.stroke();

          // Theme-based Head Details
          if (characterStyle === 'chibi') {
            // Team Headband
            ctx.fillStyle = primaryColor;
            ctx.fillRect(-headRadius + 1, headY - 14, headRadius * 2 - 2, 7);
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(-3, headY - 14, 6, 7);

            // Blushing cheeks
            ctx.fillStyle = 'rgba(244, 63, 94, 0.4)';
            ctx.beginPath();
            ctx.arc(-9, headY + 3, 3.5, 0, Math.PI * 2);
            ctx.arc(9, headY + 3, 3.5, 0, Math.PI * 2);
            ctx.fill();

            // Eyes & Mouth according to state
            ctx.fillStyle = '#0f172a';
            ctx.strokeStyle = '#0f172a';
            ctx.lineWidth = 2;

            if (isFinished) {
              const didWin = (winnerTeam === 1 && isLeftTeam) || (winnerTeam === 2 && !isLeftTeam);
              if (didWin) {
                // Happy eyes ^ ^
                ctx.beginPath();
                ctx.arc(-7, headY - 1, 4, Math.PI, 0);
                ctx.arc(7, headY - 1, 4, Math.PI, 0);
                ctx.stroke();

                // Big smile
                ctx.beginPath();
                ctx.arc(0, headY + 4, 5, 0, Math.PI);
                ctx.fill();
              } else {
                // Dizzy eyes @ @
                ctx.font = 'bold 9px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText('x', -7, headY + 1);
                ctx.fillText('x', 7, headY + 1);
              }
            } else if (isPlaying) {
              // Straining effort eyes > <
              ctx.beginPath();
              ctx.moveTo(-10, headY - 3); ctx.lineTo(-5, headY + 1); ctx.lineTo(-10, headY + 4);
              ctx.moveTo(10, headY - 3); ctx.lineTo(5, headY + 1); ctx.lineTo(10, headY + 4);
              ctx.stroke();

              // Gritted teeth
              ctx.fillStyle = '#ffffff';
              ctx.fillRect(-6, headY + 4, 12, 5);
              ctx.strokeRect(-6, headY + 4, 12, 5);
            } else {
              // Normal eyes & smile
              ctx.beginPath();
              ctx.arc(-7, headY, 2.5, 0, Math.PI * 2);
              ctx.arc(7, headY, 2.5, 0, Math.PI * 2);
              ctx.fill();

              ctx.beginPath();
              ctx.arc(0, headY + 3, 4, 0, Math.PI);
              ctx.stroke();
            }
          } else if (characterStyle === 'mascot') {
            // Cute Animal Ears (Bear / Tiger)
            ctx.fillStyle = primaryColor;
            ctx.beginPath();
            ctx.arc(-14, headY - 14, 7, 0, Math.PI * 2);
            ctx.arc(14, headY - 14, 7, 0, Math.PI * 2);
            ctx.fill();

            // Snout
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.ellipse(0, headY + 3, 6, 4, 0, 0, Math.PI * 2);
            ctx.fill();

            // Nose
            ctx.fillStyle = '#0f172a';
            ctx.beginPath();
            ctx.arc(0, headY + 1, 2.5, 0, Math.PI * 2);
            ctx.fill();
          } else if (characterStyle === 'robot') {
            // Mecha Visor
            ctx.fillStyle = isLeftTeam ? '#ef4444' : '#38bdf8';
            ctx.shadowColor = ctx.fillStyle;
            ctx.shadowBlur = 8;
            ctx.fillRect(-12, headY - 4, 24, 7);
            ctx.shadowBlur = 0;
          } else {
            // Ninja scarf
            ctx.fillStyle = primaryColor;
            ctx.fillRect(-headRadius, headY, headRadius * 2, headRadius);
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(-6, headY - 3, 2, 0, Math.PI * 2);
            ctx.arc(6, headY - 3, 2, 0, Math.PI * 2);
            ctx.fill();
          }
        }

        // Sweat drops popping out during pulling
        if (isPlaying && (index % 2 === 0)) {
          const sweatPhase = (timestamp * 0.015 + index) % (Math.PI * 2);
          const dropX = isLeftTeam ? -22 : 22;
          const dropY = headY - 8 + Math.sin(sweatPhase) * 6;

          ctx.fillStyle = '#38bdf8';
          ctx.beginPath();
          ctx.arc(dropX, dropY, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }

        // Floating Name Badge above character
        ctx.shadowColor = 'rgba(0,0,0,0.9)';
        ctx.shadowBlur = 6;
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 10px "Plus Jakarta Sans", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(getShortName(student.name), 0, headY - headRadius - 5);

        // Role Badge Tag (Tiên Phong / Trụ Cột)
        if (isLead || isAnchor) {
          const badgeText = isLead ? '⚡ TIÊN PHONG' : '🛡️ TRỤ CỘT';
          const badgeBg = isLead ? '#f59e0b' : '#6366f1';
          ctx.fillStyle = badgeBg;
          ctx.beginPath();
          ctx.roundRect(-28, headY - headRadius - 22, 56, 12, 4);
          ctx.fill();

          ctx.fillStyle = '#ffffff';
          ctx.font = '900 8px sans-serif';
          ctx.fillText(badgeText, 0, headY - headRadius - 13);
        }

        ctx.restore(); // end torso rotation

        // 5. ARMS & GLOVES GRIPPING THE ROPE
        ctx.save();
        ctx.strokeStyle = skinTone;
        ctx.lineWidth = 5;
        ctx.lineCap = 'round';

        // Hands position gripping rope
        const gripX = isLeftTeam ? 16 : -16;
        const gripY = -32;

        ctx.beginPath();
        ctx.moveTo(isLeftTeam ? -4 : 4, -52);
        ctx.lineTo(gripX, gripY);
        ctx.stroke();

        // White Athletic Gloves
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(gripX, gripY, 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Special Anchor Wrap: Rope wrapped around body for anchor character
        if (isAnchor) {
          ctx.strokeStyle = '#d97706';
          ctx.lineWidth = 5;
          ctx.beginPath();
          ctx.arc(0, -42, 14, 0, Math.PI);
          ctx.stroke();
        }

        ctx.restore();
        ctx.restore(); // end main character translate
      };

      // --- DRAW LEFT TEAM (TEAM 1 - RED) CHARACTERS ---
      for (let i = 0; i < maxDisplayTeam1; i++) {
        const student = team1Members[i];
        const isAnchor = i === maxDisplayTeam1 - 1;
        const isLead = i === 0;
        // Positioned left of the rope ribbon
        const charX = ropeCenterX - 65 - (i * team1Spacing);
        drawTugCharacter(student, charX, true, i, isAnchor, isLead);
      }

      // --- DRAW RIGHT TEAM (TEAM 2 - BLUE) CHARACTERS ---
      for (let i = 0; i < maxDisplayTeam2; i++) {
        const student = team2Members[i];
        const isAnchor = i === maxDisplayTeam2 - 1;
        const isLead = i === 0;
        // Positioned right of the rope ribbon
        const charX = ropeCenterX + 65 + (i * team2Spacing);
        drawTugCharacter(student, charX, false, i, isAnchor, isLead);
      }

      // --- 3. DRAW HEAVY DUTY JUTE ROPE (DÂY THỪNG KÉO CO SE SỢI) ---
      const ropeLeftX = Math.max(15, ropeCenterX - 65 - (maxDisplayTeam1 * team1Spacing));
      const ropeRightX = Math.min(width - 15, ropeCenterX + 65 + (maxDisplayTeam2 * team2Spacing));

      ctx.save();
      // Rope Drop Shadow on Field
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)';
      ctx.lineWidth = 12;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(ropeLeftX, groundY - 2);
      ctx.lineTo(ropeRightX, groundY - 2);
      ctx.stroke();

      // Main Golden-Brown Jute Rope
      const ropeGrad = ctx.createLinearGradient(ropeLeftX, 0, ropeRightX, 0);
      ropeGrad.addColorStop(0, '#b45309');
      ropeGrad.addColorStop(0.5, '#d97706');
      ropeGrad.addColorStop(1, '#b45309');

      ctx.strokeStyle = ropeGrad;
      ctx.lineWidth = 9;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(ropeLeftX, ropeY);
      ctx.lineTo(ropeRightX, ropeY);
      ctx.stroke();

      // Twisted Rope Texture Stripes
      ctx.strokeStyle = '#78350f';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(ropeLeftX, ropeY);
      ctx.lineTo(ropeRightX, ropeY);
      ctx.stroke();
      ctx.setLineDash([]);

      // Center Red Ribbon Marker on Rope
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(ropeCenterX, ropeY, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Dangling Ribbon Tail Animation
      const ribbonSwing = isPlaying ? Math.sin(timestamp * 0.02) * 6 : 0;
      ctx.fillStyle = '#dc2626';
      ctx.beginPath();
      ctx.moveTo(ropeCenterX - 5, ropeY + 5);
      ctx.lineTo(ropeCenterX + ribbonSwing, ropeY + 34);
      ctx.lineTo(ropeCenterX + 5, ropeY + 5);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // --- 4. SIDELINE CHEERLEADERS / FLAG WAVERS ---
      // Left Team Flag Waver
      ctx.save();
      const flag1X = Math.max(25, ropeLeftX - 35);
      ctx.translate(flag1X, groundY);
      const flagWave1 = Math.sin(timestamp * 0.008) * 0.2;
      ctx.rotate(flagWave1);

      // Flag pole
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, -50);
      ctx.stroke();

      // Red Flag
      ctx.fillStyle = '#dc2626';
      ctx.beginPath();
      ctx.moveTo(0, -50);
      ctx.lineTo(-24, -38);
      ctx.lineTo(0, -26);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // Right Team Flag Waver
      ctx.save();
      const flag2X = Math.min(width - 25, ropeRightX + 35);
      ctx.translate(flag2X, groundY);
      const flagWave2 = Math.cos(timestamp * 0.008) * 0.2;
      ctx.rotate(flagWave2);

      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, -50);
      ctx.stroke();

      // Blue Flag
      ctx.fillStyle = '#2563eb';
      ctx.beginPath();
      ctx.moveTo(0, -50);
      ctx.lineTo(24, -38);
      ctx.lineTo(0, -26);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // --- 5. VICTORY BANNER OVERLAY ---
      if (isFinished && winnerTeam) {
        ctx.save();
        const bannerText = winnerTeam === 1 ? `${team1Name} CHIẾN THẮNG!` : `${team2Name} CHIẾN THẮNG!`;

        ctx.fillStyle = 'rgba(2, 6, 23, 0.85)';
        ctx.fillRect(0, height * 0.12, width, 65);

        ctx.fillStyle = '#fbbf24';
        ctx.font = '900 24px "Plus Jakarta Sans", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(0,0,0,0.9)';
        ctx.shadowBlur = 12;
        ctx.fillText(`🏆 ${bannerText}`, centerX, height * 0.12 + 32);
        ctx.restore();
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [team1Members, team2Members, team1Name, team2Name, winnerTeam, characterStyle]);

  // Dynamic canvas resize
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;

      const w = container.clientWidth || 900;
      const h = container.clientHeight || 420;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);

      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    const observer = new ResizeObserver(() => handleResize());
    if (containerRef.current) observer.observe(containerRef.current);

    return () => {
      window.removeEventListener('resize', handleResize);
      observer.disconnect();
    };
  }, []);

  return (
    <div className="relative flex flex-col justify-between w-full h-full max-w-6xl mx-auto overflow-hidden select-none p-1 sm:p-2">
      {/* Confetti celebration canvas */}
      <canvas
        ref={confettiCanvasRef}
        className="absolute inset-0 pointer-events-none z-40 w-full h-full"
      />

      {/* Top Header: Scoreboard & Team Names Banner */}
      <div className="flex items-center justify-between gap-2 mb-1.5 px-1 shrink-0">
        {/* Team 1 Score Card */}
        <div className="flex-1 flex items-center justify-between bg-red-500/10 border-2 border-red-500/30 rounded-2xl p-2 sm:px-3 text-red-950">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-red-600 text-white flex items-center justify-center font-black shadow-xs shrink-0">
              🔴
            </div>
            <div className="min-w-0">
              <h4 className="font-black text-xs sm:text-sm truncate text-red-900">{team1Name}</h4>
              <span className="text-[10px] text-red-700 font-bold">{team1Members.length} thành viên</span>
            </div>
          </div>
          <span className="text-xl sm:text-2xl font-black text-red-600 ml-2">{team1Score}</span>
        </div>

        {/* VS Center Badge */}
        <div className="flex flex-col items-center justify-center px-2">
          <div className="w-8 h-8 rounded-full bg-slate-900 text-amber-400 flex items-center justify-center font-black text-xs shadow-md border border-amber-400/40">
            VS
          </div>
        </div>

        {/* Team 2 Score Card */}
        <div className="flex-1 flex items-center justify-between bg-blue-500/10 border-2 border-blue-500/30 rounded-2xl p-2 sm:px-3 text-blue-950">
          <span className="text-xl sm:text-2xl font-black text-blue-600 mr-2">{team2Score}</span>
          <div className="flex items-center gap-2 min-w-0 justify-end text-right">
            <div className="min-w-0">
              <h4 className="font-black text-xs sm:text-sm truncate text-blue-900">{team2Name}</h4>
              <span className="text-[10px] text-blue-700 font-bold">{team2Members.length} thành viên</span>
            </div>
            <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black shadow-xs shrink-0">
              🔵
            </div>
          </div>
        </div>
      </div>

      {/* Main Game Stage / Tug-of-War Arena */}
      <div
        ref={containerRef}
        className="relative flex-1 min-h-[300px] sm:min-h-[360px] w-full overflow-hidden rounded-3xl border border-slate-300 shadow-2xl bg-slate-950 flex flex-col justify-between"
      >
        <canvas ref={canvasRef} className="block w-full h-full" />

        {/* Setup Mode Overlay with Prominent Start Play Button */}
        {gameState === 'setup' && (
          <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-[3px] flex flex-col items-center justify-center z-20 p-4 transition-all">
            <div className="bg-slate-900/90 border-2 border-emerald-400/50 shadow-2xl rounded-3xl p-5 sm:p-7 max-w-md w-full text-center flex flex-col items-center gap-4 animate-in fade-in zoom-in-95 duration-200">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-tr from-emerald-500 via-teal-400 to-sky-400 p-1 shadow-xl shadow-emerald-500/40 animate-bounce flex items-center justify-center">
                <button
                  onClick={startMatch}
                  className="w-full h-full rounded-full bg-slate-950 flex items-center justify-center text-emerald-400 hover:text-white transition-colors cursor-pointer"
                  title="Bắt đầu chơi ngay"
                >
                  <Play size={36} className="ml-1 fill-current" />
                </button>
              </div>

              <div>
                <h3 className="text-2xl sm:text-3xl font-black text-amber-300 drop-shadow-md tracking-wide">
                  SẴN SÀNG KÉO CO!
                </h3>
                <p className="text-xs sm:text-sm text-slate-300 font-medium mt-1">
                  {team1Members.length > 0 && team2Members.length > 0
                    ? `${team1Name} VS ${team2Name} (${team1Members.length + team2Members.length} học sinh)`
                    : 'Vui lòng chia đội để tham gia thi đấu'}
                </p>
              </div>

              {/* Prominent Start Play CTA Button */}
              <button
                onClick={startMatch}
                className="w-full py-3.5 sm:py-4 px-6 bg-gradient-to-r from-emerald-500 via-teal-500 to-sky-500 hover:from-emerald-400 hover:to-sky-400 text-white font-black text-lg sm:text-xl rounded-2xl shadow-xl shadow-emerald-500/30 ring-4 ring-emerald-400/40 flex items-center justify-center gap-3 transition-all transform hover:scale-105 active:scale-95 cursor-pointer animate-pulse"
              >
                <PlayCircle size={26} className="fill-white/20" />
                <span>BẮT ĐẦU CHƠI</span>
              </button>

              {/* Quick Controls Guide */}
              <div className="grid grid-cols-2 gap-2 w-full pt-2 border-t border-slate-800 text-[11px] sm:text-xs">
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-2 text-red-300 font-bold flex items-center justify-center gap-1.5">
                  <span className="truncate">🔴 {team1Name}:</span>
                  <span className="bg-red-950/90 px-2 py-0.5 rounded border border-red-500/50 text-amber-300 font-mono font-black shrink-0">Phím A</span>
                </div>
                <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-2 text-blue-300 font-bold flex items-center justify-center gap-1.5">
                  <span className="truncate">🔵 {team2Name}:</span>
                  <span className="bg-blue-950/90 px-2 py-0.5 rounded border border-blue-500/50 text-amber-300 font-mono font-black shrink-0">Phím L</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Countdown Overlay */}
        {gameState === 'countdown' && (
          <div className="absolute inset-0 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center z-20">
            <div className="text-center animate-bounce">
              <span className="text-6xl sm:text-8xl font-black text-amber-400 drop-shadow-[0_4px_24px_rgba(0,0,0,0.9)] tracking-wider">
                {countdownText}
              </span>
            </div>
          </div>
        )}

        {/* Finished Victory Overlay: Start New Match Button */}
        {gameState === 'finished' && (
          <div className="absolute inset-x-0 bottom-6 flex items-center justify-center z-30 pointer-events-none">
            <button
              onClick={startMatch}
              className="pointer-events-auto px-6 py-3.5 bg-gradient-to-r from-amber-500 via-emerald-500 to-teal-500 hover:brightness-110 text-white font-black text-base sm:text-lg rounded-2xl shadow-2xl ring-4 ring-amber-400/60 flex items-center gap-2.5 transition-transform hover:scale-105 active:scale-95 cursor-pointer animate-bounce"
            >
              <RotateCcw size={22} />
              <span>BẮT ĐẦU CHƠI HIỆP MỚI</span>
            </button>
          </div>
        )}

        {/* In-Arena Interactive Tapping Pull Buttons (Ideal for SmartBoards / Touch Screens) */}
        {gameState === 'playing' && (
          <div className="absolute inset-x-0 bottom-4 flex items-center justify-between px-3 sm:px-10 pointer-events-none z-10">
            {/* Left Team Pull Button */}
            <button
              onClick={() => executePull(1, pullPower)}
              className="pointer-events-auto px-4 sm:px-8 py-3 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-black text-xs sm:text-base rounded-2xl shadow-2xl ring-4 ring-red-400/50 flex items-center gap-2 transition-transform active:scale-90 cursor-pointer animate-pulse"
            >
              <Flame size={18} />
              <span>KÉO VỀ ĐỎ! [Phím A]</span>
            </button>

            {/* Right Team Pull Button */}
            <button
              onClick={() => executePull(2, pullPower)}
              className="pointer-events-auto px-4 sm:px-8 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-black text-xs sm:text-base rounded-2xl shadow-2xl ring-4 ring-blue-400/50 flex items-center gap-2 transition-transform active:scale-90 cursor-pointer animate-pulse"
            >
              <span>[Phím L] KÉO VỀ XANH!</span>
              <Flame size={18} />
            </button>
          </div>
        )}
      </div>

      {/* Bottom Control Bar */}
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 p-2 bg-white border border-slate-200 rounded-2xl shadow-xs shrink-0">
        {/* Left Actions: Character Style Picker & Team Divider */}
        <div className="flex flex-wrap items-center gap-1.5">
          {/* Character Style Customizer Selector */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
            <span className="text-[11px] font-bold text-slate-500 px-1.5 hidden md:inline">Nhân vật:</span>
            <button
              onClick={() => setCharacterStyle('chibi')}
              className={`px-2.5 py-1 rounded-lg text-xs font-extrabold flex items-center gap-1 transition-all cursor-pointer ${
                characterStyle === 'chibi'
                  ? 'bg-amber-400 text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Vận động viên tí hon"
            >
              <Smile size={13} />
              <span>Tí Hon</span>
            </button>
            <button
              onClick={() => setCharacterStyle('mascot')}
              className={`px-2.5 py-1 rounded-lg text-xs font-extrabold flex items-center gap-1 transition-all cursor-pointer ${
                characterStyle === 'mascot'
                  ? 'bg-amber-400 text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Biệt đội thú cưng"
            >
              <Cat size={13} />
              <span>Thú Cưng</span>
            </button>
            <button
              onClick={() => setCharacterStyle('robot')}
              className={`px-2.5 py-1 rounded-lg text-xs font-extrabold flex items-center gap-1 transition-all cursor-pointer ${
                characterStyle === 'robot'
                  ? 'bg-amber-400 text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Robot mecha"
            >
              <Bot size={13} />
              <span>Robot</span>
            </button>
          </div>

          <button
            onClick={autoDivideTeams}
            disabled={gameState === 'playing'}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-40"
            title="Xáo trộn ngẫu nhiên thành viên 2 đội"
          >
            <Shuffle size={13} />
            <span className="hidden sm:inline">Chia Đội</span>
          </button>

          <button
            onClick={() => {
              const currentIdx = DEFAULT_TEAM_NAMES.findIndex((n) => n.team1 === team1Name);
              const nextIdx = (currentIdx + 1) % DEFAULT_TEAM_NAMES.length;
              setTeam1Name(DEFAULT_TEAM_NAMES[nextIdx].team1);
              setTeam2Name(DEFAULT_TEAM_NAMES[nextIdx].team2);
              sound.playSelect();
            }}
            disabled={gameState === 'playing'}
            className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-40"
            title="Đổi tên chủ đề 2 đội"
          >
            <Edit3 size={13} />
            <span className="hidden sm:inline">Đổi Tên</span>
          </button>
        </div>

        {/* Center: Main Start / Match Control Button */}
        <div className="flex items-center gap-2">
          {gameState === 'playing' ? (
            <button
              onClick={resetMatch}
              className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs sm:text-sm font-black shadow-md flex items-center gap-1.5 transition-transform active:scale-95 cursor-pointer"
            >
              <RotateCcw size={15} />
              <span>LÀM LẠI</span>
            </button>
          ) : (
            <button
              onClick={startMatch}
              className="px-6 py-2 bg-gradient-to-r from-emerald-500 via-teal-500 to-sky-600 hover:from-emerald-400 hover:to-sky-500 text-white rounded-xl text-xs sm:text-sm font-black shadow-lg shadow-emerald-500/20 ring-2 ring-emerald-400/40 flex items-center gap-2 transition-transform hover:scale-105 active:scale-95 cursor-pointer animate-pulse"
            >
              <PlayCircle size={18} />
              <span>{gameState === 'finished' ? 'BẮT ĐẦU HIỆP MỚI' : 'BẮT ĐẦU CHƠI'}</span>
            </button>
          )}
        </div>

        {/* Right: Game Play Mode selector */}
        <div className="flex items-center gap-1 text-xs text-slate-600">
          <Keyboard size={13} className="text-indigo-600 hidden sm:inline" />
          <select
            value={matchMode}
            onChange={(e) => setMatchMode(e.target.value as any)}
            disabled={gameState === 'playing'}
            className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs text-slate-800 font-bold outline-none cursor-pointer"
          >
            <option value="keyboard">⚡ Bấm Phím Nhanh (A & L)</option>
            <option value="auto">🤖 Tự Động Mô Phỏng</option>
          </select>
        </div>
      </div>
    </div>
  );
};
