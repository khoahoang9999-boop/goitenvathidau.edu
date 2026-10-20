import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Student } from '../types';
import { sound } from '../services/sound';
import { getShortName, getInitials } from '../utils/defaultData';
import {
  Sparkles,
  Users,
  RotateCcw,
  Play,
  Compass,
  Trophy,
  X,
  CheckCircle2,
  RefreshCw,
  Maximize2,
  Minimize2,
  Palette,
} from 'lucide-react';

interface Space3DSelectorProps {
  students: Student[];
  onSelectWinner: (student: Student) => void;
  onResetCalled: () => void;
  onRecallStudent?: (student: Student) => void;
  noRepeat?: boolean;
  onToggleNoRepeat?: (val: boolean) => void;
}

interface Point3D {
  x: number;
  y: number;
  z: number;
}

interface Star {
  x: number;
  y: number;
  z: number;
  prevZ: number;
  size: number;
  color: string;
}

interface ProjectedStudent {
  student: Student;
  projX: number;
  projY: number;
  avatarSize: number;
}

interface PendulumGeometry {
  wireY1: number;
  wireY2: number;
  spanWidth: number;
  strings: { apexX: number; apexY: number; avatarIdx: number }[];
  impactPoints?: { x: number; y: number; intensity: number }[];
}

