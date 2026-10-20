import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Student, QuizSet, QuizQuestion } from '../types';
import { DEFAULT_QUIZ_SETS } from '../utils/defaultQuizData';
import { sound } from '../services/sound';
import { ConfettiEngine } from '../services/confetti';
import { getShortName, getInitials } from '../utils/defaultData';
import { saveToAppDB, getFromAppDB } from '../services/dataStorage';
import {
  HelpCircle,
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  Clock,
  CheckCircle2,
  XCircle,
  Shuffle,
  Plus,
  Trash2,
  Edit3,
  BookOpen,
  ChevronRight,
  ChevronLeft,
  Keyboard,
  Upload,
  Save,
  X,
  Zap,
  Trophy,
  Swords,
  Flame,
  Award,
  Users,
  Flag,
  RotateCw,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  Snowflake,
  Layers,
  Search,
  Star,
  UserCheck,
  UserPlus,
  ArrowRightLeft,
  Smile,
  Image as ImageIcon,
  Mountain,
} from 'lucide-react';
import { SprintTrackArena } from './arenas/SprintTrackArena';
import { MountainClimbArena } from './arenas/MountainClimbArena';
import { TugOfWarArena } from './arenas/TugOfWarArena';
import { ZigZagArena } from './arenas/ZigZagArena';

interface ClassroomQuizProps {
  students: Student[];
  onSelectWinner?: (student: Student) => void;
}

const DEFAULT_TEAM_NAMES = [
  { teamBlue: '🔵 Đội Xanh', teamRed: '🔴 Đội Đỏ' },
  { teamBlue: '🐉 Đội Rồng Xanh', teamRed: '🐅 Đội Hổ Đỏ' },
  { teamBlue: '⚡ Đội Sấm Sét', teamRed: '🔥 Đội Lửa Thần' },
  { teamBlue: '🔵 Tổ 1 & Tổ 2', teamRed: '🔴 Tổ 3 & Tổ 4' },
];

