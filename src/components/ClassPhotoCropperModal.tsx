import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Student } from '../types';
import { saveToAppDB, getFromAppDB } from '../services/dataStorage';
import {
  Upload,
  ZoomIn,
  ZoomOut,
  Check,
  X,
  Users,
  AlertTriangle,
  Info,
  Maximize2,
  Hand,
  Crosshair,
  Minus,
  Plus,
  ArrowLeft,
  Search,
  Trash2,
  ArrowUp,
  ArrowDown,
  EyeOff,
  Eye,
} from 'lucide-react';

interface ClassPhotoCropperModalProps {
  isOpen: boolean;
  onClose: () => void;
  students: Student[];
  currentClass: string;
  onSaveAvatars: (assignedMap: Record<string, string>) => void;
}

interface AssignedPin {
  studentId: string;
  studentName: string;
  x: number; // in image natural coordinates
  y: number;
  radius: number;
  avatarUrl: string;
  labelPos?: 'top' | 'bottom';
}

export const ClassPhotoCropperModal: React.FC<ClassPhotoCropperModalProps> = ({
  isOpen,
  onClose,
  students,
  currentClass,
  onSaveAvatars,
}) => {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [imageNaturalSize, setImageNaturalSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const [circleRadius, setCircleRadius] = useState<number>(70); // in image pixels
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Tool mode: 'select' (target face circle + click to assign) or 'hand' (pan/move view)
  const [activeTool, setActiveTool] = useState<'select' | 'hand'>('select');

  // Name badge position setting: 'top' (above head - RECOMMENDED so it never covers front row students), 'bottom', 'compact', 'hidden'
  const [badgePosition, setBadgePosition] = useState<'top' | 'bottom' | 'compact' | 'hidden'>('top');

  // Map of studentId -> AssignedPin
  const [assignedPins, setAssignedPins] = useState<Record<string, AssignedPin>>({});

  // Menu popup state for selecting/changing student name
  const [menuState, setMenuState] = useState<{
    visible: boolean;
    screenX: number;
    screenY: number;
    imgX: number;
    imgY: number;
    existingStudentId?: string;
  }>({
    visible: false,
    screenX: 0,
    screenY: 0,
    imgX: 0,
    imgY: 0,
  });

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showAssignedStudents, setShowAssignedStudents] = useState<boolean>(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const reticleRef = useRef<HTMLDivElement | null>(null);
  const imageObjRef = useRef<HTMLImageElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Drag & Pan tracking refs
  const isMouseDownRef = useRef<boolean>(false);
  const isDraggingRef = useRef<boolean>(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const dragStartPanRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const panRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const rafIdRef = useRef<number | null>(null);

  // Filter students belonging to this class
  const classStudents = currentClass === 'ALL'
    ? students
    : students.filter((s) => s.className === currentClass);

  const assignedCount = Object.keys(assignedPins).length;

  // Sync pan ref
  useEffect(() => {
    panRef.current = pan;
  }, [pan]);

  // Load saved class photo & assigned pins from IndexedDB when modal opens
  useEffect(() => {
    if (!isOpen) return;
    const storageKey = `class_photo_${currentClass}`;
    getFromAppDB<{
      imageSrc: string;
      assignedPins: Record<string, AssignedPin>;
      circleRadius?: number;
    }>(storageKey).then((saved) => {
      if (saved && saved.imageSrc) {
        setImageSrc(saved.imageSrc);
        if (saved.assignedPins) {
          setAssignedPins(saved.assignedPins);
        }
        const img = new Image();
        img.src = saved.imageSrc;
        img.onload = () => {
          imageObjRef.current = img;
          setImageNaturalSize({ width: img.naturalWidth, height: img.naturalHeight });
          const defaultR = saved.circleRadius || Math.max(35, Math.min(180, Math.round(img.naturalWidth / 26)));
          setCircleRadius(defaultR);
        };
      }
    });
  }, [isOpen, currentClass]);

  // Persist class photo & pins to IndexedDB whenever they change
  useEffect(() => {
    if (!imageSrc) return;
    const storageKey = `class_photo_${currentClass}`;
    saveToAppDB(storageKey, {
      imageSrc,
      assignedPins,
      circleRadius,
    }).catch(() => {});
  }, [imageSrc, assignedPins, circleRadius, currentClass]);

  // Load image
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setImageSrc(dataUrl);

      const img = new Image();
      img.src = dataUrl;
      img.onload = () => {
        imageObjRef.current = img;
        setImageNaturalSize({ width: img.naturalWidth, height: img.naturalHeight });
        const defaultR = Math.max(35, Math.min(180, Math.round(img.naturalWidth / 26)));
        setCircleRadius(defaultR);
        setZoom(1);
        setPan({ x: 0, y: 0 });
      };
    };
    reader.readAsDataURL(file);
  };

  // Convert canvas viewport coords to image natural coords
  const canvasToImageCoords = useCallback(
    (canvasX: number, canvasY: number): { x: number; y: number } | null => {
      const canvas = canvasRef.current;
      if (!canvas || !imageObjRef.current) return null;

      const cx = canvas.width / 2;
      const cy = canvas.height / 2;
      const nw = imageNaturalSize.width;
      const nh = imageNaturalSize.height;

      const originX = cx + pan.x - (nw * zoom) / 2;
      const originY = cy + pan.y - (nh * zoom) / 2;

      const imgX = (canvasX - originX) / zoom;
      const imgY = (canvasY - originY) / zoom;

      if (imgX < 0 || imgX > nw || imgY < 0 || imgY > nh) return null;
      return { x: imgX, y: imgY };
    },
    [imageNaturalSize, pan, zoom]
  );

  // Redraw canvas
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Canvas dark background
    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const img = imageObjRef.current;
    if (!img) {
      ctx.fillStyle = '#94a3b8';
      ctx.font = 'bold 15px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Chưa có ảnh tập thể. Vui lòng tải ảnh cả lớp lên để bắt đầu.', canvas.width / 2, canvas.height / 2 - 10);
      ctx.font = '13px "Plus Jakarta Sans", sans-serif';
      ctx.fillStyle = '#64748b';
      ctx.fillText('Hỗ trợ ảnh chụp JPG, PNG chụp bằng điện thoại hoặc máy ảnh.', canvas.width / 2, canvas.height / 2 + 18);
      return;
    }

    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const nw = imageNaturalSize.width;
    const nh = imageNaturalSize.height;

    const drawW = nw * zoom;
    const drawH = nh * zoom;
    const drawX = cx + pan.x - drawW / 2;
    const drawY = cy + pan.y - drawH / 2;

    // Draw main photo
    ctx.drawImage(img, drawX, drawY, drawW, drawH);

    // 1. Draw already assigned pins
    Object.values(assignedPins).forEach((pin) => {
      const pinScreenX = drawX + pin.x * zoom;
      const pinScreenY = drawY + pin.y * zoom;
      const pinScreenR = pin.radius * zoom;

      ctx.save();

      // Clean subtle dashed circle guide
      ctx.beginPath();
      ctx.arc(pinScreenX, pinScreenY, pinScreenR, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
      ctx.lineWidth = 1.8;
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.setLineDash([]);

      // Subtle top-right check tag
      const angle = -Math.PI / 4;
      const badgeX = pinScreenX + Math.cos(angle) * pinScreenR;
      const badgeY = pinScreenY + Math.sin(angle) * pinScreenR;
      const badgeR = Math.max(9, Math.min(15, 11 * zoom));

      ctx.beginPath();
      ctx.arc(badgeX, badgeY, badgeR, 0, Math.PI * 2);
      ctx.fillStyle = '#0284c7'; // Sky blue check tag
      ctx.shadowColor = 'rgba(2, 132, 199, 0.6)';
      ctx.shadowBlur = 6;
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${Math.round(badgeR * 1.1)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('✓', badgeX, badgeY + 1);

      // Student name banner badge placement
      const effectivePos = pin.labelPos || badgePosition;

      if (effectivePos !== 'hidden') {
        const fontSize = Math.max(11, Math.min(15, 12 * zoom));
        ctx.font = `bold ${fontSize}px "Plus Jakarta Sans", sans-serif`;
        const textMetrics = ctx.measureText(pin.studentName);
        const textW = textMetrics.width;
        const badgePaddingX = 10;
        const badgeH = fontSize + 8;
        const bannerW = textW + badgePaddingX * 2;
        const bannerX = pinScreenX - bannerW / 2;

        let bannerY = 0;
        if (effectivePos === 'top') {
          // Position ABOVE the face circle (prevents covering student standing in front!)
          bannerY = pinScreenY - pinScreenR - badgeH - 6;

          // Connecting indicator line from banner to top of circle
          ctx.beginPath();
          ctx.moveTo(pinScreenX, bannerY + badgeH);
          ctx.lineTo(pinScreenX, pinScreenY - pinScreenR);
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        } else if (effectivePos === 'bottom') {
          // Position BELOW the face circle
          bannerY = pinScreenY + pinScreenR + 6;

          // Connecting indicator line from banner to bottom of circle
          ctx.beginPath();
          ctx.moveTo(pinScreenX, bannerY);
          ctx.lineTo(pinScreenX, pinScreenY + pinScreenR);
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        } else if (effectivePos === 'compact') {
          // Compact pill tag overlay
          bannerY = pinScreenY + pinScreenR * 0.4;
        }

        // Dark rounded pill banner with sky border
        ctx.beginPath();
        ctx.roundRect(bannerX, bannerY, bannerW, badgeH, 6);
        ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
        ctx.fill();
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1.5;
        ctx.shadowColor = 'rgba(56, 189, 248, 0.5)';
        ctx.shadowBlur = 6;
        ctx.stroke();

        // Text
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowBlur = 0;
        ctx.fillText(pin.studentName, pinScreenX, bannerY + badgeH / 2);
      }

      ctx.restore();
    });

    // 2. Draw active target reticle if selection menu popup is open
    if (menuState.visible) {
      const screenTargetX = drawX + menuState.imgX * zoom;
      const screenTargetY = drawY + menuState.imgY * zoom;
      const screenTargetR = circleRadius * zoom;

      ctx.save();
      ctx.beginPath();
      ctx.arc(screenTargetX, screenTargetY, screenTargetR, 0, Math.PI * 2);
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 3.5;
      ctx.shadowColor = 'rgba(56, 189, 248, 0.9)';
      ctx.shadowBlur = 14;
      ctx.stroke();

      // Center crosshair
      ctx.beginPath();
      ctx.moveTo(screenTargetX - 10, screenTargetY);
      ctx.lineTo(screenTargetX + 10, screenTargetY);
      ctx.moveTo(screenTargetX, screenTargetY - 10);
      ctx.lineTo(screenTargetX, screenTargetY + 10);
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }
  }, [assignedPins, badgePosition, circleRadius, imageNaturalSize, menuState, pan, zoom]);

  useEffect(() => {
    draw();
  }, [draw]);

  // Adjust canvas size to parent container
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;

      canvas.width = container.clientWidth;
      canvas.height = Math.max(380, Math.min(620, window.innerHeight * 0.65));
      draw();
    };

    if (isOpen) {
      setTimeout(handleResize, 60);
      window.addEventListener('resize', handleResize);
    }
    return () => window.removeEventListener('resize', handleResize);
  }, [isOpen, draw]);

  // Crop circular face from original image
  const cropFaceFromImage = (imgX: number, imgY: number, r: number): string => {
    const img = imageObjRef.current;
    if (!img) return '';

    const tempCanvas = document.createElement('canvas');
    const outSize = Math.max(140, r * 2);
    tempCanvas.width = outSize;
    tempCanvas.height = outSize;
    const ctx = tempCanvas.getContext('2d');
    if (!ctx) return '';

    ctx.beginPath();
    ctx.arc(outSize / 2, outSize / 2, outSize / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();

    const sx = imgX - r;
    const sy = imgY - r;
    const sDim = r * 2;

    ctx.drawImage(img, sx, sy, sDim, sDim, 0, 0, outSize, outSize);
    return tempCanvas.toDataURL('image/jpeg', 0.92);
  };

  // Select/change student from popup menu
  const handleAssignStudent = (student: Student) => {
    if (!menuState.visible) return;

    const croppedAvatar = cropFaceFromImage(menuState.imgX, menuState.imgY, circleRadius);

    setAssignedPins((prev) => {
      const next = { ...prev };
      next[student.id] = {
        studentId: student.id,
        studentName: student.name,
        x: menuState.imgX,
        y: menuState.imgY,
        radius: circleRadius,
        avatarUrl: croppedAvatar,
        labelPos: badgePosition === 'bottom' ? 'bottom' : 'top',
      };
      return next;
    });

    setMenuState((prev) => ({ ...prev, visible: false }));
    setSearchQuery('');
  };

  // Toggle individual pin label position (Top vs Bottom)
  const handleTogglePinLabelPos = (studentId: string) => {
    setAssignedPins((prev) => {
      const pin = prev[studentId];
      if (!pin) return prev;
      const nextPos = pin.labelPos === 'bottom' ? 'top' : 'bottom';
      return {
        ...prev,
        [studentId]: { ...pin, labelPos: nextPos },
      };
    });
  };

  // Remove pin assignment for a student
  const handleRemovePin = (studentId: string) => {
    setAssignedPins((prev) => {
      const next = { ...prev };
      delete next[studentId];
      return next;
    });
    setMenuState((prev) => ({ ...prev, visible: false }));
  };

  // Event handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button !== 0 && e.button !== 2) return;

    isMouseDownRef.current = true;
    isDraggingRef.current = false;
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    dragStartPanRef.current = { x: panRef.current.x, y: panRef.current.y };
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const currentCanvasX = e.clientX - rect.left;
    const currentCanvasY = e.clientY - rect.top;

    if (reticleRef.current) {
      if (
        activeTool === 'select' &&
        !isDraggingRef.current &&
        !menuState.visible &&
        imageObjRef.current
      ) {
        reticleRef.current.style.display = 'block';
        reticleRef.current.style.transform = `translate3d(${currentCanvasX}px, ${currentCanvasY}px, 0)`;
      } else {
        reticleRef.current.style.display = 'none';
      }
    }

    if (isMouseDownRef.current) {
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      const dist = Math.hypot(dx, dy);

      if (dist > 5) {
        isDraggingRef.current = true;
        if (reticleRef.current) {
          reticleRef.current.style.display = 'none';
        }

        panRef.current = {
          x: dragStartPanRef.current.x + dx,
          y: dragStartPanRef.current.y + dy,
        };

        if (rafIdRef.current === null) {
          rafIdRef.current = requestAnimationFrame(() => {
            setPan({ ...panRef.current });
            rafIdRef.current = null;
          });
        }

        if (menuState.visible) {
          setMenuState((prev) => ({ ...prev, visible: false }));
        }
      }
    }
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const wasDragging = isDraggingRef.current;
    isMouseDownRef.current = false;
    isDraggingRef.current = false;

    if (!wasDragging && imageObjRef.current) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const clickCanvasX = e.clientX - rect.left;
      const clickCanvasY = e.clientY - rect.top;

      const coords = canvasToImageCoords(clickCanvasX, clickCanvasY);
      if (coords) {
        const clickedPin = Object.values(assignedPins).find((p) => {
          const dist = Math.hypot(p.x - coords.x, p.y - coords.y);
          return dist <= p.radius * 1.2;
        });

        const containerRect = containerRef.current?.getBoundingClientRect();
        const relX = e.clientX - (containerRect?.left || 0);
        const relY = e.clientY - (containerRect?.top || 0);

        setSearchQuery('');
        setMenuState({
          visible: true,
          screenX: Math.min(relX, (containerRect?.width || 500) - 270),
          screenY: Math.min(relY, (containerRect?.height || 400) - 300),
          imgX: clickedPin ? clickedPin.x : coords.x,
          imgY: clickedPin ? clickedPin.y : coords.y,
          existingStudentId: clickedPin ? clickedPin.studentId : undefined,
        });

        if (reticleRef.current) {
          reticleRef.current.style.display = 'none';
        }
      }
    }
  };

  const handleMouseLeave = () => {
    isMouseDownRef.current = false;
    isDraggingRef.current = false;
    if (reticleRef.current) {
      reticleRef.current.style.display = 'none';
    }
  };

  const handleMouseEnter = () => {
    if (activeTool === 'select' && imageObjRef.current && !menuState.visible && reticleRef.current) {
      reticleRef.current.style.display = 'block';
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.15 : -0.15;
    setZoom((prev) => Math.max(0.35, Math.min(4.5, Number((prev + delta).toFixed(2)))));
  };

  const handleSave = () => {
    const avatarMap: Record<string, string> = {};
    Object.values(assignedPins).forEach((pin) => {
      avatarMap[pin.studentId] = pin.avatarUrl;
    });
    onSaveAvatars(avatarMap);
    onClose();
  };

  const handleResetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  if (!isOpen) return null;

  const screenDiameter = Math.round(circleRadius * 2 * zoom);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl w-full max-w-5xl shadow-2xl border border-slate-200 flex flex-col max-h-[95vh] overflow-hidden">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
              title="Quay lại"
            >
              <ArrowLeft size={16} /> Quay lại
            </button>

            <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl">
              <Users size={20} />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-800">
                Lấy ảnh từng học sinh từ ảnh tập thể cả lớp
              </h2>
              <p className="text-xs text-slate-500">
                Lớp đang chọn: <strong className="text-emerald-700">{currentClass}</strong> ({classStudents.length} học sinh)
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Quick Instructions banner */}
        <div className="px-5 py-2.5 bg-emerald-50/80 border-b border-emerald-100 flex items-start gap-2.5 text-xs text-emerald-950">
          <Info size={16} className="text-emerald-600 shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <strong>Mẹo hữu ích:</strong> Nếu lớp đứng nhiều hàng (hàng trước & hàng sau), đặt tên <strong>"⬆️ Trực quan: Trên đầu mặt"</strong> để nhãn tên không bao giờ che mặt học sinh đứng phía trước!
          </div>
        </div>

        {/* Toolbar controls */}
        <div className="px-5 py-2.5 border-b border-slate-200 bg-slate-50/90 flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Mode Switcher */}
          <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-2xs">
            <button
              onClick={() => setActiveTool('select')}
              className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTool === 'select'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
              title="Chế độ chọn mặt học sinh"
            >
              <Crosshair size={14} />
              <span>Vòng chọn mặt</span>
            </button>
            <button
              onClick={() => {
                setActiveTool('hand');
                if (reticleRef.current) reticleRef.current.style.display = 'none';
              }}
              className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTool === 'hand'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
              title="Chế độ bàn tay: giữ chuột kéo để di chuyển ảnh"
            >
              <Hand size={14} />
              <span>Bàn tay di chuyển</span>
            </button>
          </div>

          {/* BADGE POSITION CONTROLS (Tùy chọn vị trí tên tránh che mặt) */}
          <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-2xs">
            <span className="font-semibold text-slate-700 whitespace-nowrap text-xs px-1">Vị trí tên:</span>
            <button
              type="button"
              onClick={() => setBadgePosition('top')}
              className={`px-2.5 py-1 rounded-lg font-bold text-xs flex items-center gap-1 transition-all cursor-pointer ${
                badgePosition === 'top'
                  ? 'bg-sky-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
              title="Đặt nhãn tên PHÍA TRÊN ĐẦU (Khuyên dùng: Tránh che mặt học sinh đứng hàng trước)"
            >
              <ArrowUp size={13} />
              <span>Trên đầu mặt</span>
            </button>
            <button
              type="button"
              onClick={() => setBadgePosition('bottom')}
              className={`px-2.5 py-1 rounded-lg font-bold text-xs flex items-center gap-1 transition-all cursor-pointer ${
                badgePosition === 'bottom'
                  ? 'bg-sky-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
              title="Đặt nhãn tên phía dưới mặt"
            >
              <ArrowDown size={13} />
              <span>Dưới mặt</span>
            </button>
            <button
              type="button"
              onClick={() => setBadgePosition('hidden')}
              className={`px-2.5 py-1 rounded-lg font-bold text-xs flex items-center gap-1 transition-all cursor-pointer ${
                badgePosition === 'hidden'
                  ? 'bg-sky-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
              title="Ẩn tên hoàn toàn (Chỉ hiện dấu tích v xanh)"
            >
              <EyeOff size={13} />
              <span>Ẩn tên</span>
            </button>
          </div>

          {/* Circle size slider */}
          <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-xl border border-slate-200 shadow-2xs">
            <span className="font-semibold text-slate-700 whitespace-nowrap text-xs">Cỡ vòng:</span>

            <button
              type="button"
              onClick={() => setCircleRadius((r) => Math.max(20, r - 5))}
              className="w-6 h-6 rounded-lg bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 flex items-center justify-center font-bold transition-colors cursor-pointer"
              title="Giảm kích thước (-)"
            >
              <Minus size={13} />
            </button>

            <input
              type="range"
              min={20}
              max={250}
              value={circleRadius}
              onChange={(e) => setCircleRadius(Number(e.target.value))}
              className="w-20 sm:w-28 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
            />

            <button
              type="button"
              onClick={() => setCircleRadius((r) => Math.min(250, r + 5))}
              className="w-6 h-6 rounded-lg bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 flex items-center justify-center font-bold transition-colors cursor-pointer"
              title="Tăng kích thước (+)"
            >
              <Plus size={13} />
            </button>

            <span className="font-mono font-bold text-slate-800 text-xs min-w-[38px] text-right">
              {circleRadius * 2}px
            </span>
          </div>

          {/* Zoom controls */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setZoom((z) => Math.max(0.35, Number((z - 0.2).toFixed(2))))}
              className="p-1.5 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg text-slate-700 cursor-pointer"
              title="Thu nhỏ ảnh"
            >
              <ZoomOut size={15} />
            </button>
            <span className="font-mono text-xs font-semibold px-1 text-slate-600">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={() => setZoom((z) => Math.min(4.5, Number((z + 0.2).toFixed(2))))}
              className="p-1.5 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg text-slate-700 cursor-pointer"
              title="Phóng to ảnh"
            >
              <ZoomIn size={15} />
            </button>
            <button
              onClick={handleResetView}
              className="p-1.5 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg text-slate-700 cursor-pointer"
              title="Về kích thước mặc định"
            >
              <Maximize2 size={15} />
            </button>
          </div>

          {/* Counter & Upload */}
          <div className="flex items-center gap-2.5">
            <div className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg font-medium text-slate-700">
              Đã gán: <strong className="text-emerald-600 font-mono">{assignedCount}</strong> / {classStudents.length} em
            </div>

            <label className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer">
              <Upload size={14} />
              <span>{imageSrc ? 'Đổi ảnh cả lớp' : 'Tải ảnh cả lớp lên'}</span>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
          </div>
        </div>

        {/* Main Canvas Viewport */}
        <div
          ref={containerRef}
          className={`relative flex-1 bg-slate-950 overflow-hidden select-none ${
            activeTool === 'hand' ? 'cursor-grab' : 'cursor-crosshair'
          }`}
        >
          <canvas
            ref={canvasRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseLeave}
            onMouseEnter={handleMouseEnter}
            onWheel={handleWheel}
            className="w-full h-full block"
          />

          {/* Floating Reticle */}
          <div
            ref={reticleRef}
            style={{
              display: 'none',
              width: `${screenDiameter}px`,
              height: `${screenDiameter}px`,
              pointerEvents: 'none',
              willChange: 'transform',
            }}
            className="absolute top-0 left-0 -translate-x-1/2 -translate-y-1/2 z-10 transition-[width,height] duration-75"
          >
            <div className="w-full h-full rounded-full border-[3px] border-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.95)] relative flex items-center justify-center">
              <div className="absolute inset-1.5 rounded-full border border-white/50 border-dashed" />
              <div className="absolute w-4 h-0.5 bg-white/95 rounded-full shadow-xs" />
              <div className="absolute h-4 w-0.5 bg-white/95 rounded-full shadow-xs" />

              <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-lg bg-slate-900/95 border border-emerald-400 text-white text-[11px] font-bold whitespace-nowrap shadow-lg flex items-center gap-1">
                <span>Nhấp để chọn tên</span>
              </div>
            </div>
          </div>

          {/* Floating Student Selection Menu */}
          {menuState.visible && (
            <div
              style={{ left: `${menuState.screenX}px`, top: `${menuState.screenY}px` }}
              className="absolute z-20 w-72 max-h-80 bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-scale-up"
            >
              <div className="p-2.5 bg-sky-50 border-b border-sky-100 flex items-center justify-between text-xs font-extrabold text-sky-950">
                <span className="flex items-center gap-1">
                  <Check size={14} className="text-sky-600" />
                  <span>{menuState.existingStudentId ? 'Chọn lại tên học sinh:' : 'Chọn tên học sinh:'}</span>
                </span>
                <button
                  onClick={() => setMenuState((prev) => ({ ...prev, visible: false }))}
                  className="text-slate-400 hover:text-slate-600 cursor-pointer p-0.5"
                >
                  <X size={14} />
                </button>
              </div>

              {/* Search Bar Input */}
              <div className="p-1.5 bg-slate-50 border-b border-slate-200 flex items-center gap-1.5">
                <Search size={13} className="text-slate-400 shrink-0 ml-1" />
                <input
                  type="text"
                  placeholder="Gõ tên để tìm nhanh..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-transparent text-xs font-semibold text-slate-800 outline-none placeholder:text-slate-400"
                  autoFocus
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="text-slate-400 hover:text-slate-600 pr-1">
                    <X size={12} />
                  </button>
                )}
              </div>

              {/* Action for existing assigned pin */}
              {menuState.existingStudentId && (
                <div className="p-1.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-1">
                  <button
                    type="button"
                    onClick={() => handleTogglePinLabelPos(menuState.existingStudentId!)}
                    className="text-xs font-bold text-sky-700 bg-sky-50 hover:bg-sky-100 px-2 py-1 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
                    title="Đổi vị trí tên học sinh này giữa Phía trên và Phía dưới"
                  >
                    <span>
                      {assignedPins[menuState.existingStudentId]?.labelPos === 'bottom'
                        ? '⬆️ Đổi nhãn lên TRÊN'
                        : '⬇️ Đổi nhãn xuống DƯỚI'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleRemovePin(menuState.existingStudentId!)}
                    className="text-xs font-bold text-rose-600 hover:bg-rose-100 px-2 py-1 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <Trash2 size={13} />
                    <span>Xóa vị trí</span>
                  </button>
                </div>
              )}

              {/* Student List */}
              <div className="overflow-y-auto p-1.5 space-y-0.5 max-h-52 flex-1">
                {(() => {
                  const filtered = classStudents.filter((st) => {
                    if (searchQuery && !st.name.toLowerCase().includes(searchQuery.toLowerCase())) {
                      return false;
                    }
                    if (!searchQuery && !showAssignedStudents && !!assignedPins[st.id] && st.id !== menuState.existingStudentId) {
                      return false;
                    }
                    return true;
                  });

                  if (filtered.length === 0) {
                    return (
                      <div className="py-4 text-center text-xs text-slate-400 font-medium">
                        {searchQuery ? 'Không tìm thấy học sinh phù hợp' : 'Đã chọn hết tất cả học sinh trong lớp!'}
                      </div>
                    );
                  }

                  return filtered.map((st) => {
                    const isAssigned = !!assignedPins[st.id];
                    const isCurrentPin = st.id === menuState.existingStudentId;

                    return (
                      <button
                        key={st.id}
                        onClick={() => handleAssignStudent(st)}
                        className={`w-full px-2.5 py-1.5 text-left text-xs rounded-xl flex items-center justify-between transition-colors cursor-pointer ${
                          isCurrentPin
                            ? 'bg-sky-100 text-sky-900 font-bold border border-sky-300'
                            : isAssigned
                            ? 'bg-slate-100 text-slate-500 font-medium'
                            : 'hover:bg-slate-100 text-slate-800 font-bold'
                        }`}
                      >
                        <span className="truncate">{st.name}</span>
                        {isAssigned && (
                          <span className="text-[10px] bg-sky-100 text-sky-700 px-1.5 py-0.2 rounded font-mono shrink-0">
                            ✓ Có ảnh
                          </span>
                        )}
                      </button>
                    );
                  });
                })()}
              </div>

              {/* Toggle to show already assigned students */}
              {assignedCount > 0 && !searchQuery && (
                <label className="p-2 bg-slate-50 border-t border-slate-200 flex items-center gap-2 text-[11px] font-bold text-slate-600 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={showAssignedStudents}
                    onChange={(e) => setShowAssignedStudents(e.target.checked)}
                    className="rounded text-sky-600 accent-sky-600 cursor-pointer"
                  />
                  <span>Hiện cả các em đã được gán ({assignedCount})</span>
                </label>
              )}
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="px-5 py-3.5 border-t border-slate-200 bg-white flex items-center justify-between gap-3">
          <div className="text-xs text-slate-500 flex items-center gap-2">
            <span className="flex items-center gap-1 font-medium text-slate-600">
              <Hand size={13} className="text-slate-400" /> Giữ chuột trái & rê để di chuyển ảnh
            </span>
            <span>·</span>
            {assignedCount > 0 ? (
              <span className="text-emerald-700 font-bold">
                Đã gán {assignedCount} khuôn mặt. Bấm "Lưu tất cả ảnh" để áp dụng cho lớp.
              </span>
            ) : (
              <span>Chưa có ảnh nào được gán. Hãy nhấp vào khuôn mặt từng em.</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              Hủy bỏ
            </button>
            <button
              disabled={assignedCount === 0}
              onClick={handleSave}
              className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
            >
              <Check size={16} /> Lưu tất cả ảnh đã cắt ({assignedCount})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