export const Space3DSelector: React.FC<Space3DSelectorProps> = ({
  students,
  onSelectWinner,
  onResetCalled,
  onRecallStudent,
  noRepeat = true,
  onToggleNoRepeat,
}) => {
  const activeStudents = (noRepeat ? students.filter((s) => !s.called) : students).filter((s) => !s.excluded);

  // Background visual theme: Default is 'space' (3D Cosmic Starry Universe)
  const [bgTheme, setBgTheme] = useState<'vibrant' | 'purple' | 'space'>('space');

  const [isSpinning, setIsSpinning] = useState<boolean>(false);
  // Custom user spin duration in seconds (editable, default 10s)
  const [customDuration, setCustomDuration] = useState<number>(10);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  // Center winner spotlight modal
  const [centerWinner, setCenterWinner] = useState<Student | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Cached avatar images
  const imageCache = useRef<Map<string, HTMLImageElement>>(new Map());

  // Projected students for click-selection
  const projectedStudentsRef = useRef<ProjectedStudent[]>([]);

  // Starfield particles
  const starsRef = useRef<Star[]>([]);

  // 3D Rotation angles and velocities
  const rotationRef = useRef({
    rx: 0.12,
    ry: 0.22,
    rz: 0.0,
    vx: 0.0004,
    vy: 0.0006,
    isDragging: false,
    dragDistance: 0,
    lastMouseX: 0,
    lastMouseY: 0,
  });

  // Spin animation physics state
  const spinAnimRef = useRef({
    startTime: 0,
    duration: 10000,
    progress: 0,
    winner: null as Student | null,
    startRot: 0,
    targetRot: 0,
    winnerIdx: 0,
  });

  // Preload avatars
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

  // Initialize stars
  useEffect(() => {
    const starColors = ['#ffffff', '#bae6fd', '#fef08a', '#e0e7ff', '#fbcfe8'];
    const newStars: Star[] = [];
    for (let i = 0; i < 180; i++) {
      const x = (Math.random() - 0.5) * 2200;
      const y = (Math.random() - 0.5) * 1600;
      const z = Math.random() * 1000 + 50;
      newStars.push({
        x,
        y,
        z,
        prevZ: z,
        size: Math.random() * 2 + 0.8,
        color: starColors[Math.floor(Math.random() * starColors.length)],
      });
    }
    starsRef.current = newStars;
  }, []);

  // =========================================================================
  // DYNAMIC MOTION GENERATORS WITH ADAPTIVE STUDENT DENSITY
  // =========================================================================

  // 0. IDLE STATE: Mới đầu vào chưa bấm quay, học sinh bay bổng tự nhiên, phân bổ rộng rãi khắp màn hình
  const getIdleCoords = (
    total: number,
    width: number,
    height: number,
    timestamp: number
  ): Point3D[] => {
    const coords: Point3D[] = [];
    const density = Math.min(1.0, Math.max(0.35, total / 22));
    const idleRadiusX = Math.min(width * 0.40, 180 + density * 190);
    const idleRadiusY = idleRadiusX * 0.68;

    for (let i = 0; i < total; i++) {
      const theta = (i / total) * Math.PI * 2;
      // Gentle natural organic floating
      const floatX = Math.cos(timestamp * 0.0006 + i * 1.4) * 8;
      const floatY = Math.sin(timestamp * 0.0007 + i * 1.2) * 8;
      const floatZ = Math.sin(timestamp * 0.0005 + i * 0.9) * 14;

      coords.push({
        x: Math.cos(theta) * idleRadiusX + floatX,
        y: Math.sin(theta) * idleRadiusY + floatY,
        z: floatZ,
      });
    }
    return coords;
  };

  // 1. Galaxy Spiral Vortex (Chuyển động xoáy vòng vòng ngoạn mục - phân bổ rộng rãi khắp màn hình)
  const getGalaxyCoords = (
    total: number,
    width: number,
    height: number,
    timestamp: number,
    speed: number,
    density: number,
    spinProgress: number = 0,
    winnerIdx: number = -1
  ): Point3D[] => {
    const coords: Point3D[] = [];
    // Rộng mở toàn màn hình, không bị co cụm
    const maxRadiusX = Math.min(width * 0.43, 240 + density * 240);
    const maxRadiusY = Math.min(height * 0.39, 170 + density * 170);
    const minRadiusX = 85 + density * 25;
    const minRadiusY = 60 + density * 20;

    // Xoay vòng vòng rõ rệt, uyển chuyển theo thời gian
    const spinTravel = timestamp * 0.0032 * (isSpinning ? Math.min(2.4, speed * 1.35) : 1.0);

    // Khi gần về đích (spinProgress > 0.88), học sinh trúng giải xoáy dần về trung tâm sân khấu
    const winPull = isSpinning && spinProgress > 0.88 ? Math.min(1, (spinProgress - 0.88) / 0.12) : 0;

    // Chia đều học sinh ra 3 đến 4 cánh xoắn thiên hà để không bị chồng đè, co cụm
    const armCount = total > 24 ? 4 : total > 12 ? 3 : 2;

    for (let i = 0; i < total; i++) {
      const arm = i % armCount;
      const indexInArm = Math.floor(i / armCount);
      const countInArm = Math.ceil(total / armCount);
      const progress = countInArm > 1 ? indexInArm / (countInArm - 1) : 0.5;

      const armOffset = (arm / armCount) * Math.PI * 2;
      const theta = progress * Math.PI * 2.8 + armOffset + spinTravel;

      const rx = minRadiusX + progress * (maxRadiusX - minRadiusX);
      const ry = minRadiusY + progress * (maxRadiusY - minRadiusY);

      let x = Math.cos(theta) * rx;
      let y = Math.sin(theta) * ry;
      // Phân tách chiều sâu 3D rõ rệt
      let z = Math.sin(theta * 2 + progress * Math.PI) * 65;

      if (i === winnerIdx && winPull > 0) {
        x *= (1 - winPull * 0.88);
        y *= (1 - winPull * 0.88);
        z = z * (1 - winPull) + winPull * 110;
      } else if (winPull > 0) {
        // Các học sinh khác giãn nở nhẹ ra ngoài để nhường sân khấu trung tâm cho học sinh chiến thắng
        x *= (1 + winPull * 0.16);
        y *= (1 + winPull * 0.16);
      }

      coords.push({ x, y, z });
    }
    return coords;
  };

  // 2. Cosmic 3D Sphere (Cầu 3D quay êm đềm)
  const getSphereCoords = (
    total: number,
    width: number,
    height: number,
    timestamp: number,
    speed: number,
    density: number
  ): Point3D[] => {
    const coords: Point3D[] = [];
    const radX = Math.min(width * 0.40, 180 + density * 210);
    const radY = radX * 0.85;
    const radZ = radX * 0.85;
    const phi = Math.PI * (3 - Math.sqrt(5));
    const spinTravel = timestamp * 0.00075 * speed;

    for (let i = 0; i < total; i++) {
      const yNorm = 1 - (i / (total === 1 ? 1 : total - 1)) * 2;
      const radiusAtY = Math.sqrt(Math.max(0, 1 - yNorm * yNorm));
      const theta = phi * i + spinTravel;

      const x = Math.cos(theta) * radiusAtY * radX;
      const y = yNorm * radY;
      const z = Math.sin(theta) * radiusAtY * radZ;
      coords.push({ x, y, z });
    }
    return coords;
  };

  // 3. Horizontal Undulating Waves (Lượn sóng dập dềnh êm dịu)
  const getWaveCoords = (
    total: number,
    width: number,
    height: number,
    timestamp: number,
    speed: number,
    density: number
  ): Point3D[] => {
    const coords: Point3D[] = [];
    const waveSpanX = width * (0.45 + density * 0.38);
    const startX = -waveSpanX / 2;
    const waveAmpY = height * (0.08 + density * 0.08);
    const waveFrequency = 2.0;

    const useMultiTiers = total > 16;
    const tiers = useMultiTiers ? 2 : 1;

    for (let i = 0; i < total; i++) {
      const tier = useMultiTiers ? i % tiers : 0;
      const idxInTier = useMultiTiers ? Math.floor(i / tiers) : i;
      const countInTier = useMultiTiers ? Math.ceil(total / tiers) : total;

      const normX = countInTier > 1 ? idxInTier / (countInTier - 1) : 0.5;
      const baseX = startX + normX * waveSpanX;

      const wavePhase =
        (baseX / width) * Math.PI * waveFrequency * 2 -
        timestamp * 0.00085 * speed +
        tier * Math.PI * 0.7;

      const baseY =
        Math.sin(wavePhase) * waveAmpY +
        (useMultiTiers ? (tier === 0 ? -height * 0.12 : height * 0.12) : 0);

      const baseZ = Math.sin(wavePhase * 0.5) * 45;
      coords.push({ x: baseX, y: baseY, z: baseZ });
    }
    return coords;
  };

  // 4. Infinity Figure-8 Loop (Vòng số 8 lướt êm ái)
  const getInfinityCoords = (
    total: number,
    width: number,
    height: number,
    timestamp: number,
    speed: number,
    density: number
  ): Point3D[] => {
    const coords: Point3D[] = [];
    const spanX = Math.min(width * 0.40, 160 + density * 180);
    const spanY = Math.min(height * 0.32, 100 + density * 120);
    const spinTravel = timestamp * 0.0005 * speed;

    for (let i = 0; i < total; i++) {
      const t = (i / total) * Math.PI * 2 + spinTravel;
      const denom = 1 + Math.sin(t) * Math.sin(t);

      const x = (Math.cos(t) / denom) * spanX;
      const y = ((Math.sin(t) * Math.cos(t)) / denom) * spanY * 2.1;
      const z = Math.sin(t) * 75;
      coords.push({ x, y, z });
    }
    return coords;
  };

  // 5. Quả Lắc 2 HÀNG & GHÉP CẶP ĐUNG ĐƯA VA VÀO NHAU (COLLIDING PAIRS)
  const getDoubleTierPairedPendulumCoords = (
    total: number,
    width: number,
    height: number,
    timestamp: number,
    speed: number,
    density: number
  ): { coords: Point3D[]; pendulumGeom: PendulumGeometry } => {
    const coords: Point3D[] = [];
    const strings: { apexX: number; apexY: number; avatarIdx: number }[] = [];
    const impactPoints: { x: number; y: number; intensity: number }[] = [];

    // Tổng số cặp (ghép 2 em một nhóm)
    const totalPairs = Math.ceil(total / 2);
    // Chia đều cân đối số cặp cho 2 hàng:
    const row1Pairs = Math.ceil(totalPairs / 2);
    const row2Pairs = totalPairs - row1Pairs;

    // Số học sinh mỗi hàng
    const row1Count = Math.min(total, row1Pairs * 2);

    // Khoảng cách giữa các cặp (vừa vặn, co cụm quanh trung tâm)
    const maxPairsInRow = Math.max(1, Math.max(row1Pairs, row2Pairs));
    const stepX = Math.min(135, Math.max(85, (width * 0.65) / maxPairsInRow));

    // Vị trí thanh ngang: Hàng trên & Hàng dưới
    const wireY1 = -height * (0.18 + density * 0.05); // Thanh trên
    const wireY2 = +height * (0.04 + density * 0.04); // Thanh dưới
    const stringLen = height * (0.19 + density * 0.05);

    // Độ lệch so le (stagger offset) giữa Hàng 1 và Hàng 2:
    const staggerOffset = row1Pairs === row2Pairs && row1Pairs > 1 ? stepX * 0.25 : 0;

    // Chiều rộng thanh ngang bao trùm
    const spanWidth = Math.max(80, (maxPairsInRow - 1) * stepX + 60);

    for (let idx = 0; idx < total; idx++) {
      const isRow1 = idx < row1Count;
      const rowIdx = isRow1 ? idx : idx - row1Count;
      const rowCount = isRow1 ? row1Count : total - row1Count;
      const rowPairs = isRow1 ? row1Pairs : row2Pairs;
      const wireY = isRow1 ? wireY1 : wireY2;

      // Ghép 2 cặp một nhóm: pairIdx và partner (0: trái, 1: phải)
      const pairIdx = Math.floor(rowIdx / 2);
      const partner = rowIdx % 2;
      const isSingle = partner === 0 && rowIdx === rowCount - 1;

      // Điểm đỉnh treo trung tâm của cặp trên thanh ngang
      let pairApexX = rowPairs > 1 ? (pairIdx - (rowPairs - 1) / 2) * stepX : 0;
      if (isRow1) {
        pairApexX -= staggerOffset;
      } else {
        pairApexX += staggerOffset;
      }
      const apexY = wireY;

      // Khoảng cách giữa 2 điểm móc dây của cặp trên thanh ngang
      const suspensionGap = isSingle ? 0 : 26;
      const partnerApexX = pairApexX + (partner === 0 ? -suspensionGap / 2 : suspensionGap / 2);

      // Dao động đung đưa nhịp nhàng:
      // Tần số 0.0026 vừa vặn để học sinh đung đưa qua lại và va vào nhau đều đặn
      const rowPhaseOffset = isRow1 ? 0 : Math.PI * 0.65;
      const swingPhase = timestamp * 0.0026 * speed + pairIdx * 0.85 + rowPhaseOffset;
      const cycle = Math.sin(swingPhase);
      const absCycle = Math.abs(cycle);

      // Điểm va chạm mạnh nhất khi cycle = 0 (2 bạn lao vào chạm khít vào nhau)
      const impact = Math.exp(-Math.pow(cycle * 7.5, 2));
      const commonSway = Math.sin(swingPhase * 0.5) * 0.04;
      const maxSwingAngle = 0.36; // Góc vung mở rộng hai bên

      let avatarX = partnerApexX;
      let avatarY = apexY + stringLen;
      let avatarZ = 0;

      if (isSingle) {
        // Bạn lẻ ở cuối hàng đung đưa tự nhiên
        const singleAngle = Math.sin(swingPhase) * 0.26 + commonSway;
        avatarX = pairApexX + Math.sin(singleAngle) * stringLen;
        avatarY = apexY + Math.cos(singleAngle) * stringLen;
        avatarZ = Math.cos(singleAngle) * 20;
        strings.push({ apexX: pairApexX, apexY, avatarIdx: idx });
      } else {
        // HAI BẠN GHÉP CẶP ĐUNG ĐƯA VA VÀO NHAU:
        // - Vung ra: 2 bạn dãn ra xa thành hình chữ V
        // - Lao vào: 2 bạn áp sát và VA VÀO NHAU ở giữa kèm độ nảy đàn hồi (bounce)
        const bounce = impact * 4;
        if (partner === 0) {
          const swingAngle = -absCycle * maxSwingAngle + commonSway;
          avatarX = partnerApexX + Math.sin(swingAngle) * stringLen - bounce;
          avatarY = apexY + Math.cos(swingAngle) * stringLen - impact * 2;
          avatarZ = Math.cos(swingAngle) * 20;

          if (impact > 0.2) {
            impactPoints.push({
              x: pairApexX,
              y: apexY + stringLen,
              intensity: impact,
            });
          }
        } else {
          const swingAngle = +absCycle * maxSwingAngle + commonSway;
          avatarX = partnerApexX + Math.sin(swingAngle) * stringLen + bounce;
          avatarY = apexY + Math.cos(swingAngle) * stringLen - impact * 2;
          avatarZ = Math.cos(swingAngle) * 20;
        }

        strings.push({ apexX: partnerApexX, apexY, avatarIdx: idx });
      }

      coords.push({ x: avatarX, y: avatarY, z: avatarZ });
    }

    return {
      coords,
      pendulumGeom: { wireY1, wireY2, spanWidth, strings, impactPoints },
    };
  };

  // =========================================================================
  // UNIFIED 5-IN-1 MORPHING ARCHITECTURE
  // =========================================================================
  const getStudentCoordinates = useCallback(
    (
      total: number,
      width: number,
      height: number,
      timestamp: number,
      spinProgress: number
    ): {
      coords: Point3D[];
      pendulumGeom?: PendulumGeometry;
      weights: {
        galaxy: number;
        sphere: number;
        wave: number;
        infinity: number;
        pendulum: number;
      };
      density: number;
    } => {
      const density = Math.min(1.0, Math.max(0.35, total / 22));

      if (total === 0) {
        return {
          coords: [],
          weights: { galaxy: 0, sphere: 0, wave: 0, infinity: 0, pendulum: 0 },
          density,
        };
      }

      // KHI CHƯA QUAY (IDLE): Hoàn toàn bình thường, không có các kiểu, không có đường vẽ, bay tự nhiên
      if (!isSpinning) {
        const idle = getIdleCoords(total, width, height, timestamp);
        return {
          coords: idle,
          weights: { galaxy: 0, sphere: 0, wave: 0, infinity: 0, pendulum: 0 },
          density,
        };
      }

      // KHI ĐANG QUAY: TỰ ĐỘNG CHUYỂN TIẾP MƯỢT MÀ LIỀN MẠCH QUA 4 GIAI ĐOẠN THEO THỨ TỰ:
      // 1. Quả Lắc 2 Hàng -> 2. Lượn Sóng Đại Dương -> 3. Quả Cầu 3D -> 4. Xoáy Ốc Thiên Hà Bùng Nổ
      const speedMultiplier = 1.15 + (1 - spinProgress) * 0.22;
      const p = spinProgress;

      // C1-smooth Cosine Bell Curve function for seamless interpolation
      const bell = (center: number, radius: number): number => {
        const dist = Math.abs(p - center);
        if (dist >= radius) return 0;
        return 0.5 + 0.5 * Math.cos((dist / radius) * Math.PI);
      };

      // 1. Quả Lắc 2 Hàng Ghép Cặp (bắt đầu từ p = 0)
      let wPendulum = p < 0.12 ? 1 : bell(0.12, 0.20);
      // 2. Lượn Sóng Đại Dương Dập Dềnh (ở khoảng 0.38)
      let wWave = bell(0.38, 0.20);
      // 3. Quả Cầu 3D Nhào Lộn Không Gian (ở khoảng 0.65)
      let wSphere = bell(0.65, 0.20);
      // 4. Xoáy Ốc Thiên Hà Bùng Nổ (về đích ở 0.88 - 1.0)
      let wGalaxy = p > 0.88 ? 1 : bell(0.88, 0.20);
      const wInfinity = 0;

      const sum = wPendulum + wWave + wSphere + wGalaxy || 1;
      wPendulum /= sum;
      wWave /= sum;
      wSphere /= sum;
      wGalaxy /= sum;

      // Generate 5 movement targets
      const cGalaxy = getGalaxyCoords(
        total,
        width,
        height,
        timestamp,
        speedMultiplier,
        density,
        spinProgress,
        spinAnimRef.current.winnerIdx
      );
      const cSphere = getSphereCoords(total, width, height, timestamp, speedMultiplier, density);
      const cWave = getWaveCoords(total, width, height, timestamp, speedMultiplier, density);
      const cInfinity = getInfinityCoords(total, width, height, timestamp, speedMultiplier, density);
      const { coords: cPendulum, pendulumGeom } = getDoubleTierPairedPendulumCoords(
        total,
        width,
        height,
        timestamp,
        speedMultiplier,
        density
      );

      // Interpolate seamlessly (ZERO jerkiness or vibration)
      const blendedCoords: Point3D[] = [];
      for (let i = 0; i < total; i++) {
        const g = cGalaxy[i] || { x: 0, y: 0, z: 0 };
        const s = cSphere[i] || { x: 0, y: 0, z: 0 };
        const w = cWave[i] || { x: 0, y: 0, z: 0 };
        const inf = cInfinity[i] || { x: 0, y: 0, z: 0 };
        const pend = cPendulum[i] || { x: 0, y: 0, z: 0 };

        const mx = g.x * wGalaxy + s.x * wSphere + w.x * wWave + inf.x * wInfinity + pend.x * wPendulum;
        const my = g.y * wGalaxy + s.y * wSphere + w.y * wWave + inf.y * wInfinity + pend.y * wPendulum;
        const mz = g.z * wGalaxy + s.z * wSphere + w.z * wWave + inf.z * wInfinity + pend.z * wPendulum;

        // Subtle micro-breath, gentle and smooth (no jitter)
        const bounceX = Math.cos(timestamp * 0.0006 + i * 0.8) * 1.5;
        const bounceY = Math.sin(timestamp * 0.0007 + i * 0.9) * 2;

        blendedCoords.push({
          x: mx + bounceX,
          y: my + bounceY,
          z: mz,
        });
      }

      return {
        coords: blendedCoords,
        pendulumGeom,
        weights: {
          galaxy: wGalaxy,
          sphere: wSphere,
          wave: wWave,
          infinity: wInfinity,
          pendulum: wPendulum,
        },
        density,
      };
    },
    [isSpinning]
  );

  // 3D rotation transform function
  const rotatePoint = (p: Point3D, rx: number, ry: number, rz: number): Point3D => {
    const y1 = p.y * Math.cos(rx) - p.z * Math.sin(rx);
    const z1 = p.y * Math.sin(rx) + p.z * Math.cos(rx);
    const x1 = p.x;

    const x2 = x1 * Math.cos(ry) + z1 * Math.sin(ry);
    const z2 = -x1 * Math.sin(ry) + z1 * Math.cos(ry);
    const y2 = y1;

    const x3 = x2 * Math.cos(rz) - y2 * Math.sin(rz);
    const y3 = x2 * Math.sin(rz) + y2 * Math.cos(rz);
    const z3 = z2;

    return { x: x3, y: y3, z: z3 };
  };

  // Easing function for deceleration
  const easeOutQuart = (x: number): number => {
    return 1 - Math.pow(1 - x, 4);
  };

  // Render loop
  const render = useCallback(
    (timestamp: number = performance.now()) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const width = canvas.width / (window.devicePixelRatio || 1);
      const height = canvas.height / (window.devicePixelRatio || 1);
      const cx = width / 2;
      const cy = height / 2;

      ctx.clearRect(0, 0, width, height);

      // ==========================================
      // 1. DYNAMIC BACKGROUND
      // ==========================================
      if (bgTheme === 'vibrant') {
        // Lime-Green to Cyan/Teal (Hình 2 & 3)
        const bgGrad = ctx.createLinearGradient(0, 0, width, height);
        bgGrad.addColorStop(0, '#84cc16'); // Bright lime
        bgGrad.addColorStop(0.35, '#10b981'); // Emerald
        bgGrad.addColorStop(0.7, '#06b6d4'); // Cyan
        bgGrad.addColorStop(1, '#0284c7'); // Sky blue
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, width, height);

        // Soft ambient ripples
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
        ctx.lineWidth = 1.5;
        for (let r = 80; r < Math.max(width, height); r += 90) {
          ctx.beginPath();
          ctx.arc(cx, cy, r, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.restore();
      } else if (bgTheme === 'purple') {
        // Indigo to Magenta / Pink (Hình 4 & 5)
        const bgGrad = ctx.createLinearGradient(0, 0, width, height);
        bgGrad.addColorStop(0, '#3b82f6');
        bgGrad.addColorStop(0.4, '#8b5cf6');
        bgGrad.addColorStop(0.75, '#d946ef');
        bgGrad.addColorStop(1, '#f43f5e');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, width, height);
      } else {
        // Deep Space Midnight Navy (3D Cosmic Universe)
        const bgGradient = ctx.createRadialGradient(
          cx,
          cy,
          30,
          cx,
          cy,
          Math.max(width, height) * 0.8
        );
        bgGradient.addColorStop(0, '#0f172a');
        bgGradient.addColorStop(0.35, '#0b1120');
        bgGradient.addColorStop(0.7, '#070a13');
        bgGradient.addColorStop(1, '#02040a');
        ctx.fillStyle = bgGradient;
        ctx.fillRect(0, 0, width, height);

        // Subtle glowing cosmic nebula dust in center
        const nebulaGrad = ctx.createRadialGradient(
          cx,
          cy,
          0,
          cx,
          cy,
          Math.min(width, height) * 0.45
        );
        nebulaGrad.addColorStop(0, 'rgba(56, 189, 248, 0.12)'); // Sky cyan dust
        nebulaGrad.addColorStop(0.4, 'rgba(147, 51, 234, 0.08)'); // Purple galaxy dust
        nebulaGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = nebulaGrad;
        ctx.beginPath();
        ctx.arc(cx, cy, Math.min(width, height) * 0.45, 0, Math.PI * 2);
        ctx.fill();

        // Stars & Warp streaks
        const warpSpeed = isSpinning ? 3.0 : 0.8;
        ctx.save();
        starsRef.current.forEach((star) => {
          star.prevZ = star.z;
          star.z -= warpSpeed;
          if (star.z <= 1) {
            star.z = 1000;
            star.prevZ = 1000;
            star.x = (Math.random() - 0.5) * 2200;
            star.y = (Math.random() - 0.5) * 1600;
          }
          const k = 400 / star.z;
          const px = cx + star.x * k;
          const py = cy + star.y * k;
          if (px >= 0 && px <= width && py >= 0 && py <= height) {
            if (isSpinning) {
              // Warp speed streak lines
              const prevK = 400 / Math.max(1, star.prevZ);
              const ppx = cx + star.x * prevK;
              const ppy = cy + star.y * prevK;
              ctx.strokeStyle = star.color;
              ctx.lineWidth = Math.min(2.5, star.size * k * 1.4);
              ctx.beginPath();
              ctx.moveTo(ppx, ppy);
              ctx.lineTo(px, py);
              ctx.stroke();
            } else {
              // Twinkling dots
              const r = Math.max(0.6, star.size * k * 0.8);
              ctx.fillStyle = star.color;
              ctx.beginPath();
              ctx.arc(px, py, r, 0, Math.PI * 2);
              ctx.fill();
            }
          }
        });
        ctx.restore();
      }

      // ==========================================
      // 2. PROJECT STUDENTS ACROSS CANVAS
      // ==========================================
      const renderList = centerWinner
        ? activeStudents.filter((s) => s.id !== centerWinner.id)
        : activeStudents;

      const total = renderList.length;
      if (total === 0 && !centerWinner) {
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 18px "Plus Jakarta Sans", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('Tất cả học sinh đã được gọi!', cx, cy);
        return;
      }

      const spinProgress = isSpinning ? spinAnimRef.current.progress : 1;
      const { coords, pendulumGeom, weights, density } = getStudentCoordinates(
        total,
        width,
        height,
        timestamp,
        spinProgress
      );

      const focalLength = 650;
      const cameraZ = 850;
      const rot = rotationRef.current;
      const is3D = weights.sphere > 0.08 || weights.galaxy > 0.08;

      const transformed = renderList.map((student, idx) => {
        const base = coords[idx] || { x: 0, y: 0, z: 0 };
        const rotBlendX = rot.rx * (weights.sphere * 0.8 + weights.galaxy * 0.4);
        const rotBlendY = rot.ry * (weights.sphere * 0.8 + weights.galaxy * 0.4);
        const p3d = is3D ? rotatePoint(base, rotBlendX, rotBlendY, 0) : base;

        const depth = cameraZ + p3d.z;
        const scale = focalLength / Math.max(10, depth);
        const projX = cx + p3d.x * (is3D ? scale : 1.0);
        const projY = cy + p3d.y * (is3D ? scale : 1.0);

        return {
          student,
          idx,
          p3d,
          projX,
          projY,
          scale: is3D ? scale : 1.0,
          z: p3d.z,
        };
      });

      // ==========================================
      // 3. DRAW DYNAMIC GUIDES ONLY WHEN ACTIVE (ZERO LINES WHEN IDLE)
      // ==========================================
      ctx.save();
      const baseAlpha = bgTheme === 'space' ? 0.11 : 0.18;

      // 3A. Quả Lắc: Chỉ xuất hiện khi quay ở giai đoạn con lắc (mảnh, mờ, tinh tế)
      if (isSpinning && weights.pendulum > 0.02 && pendulumGeom) {
        const pAlpha = baseAlpha * weights.pendulum;
        ctx.strokeStyle = `rgba(255, 255, 255, ${pAlpha * 0.9})`;
        ctx.lineWidth = 0.75;

        const wire1Y = cy + pendulumGeom.wireY1;
        const wire2Y = cy + pendulumGeom.wireY2;
        const halfWireSpan = (pendulumGeom.spanWidth / 2) + 30;

        ctx.beginPath();
        ctx.moveTo(cx - halfWireSpan, wire1Y);
        ctx.lineTo(cx + halfWireSpan, wire1Y);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(cx - halfWireSpan, wire2Y);
        ctx.lineTo(cx + halfWireSpan, wire2Y);
        ctx.stroke();

        // Vẽ các dây chữ V siêu mảnh giữ từng cặp học sinh
        ctx.lineWidth = 0.6;
        ctx.strokeStyle = `rgba(255, 255, 255, ${pAlpha * 0.8})`;
        pendulumGeom.strings.forEach((str) => {
          const targetNode = transformed.find((t) => t.idx === str.avatarIdx);
          if (targetNode) {
            ctx.beginPath();
            ctx.moveTo(cx + str.apexX, cy + str.apexY);
            ctx.lineTo(targetNode.projX, targetNode.projY);
            ctx.stroke();

            // Chấm mờ nhỏ tại điểm đỉnh
            ctx.fillStyle = `rgba(255, 255, 255, ${pAlpha * 1.2})`;
            ctx.beginPath();
            ctx.arc(cx + str.apexX, cy + str.apexY, 1.2, 0, Math.PI * 2);
            ctx.fill();
          }
        });

        // Hiệu ứng tia sáng va chạm (Clack Sparkle) khi 2 bạn đung đưa va vào nhau
        if (pendulumGeom.impactPoints && pendulumGeom.impactPoints.length > 0) {
          pendulumGeom.impactPoints.forEach((imp) => {
            const sparkAlpha = Math.min(1.0, imp.intensity * (pAlpha / baseAlpha) * 1.5);
            if (sparkAlpha > 0.05) {
              const px = cx + imp.x;
              const py = cy + imp.y;

              // Vầng hào quang sáng ấm nơi hai bạn chạm khít vào nhau
              const grad = ctx.createRadialGradient(px, py, 0, px, py, 18 * imp.intensity);
              grad.addColorStop(0, `rgba(255, 245, 160, ${sparkAlpha * 0.95})`);
              grad.addColorStop(0.4, `rgba(255, 210, 80, ${sparkAlpha * 0.45})`);
              grad.addColorStop(1, 'rgba(255, 210, 80, 0)');
              ctx.fillStyle = grad;
              ctx.beginPath();
              ctx.arc(px, py, 18 * imp.intensity, 0, Math.PI * 2);
              ctx.fill();

              // Điểm sáng trung tâm lấp lánh
              ctx.fillStyle = `rgba(255, 255, 255, ${sparkAlpha * 1.1})`;
              ctx.beginPath();
              ctx.arc(px, py, 2.5 * imp.intensity, 0, Math.PI * 2);
              ctx.fill();
            }
          });
        }
      }

      // 3B. Lượn Sóng: Đường sóng mảnh và mờ
      if (isSpinning && weights.wave > 0.04) {
        const wAlpha = baseAlpha * weights.wave;
        ctx.strokeStyle = `rgba(255, 255, 255, ${wAlpha * 0.85})`;
        ctx.lineWidth = 0.75;
        ctx.setLineDash([4, 6]);
        ctx.lineDashOffset = -timestamp * 0.02;

        const waveSpanX = width * (0.45 + density * 0.38);
        const waveAmpY = height * (0.08 + density * 0.08);
        const startX = -waveSpanX / 2;

        [-height * 0.12, height * 0.12].forEach((offsetY, wIdx) => {
          ctx.beginPath();
          for (let step = 0; step <= 80; step++) {
            const px = startX + (step / 80) * waveSpanX;
            const phase =
              (px / width) * Math.PI * 2.0 * 2 - timestamp * 0.001 + wIdx * Math.PI * 0.5;
            const py = Math.sin(phase) * waveAmpY + offsetY;
            if (step === 0) ctx.moveTo(cx + px, cy + py);
            else ctx.lineTo(cx + px, cy + py);
          }
          ctx.stroke();
        });
        ctx.setLineDash([]);
      }

      // 3C. Vòng Số 8 Vô Cực: Nét mảnh và mờ
      if (isSpinning && weights.infinity > 0.04) {
        const infAlpha = baseAlpha * weights.infinity;
        ctx.strokeStyle = `rgba(255, 255, 255, ${infAlpha * 0.85})`;
        ctx.lineWidth = 0.75;
        ctx.setLineDash([4, 6]);
        ctx.lineDashOffset = -timestamp * 0.03;

        const spanX = Math.min(width * 0.40, 160 + density * 180);
        const spanY = Math.min(height * 0.32, 100 + density * 120);
        ctx.beginPath();
        for (let i = 0; i <= 100; i++) {
          const t = (i / 100) * Math.PI * 2;
          const denom = 1 + Math.sin(t) * Math.sin(t);
          const px = (Math.cos(t) / denom) * spanX;
          const py = ((Math.sin(t) * Math.cos(t)) / denom) * spanY * 2.1;
          if (i === 0) ctx.moveTo(cx + px, cy + py);
          else ctx.lineTo(cx + px, cy + py);
        }
        ctx.closePath();
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // 3D. Xoáy Ốc Thiên Hà: Nét mảnh, mờ và XOAY VÒNG VÒNG ĐỒNG BỘ CÙNG HỌC SINH
      if (isSpinning && weights.galaxy > 0.04) {
        const gAlpha = baseAlpha * weights.galaxy;
        ctx.strokeStyle = `rgba(255, 255, 255, ${gAlpha * 0.85})`;
        ctx.lineWidth = 0.75;
        ctx.setLineDash([3, 5]);
        ctx.lineDashOffset = -timestamp * 0.04;

        const maxRadius = Math.min(width, height) * (0.28 + density * 0.16);
        const spinSpeed = 1.15 + (1 - spinProgress) * 0.22;
        const spinTravel = timestamp * 0.0032 * Math.min(2.4, spinSpeed * 1.35);

        for (let arm = 0; arm < 2; arm++) {
          ctx.beginPath();
          for (let step = 0; step <= 70; step++) {
            const prog = step / 70;
            const theta = prog * Math.PI * 3.4 + arm * Math.PI + spinTravel;
            const r = maxRadius * 0.22 + prog * maxRadius * 0.74;
            const px = Math.cos(theta) * r;
            const py = Math.sin(theta) * (r * 0.72);
            if (step === 0) ctx.moveTo(cx + px, cy + py);
            else ctx.lineTo(cx + px, cy + py);
          }
          ctx.stroke();
        }
        ctx.setLineDash([]);
      }
      ctx.restore();

      // ==========================================
      // 4. DRAW AVATARS (Clean, Vibrant & Bouncing)
      // ==========================================
      transformed.sort((a, b) => b.z - a.z);

      // Save projected positions for click-selection
      projectedStudentsRef.current = transformed.map((t) => ({
        student: t.student,
        projX: t.projX,
        projY: t.projY,
        avatarSize: Math.max(38, Math.min(68, 52 * t.scale)),
      }));

      transformed.forEach(({ student, projX, projY, scale }) => {
        const avatarSize = Math.max(38, Math.min(68, 52 * scale));
        const colorPalette = [
          '#ec4899', // Pink
          '#06b6d4', // Cyan
          '#eab308', // Yellow
          '#10b981', // Green
          '#8b5cf6', // Purple
          '#f97316', // Orange
          '#3b82f6', // Blue
        ];
        const ringColor =
          student.color || colorPalette[Math.abs(student.name.charCodeAt(0)) % colorPalette.length];

        ctx.save();
        ctx.translate(projX, projY);

        // Soft drop shadow
        ctx.shadowColor = 'rgba(0, 0, 0, 0.28)';
        ctx.shadowBlur = 10;
        ctx.shadowOffsetY = 4;

        // Outer colorful ring
        ctx.beginPath();
        ctx.arc(0, 0, avatarSize / 2 + 3.5, 0, Math.PI * 2);
        ctx.fillStyle = ringColor;
        ctx.fill();

        // Inner clean white ring divider
        ctx.beginPath();
        ctx.arc(0, 0, avatarSize / 2 + 1, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();

        ctx.shadowColor = 'transparent';

        // Clip circular photo
        ctx.beginPath();
        ctx.arc(0, 0, avatarSize / 2, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();

        const cachedImg = imageCache.current.get(student.id);
        if (cachedImg && cachedImg.complete && cachedImg.naturalWidth > 0) {
          ctx.drawImage(
            cachedImg,
            -avatarSize / 2,
            -avatarSize / 2,
            avatarSize,
            avatarSize
          );
        } else {
          // Fallback Initials
          ctx.fillStyle = ringColor;
          ctx.fillRect(-avatarSize / 2, -avatarSize / 2, avatarSize, avatarSize);
          ctx.fillStyle = '#ffffff';
          ctx.font = `bold ${Math.round(avatarSize * 0.44)}px "Plus Jakarta Sans", sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(getInitials(student.name), 0, 1);
        }

        ctx.restore();

        // Draw Name Badge underneath avatar (Clean, legible pill)
        ctx.save();
        ctx.translate(projX, projY + avatarSize / 2 + 14);

        const shortName = getShortName(student.name);
        const fontSize = Math.max(11, Math.min(14, 12 * scale));
        ctx.font = `bold ${fontSize}px "Plus Jakarta Sans", sans-serif`;
        const textWidth = ctx.measureText(shortName).width;

        const padX = 7;
        const padY = 3.5;
        const badgeW = textWidth + padX * 2;
        const badgeH = fontSize + padY * 2;

        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
        ctx.beginPath();
        ctx.roundRect(-badgeW / 2, -badgeH / 2, badgeW, badgeH, 6);
        ctx.fill();

        ctx.strokeStyle = ringColor;
        ctx.lineWidth = 1.2;
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(shortName, 0, 0.5);

        ctx.restore();
      });
    },
    [
      activeStudents,
      bgTheme,
      centerWinner,
      getStudentCoordinates,
      isSpinning,
    ]
  );

  // Main animation frame loop: SILKY SMOOTH CONTINUOUS NON-STOP FLOW
  useEffect(() => {
    let animId: number;

    const loop = (timestamp: number) => {
      const rot = rotationRef.current;
      const spin = spinAnimRef.current;

      if (isSpinning) {
        if (!spin.startTime) spin.startTime = timestamp;
        const elapsed = timestamp - spin.startTime;
        const progress = Math.min(1, elapsed / spin.duration);
        spin.progress = progress;
        const eased = easeOutQuart(progress);

        // Continuous silky smooth spin without any pauses
        rot.ry = spin.startRot + (spin.targetRot - spin.startRot) * eased;
        rot.rx = 0.10 + Math.sin(progress * Math.PI) * 0.05;

        // Finish spin: Stop music, sound fanfare, spotlight winner
        if (progress >= 1) {
          setIsSpinning(false);
          sound.stopBgMusic();
          sound.playFanfare();

          if (spin.winner) {
            setCenterWinner(spin.winner);
            onSelectWinner(spin.winner);
          }
        }
      } else if (!rot.isDragging) {
        // Idle gentle drift
        rot.ry += rot.vy;
      }

      render(timestamp);
      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [isSpinning, onSelectWinner, render]);

  // Trigger Spin with custom user-entered duration
  const startSpin = () => {
    if (isSpinning || activeStudents.length === 0) return;

    setCenterWinner(null);
    setIsSpinning(true);

    // Upbeat joyful game music non-stop
    sound.startBgMusic();

    const rot = rotationRef.current;
    const spin = spinAnimRef.current;
    spin.startTime = 0;

    const validSec = Math.max(3, Math.min(120, customDuration || 10));
    const durationMs = validSec * 1000;
    spin.duration = durationMs;

    // Tăng tốc độ quay thêm một chút, thêm vòng quay hào hứng và nhịp nhàng
    const fullTurns = Math.max(2, Math.round(validSec * 0.18));

    const total = activeStudents.length;
    const winnerIdx = Math.floor(Math.random() * total);
    const winner = activeStudents[winnerIdx];
    spin.winner = winner;
    spin.winnerIdx = winnerIdx;

    spin.startRot = rot.ry;
    spin.targetRot = rot.ry + Math.PI * 2 * fullTurns;
  };

  // Interactive mouse/touch drag
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isSpinning) return;
    rotationRef.current.isDragging = true;
    rotationRef.current.dragDistance = 0;
    rotationRef.current.lastMouseX = e.clientX;
    rotationRef.current.lastMouseY = e.clientY;
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isSpinning || !rotationRef.current.isDragging) return;
    const rot = rotationRef.current;
    const dx = e.clientX - rot.lastMouseX;
    const dy = e.clientY - rot.lastMouseY;

    rot.dragDistance += Math.hypot(dx, dy);
    rot.ry += dx * 0.007;
    rot.rx += dy * 0.007;

    rot.lastMouseX = e.clientX;
    rot.lastMouseY = e.clientY;
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rot = rotationRef.current;
    rot.isDragging = false;

    if (rot.dragDistance < 6 && !isSpinning) {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      for (let i = projectedStudentsRef.current.length - 1; i >= 0; i--) {
        const item = projectedStudentsRef.current[i];
        const dist = Math.hypot(mouseX - item.projX, mouseY - item.projY);
        if (dist <= item.avatarSize / 2 + 10) {
          sound.playTick(1.2);
          setCenterWinner(item.student);
          onSelectWinner(item.student);
          break;
        }
      }
    }
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (isSpinning || e.touches.length === 0) return;
    rotationRef.current.isDragging = true;
    rotationRef.current.dragDistance = 0;
    rotationRef.current.lastMouseX = e.touches[0].clientX;
    rotationRef.current.lastMouseY = e.touches[0].clientY;
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (isSpinning || !rotationRef.current.isDragging || e.touches.length === 0) return;
    const rot = rotationRef.current;
    const dx = e.touches[0].clientX - rot.lastMouseX;
    const dy = e.touches[0].clientY - rot.lastMouseY;

    rot.dragDistance += Math.hypot(dx, dy);
    rot.ry += dx * 0.008;
    rot.rx += dy * 0.008;

    rot.lastMouseX = e.touches[0].clientX;
    rot.lastMouseY = e.touches[0].clientY;
  };

  const handleTouchEnd = () => {
    rotationRef.current.isDragging = false;
  };

  // Precise Container ResizeObserver: Guarantees 0-scroll viewport fitting
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateCanvasSize = () => {
      const canvas = canvasRef.current;
      if (!canvas || !container) return;

      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w <= 0 || h <= 0) return;

      const dpr = window.devicePixelRatio || 1;

      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;

      const ctx = canvas.getContext('2d');
      if (ctx) ctx.scale(dpr, dpr);

      render();
    };

    const ro = new ResizeObserver(() => {
      updateCanvasSize();
    });
    ro.observe(container);
    updateCanvasSize();

    return () => ro.disconnect();
  }, [render]);

  return (
    <div
      className={
        isExpanded
          ? 'fixed inset-0 z-50 bg-slate-950 p-2 sm:p-4 flex flex-col justify-between overflow-hidden select-none animate-fade-in'
          : 'flex-1 min-h-0 flex flex-col w-full h-full justify-between overflow-hidden select-none'
      }
    >
      {/* Top Bar: Clean & Minimal */}
      <div className="shrink-0 flex items-center justify-end w-full px-1 mb-1.5 gap-2">
        {/* Right side: Theme toggle, Student Count, Fullscreen & Reset */}
        <div className="flex items-center gap-2">
          {/* Background Theme Switcher */}
          <button
            onClick={() => {
              if (bgTheme === 'space') setBgTheme('vibrant');
              else if (bgTheme === 'vibrant') setBgTheme('purple');
              else setBgTheme('space');
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-white text-slate-700 hover:bg-slate-50 border border-slate-200 rounded-xl shadow-xs transition-colors cursor-pointer"
            title="Đổi màu nền (Vũ Trụ 3D / Xanh Tươi Sáng / Tím Hồng)"
          >
            <Palette size={13} className="text-cyan-500" />
            <span className="hidden sm:inline">
              {bgTheme === 'space'
                ? 'Nền Vũ Trụ 3D'
                : bgTheme === 'vibrant'
                ? 'Nền Xanh Tươi Sáng'
                : 'Nền Tím Hồng'}
            </span>
          </button>

          <div className="flex items-center gap-2 text-xs font-medium text-slate-600 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-xs">
            <Users size={14} className="text-indigo-600" />
            <span className="hidden sm:inline">Học sinh:</span>
            <strong className="font-bold text-slate-900 font-mono tabular-nums">
              {activeStudents.length} / {students.length}
            </strong>
          </div>

          {/* Toggle Expand Viewport Button */}
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 text-slate-600 hover:text-indigo-600 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-colors cursor-pointer shadow-xs"
            title={isExpanded ? 'Thu nhỏ cửa sổ' : 'Mở rộng toàn màn hình'}
          >
            {isExpanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>

          {/* Reset called students */}
          <button
            type="button"
            onClick={onResetCalled}
            disabled={isSpinning || activeStudents.length === students.length}
            className="p-1.5 text-slate-500 hover:text-indigo-600 disabled:opacity-40 disabled:hover:text-slate-500 bg-white border border-slate-200 rounded-xl transition-colors cursor-pointer shadow-xs"
            title="Đặt lại tất cả học sinh chưa gọi"
          >
            <RotateCcw size={15} />
          </button>
        </div>
      </div>

      {/* Main Canvas Space Container */}
      <div
        ref={containerRef}
        className="relative flex-1 min-h-0 w-full rounded-2xl overflow-hidden shadow-inner cursor-grab active:cursor-grabbing border border-slate-200"
      >
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          className="absolute inset-0 block w-full h-full"
        />

        {/* CENTER WINNER SPOTLIGHT MODAL */}
        {centerWinner && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center animate-fade-in">
            <div className="pointer-events-auto bg-slate-900/90 border-2 border-amber-400 p-5 sm:p-6 rounded-3xl shadow-2xl backdrop-blur-md flex flex-col items-center gap-3 max-w-xs sm:max-w-sm text-center animate-scale-up">
              <div className="flex items-center gap-1.5 text-amber-400 font-extrabold text-xs uppercase tracking-wider">
                <Trophy size={16} className="animate-bounce" />
                <span>Học Sinh Được Chọn!</span>
              </div>

              {/* Large Spotlight Avatar */}
              <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-full p-1 bg-gradient-to-tr from-amber-400 via-pink-500 to-indigo-500 shadow-xl">
                <div className="w-full h-full rounded-full overflow-hidden bg-slate-800 flex items-center justify-center">
                  {centerWinner.avatar ? (
                    <img
                      src={centerWinner.avatar}
                      alt={centerWinner.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div
                      className="w-full h-full flex items-center justify-center font-bold text-white text-3xl"
                      style={{ backgroundColor: centerWinner.color || '#3b82f6' }}
                    >
                      {getInitials(centerWinner.name)}
                    </div>
                  )}
                </div>
                <div className="absolute -bottom-1 -right-1 p-1 bg-amber-400 text-slate-950 rounded-full shadow-md">
                  <CheckCircle2 size={18} />
                </div>
              </div>

              {/* Name & Class Info */}
              <div>
                <h4 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  {centerWinner.name}
                </h4>
                <div className="text-xs text-slate-300 font-medium mt-0.5">
                  <span>{centerWinner.className}</span>
                  {centerWinner.grade && <span> · {centerWinner.grade}</span>}
                </div>
              </div>

              {/* Recall button */}
              {onRecallStudent && (
                <button
                  type="button"
                  onClick={() => {
                    onRecallStudent(centerWinner);
                    setCenterWinner(null);
                  }}
                  className="mt-1 px-3 py-1.5 text-xs font-semibold text-amber-300 hover:text-white bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/40 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw size={12} />
                  <span>Hủy gọi</span>
                </button>
              )}

              {/* Close spotlight */}
              <button
                type="button"
                onClick={() => setCenterWinner(null)}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                title="Đóng tiêu điểm để xem toàn cảnh"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Action Controls: Custom Duration Input + Play Button */}
      <div className="shrink-0 mt-1.5 flex flex-wrap items-center justify-center gap-2.5 py-0.5">
        <button
          disabled={isSpinning || activeStudents.length === 0}
          onClick={startSpin}
          className={`px-5 py-2 rounded-xl font-bold text-xs sm:text-sm shadow-md tracking-wide flex items-center gap-2 transition-all transform active:scale-95 cursor-pointer ${
            isSpinning || activeStudents.length === 0
              ? 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none'
              : 'bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white hover:brightness-110 hover:shadow-lg'
          }`}
        >
          <Play size={16} className={isSpinning ? 'animate-spin' : ''} fill="currentColor" />
          <span>{isSpinning ? 'Đang quay...' : 'Quay Chọn Học Sinh'}</span>
        </button>

        {/* User-editable Duration Input + Presets */}
        <div className="flex items-center gap-1.5 text-xs text-slate-600 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-xs">
          <Sparkles size={14} className="text-indigo-500 shrink-0" />
          <span>Thời gian:</span>
          <input
            type="number"
            min={3}
            max={120}
            value={customDuration}
            onChange={(e) => {
              const val = parseInt(e.target.value, 10);
              if (!isNaN(val)) {
                setCustomDuration(Math.max(3, Math.min(120, val)));
              }
            }}
            disabled={isSpinning}
            className="w-14 px-1.5 py-0.5 text-center font-bold text-slate-800 bg-slate-50 border border-slate-300 rounded-lg outline-none focus:border-indigo-500 focus:bg-white text-xs cursor-pointer"
            title="Nhập số giây tùy chỉnh (từ 3 đến 120 giây)"
          />
          <span className="font-semibold text-slate-500">giây</span>

          {/* Quick presets (10s, 15s, 20s) */}
          <div className="flex items-center gap-1 ml-1 border-l border-slate-200 pl-2">
            {[10, 15, 20].map((sec) => (
              <button
                key={sec}
                type="button"
                disabled={isSpinning}
                onClick={() => setCustomDuration(sec)}
                className={`px-2 py-0.5 text-[11px] font-bold rounded-md transition-colors cursor-pointer ${
                  customDuration === sec
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {sec}s
              </button>
            ))}
          </div>
        </div>

        {/* Checkbox Không gọi trùng */}
        {onToggleNoRepeat && (
          <label className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white border border-slate-200 rounded-xl shadow-xs cursor-pointer select-none">
            <input
              type="checkbox"
              checked={noRepeat}
              onChange={(e) => onToggleNoRepeat(e.target.checked)}
              disabled={isSpinning}
              className="w-4 h-4 rounded text-purple-600 accent-purple-600 cursor-pointer"
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