export const ClassroomQuiz: React.FC<ClassroomQuizProps> = ({ students = [] }) => {
  // Quiz sets stored in localStorage
  const [quizSets, setQuizSets] = useState<QuizSet[]>(() => {
    const saved = localStorage.getItem('cp_quiz_sets');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return DEFAULT_QUIZ_SETS;
      }
    }
    return DEFAULT_QUIZ_SETS;
  });

  const [activeSetId, setActiveSetId] = useState<string>(() => {
    return quizSets[0]?.id || DEFAULT_QUIZ_SETS[0].id;
  });

  const currentSet = quizSets.find((s) => s.id === activeSetId) || quizSets[0] || DEFAULT_QUIZ_SETS[0];

  // Question mode: 'independent_shuffle' vs 'split_deck' vs 'same_question'
  const [questionMode, setQuestionMode] = useState<'independent_shuffle' | 'split_deck' | 'same_question'>('independent_shuffle');

  // Independent Question Lists for each team
  const [blueQuestions, setBlueQuestions] = useState<QuizQuestion[]>([]);
  const [redQuestions, setRedQuestions] = useState<QuizQuestion[]>([]);
  const [blueQuestionIndex, setBlueQuestionIndex] = useState<number>(0);
  const [redQuestionIndex, setRedQuestionIndex] = useState<number>(0);

  // Teams & Scores
  const [teamBlueName, setTeamBlueName] = useState<string>('🔵 Đội Xanh');
  const [teamRedName, setTeamRedName] = useState<string>('🔴 Đội Đỏ');
  const [teamBlueMembers, setTeamBlueMembers] = useState<Student[]>([]);
  const [teamRedMembers, setTeamRedMembers] = useState<Student[]>([]);
  const [teamBlueScore, setTeamBlueScore] = useState<number>(0);
  const [teamRedScore, setTeamRedScore] = useState<number>(0);

  // Arena Theme: 'tug' (Kéo Co Đối Kháng 🪢), 'running' (Đường Đua Về Đích 🏁), 'climbing' (Leo Núi Chinh Phục Đỉnh Cao 🧗‍♂️), 'ziczac' (Đua Ziczac Vượt Ải 🌀)
  const [arenaTheme, setArenaTheme] = useState<'running' | 'climbing' | 'tug' | 'ziczac'>(() => {
    try {
      const saved = localStorage.getItem('cp_arena_theme');
      if (saved === 'running' || saved === 'climbing' || saved === 'tug' || saved === 'ziczac') return saved as any;
    } catch {}
    return 'tug'; // Mặc định Kéo Co Đối Kháng để hiện ngay hình 2 đội kéo co
  });

  // Target points to reach finish line or mountain summit (default: 6 points)
  const [targetPointsToWin, setTargetPointsToWin] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('cp_target_points');
      if (saved) return parseInt(saved, 10) || 6;
    } catch {}
    return 6;
  });

  const handleSelectArenaTheme = (theme: 'running' | 'climbing' | 'tug' | 'ziczac') => {
    setArenaTheme(theme);
    try {
      localStorage.setItem('cp_arena_theme', theme);
    } catch {}
    sound.playSelect();
  };

  const handleSelectTargetPoints = (pts: number) => {
    setTargetPointsToWin(pts);
    try {
      localStorage.setItem('cp_target_points', pts.toString());
    } catch {}
    sound.playSelect();
  };

  // Character Face Mode: exact cartoon artwork vs student avatar photo
  const [showStudentFaces, setShowStudentFaces] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('cp_show_student_faces_v2');
      if (saved !== null) return saved === 'true';
    } catch {}
    return false;
  });

  const handleToggleStudentFaces = () => {
    const next = !showStudentFaces;
    setShowStudentFaces(next);
    try {
      localStorage.setItem('cp_show_student_faces_v2', String(next));
    } catch {}
  };

  // Custom uploaded Tug of War background/artwork image (persisted in IndexedDB + localStorage)
  const [customTugImage, setCustomTugImage] = useState<string | null>(() => {
    try {
      return localStorage.getItem('cp_custom_tug_image');
    } catch {
      return null;
    }
  });
  const tugFileInputRef = useRef<HTMLInputElement | null>(null);
  const isQuizDbLoadedRef = useRef<boolean>(false);

  // Load customTugImage and quizSets from IndexedDB on mount and when backup is restored
  useEffect(() => {
    const loadPersistedQuizData = async () => {
      const dbTugImg = await getFromAppDB<string>('custom_tug_image');
      if (dbTugImg) {
        setCustomTugImage(dbTugImg);
      }
      const dbQuizSets = await getFromAppDB<QuizSet[]>('quiz_sets');
      if (Array.isArray(dbQuizSets) && dbQuizSets.length > 0) {
        setQuizSets(dbQuizSets);
      }
      isQuizDbLoadedRef.current = true;
    };
    loadPersistedQuizData();

    const handleRestored = () => {
      loadPersistedQuizData();
    };
    window.addEventListener('classroom-data-restored', handleRestored);
    return () => window.removeEventListener('classroom-data-restored', handleRestored);
  }, []);

  // Save quizSets to IndexedDB whenever they change
  useEffect(() => {
    if (!isQuizDbLoadedRef.current) return;
    saveToAppDB('quiz_sets', quizSets).catch(() => {});
  }, [quizSets]);

  // Compress uploaded images via HTML5 Canvas to fix image persistence & save to IndexedDB
  const saveCompressedTugImage = (dataUrl: string) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const MAX_WIDTH = 960;
      const MAX_HEIGHT = 540;
      let width = img.width;
      let height = img.height;

      if (width > MAX_WIDTH) {
        height = Math.round((height * MAX_WIDTH) / width);
        width = MAX_WIDTH;
      }
      if (height > MAX_HEIGHT) {
        width = Math.round((width * MAX_HEIGHT) / height);
        height = MAX_HEIGHT;
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0, width, height);
        const compressed = canvas.toDataURL('image/jpeg', 0.85);
        setCustomTugImage(compressed);
        saveToAppDB('custom_tug_image', compressed).catch(() => {});
        try {
          localStorage.setItem('cp_custom_tug_image', compressed);
        } catch {}
      } else {
        setCustomTugImage(dataUrl);
        saveToAppDB('custom_tug_image', dataUrl).catch(() => {});
      }
    };
    img.onerror = () => {
      setCustomTugImage(dataUrl);
      saveToAppDB('custom_tug_image', dataUrl).catch(() => {});
    };
    img.src = dataUrl;
  };

  const handleUploadTugImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      saveCompressedTugImage(dataUrl);
      sound.playFanfare();
    };
    reader.readAsDataURL(file);
  };

  const handleClearCustomTugImage = () => {
    setCustomTugImage(null);
    saveToAppDB('custom_tug_image', null).catch(() => {});
    try {
      localStorage.removeItem('cp_custom_tug_image');
    } catch {}
    sound.playTick();
  };

  // Team Selection & Configuration Modal
  const [showTeamModal, setShowTeamModal] = useState<boolean>(false);
  const [teamSearchQuery, setTeamSearchQuery] = useState<string>('');

  // Answering & Freeze Penalty states (Đóng băng 3 giây khi trả lời sai)
  const [freezePenaltySeconds, setFreezePenaltySeconds] = useState<number>(3);
  const [blueSelectedOption, setBlueSelectedOption] = useState<number | null>(null);
  const [blueIsRevealed, setBlueIsRevealed] = useState<boolean>(false);
  const [blueFreezeSeconds, setBlueFreezeSeconds] = useState<number>(0);

  const [redSelectedOption, setRedSelectedOption] = useState<number | null>(null);
  const [redIsRevealed, setRedIsRevealed] = useState<boolean>(false);
  const [redFreezeSeconds, setRedFreezeSeconds] = useState<number>(0);

  // Rope physical position: -100 (Blue pulls left) to +100 (Red pulls right)
  const [ropePosition, setRopePosition] = useState<number>(0);
  const [isQuizCompleted, setIsQuizCompleted] = useState<boolean>(false);
  const [matchWinner, setMatchWinner] = useState<'blue' | 'red' | 'draw' | null>(null);

  // Timer & Controls (Có thể tùy chỉnh thời gian suy nghĩ / thời gian trận đấu)
  const [isGameStarted, setIsGameStarted] = useState<boolean>(false);
  const [timerDuration, setTimerDuration] = useState<number>(120); // 2 minutes default
  const [timeLeft, setTimeLeft] = useState<number>(120);
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(false);
  const [showTimeMenu, setShowTimeMenu] = useState<boolean>(false);
  const [isSoundMuted, setIsSoundMuted] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Modals for Importing Questions
  const [showImportModal, setShowImportModal] = useState<boolean>(false);
  const [importText, setImportText] = useState<string>('');
  const [importCategory, setImportCategory] = useState<string>('Tiếng Anh');
  const [importTitle, setImportTitle] = useState<string>('Bộ Đề Kéo Co Mới');

  // Animation Refs
  const confettiCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const confettiEngineRef = useRef<ConfettiEngine | null>(null);
  const ropePosRef = useRef<number>(0);
  const isPullingAnimRef = useRef<{ team: 'blue' | 'red'; endTime: number } | null>(null);

  useEffect(() => {
    ropePosRef.current = ropePosition;
  }, [ropePosition]);

  // Build question pools for both teams
  const buildTeamQuestions = useCallback(() => {
    if (!currentSet || currentSet.questions.length === 0) return;

    const baseQuestions = [...currentSet.questions];

    if (questionMode === 'independent_shuffle') {
      const shuffledBlue = [...baseQuestions].sort(() => Math.random() - 0.5);
      const shuffledRed = [...baseQuestions].sort(() => Math.random() - 0.5);
      setBlueQuestions(shuffledBlue);
      setRedQuestions(shuffledRed);
    } else if (questionMode === 'split_deck') {
      const blueDeck = baseQuestions.filter((_, idx) => idx % 2 === 0);
      const redDeck = baseQuestions.filter((_, idx) => idx % 2 !== 0);
      setBlueQuestions(blueDeck.length > 0 ? blueDeck : baseQuestions);
      setRedQuestions(redDeck.length > 0 ? redDeck : baseQuestions);
    } else {
      setBlueQuestions(baseQuestions);
      setRedQuestions(baseQuestions);
    }

    setBlueQuestionIndex(0);
    setRedQuestionIndex(0);
    setBlueSelectedOption(null);
    setBlueIsRevealed(false);
    setBlueFreezeSeconds(0);
    setRedSelectedOption(null);
    setRedIsRevealed(false);
    setRedFreezeSeconds(0);
  }, [currentSet, questionMode]);

  useEffect(() => {
    buildTeamQuestions();
  }, [buildTeamQuestions]);

  // Save quiz sets
  useEffect(() => {
    localStorage.setItem('cp_quiz_sets', JSON.stringify(quizSets));
  }, [quizSets]);

  // Auto divide students
  const autoDivideTeams = useCallback(() => {
    if (students.length === 0) return;
    const shuffled = [...students].sort(() => Math.random() - 0.5);
    const mid = Math.ceil(shuffled.length / 2);
    setTeamBlueMembers(shuffled.slice(0, mid));
    setTeamRedMembers(shuffled.slice(mid));
    sound.playSelect();
  }, [students]);

  // Assign a student to Blue or Red team
  const assignStudentToTeam = (student: Student, team: 'blue' | 'red') => {
    sound.playSelect();
    if (team === 'blue') {
      setTeamRedMembers((prev) => prev.filter((s) => s.id !== student.id));
      setTeamBlueMembers((prev) => {
        if (prev.some((s) => s.id === student.id)) return prev;
        return [...prev, student];
      });
    } else {
      setTeamBlueMembers((prev) => prev.filter((s) => s.id !== student.id));
      setTeamRedMembers((prev) => {
        if (prev.some((s) => s.id === student.id)) return prev;
        return [...prev, student];
      });
    }
  };

  // Remove a student from all teams
  const removeStudentFromTeam = (studentId: string) => {
    sound.playTick();
    setTeamBlueMembers((prev) => prev.filter((s) => s.id !== studentId));
    setTeamRedMembers((prev) => prev.filter((s) => s.id !== studentId));
  };

  // Set lead athlete (promotes student to top of team to appear on the rope)
  const setLeadAthlete = (studentId: string, team: 'blue' | 'red') => {
    sound.playSelect();
    if (team === 'blue') {
      setTeamBlueMembers((prev) => {
        const found = prev.find((s) => s.id === studentId);
        if (!found) return prev;
        return [found, ...prev.filter((s) => s.id !== studentId)];
      });
    } else {
      setTeamRedMembers((prev) => {
        const found = prev.find((s) => s.id === studentId);
        if (!found) return prev;
        return [found, ...prev.filter((s) => s.id !== studentId)];
      });
    }
  };

  const clearAllTeams = () => {
    sound.playBuzzer();
    setTeamBlueMembers([]);
    setTeamRedMembers([]);
  };

  useEffect(() => {
    if (teamBlueMembers.length === 0 && teamRedMembers.length === 0 && students.length > 0) {
      autoDivideTeams();
    }
  }, [students, autoDivideTeams, teamBlueMembers.length, teamRedMembers.length]);

  // Fullscreen toggle
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
        setIsFullscreen(false);
      }
    }
  };

  // Sound mute toggle
  const toggleMute = () => {
    sound.toggleMute();
    setIsSoundMuted(sound.getMuted());
  };

  // Stop background music on unmount
  useEffect(() => {
    return () => {
      sound.stopBgMusic();
    };
  }, []);

  // Start game after configuring teams and questions
  const handleStartGame = () => {
    setIsGameStarted(true);
    setIsTimerRunning(true);
    setTeamBlueScore(0);
    setTeamRedScore(0);
    setRopePosition(0);
    ropePosRef.current = 0;
    setIsQuizCompleted(false);
    setMatchWinner(null);
    setTimeLeft(timerDuration);
    buildTeamQuestions();
    sound.playWhistle();
    sound.startBgMusic();
  };

  // Reset match / back to setup
  const resetMatch = () => {
    sound.stopBgMusic();
    setIsGameStarted(false);
    setIsTimerRunning(false);
    setTeamBlueScore(0);
    setTeamRedScore(0);
    setRopePosition(0);
    ropePosRef.current = 0;
    setIsQuizCompleted(false);
    setMatchWinner(null);
    setTimeLeft(timerDuration);
    buildTeamQuestions();
    sound.playSelect();
  };

  // Timer countdown loop
  useEffect(() => {
    let timerId: any = null;
    if (isTimerRunning && timeLeft > 0 && !isQuizCompleted) {
      timerId = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            setIsTimerRunning(false);
            sound.stopBgMusic();
            sound.playWhistle();
            sound.playFanfare();
            setIsQuizCompleted(true);
            const finalPos = ropePosRef.current;
            if (finalPos < -5 || teamBlueScore > teamRedScore) setMatchWinner('blue');
            else if (finalPos > 5 || teamRedScore > teamBlueScore) setMatchWinner('red');
            else setMatchWinner('draw');
            return 0;
          }
          if (prev <= 5) sound.playTick();
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timerId);
  }, [isTimerRunning, timeLeft, isQuizCompleted, teamBlueScore, teamRedScore]);

  // Freeze Penalty Countdown Timers (5s)
  useEffect(() => {
    let blueFreezeInterval: any = null;
    if (blueFreezeSeconds > 0) {
      blueFreezeInterval = setInterval(() => {
        setBlueFreezeSeconds((sec) => {
          if (sec <= 1) {
            setBlueIsRevealed(false);
            setBlueSelectedOption(null);
            return 0;
          }
          return sec - 1;
        });
      }, 1000);
    }
    return () => clearInterval(blueFreezeInterval);
  }, [blueFreezeSeconds]);

  useEffect(() => {
    let redFreezeInterval: any = null;
    if (redFreezeSeconds > 0) {
      redFreezeInterval = setInterval(() => {
        setRedFreezeSeconds((sec) => {
          if (sec <= 1) {
            setRedIsRevealed(false);
            setRedSelectedOption(null);
            return 0;
          }
          return sec - 1;
        });
      }, 1000);
    }
    return () => clearInterval(redFreezeInterval);
  }, [redFreezeSeconds]);

  // Pull step size
  const totalQCount = Math.max(5, blueQuestions.length);
  const pullStep = Math.max(14, 80 / totalQCount);

  // Check win condition
  const checkWinCondition = useCallback((newPos: number, currentBlueScore: number, currentRedScore: number) => {
    if (arenaTheme === 'running' || arenaTheme === 'climbing') {
      if (currentBlueScore >= targetPointsToWin) {
        setIsQuizCompleted(true);
        setMatchWinner('blue');
        sound.playWhistle();
        sound.playFanfare();
        if (confettiCanvasRef.current) {
          if (!confettiEngineRef.current) confettiEngineRef.current = new ConfettiEngine(confettiCanvasRef.current);
          confettiEngineRef.current.resize();
          confettiEngineRef.current.fireCelebration(180);
        }
      } else if (currentRedScore >= targetPointsToWin) {
        setIsQuizCompleted(true);
        setMatchWinner('red');
        sound.playWhistle();
        sound.playFanfare();
        if (confettiCanvasRef.current) {
          if (!confettiEngineRef.current) confettiEngineRef.current = new ConfettiEngine(confettiCanvasRef.current);
          confettiEngineRef.current.resize();
          confettiEngineRef.current.fireCelebration(180);
        }
      }
    } else {
      if (newPos <= -70) {
        setIsQuizCompleted(true);
        setMatchWinner('blue');
        sound.playWhistle();
        sound.playFanfare();
        if (confettiCanvasRef.current) {
          if (!confettiEngineRef.current) confettiEngineRef.current = new ConfettiEngine(confettiCanvasRef.current);
          confettiEngineRef.current.resize();
          confettiEngineRef.current.fireCelebration(180);
        }
      } else if (newPos >= 70) {
        setIsQuizCompleted(true);
        setMatchWinner('red');
        sound.playWhistle();
        sound.playFanfare();
        if (confettiCanvasRef.current) {
          if (!confettiEngineRef.current) confettiEngineRef.current = new ConfettiEngine(confettiCanvasRef.current);
          confettiEngineRef.current.resize();
          confettiEngineRef.current.fireCelebration(180);
        }
      }
    }
  }, [arenaTheme, targetPointsToWin]);

  // Handle Blue Answer
  const currentBlueQuestion = blueQuestions[blueQuestionIndex] || currentSet.questions[0];

  const handleBlueAnswer = useCallback(
    (index: number) => {
      if (!isGameStarted || !currentBlueQuestion || blueIsRevealed || blueFreezeSeconds > 0 || isQuizCompleted) return;

      setBlueSelectedOption(index);
      setBlueIsRevealed(true);

      const isCorrect = index === currentBlueQuestion.correctIndex;

      if (isCorrect) {
        sound.playChimeReveal();
        sound.playPull();
        const nextBlueScore = teamBlueScore + 1;
        setTeamBlueScore(nextBlueScore);

        isPullingAnimRef.current = { team: 'blue', endTime: Date.now() + 1400 };

        // Pull rope to the Left
        const nextPos = Math.max(-85, ropePosRef.current - pullStep);
        setRopePosition(nextPos);
        checkWinCondition(nextPos, nextBlueScore, teamRedScore);

        if (confettiCanvasRef.current) {
          if (!confettiEngineRef.current) confettiEngineRef.current = new ConfettiEngine(confettiCanvasRef.current);
          confettiEngineRef.current.resize();
          confettiEngineRef.current.fireCelebration(60);
        }

        setTimeout(() => {
          if (blueQuestionIndex < blueQuestions.length - 1) {
            setBlueQuestionIndex((i) => i + 1);
            setBlueSelectedOption(null);
            setBlueIsRevealed(false);
          } else {
            setBlueQuestionIndex(0);
            setBlueSelectedOption(null);
            setBlueIsRevealed(false);
          }
        }, 600);
      } else {
        // Wrong Answer: Freeze Team (3 seconds default)
        sound.playBuzzer();
        setBlueFreezeSeconds(freezePenaltySeconds);

        // Rope slips slightly to red side
        const nextPos = Math.min(85, ropePosRef.current + pullStep * 0.35);
        setRopePosition(nextPos);
        checkWinCondition(nextPos, teamBlueScore, teamRedScore);
      }
    },
    [isGameStarted, currentBlueQuestion, blueIsRevealed, blueFreezeSeconds, isQuizCompleted, teamBlueScore, teamRedScore, blueQuestionIndex, blueQuestions.length, pullStep, checkWinCondition, freezePenaltySeconds]
  );

  // Handle Red Answer
  const currentRedQuestion = redQuestions[redQuestionIndex] || currentSet.questions[0];

  const handleRedAnswer = useCallback(
    (index: number) => {
      if (!isGameStarted || !currentRedQuestion || redIsRevealed || redFreezeSeconds > 0 || isQuizCompleted) return;

      setRedSelectedOption(index);
      setRedIsRevealed(true);

      const isCorrect = index === currentRedQuestion.correctIndex;

      if (isCorrect) {
        sound.playChimeReveal();
        sound.playPull();
        const nextRedScore = teamRedScore + 1;
        setTeamRedScore(nextRedScore);

        isPullingAnimRef.current = { team: 'red', endTime: Date.now() + 1400 };

        // Pull rope to the Right
        const nextPos = Math.min(85, ropePosRef.current + pullStep);
        setRopePosition(nextPos);
        checkWinCondition(nextPos, teamBlueScore, nextRedScore);

        if (confettiCanvasRef.current) {
          if (!confettiEngineRef.current) confettiEngineRef.current = new ConfettiEngine(confettiCanvasRef.current);
          confettiEngineRef.current.resize();
          confettiEngineRef.current.fireCelebration(60);
        }

        setTimeout(() => {
          if (redQuestionIndex < redQuestions.length - 1) {
            setRedQuestionIndex((i) => i + 1);
            setRedSelectedOption(null);
            setRedIsRevealed(false);
          } else {
            setRedQuestionIndex(0);
            setRedSelectedOption(null);
            setRedIsRevealed(false);
          }
        }, 600);
      } else {
        // Wrong Answer: Freeze Team (3 seconds default)
        sound.playBuzzer();
        setRedFreezeSeconds(freezePenaltySeconds);

        // Rope slips slightly to blue side
        const nextPos = Math.max(-85, ropePosRef.current - pullStep * 0.35);
        setRopePosition(nextPos);
        checkWinCondition(nextPos, teamBlueScore, teamRedScore);
      }
    },
    [isGameStarted, currentRedQuestion, redIsRevealed, redFreezeSeconds, isQuizCompleted, teamBlueScore, teamRedScore, redQuestionIndex, redQuestions.length, pullStep, checkWinCondition, freezePenaltySeconds]
  );

  // Keyboard shortcuts for 2-team answering
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (showImportModal || showTeamModal || ['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      const key = e.key.toUpperCase();
      const code = e.code;

      // BLUE TEAM KEYS (Left side): 1,2,3,4 or Q,W,E,R or A,S,D,F
      if (key === '1' || key === 'Q' || key === 'A' || code === 'Digit1' || code === 'KeyQ') {
        handleBlueAnswer(0);
      } else if (key === '2' || key === 'W' || key === 'S' || code === 'Digit2' || code === 'KeyW') {
        handleBlueAnswer(1);
      } else if (key === '3' || key === 'E' || key === 'D' || code === 'Digit3' || code === 'KeyE') {
        handleBlueAnswer(2);
      } else if (key === '4' || key === 'R' || key === 'F' || code === 'Digit4' || code === 'KeyR') {
        handleBlueAnswer(3);
      }

      // RED TEAM KEYS (Right side): 7,8,9,0 or U,I,O,P or J,K,L,; or Arrow keys or Numpad
      else if (key === '7' || key === 'U' || key === 'J' || code === 'Digit7' || code === 'KeyU' || code === 'ArrowLeft' || code === 'Numpad7' || code === 'Numpad1') {
        handleRedAnswer(0);
      } else if (key === '8' || key === 'I' || key === 'K' || code === 'Digit8' || code === 'KeyI' || code === 'ArrowDown' || code === 'Numpad8' || code === 'Numpad2') {
        handleRedAnswer(1);
      } else if (key === '9' || key === 'O' || key === 'L' || code === 'Digit9' || code === 'KeyO' || code === 'ArrowUp' || code === 'Numpad9' || code === 'Numpad3') {
        handleRedAnswer(2);
      } else if (key === '0' || key === 'P' || key === ';' || code === 'Digit0' || code === 'KeyP' || code === 'ArrowRight' || code === 'Numpad0' || code === 'Numpad4' || code === 'NumpadEnter') {
        handleRedAnswer(3);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showImportModal, showTeamModal, handleBlueAnswer, handleRedAnswer]);

  // Parser for importing questions with rich format support
  const parseQuestionsFromText = (rawText: string): QuizQuestion[] => {
    if (!rawText.trim()) return [];
    const lines = rawText.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
    const parsed: QuizQuestion[] = [];

    let currentQ: { question: string; options: string[]; correctIndex: number; explanation: string } | null = null;

    const commitCurrentQ = () => {
      if (currentQ && currentQ.question && currentQ.options.length >= 2) {
        if (currentQ.correctIndex < 0 || currentQ.correctIndex >= currentQ.options.length) {
          currentQ.correctIndex = 0;
        }
        parsed.push({
          id: `custom-q-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
          question: currentQ.question,
          options: currentQ.options,
          correctIndex: currentQ.correctIndex,
          explanation: currentQ.explanation,
          points: 10,
        });
      }
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const isOptionLine =
        /^[A-Da-d][\.\)\:\/\-]\s|^[\*\[][A-Da-d][\.\)\]\:\/]\s|^\*[A-Da-d]\b|^\[x\]\s*[A-Da-d]/i.test(line) ||
        /^[1-4][\.\)\:\/\-]\s/i.test(line);

      const isAnswerKeyLine =
        /^(Đáp án|Dap an|Key|Answer|ĐA|DA|Ket qua)[\s\:\=\-]+([A-D1-4])/i.test(line);

      const isExplanationLine =
        /^(Giải thích|Giai thich|Huong dan|Explain)[\s\:\=\-]+(.+)/i.test(line);

      if (isAnswerKeyLine) {
        if (currentQ) {
          const match = line.match(/^(Đáp án|Dap an|Key|Answer|ĐA|DA|Ket qua)[\s\:\=\-]+([A-D1-4])/i);
          if (match && match[2]) {
            const val = match[2].toUpperCase();
            if (['A', 'B', 'C', 'D'].includes(val)) {
              currentQ.correctIndex = val.charCodeAt(0) - 65;
            } else if (['1', '2', '3', '4'].includes(val)) {
              currentQ.correctIndex = parseInt(val, 10) - 1;
            }
          }
        }
      } else if (isExplanationLine) {
        if (currentQ) {
          const match = line.match(/^(Giải thích|Giai thich|Huong dan|Explain)[\s\:\=\-]+(.+)/i);
          if (match && match[2]) currentQ.explanation = match[2].trim();
        }
      } else if (isOptionLine) {
        if (!currentQ) currentQ = { question: 'Câu hỏi', options: [], correctIndex: 0, explanation: '' };
        let isCorrect = false;
        let cleanText = line;

        if (
          cleanText.startsWith('*') ||
          cleanText.startsWith('[x]') ||
          /\(đúng\)|\(dung\)|\(correct\)|\(đáp án đúng\)/i.test(cleanText)
        ) {
          isCorrect = true;
          cleanText = cleanText
            .replace(/^\*|^\[x\]/i, '')
            .replace(/\(đúng\)|\(dung\)|\(correct\)|\(đáp án đúng\)/gi, '')
            .trim();
        }

        cleanText = cleanText.replace(/^[A-Da-d1-4][\.\)\:\/\-]\s*/, '').trim();
        const optIdx = currentQ.options.length;
        currentQ.options.push(cleanText);
        if (isCorrect) currentQ.correctIndex = optIdx;
      } else {
        const isNewQ =
          /^(Câu|Cau|Question|Q|Bài|Bai|\d+)[\s\.\)\:\/\-]/i.test(line);

        if (isNewQ || (currentQ && currentQ.options.length >= 2)) {
          commitCurrentQ();
          const cleanQ = line
            .replace(/^(Câu|Cau|Question|Q|Bài|Bai)\s*\d+[\.\:\s\)\/\-]*/i, '')
            .replace(/^\d+[\.\)\:\/\-]\s*/, '')
            .trim();
          currentQ = { question: cleanQ || line, options: [], correctIndex: 0, explanation: '' };
        } else if (currentQ) {
          currentQ.question += ' ' + line;
        } else {
          currentQ = { question: line, options: [], correctIndex: 0, explanation: '' };
        }
      }
    }
    commitCurrentQ();
    return parsed;
  };

  const handleImportSubmit = () => {
    if (!importText.trim()) return;
    const parsed = parseQuestionsFromText(importText);
    if (parsed.length === 0) {
      alert('Không nhận diện được câu hỏi nào! Vui lòng kiểm tra định dạng dán.');
      return;
    }

    const newSet: QuizSet = {
      id: `custom-set-${Date.now()}`,
      title: importTitle.trim() || 'Bộ Câu Hỏi Mới',
      category: importCategory.trim() || 'Trắc Nghiệm',
      description: `Gồm ${parsed.length} câu hỏi`,
      questions: parsed,
    };

    setQuizSets((prev) => [newSet, ...prev]);
    setActiveSetId(newSet.id);
    resetMatch();
    setShowImportModal(false);
    setImportText('');
    sound.playFanfare();
  };

  const handlePasteFromClipboard = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        const text = await navigator.clipboard.readText();
        if (text) {
          setImportText(text);
          sound.playTick();
        }
      } else {
        alert('Trình duyệt không hỗ trợ đọc clipboard tự động, bạn hãy bấm phím Ctrl + V vào khung văn bản bên dưới.');
      }
    } catch {
      alert('Vui lòng cấp quyền đọc clipboard hoặc dùng phím tắt Ctrl + V để dán.');
    }
  };

  const handleSampleEnglish = () => {
    setImportTitle('Tiếng Anh Lớp 5 - Revision');
    setImportCategory('Tiếng Anh');
    setImportText(`Câu 1: What is your favorite subject?
A. I like English
*B. English
C. She likes Math
D. Yes, I do

Câu 2: How often do you have Music?
*A. Once a week
B. In the morning
C. At school
D. With my friend

Câu 3: Choose the odd one out:
A. Cat
B. Dog
*C. Table
D. Bird

Câu 4: Where were you yesterday?
A. I am at home
*B. I was on the beach
C. She was happy
D. We are playing`);
    sound.playSelect();
  };

  const handleSampleMath = () => {
    setImportTitle('Toán Lớp 5 - Luyện Tập');
    setImportCategory('Toán Học');
    setImportText(`Câu 1: Kết quả của phép tính 25 x 4 là:
A. 80
B. 90
*C. 100
D. 120

Câu 2: Phân số 3/4 viết dưới dạng số thập phân là:
A. 0.34
B. 0.5
*C. 0.75
D. 0.8

Câu 3: Diện tích hình chữ nhật có chiều dài 8cm và chiều rộng 5cm là:
*A. 40 cm²
B. 26 cm²
C. 13 cm²
D. 45 cm²

Câu 4: 1 giờ 15 phút bằng bao nhiêu phút?
A. 65 phút
*B. 75 phút
C. 85 phút
D. 115 phút`);
    sound.playSelect();
  };

  const blueKeys = [
    { letter: 'A', key: '1', altKey: 'Q / A' },
    { letter: 'B', key: '2', altKey: 'W / S' },
    { letter: 'C', key: '3', altKey: 'E / D' },
    { letter: 'D', key: '4', altKey: 'R / F' },
  ];
  const redKeys = [
    { letter: 'A', key: '7', altKey: 'U / J / ◀' },
    { letter: 'B', key: '8', altKey: 'I / K / ▼' },
    { letter: 'C', key: '9', altKey: 'O / L / ▲' },
    { letter: 'D', key: '0', altKey: 'P / ; / ▶' },
  ];

  // Left & Right Active Students
  const activeBlueStudent = teamBlueMembers[0];
  const activeRedStudent = teamRedMembers[0];

  // Filtered student list for team management modal
  const filteredClassStudents = students.filter((s) =>
    s.name.toLowerCase().includes(teamSearchQuery.toLowerCase())
  );

  return (
    <div className="relative flex flex-col justify-between w-full h-full max-w-[1800px] mx-auto overflow-hidden select-none p-1 sm:p-2 bg-slate-900 text-white rounded-2xl sm:rounded-3xl shadow-2xl">
      {/* Confetti canvas */}
      <canvas ref={confettiCanvasRef} className="absolute inset-0 pointer-events-none z-50 w-full h-full" />

      {/* TOP HEADER */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-2 py-1.5 bg-slate-950/90 rounded-2xl border border-slate-800 shrink-0 mb-1.5 shadow-md">
        {/* Left: Subject / Title Badge */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 font-black text-xs sm:text-sm tracking-wide shadow-md">
            <Swords size={16} />
            <span className="uppercase">{currentSet.category || 'TIẾNG ANH 5'}</span>
          </div>

          <div className="hidden lg:flex items-center gap-1 bg-slate-800/90 border border-slate-700 px-2.5 py-1 rounded-xl text-xs">
            <BookOpen size={12} className="text-amber-400" />
            <select
              value={activeSetId}
              onChange={(e) => {
                setActiveSetId(e.target.value);
                resetMatch();
              }}
              className="bg-transparent text-xs font-bold text-white outline-none cursor-pointer max-w-[150px] truncate"
            >
              {quizSets.map((s) => (
                <option key={s.id} value={s.id} className="bg-slate-900 text-white">
                  {s.title} ({s.questions.length} câu)
                </option>
              ))}
            </select>
          </div>

          {/* Mode switch */}
          <div className="hidden xl:flex items-center gap-1 bg-slate-800 border border-slate-700 px-2 py-0.5 rounded-xl text-[11px]">
            <Layers size={11} className="text-indigo-400" />
            <select
              value={questionMode}
              onChange={(e) => setQuestionMode(e.target.value as any)}
              className="bg-transparent text-slate-200 font-bold outline-none cursor-pointer"
            >
              <option value="independent_shuffle" className="bg-slate-900">Đảo câu hỏi độc lập 2 đội</option>
              <option value="split_deck" className="bg-slate-900">Chia đôi bộ đề (Chẵn / Lẻ)</option>
              <option value="same_question" className="bg-slate-900">Cùng câu hỏi đồng thời</option>
            </select>
          </div>
        </div>

        {/* Center: Team Score Pills & Match Timer with Configurable Thinking Time */}
        <div className="flex items-center gap-1.5 sm:gap-2 relative">
          {/* Blue Team Score Pill */}
          <div className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1 bg-blue-900/90 border-2 border-blue-500 text-blue-100 rounded-xl text-xs sm:text-sm font-black shadow-xs">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping"></span>
            <span>{teamBlueName}:</span>
            <span className="text-sm sm:text-base text-white font-mono">{teamBlueScore}</span>
          </div>

          {/* Center Timer Countdown Pill with Time Configuration Dropdown */}
          <div className="relative">
            <div className="flex items-center bg-slate-800 border border-slate-700 rounded-xl shadow-md overflow-hidden">
              <button
                onClick={() => setIsTimerRunning(!isTimerRunning)}
                className={`flex items-center gap-1.5 px-3 py-1 font-mono font-black text-sm sm:text-base transition-all cursor-pointer ${
                  timeLeft <= 10
                    ? 'bg-rose-600 text-white animate-pulse ring-2 ring-rose-400'
                    : 'text-amber-300 hover:bg-slate-700/80'
                }`}
                title={isTimerRunning ? 'Bấm để tạm dừng đếm giờ' : 'Bấm để tiếp tục đếm giờ'}
              >
                <Clock size={15} className="text-amber-400 shrink-0" />
                <span>
                  {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
                </span>
              </button>

              {/* +30s Quick Add Button */}
              <button
                onClick={() => setTimeLeft((t) => t + 30)}
                className="px-1.5 py-1 text-[10px] font-bold text-amber-300 hover:bg-slate-700 border-l border-slate-700 transition-colors cursor-pointer"
                title="Cộng thêm 30 giây suy nghĩ"
              >
                +30s
              </button>

              {/* Time Configuration Dropdown Trigger */}
              <button
                onClick={() => setShowTimeMenu(!showTimeMenu)}
                className="px-1.5 py-1 text-slate-300 hover:bg-slate-700 hover:text-white border-l border-slate-700 transition-colors cursor-pointer"
                title="Thay đổi thời gian suy nghĩ / trận đấu"
              >
                <Edit3 size={13} />
              </button>
            </div>

            {/* Time Settings Dropdown */}
            {showTimeMenu && (
              <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1.5 w-64 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-2 z-50 animate-fade-in text-white">
                <div className="flex items-center justify-between px-2 py-1 border-b border-slate-800 mb-1.5">
                  <span className="text-[11px] font-black uppercase text-amber-400 flex items-center gap-1">
                    <Clock size={12} /> Thời Gian Suy Nghĩ
                  </span>
                  <button
                    onClick={() => setShowTimeMenu(false)}
                    className="text-slate-400 hover:text-white text-xs p-0.5"
                  >
                    ✕
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-1 mb-2">
                  {[
                    { label: '30 giây (Siêu tốc)', sec: 30 },
                    { label: '60 giây (1 phút)', sec: 60 },
                    { label: '90 giây (1.5 phút)', sec: 90 },
                    { label: '120 giây (2 phút)', sec: 120 },
                    { label: '180 giây (3 phút)', sec: 180 },
                    { label: '300 giây (5 phút)', sec: 300 },
                  ].map((t) => (
                    <button
                      key={t.sec}
                      onClick={() => {
                        setTimerDuration(t.sec);
                        setTimeLeft(t.sec);
                        setIsTimerRunning(true);
                        setShowTimeMenu(false);
                        sound.playSelect();
                      }}
                      className={`p-1.5 rounded-lg text-left text-xs font-bold transition-colors cursor-pointer ${
                        timerDuration === t.sec
                          ? 'bg-amber-500 text-slate-950 font-black'
                          : 'bg-slate-800/80 hover:bg-slate-700 text-slate-200'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                {/* Freeze duration setting */}
                <div className="border-t border-slate-800 pt-1.5 px-1">
                  <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1 font-bold">
                    <span>Phạt sai (Đóng băng):</span>
                    <span className="text-amber-400 font-mono font-black">{freezePenaltySeconds} giây</span>
                  </div>
                  <div className="flex gap-1">
                    {[1, 2, 3, 5].map((s) => (
                      <button
                        key={s}
                        onClick={() => setFreezePenaltySeconds(s)}
                        className={`flex-1 py-1 rounded-md text-[11px] font-bold cursor-pointer transition-colors ${
                          freezePenaltySeconds === s
                            ? 'bg-rose-600 text-white font-black'
                            : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                        }`}
                      >
                        {s}s
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Red Team Score Pill */}
          <div className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1 bg-red-900/90 border-2 border-red-500 text-red-100 rounded-xl text-xs sm:text-sm font-black shadow-xs">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-400 animate-ping"></span>
            <span>{teamRedName}:</span>
            <span className="text-sm sm:text-base text-white font-mono">{teamRedScore}</span>
          </div>
        </div>

        {/* Right Header Buttons */}
        <div className="flex items-center gap-1 sm:gap-1.5">
          {/* NÚT BẮT ĐẦU CHƠI (SAU KHI CẤU HÌNH XONG ĐỘI VÀ CÂU HỎI) */}
          {!isGameStarted ? (
            <button
              onClick={handleStartGame}
              className="px-3.5 py-1.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-sky-500 hover:brightness-110 text-white rounded-xl text-xs sm:text-sm font-black flex items-center gap-1.5 transition-transform active:scale-95 cursor-pointer shadow-lg shadow-emerald-500/30 ring-2 ring-emerald-400/50 animate-pulse"
              title="Ấn vào đây để bắt đầu trò chơi sau khi cấu hình xong đội và câu hỏi"
            >
              <Play size={15} className="fill-white/30" />
              <span>BẮT ĐẦU CHƠI</span>
            </button>
          ) : (
            <button
              onClick={resetMatch}
              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-black flex items-center gap-1.5 transition-transform active:scale-95 cursor-pointer shadow-md"
              title="Cấu hình lại đội & câu hỏi"
            >
              <RotateCcw size={13} />
              <span>Chơi Lại</span>
            </button>
          )}

          {/* BUTTON: CHỌN ĐỘI */}
          <button
            onClick={() => setShowTeamModal(true)}
            className="px-3 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:brightness-110 text-white rounded-xl text-xs font-black flex items-center gap-1.5 transition-transform active:scale-95 cursor-pointer shadow-md"
            title="Mở danh sách lớp để chọn học sinh vào Đội 1 & Đội 2"
          >
            <Users size={14} />
            <span className="hidden md:inline">Chọn Đội ({teamBlueMembers.length} vs {teamRedMembers.length})</span>
            <span className="md:hidden">Đội ({teamBlueMembers.length}v{teamRedMembers.length})</span>
          </button>

          <button
            onClick={() => setShowImportModal(true)}
            className="px-3 py-1.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:brightness-110 text-white rounded-xl text-xs font-black flex items-center gap-1 transition-transform active:scale-95 cursor-pointer shadow-xs"
            title="Nhập bộ câu hỏi mới"
          >
            <Upload size={12} />
            <span>Nhập Đề</span>
          </button>

          <button
            onClick={toggleMute}
            className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
            title={isSoundMuted ? 'Bật âm thanh' : 'Tắt âm thanh'}
          >
            {isSoundMuted ? <VolumeX size={13} className="text-rose-400" /> : <Volume2 size={13} className="text-emerald-400" />}
            <span className="hidden lg:inline">{isSoundMuted ? 'Bật Âm' : 'Tắt Âm'}</span>
          </button>

          <button
            onClick={toggleFullscreen}
            className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
            title="Toàn màn hình trình chiếu"
          >
            {isFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
            <span className="hidden lg:inline">Toàn Màn Hình</span>
          </button>
        </div>
      </div>

      {/* 3-COLUMN LAYOUT */}
      <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-12 gap-2 sm:gap-3">
        {/* ===================================================================== */}
        {/* CỘT TRÁI (BÊN XANH - ĐỘI XANH) */}
        {/* ===================================================================== */}
        <div className="md:col-span-4 flex flex-col justify-between bg-gradient-to-b from-blue-600 to-blue-700 rounded-3xl p-3 sm:p-4 border-2 border-blue-500 shadow-xl overflow-hidden min-h-0 relative">
          {/* FREEZE PENALTY OVERLAY (CHỈ KHI TRẢ LỜI SAI 5S) */}
          {blueFreezeSeconds > 0 && (
            <div className="absolute inset-0 bg-blue-950/92 backdrop-blur-xs z-30 flex flex-col items-center justify-center text-center p-4 animate-fade-in">
              <div className="w-16 h-16 rounded-full bg-blue-500/20 text-cyan-300 flex items-center justify-center mb-2 animate-pulse ring-4 ring-cyan-400/40">
                <Snowflake size={36} />
              </div>
              <h3 className="text-2xl sm:text-3xl font-black text-rose-400 drop-shadow-md">
                Đóng Băng!
              </h3>
              <div className="text-5xl sm:text-6xl font-black text-white my-1 animate-bounce font-mono">
                {blueFreezeSeconds}
              </div>
              <p className="text-xs sm:text-sm text-blue-200 font-bold">
                ⚠️ Phạt trả lời sai
              </p>
            </div>
          )}

          {/* Top Question Header */}
          <div className="flex items-center justify-between border-b border-blue-400/40 pb-2 mb-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-3 h-3 rounded-full bg-cyan-300 animate-pulse"></span>
              <h3 className="font-black text-sm sm:text-base text-white truncate">{teamBlueName}</h3>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-extrabold bg-blue-500/40 text-cyan-200 px-2 py-0.5 rounded-md border border-cyan-400/30 flex items-center gap-1">
                <Keyboard size={11} /> 1, 2, 3, 4
              </span>
              <span className="text-[11px] font-bold bg-blue-900/80 text-blue-100 px-2 py-0.5 rounded-lg border border-blue-400/40">
                Câu {blueQuestionIndex + 1}/{blueQuestions.length}
              </span>
            </div>
          </div>

          {/* Question Text Box */}
          <div className="flex-1 flex items-center justify-center p-2 text-center min-h-0">
            <h2 className="text-lg sm:text-2xl lg:text-3xl font-black text-white leading-snug drop-shadow-sm">
              {currentBlueQuestion?.question}
            </h2>
          </div>

          {/* 4 Option Cards in 2x2 Grid */}
          <div className="grid grid-cols-2 gap-2 mt-2 shrink-0">
            {currentBlueQuestion?.options.map((option, idx) => {
              const isSelected = blueSelectedOption === idx;
              const isCorrect = idx === currentBlueQuestion.correctIndex;
              const k = blueKeys[idx] || { letter: String.fromCharCode(65 + idx), key: String(idx + 1) };

              let cardStyle =
                'bg-white hover:bg-blue-50 text-slate-900 border-2 border-slate-200 hover:border-cyan-400';
              let badgeStyle = 'bg-blue-600 text-white';

              if (blueIsRevealed) {
                if (isCorrect) {
                  cardStyle = 'bg-emerald-500 text-white border-emerald-300 shadow-lg ring-2 ring-emerald-200 font-black';
                  badgeStyle = 'bg-white text-emerald-700';
                } else if (isSelected && !isCorrect) {
                  cardStyle = 'bg-rose-600 text-white border-rose-700';
                  badgeStyle = 'bg-rose-900 text-white';
                } else {
                  cardStyle = 'opacity-40 bg-slate-200 text-slate-500 border-slate-300';
                }
              }

              return (
                <button
                  key={idx}
                  onClick={() => handleBlueAnswer(idx)}
                  disabled={blueIsRevealed || blueFreezeSeconds > 0 || isQuizCompleted}
                  className={`group relative p-2.5 sm:p-3.5 rounded-2xl text-left flex flex-col justify-between min-h-[65px] sm:min-h-[80px] transition-all transform active:scale-95 cursor-pointer shadow-md ${cardStyle}`}
                >
                  <div className="flex items-center justify-between w-full mb-1">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`w-6 h-6 rounded-lg flex items-center justify-center font-black text-xs shadow-xs ${badgeStyle}`}
                      >
                        {k.letter}
                      </span>
                      <span className="text-[10px] font-black bg-slate-100 text-slate-700 px-1.5 py-0.2 rounded border border-slate-300 shadow-2xs">
                        Phím {k.key}
                      </span>
                    </div>
                    {blueIsRevealed && isCorrect && (
                      <CheckCircle2 size={16} className="text-white shrink-0" />
                    )}
                  </div>
                  <span className="font-black text-xs sm:text-sm lg:text-base leading-tight line-clamp-2">
                    {option}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ===================================================================== */}
        {/* CỘT GIỮA (SÂN ĐẤU KÉO CO - NGUYÊN BẢN ẢNH MẪU 99315ecf2aa3aafdf3b2.jpg) */}
        {/* ===================================================================== */}
        <div className="md:col-span-4 flex flex-col justify-between bg-white rounded-3xl p-2 sm:p-3 border-2 border-slate-300 shadow-xl overflow-hidden min-h-0 text-slate-900">
          {/* Top Switcher: Theme Tabs (Đường Đua, Leo Núi, Kéo Co) & Settings */}
          <div className="flex items-center justify-between px-1 mb-1.5 flex-wrap gap-1">
            <input
              type="file"
              ref={tugFileInputRef}
              onChange={handleUploadTugImage}
              accept="image/*"
              className="hidden"
            />

            {/* 4 Arena Theme Mode Buttons (Kéo Co first) */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200">
              <button
                onClick={() => handleSelectArenaTheme('tug')}
                className={`px-2 py-0.5 rounded-lg text-[10px] font-black flex items-center gap-1 transition-all cursor-pointer ${
                  arenaTheme === 'tug'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Kéo co đối kháng 2 đội"
              >
                <Swords size={11} />
                <span>🪢 Kéo Co</span>
              </button>
              <button
                onClick={() => handleSelectArenaTheme('running')}
                className={`px-2 py-0.5 rounded-lg text-[10px] font-black flex items-center gap-1 transition-all cursor-pointer ${
                  arenaTheme === 'running'
                    ? 'bg-orange-500 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Đường đua về đích 2 đội"
              >
                <span>🏁 Đường Đua</span>
              </button>
              <button
                onClick={() => handleSelectArenaTheme('climbing')}
                className={`px-2 py-0.5 rounded-lg text-[10px] font-black flex items-center gap-1 transition-all cursor-pointer ${
                  arenaTheme === 'climbing'
                    ? 'bg-sky-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Leo núi chinh phục đỉnh cao"
              >
                <Mountain size={11} />
                <span>Leo Núi</span>
              </button>
              <button
                onClick={() => handleSelectArenaTheme('ziczac')}
                className={`px-2 py-0.5 rounded-lg text-[10px] font-black flex items-center gap-1 transition-all cursor-pointer ${
                  arenaTheme === 'ziczac'
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Đua ziczac lăn qua các ải"
              >
                <Shuffle size={11} />
                <span>🌀 Ziczac</span>
              </button>
            </div>

            <div className="flex items-center gap-1">
              {/* Target points selector for racing/climbing/ziczac */}
              {(arenaTheme === 'running' || arenaTheme === 'climbing' || arenaTheme === 'ziczac') && (
                <div className="flex items-center gap-1 bg-amber-50 px-1.5 py-0.5 rounded-lg border border-amber-200 text-[10px] font-black text-amber-900">
                  <span>🎯 Đích:</span>
                  <select
                    value={targetPointsToWin}
                    onChange={(e) => handleSelectTargetPoints(Number(e.target.value))}
                    className="bg-transparent font-black cursor-pointer outline-none"
                  >
                    <option value={4}>4 điểm</option>
                    <option value={6}>6 điểm</option>
                    <option value={8}>8 điểm</option>
                    <option value={10}>10 điểm</option>
                    <option value={12}>12 điểm</option>
                  </select>
                </div>
              )}

              {/* Upload Custom Image (or clear it) for Tug of war */}
              {arenaTheme === 'tug' && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => tugFileInputRef.current?.click()}
                    className="px-2 py-0.5 rounded-lg text-[10px] font-black bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1 transition-all cursor-pointer shadow-2xs"
                    title="Tải lên hình ảnh đội kéo co tùy chỉnh từ máy tính (lưu vĩnh viễn trong IndexedDB)"
                  >
                    <Upload size={10} />
                    <span>{customTugImage ? 'Đổi Ảnh Kéo Co' : 'Nhập Ảnh Kéo Co'}</span>
                  </button>
                  {customTugImage && (
                    <button
                      onClick={handleClearCustomTugImage}
                      className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-slate-100 hover:bg-rose-50 hover:text-rose-600 text-slate-600 border border-slate-200 transition-all cursor-pointer"
                      title="Xóa ảnh tùy chỉnh, dùng nhân vật hoạt hình mặc định"
                    >
                      Đồ Họa Gốc
                    </button>
                  )}
                </div>
              )}

              {/* Student Face overlay toggle */}
              <button
                onClick={handleToggleStudentFaces}
                className={`px-2 py-0.5 rounded-lg text-[10px] font-black flex items-center gap-1 transition-all cursor-pointer ${
                  showStudentFaces
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200'
                }`}
                title="Bật/tắt gắn mặt đại diện của các học sinh trong đội"
              >
                {showStudentFaces ? <UserCheck size={11} /> : <Smile size={11} />}
                <span>{showStudentFaces ? 'Mặt học sinh' : 'Hình gốc'}</span>
              </button>
            </div>
          </div>

          {/* ARENA DISPLAY: SELECTED ARENA THEME (ĐƯỜNG ĐUA, LEO NÚI, ZICZAC, KÉO CO) */}
          <div className="relative flex-1 w-full rounded-2xl bg-gradient-to-b from-sky-50 via-white to-amber-50/40 overflow-hidden flex items-center justify-center min-h-[230px] border border-slate-200 shadow-inner">
            {/* COMPACT FLOATING START BUTTON (KHÔNG CHE CÁC NHÂN VẬT KÉO CO, DỄ QUAN SÁT) */}
            {!isGameStarted && (
              <div className="absolute top-2.5 left-1/2 -translate-x-1/2 z-20 pointer-events-auto">
                <button
                  onClick={handleStartGame}
                  className="px-4 py-1.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-sky-500 hover:brightness-110 text-white font-black text-xs sm:text-sm rounded-full shadow-xl ring-2 ring-emerald-300/80 flex items-center gap-1.5 cursor-pointer transition-transform active:scale-95 animate-bounce hover:animate-none backdrop-blur-xs"
                  title="Bấm để bắt đầu tính giờ & mở các nút đáp án"
                >
                  <Play size={14} className="fill-white" />
                  <span>▶️ BẮT ĐẦU CHƠI</span>
                </button>
              </div>
            )}

            {arenaTheme === 'running' ? (
              /* 1. SPRINT RACE TRACK ARENA (ĐƯỜNG ĐUA VỀ ĐÍCH) */
              <SprintTrackArena
                teamBlueScore={teamBlueScore}
                teamRedScore={teamRedScore}
                targetPoints={targetPointsToWin}
                teamBlueMembers={teamBlueMembers}
                teamRedMembers={teamRedMembers}
                activeBlueStudent={activeBlueStudent}
                activeRedStudent={activeRedStudent}
                showStudentFaces={showStudentFaces}
                teamBlueName={teamBlueName}
                teamRedName={teamRedName}
              />
            ) : arenaTheme === 'climbing' ? (
              /* 2. MOUNTAIN SUMMIT CLIMBING ARENA (LEO NÚI CHINH PHỤC ĐỈNH CAO) */
              <MountainClimbArena
                teamBlueScore={teamBlueScore}
                teamRedScore={teamRedScore}
                targetPoints={targetPointsToWin}
                teamBlueMembers={teamBlueMembers}
                teamRedMembers={teamRedMembers}
                activeBlueStudent={activeBlueStudent}
                activeRedStudent={activeRedStudent}
                showStudentFaces={showStudentFaces}
                teamBlueName={teamBlueName}
                teamRedName={teamRedName}
              />
            ) : arenaTheme === 'ziczac' ? (
              /* 3. ZICZAC OBSTACLE ROLL ARENA (ĐƯỜNG ĐUA ZICZAC VƯỢT CÁC ẢI) */
              <ZigZagArena
                teamBlueScore={teamBlueScore}
                teamRedScore={teamRedScore}
                targetPoints={targetPointsToWin}
                teamBlueMembers={teamBlueMembers}
                teamRedMembers={teamRedMembers}
                activeBlueStudent={activeBlueStudent}
                activeRedStudent={activeRedStudent}
                showStudentFaces={showStudentFaces}
                teamBlueName={teamBlueName}
                teamRedName={teamRedName}
              />
            ) : customTugImage ? (
              /* 4. CUSTOM UPLOADED TUG OF WAR IMAGE MODE */
              <div className="relative w-full h-full flex flex-col items-center justify-center p-2 overflow-hidden select-none">
                <div className="absolute inset-x-0 bottom-6 h-24 bg-gradient-to-t from-emerald-500/20 to-transparent pointer-events-none"></div>
                <div className="absolute top-0 bottom-0 left-1/2 w-0.5 border-r-2 border-dashed border-slate-300 pointer-events-none"></div>

                <div
                  className="relative transition-transform duration-300 ease-out flex items-center justify-center max-w-full"
                  style={{
                    transform: `translateX(${(ropePosition / 100) * 90}px)`,
                  }}
                >
                  <img
                    src={customTugImage}
                    alt="Tug of war"
                    className="max-h-[190px] sm:max-h-[220px] w-auto object-contain drop-shadow-lg rounded-xl"
                  />
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none flex flex-col items-center">
                    <div className="w-4 h-4 rounded-full bg-rose-600 border-2 border-white shadow-md animate-pulse"></div>
                    <div className="w-0.5 h-6 bg-rose-600"></div>
                  </div>
                </div>
              </div>
            ) : (
              /* 5. TUG OF WAR 6-CHARACTER ARENA (KÉO CO ĐỐI KHÁNG) */
              <TugOfWarArena
                ropePosition={ropePosition}
                teamBlueMembers={teamBlueMembers}
                teamRedMembers={teamRedMembers}
                activeBlueStudent={activeBlueStudent}
                activeRedStudent={activeRedStudent}
                showStudentFaces={showStudentFaces}
                teamBlueName={teamBlueName}
                teamRedName={teamRedName}
              />
            )}
          </div>

          {/* DYNAMIC PROGRESS GAUGE (Tailored to active arena theme) */}
          <div className="mt-2 bg-slate-100 p-2 rounded-2xl border border-slate-200 shadow-2xs flex flex-col gap-1 shrink-0">
            {arenaTheme === 'running' ? (
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-[11px] font-black">
                  <span className="text-blue-600 flex items-center gap-1">
                    🏃 {teamBlueName}: <span className="text-blue-900">{teamBlueScore}/{targetPointsToWin} điểm 🏁</span>
                  </span>
                  <span className="text-red-600 flex items-center gap-1">
                    🏃 {teamRedName}: <span className="text-red-900">{teamRedScore}/{targetPointsToWin} điểm 🏁</span>
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="h-2.5 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-300 rounded-full"
                      style={{ width: `${Math.min(100, (teamBlueScore / targetPointsToWin) * 100)}%` }}
                    ></div>
                  </div>
                  <div className="h-2.5 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-red-500 to-red-600 transition-all duration-300 rounded-full"
                      style={{ width: `${Math.min(100, (teamRedScore / targetPointsToWin) * 100)}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            ) : arenaTheme === 'climbing' ? (
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-[11px] font-black">
                  <span className="text-blue-600 flex items-center gap-1">
                    🧗 {teamBlueName}: <span className="text-blue-900">{Math.round((teamBlueScore / targetPointsToWin) * 8848)}m / 8848m</span>
                  </span>
                  <span className="text-red-600 flex items-center gap-1">
                    🧗 {teamRedName}: <span className="text-red-900">{Math.round((teamRedScore / targetPointsToWin) * 8848)}m / 8848m</span>
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="h-2.5 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-sky-400 to-blue-600 transition-all duration-300 rounded-full"
                      style={{ width: `${Math.min(100, (teamBlueScore / targetPointsToWin) * 100)}%` }}
                    ></div>
                  </div>
                  <div className="h-2.5 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-amber-400 to-red-600 transition-all duration-300 rounded-full"
                      style={{ width: `${Math.min(100, (teamRedScore / targetPointsToWin) * 100)}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            ) : arenaTheme === 'ziczac' ? (
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-[11px] font-black">
                  <span className="text-blue-600 flex items-center gap-1">
                    🌀 {teamBlueName}: <span className="text-blue-900">Ải {Math.min(targetPointsToWin, teamBlueScore)}/{targetPointsToWin} 🏁</span>
                  </span>
                  <span className="text-red-600 flex items-center gap-1">
                    🌀 {teamRedName}: <span className="text-red-900">Ải {Math.min(targetPointsToWin, teamRedScore)}/{targetPointsToWin} 🏁</span>
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="h-2.5 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-blue-500 to-purple-600 transition-all duration-300 rounded-full"
                      style={{ width: `${Math.min(100, (teamBlueScore / targetPointsToWin) * 100)}%` }}
                    ></div>
                  </div>
                  <div className="h-2.5 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-rose-500 to-purple-600 transition-all duration-300 rounded-full"
                      style={{ width: `${Math.min(100, (teamRedScore / targetPointsToWin) * 100)}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between text-[11px] font-black text-slate-600">
                  <span className="text-blue-600">◀ Kéo về {teamBlueName}</span>
                  <span className="text-red-600">Kéo về {teamRedName} ▶</span>
                </div>
                <div className="relative w-full h-3 bg-slate-200 rounded-full overflow-hidden flex items-center mt-1">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-0.5 h-full bg-slate-400"></div>
                  </div>
                  <div
                    className="absolute top-0 bottom-0 w-5 h-5 -mt-1 bg-amber-500 border-2 border-white rounded-full shadow-md transition-all duration-300"
                    style={{
                      left: `calc(50% + ${(ropePosition / 100) * 45}% - 10px)`,
                    }}
                  ></div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ===================================================================== */}
        {/* CỘT PHẢI (BÊN ĐỎ - ĐỘI ĐỎ) */}
        {/* ===================================================================== */}
        <div className="md:col-span-4 flex flex-col justify-between bg-gradient-to-b from-red-600 to-red-700 rounded-3xl p-3 sm:p-4 border-2 border-red-500 shadow-xl overflow-hidden min-h-0 relative">
          {/* FREEZE PENALTY OVERLAY (CHỈ KHI TRẢ LỜI SAI 5S) */}
          {redFreezeSeconds > 0 && (
            <div className="absolute inset-0 bg-red-950/92 backdrop-blur-xs z-30 flex flex-col items-center justify-center text-center p-4 animate-fade-in">
              <div className="w-16 h-16 rounded-full bg-red-500/20 text-rose-300 flex items-center justify-center mb-2 animate-pulse ring-4 ring-rose-400/40">
                <Snowflake size={36} />
              </div>
              <h3 className="text-2xl sm:text-3xl font-black text-rose-400 drop-shadow-md">
                Đóng Băng!
              </h3>
              <div className="text-5xl sm:text-6xl font-black text-white my-1 animate-bounce font-mono">
                {redFreezeSeconds}
              </div>
              <p className="text-xs sm:text-sm text-red-200 font-bold">
                ⚠️ Phạt trả lời sai
              </p>
            </div>
          )}

          {/* Top Question Header */}
          <div className="flex items-center justify-between border-b border-red-400/40 pb-2 mb-2">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold bg-red-900/80 text-red-100 px-2 py-0.5 rounded-lg border border-red-400/40">
                Câu {redQuestionIndex + 1}/{redQuestions.length}
              </span>
              <span className="text-[10px] font-extrabold bg-red-500/40 text-rose-200 px-2 py-0.5 rounded-md border border-rose-400/30 flex items-center gap-1">
                <Keyboard size={11} /> 7, 8, 9, 0 (hoặc U, I, O, P)
              </span>
            </div>
            <div className="flex items-center gap-2 min-w-0">
              <h3 className="font-black text-sm sm:text-base text-white truncate">{teamRedName}</h3>
              <span className="w-3 h-3 rounded-full bg-rose-300 animate-pulse"></span>
            </div>
          </div>

          {/* Question Text Box */}
          <div className="flex-1 flex items-center justify-center p-2 text-center min-h-0">
            <h2 className="text-lg sm:text-2xl lg:text-3xl font-black text-white leading-snug drop-shadow-sm">
              {currentRedQuestion?.question}
            </h2>
          </div>

          {/* 4 Option Cards in 2x2 Grid */}
          <div className="grid grid-cols-2 gap-2 mt-2 shrink-0">
            {currentRedQuestion?.options.map((option, idx) => {
              const isSelected = redSelectedOption === idx;
              const isCorrect = idx === currentRedQuestion.correctIndex;
              const k = redKeys[idx] || { letter: String.fromCharCode(65 + idx), key: String(idx + 7) };

              let cardStyle =
                'bg-white hover:bg-red-50 text-slate-900 border-2 border-slate-200 hover:border-rose-400';
              let badgeStyle = 'bg-red-600 text-white';

              if (redIsRevealed) {
                if (isCorrect) {
                  cardStyle = 'bg-emerald-500 text-white border-emerald-300 shadow-lg ring-2 ring-emerald-200 font-black';
                  badgeStyle = 'bg-white text-emerald-700';
                } else if (isSelected && !isCorrect) {
                  cardStyle = 'bg-rose-600 text-white border-rose-700';
                  badgeStyle = 'bg-rose-900 text-white';
                } else {
                  cardStyle = 'opacity-40 bg-slate-200 text-slate-500 border-slate-300';
                }
              }

              return (
                <button
                  key={idx}
                  onClick={() => handleRedAnswer(idx)}
                  disabled={redIsRevealed || redFreezeSeconds > 0 || isQuizCompleted}
                  className={`group relative p-2.5 sm:p-3.5 rounded-2xl text-left flex flex-col justify-between min-h-[65px] sm:min-h-[80px] transition-all transform active:scale-95 cursor-pointer shadow-md ${cardStyle}`}
                >
                  <div className="flex items-center justify-between w-full mb-1">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`w-6 h-6 rounded-lg flex items-center justify-center font-black text-xs shadow-xs ${badgeStyle}`}
                      >
                        {k.letter}
                      </span>
                      <span className="text-[10px] font-black bg-slate-100 text-slate-700 px-1.5 py-0.2 rounded border border-slate-300 shadow-2xs">
                        Phím {k.key}
                      </span>
                    </div>
                    {redIsRevealed && isCorrect && (
                      <CheckCircle2 size={16} className="text-white shrink-0" />
                    )}
                  </div>
                  <span className="font-black text-xs sm:text-sm lg:text-base leading-tight line-clamp-2">
                    {option}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* FINAL VICTORY MODAL */}
      {isQuizCompleted && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-lg p-6 shadow-2xl border-4 border-amber-400 flex flex-col text-center animate-fade-in relative overflow-hidden text-slate-900">
            <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-amber-400 to-yellow-300 text-slate-950 flex items-center justify-center mx-auto mb-3 shadow-xl ring-4 ring-amber-300/50 animate-bounce">
              <Trophy size={42} />
            </div>

            <span className="text-xs font-extrabold uppercase tracking-widest text-amber-600">
              KẾT THÚC KÉO CO KIẾN THỨC
            </span>

            <h3 className="text-2xl sm:text-3xl font-black text-slate-900 mt-1 mb-2">
              {matchWinner === 'blue'
                ? `🏆 ${teamBlueName} CHIẾN THẮNG!`
                : matchWinner === 'red'
                ? `🏆 ${teamRedName} CHIẾN THẮNG!`
                : '🤝 HAI ĐỘI HÒA NHAU!'}
            </h3>

            <p className="text-xs text-slate-500 mb-4">
              Tỉ số chung cuộc: <strong className="text-blue-600">{teamBlueScore} điểm</strong> vs{' '}
              <strong className="text-red-600">{teamRedScore} điểm</strong>
            </p>

            {/* Winning Team Roster */}
            <div className="bg-slate-50 rounded-2xl p-3 border border-slate-200 mb-4 max-h-40 overflow-y-auto">
              <h5 className="text-[11px] font-black text-slate-700 uppercase tracking-wider mb-2">
                {matchWinner === 'blue' ? `Thành Viên ${teamBlueName}` : `Thành Viên ${teamRedName}`}
              </h5>
              <div className="flex flex-wrap items-center justify-center gap-1.5">
                {(matchWinner === 'blue' ? teamBlueMembers : teamRedMembers).map((m) => (
                  <span
                    key={m.id}
                    className="bg-white px-2 py-1 rounded-lg border border-slate-200 text-xs font-bold text-slate-800 shadow-2xs"
                  >
                    {m.name}
                  </span>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={resetMatch}
                className="flex-1 py-3 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-600 hover:brightness-110 text-white font-black text-sm rounded-2xl shadow-lg flex items-center justify-center gap-2 cursor-pointer"
              >
                <RotateCcw size={16} />
                <span>ĐẤU HIỆP MỚI (CHƠI LẠI)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CẤU HÌNH & CHỌN THÀNH VIÊN VÀO ĐỘI 1 & ĐỘI 2 */}
      {/* ========================================================================= */}
      {showTeamModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 text-slate-900">
          <div className="bg-white rounded-3xl w-[98vw] max-w-7xl h-[94vh] max-h-[920px] p-4 sm:p-6 shadow-2xl border border-slate-200 flex flex-col animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-100 text-blue-700 rounded-2xl shadow-xs">
                  <Users size={26} />
                </div>
                <div>
                  <h3 className="text-lg sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                    <span>Cấu Hình Danh Sách Đội Kéo Co</span>
                    <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                      Tổng {students.length} học sinh
                    </span>
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-500 font-medium">
                    Bấm nút <strong>🔵 Chọn Đội 1</strong> hoặc <strong>🔴 Chọn Đội 2</strong> để thêm học sinh vào đội thi đấu
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowTeamModal(false)}
                className="p-2 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-2xl transition-colors cursor-pointer"
                title="Đóng cửa sổ"
              >
                <X size={24} />
              </button>
            </div>

            {/* Quick Actions & Search Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3.5 bg-slate-50 p-3 rounded-2xl border border-slate-200 shrink-0">
              <div className="relative flex-1 min-w-[240px]">
                <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={teamSearchQuery}
                  onChange={(e) => setTeamSearchQuery(e.target.value)}
                  placeholder="🔍 Tìm nhanh học sinh theo tên..."
                  className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
                />
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={autoDivideTeams}
                  className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:brightness-110 text-white rounded-xl text-xs sm:text-sm font-black flex items-center gap-1.5 shadow-sm hover:shadow transition-all cursor-pointer"
                >
                  <Shuffle size={16} />
                  <span>Chia Ngẫu Nhiên 50/50</span>
                </button>
                <button
                  onClick={clearAllTeams}
                  className="px-3.5 py-2 bg-slate-200/80 hover:bg-rose-100 hover:text-rose-700 text-slate-700 rounded-xl text-xs sm:text-sm font-bold transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <Trash2 size={15} />
                  <span>Xóa Trắng Chia Lại</span>
                </button>
              </div>
            </div>

            {/* 3 Columns Layout: Equal 3-column grid */}
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4 min-h-0 overflow-hidden">
              {/* CỘT 1: ĐỘI XANH */}
              <div className="flex flex-col bg-blue-50/80 border-2 border-blue-400 rounded-2xl p-3.5 min-h-0 shadow-xs">
                <div className="flex items-center justify-between border-b-2 border-blue-200 pb-2.5 mb-2.5 shrink-0">
                  <div className="flex items-center gap-2">
                    <span className="w-3.5 h-3.5 rounded-full bg-blue-600 ring-2 ring-blue-200"></span>
                    <span className="font-black text-base text-blue-950">{teamBlueName}</span>
                  </div>
                  <span className="bg-blue-600 text-white font-black px-2.5 py-0.5 rounded-full text-xs shadow-2xs">
                    {teamBlueMembers.length} thành viên
                  </span>
                </div>

                <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-0 custom-scrollbar">
                  {teamBlueMembers.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-slate-400 text-xs sm:text-sm text-center py-10 px-4 bg-white/50 rounded-xl border border-dashed border-blue-200">
                      <UserPlus size={32} className="mb-2 text-blue-400 opacity-70" />
                      <span className="font-bold text-slate-600">Đội Xanh chưa có thành viên</span>
                      <span className="text-xs text-slate-400 mt-1">Bấm <strong>🔵 Đội 1</strong> ở cột giữa để thêm học sinh</span>
                    </div>
                  ) : (
                    teamBlueMembers.map((student, idx) => {
                      const isLead = idx === 0;
                      return (
                        <div
                          key={student.id}
                          className={`flex items-center justify-between p-2.5 rounded-xl border transition-all ${
                            isLead
                              ? 'bg-blue-600 text-white border-blue-700 shadow-md ring-2 ring-blue-300'
                              : 'bg-white text-slate-800 border-blue-100 hover:border-blue-300 shadow-2xs'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-8 h-8 rounded-full overflow-hidden bg-blue-100 flex items-center justify-center shrink-0 text-xs font-black ring-1 ring-blue-200">
                              {student.avatar ? (
                                <img src={student.avatar} alt={student.name} className="w-full h-full object-cover" />
                              ) : (
                                <span className={isLead ? 'text-blue-900' : 'text-blue-700'}>{getInitials(student.name)}</span>
                              )}
                            </div>
                            <div className="min-w-0">
                              <span className="text-xs sm:text-sm font-bold truncate block">{student.name}</span>
                              {isLead ? (
                                <span className="text-[11px] text-amber-300 font-black flex items-center gap-1">
                                  <Star size={12} fill="currentColor" /> Vận động viên kéo chính
                                </span>
                              ) : (
                                <span className="text-[10px] text-slate-400">Thành viên #{idx + 1}</span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0 ml-2">
                            {!isLead && (
                              <button
                                onClick={() => setLeadAthlete(student.id, 'blue')}
                                className="p-1.5 hover:bg-amber-50 rounded-lg text-amber-500 hover:text-amber-600 transition-colors cursor-pointer bg-white/80 border border-slate-200"
                                title="Đặt làm người kéo chính trên sàn đấu"
                              >
                                <Star size={15} />
                              </button>
                            )}
                            <button
                              onClick={() => removeStudentFromTeam(student.id)}
                              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                isLead
                                  ? 'hover:bg-blue-700 text-blue-100'
                                  : 'hover:bg-rose-50 text-slate-400 hover:text-rose-600 border border-slate-200 bg-white/80'
                              }`}
                              title="Xóa khỏi đội"
                            >
                              <X size={15} />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* CỘT 2: DANH SÁCH CẢ LỚP */}
              <div className="flex flex-col bg-slate-50 border-2 border-slate-200 rounded-2xl p-3.5 min-h-0 shadow-xs">
                <div className="flex items-center justify-between border-b-2 border-slate-200 pb-2.5 mb-2.5 shrink-0">
                  <span className="font-black text-sm uppercase tracking-wider text-slate-800">
                    Danh Sách Học Sinh ({filteredClassStudents.length}/{students.length})
                  </span>
                  <span className="text-xs font-semibold text-slate-500">Bấm nút để gán</span>
                </div>

                <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-0 custom-scrollbar">
                  {filteredClassStudents.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-slate-400 text-xs py-10">
                      <span>Không tìm thấy học sinh phù hợp</span>
                    </div>
                  ) : (
                    filteredClassStudents.map((student) => {
                      const isBlue = teamBlueMembers.some((s) => s.id === student.id);
                      const isRed = teamRedMembers.some((s) => s.id === student.id);

                      return (
                        <div
                          key={student.id}
                          className="flex items-center justify-between p-2.5 bg-white rounded-xl border border-slate-200 shadow-2xs hover:border-slate-300 hover:shadow-xs transition-all"
                        >
                          <div className="flex items-center gap-2.5 min-w-0 pr-2">
                            <div className="w-8 h-8 rounded-full overflow-hidden bg-slate-100 flex items-center justify-center shrink-0 text-xs font-black border border-slate-200">
                              {student.avatar ? (
                                <img src={student.avatar} alt={student.name} className="w-full h-full object-cover" />
                              ) : (
                                <span className="text-slate-700">{getInitials(student.name)}</span>
                              )}
                            </div>
                            <span className="text-xs sm:text-sm font-bold text-slate-800 truncate">{student.name}</span>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              onClick={() => assignStudentToTeam(student, 'blue')}
                              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1 shadow-2xs ${
                                isBlue
                                  ? 'bg-blue-600 text-white ring-2 ring-blue-300'
                                  : 'bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white border border-blue-200'
                              }`}
                            >
                              <span>🔵 Đội 1</span>
                              {isBlue && <CheckCircle2 size={13} />}
                            </button>

                            <button
                              onClick={() => assignStudentToTeam(student, 'red')}
                              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1 shadow-2xs ${
                                isRed
                                  ? 'bg-red-600 text-white ring-2 ring-red-300'
                                  : 'bg-red-50 text-red-700 hover:bg-red-600 hover:text-white border border-red-200'
                              }`}
                            >
                              <span>🔴 Đội 2</span>
                              {isRed && <CheckCircle2 size={13} />}
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* CỘT 3: ĐỘI ĐỎ */}
              <div className="flex flex-col bg-red-50/80 border-2 border-red-400 rounded-2xl p-3.5 min-h-0 shadow-xs">
                <div className="flex items-center justify-between border-b-2 border-red-200 pb-2.5 mb-2.5 shrink-0">
                  <div className="flex items-center gap-2">
                    <span className="w-3.5 h-3.5 rounded-full bg-red-600 ring-2 ring-red-200"></span>
                    <span className="font-black text-base text-red-950">{teamRedName}</span>
                  </div>
                  <span className="bg-red-600 text-white font-black px-2.5 py-0.5 rounded-full text-xs shadow-2xs">
                    {teamRedMembers.length} thành viên
                  </span>
                </div>

                <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-0 custom-scrollbar">
                  {teamRedMembers.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-slate-400 text-xs sm:text-sm text-center py-10 px-4 bg-white/50 rounded-xl border border-dashed border-red-200">
                      <UserPlus size={32} className="mb-2 text-red-400 opacity-70" />
                      <span className="font-bold text-slate-600">Đội Đỏ chưa có thành viên</span>
                      <span className="text-xs text-slate-400 mt-1">Bấm <strong>🔴 Đội 2</strong> ở cột giữa để thêm học sinh</span>
                    </div>
                  ) : (
                    teamRedMembers.map((student, idx) => {
                      const isLead = idx === 0;
                      return (
                        <div
                          key={student.id}
                          className={`flex items-center justify-between p-2.5 rounded-xl border transition-all ${
                            isLead
                              ? 'bg-red-600 text-white border-red-700 shadow-md ring-2 ring-red-300'
                              : 'bg-white text-slate-800 border-red-100 hover:border-red-300 shadow-2xs'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-8 h-8 rounded-full overflow-hidden bg-red-100 flex items-center justify-center shrink-0 text-xs font-black ring-1 ring-red-200">
                              {student.avatar ? (
                                <img src={student.avatar} alt={student.name} className="w-full h-full object-cover" />
                              ) : (
                                <span className={isLead ? 'text-red-900' : 'text-red-700'}>{getInitials(student.name)}</span>
                              )}
                            </div>
                            <div className="min-w-0">
                              <span className="text-xs sm:text-sm font-bold truncate block">{student.name}</span>
                              {isLead ? (
                                <span className="text-[11px] text-amber-300 font-black flex items-center gap-1">
                                  <Star size={12} fill="currentColor" /> Vận động viên kéo chính
                                </span>
                              ) : (
                                <span className="text-[10px] text-slate-400">Thành viên #{idx + 1}</span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0 ml-2">
                            {!isLead && (
                              <button
                                onClick={() => setLeadAthlete(student.id, 'red')}
                                className="p-1.5 hover:bg-amber-50 rounded-lg text-amber-500 hover:text-amber-600 transition-colors cursor-pointer bg-white/80 border border-slate-200"
                                title="Đặt làm người kéo chính trên sàn đấu"
                              >
                                <Star size={15} />
                              </button>
                            )}
                            <button
                              onClick={() => removeStudentFromTeam(student.id)}
                              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                isLead
                                  ? 'hover:bg-red-700 text-red-100'
                                  : 'hover:bg-rose-50 text-slate-400 hover:text-rose-600 border border-slate-200 bg-white/80'
                              }`}
                              title="Xóa khỏi đội"
                            >
                              <X size={15} />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="mt-3.5 pt-3 border-t border-slate-100 flex items-center justify-between shrink-0">
              <div className="text-xs text-slate-500 hidden sm:block">
                💡 <em>Mẹo:</em> Học sinh có dấu sao <Star size={12} className="inline text-amber-500" fill="currentColor" /> là người đứng đầu hàng kéo co trên sân khấu.
              </div>
              <button
                onClick={() => setShowTeamModal(false)}
                className="px-6 py-2.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-600 hover:brightness-110 text-white font-black text-sm rounded-xl shadow-md hover:shadow-lg transition-all cursor-pointer flex items-center gap-2 ml-auto"
              >
                <CheckCircle2 size={18} />
                <span>Hoàn Tất & Bắt Đầu Trận Đấu</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* IMPORT MODAL */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 text-slate-900">
          <div className="bg-white rounded-3xl w-full max-w-2xl p-5 sm:p-6 shadow-2xl border border-slate-200 flex flex-col max-h-[92vh] animate-fade-in">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-100 text-indigo-700 rounded-xl">
                  <Upload size={20} />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-slate-900">Nhập Câu Hỏi Kéo Co</h3>
                  <p className="text-xs text-slate-500">Dán trực tiếp văn bản từ Word, Excel hoặc đề thi</p>
                </div>
              </div>
              <button
                onClick={() => setShowImportModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Tên bộ câu hỏi:</label>
                  <input
                    type="text"
                    value={importTitle}
                    onChange={(e) => setImportTitle(e.target.value)}
                    placeholder="VD: Tiếng Anh 5 - Unit 1"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs sm:text-sm font-bold text-slate-800 outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Chủ đề / Môn học:</label>
                  <input
                    type="text"
                    value={importCategory}
                    onChange={(e) => setImportCategory(e.target.value)}
                    placeholder="VD: Tiếng Anh, Toán Học, Lịch Sử..."
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs sm:text-sm font-bold text-slate-800 outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-xl text-xs text-amber-900">
                <span className="font-black text-amber-800">💡 Hướng dẫn đánh dấu đáp án đúng:</span>
                <ul className="list-disc list-inside mt-1 space-y-0.5 text-[11px] text-amber-950 font-medium">
                  <li>Đặt dấu sao <code className="bg-amber-200/80 px-1 rounded font-bold">*</code> trước đáp án đúng (VD: <code className="font-bold">*C. yellow</code>)</li>
                  <li>Hoặc thêm dòng <code className="bg-amber-200/80 px-1 rounded font-bold">Đáp án: C</code> ở dưới mỗi câu.</li>
                </ul>
              </div>

              {/* Quick Paste Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-2 p-2 bg-indigo-50/80 border border-indigo-200 rounded-2xl">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={handlePasteFromClipboard}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black flex items-center gap-1 shadow-xs transition-transform active:scale-95 cursor-pointer"
                  >
                    <Upload size={13} />
                    <span>Dán Từ Clipboard (Ctrl + V)</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleSampleEnglish}
                    className="px-2.5 py-1.5 bg-white hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  >
                    🇬🇧 Đề Mẫu Tiếng Anh
                  </button>

                  <button
                    type="button"
                    onClick={handleSampleMath}
                    className="px-2.5 py-1.5 bg-white hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  >
                    🔢 Đề Mẫu Toán Học
                  </button>
                </div>

                {importText && (
                  <button
                    type="button"
                    onClick={() => setImportText('')}
                    className="text-xs text-rose-600 hover:text-rose-800 font-bold px-2 py-1 hover:bg-rose-50 rounded-lg cursor-pointer transition-colors"
                  >
                    Xóa Trắng
                  </button>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-black text-slate-700">Dán nội dung câu hỏi vào đây:</label>
                  {importText.trim() && (
                    <span className="text-xs font-extrabold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200">
                      ✅ Đã nhận diện được {parseQuestionsFromText(importText).length} câu hỏi
                    </span>
                  )}
                </div>
                <textarea
                  rows={7}
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                  placeholder={`Câu 1: What is your favorite subject?\nA. I like English\n*B. English\nC. She likes Math\nD. Yes, I do\n\nCâu 2: How often do you have Music?\n*A. Once a week\nB. In the morning\nC. At school\nD. With my friend`}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs sm:text-sm font-mono text-slate-800 outline-none focus:border-indigo-500 focus:bg-white leading-relaxed"
                />
              </div>

              {/* LIVE PARSING PREVIEW */}
              {importText.trim().length > 0 && (
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 max-h-48 overflow-y-auto">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-black uppercase tracking-wider text-slate-700">
                      Xem Trước Các Câu Hỏi Đã Nhận Diện ({parseQuestionsFromText(importText).length})
                    </span>
                  </div>

                  {parseQuestionsFromText(importText).length === 0 ? (
                    <div className="text-xs text-rose-500 font-bold p-2 bg-rose-50 rounded-xl border border-rose-200">
                      ⚠️ Chưa nhận diện được câu hỏi. Hãy đảm bảo mỗi câu có tên câu hỏi và các lựa chọn A, B, C, D (đặt dấu * trước đáp án đúng).
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {parseQuestionsFromText(importText).map((q, qIdx) => (
                        <div key={qIdx} className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs text-xs">
                          <div className="font-bold text-slate-900 mb-1.5 flex items-center gap-1.5">
                            <span className="bg-indigo-600 text-white font-black px-1.5 py-0.2 rounded text-[10px]">
                              Câu {qIdx + 1}
                            </span>
                            <span>{q.question}</span>
                          </div>
                          <div className="grid grid-cols-2 gap-1 pl-2">
                            {q.options.map((opt, oIdx) => {
                              const isCorrect = oIdx === q.correctIndex;
                              return (
                                <div
                                  key={oIdx}
                                  className={`px-2 py-1 rounded-lg text-[11px] flex items-center gap-1 font-medium ${
                                    isCorrect
                                      ? 'bg-emerald-100 text-emerald-900 font-bold border border-emerald-300'
                                      : 'bg-slate-100 text-slate-700'
                                  }`}
                                >
                                  <span className="font-bold">{['A', 'B', 'C', 'D'][oIdx] || oIdx + 1}.</span>
                                  <span className="truncate">{opt}</span>
                                  {isCorrect && <CheckCircle2 size={12} className="text-emerald-600 ml-auto shrink-0" />}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                onClick={() => setShowImportModal(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Hủy
              </button>
              <button
                onClick={handleImportSubmit}
                className="px-5 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:brightness-110 text-white font-black text-xs sm:text-sm rounded-xl shadow-md flex items-center gap-1.5 cursor-pointer"
              >
                <Save size={15} />
                <span>Lưu & Bắt Đầu Đấu</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
