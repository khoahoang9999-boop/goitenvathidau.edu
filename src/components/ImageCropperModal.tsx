import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, ZoomIn, ZoomOut, RotateCw, Check, Upload, Move, ArrowLeft, User, Trash2 } from 'lucide-react';
import { Student } from '../types';

interface ImageCropperModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCropComplete: (base64Avatar: string, targetStudentId?: string) => void;
  onDeletePhoto?: (studentId: string) => void;
  initialName?: string;
  students?: Student[];
  croppingStudentId?: string | null;
}

export const ImageCropperModal: React.FC<ImageCropperModalProps> = ({
  isOpen,
  onClose,
  onCropComplete,
  onDeletePhoto,
  initialName = 'Học sinh',
  students = [],
  croppingStudentId = null,
}) => {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [scale, setScale] = useState<number>(1);
  const [rotation, setRotation] = useState<number>(0);
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(croppingStudentId);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const imageObjRef = useRef<HTMLImageElement | null>(null);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setScale(1);
      setRotation(0);
      setPosition({ x: 0, y: 0 });
      setPreviewDataUrl(null);
      setSelectedStudentId(croppingStudentId);
    }
  }, [isOpen, croppingStudentId]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const src = event.target?.result as string;
      setImageSrc(src);

      const img = new Image();
      img.onload = () => {
        imageObjRef.current = img;
        setScale(1);
        setRotation(0);
        setPosition({ x: 0, y: 0 });
        drawCanvas();
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  };

  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;
    const circleRadius = 140; // 280px diameter circle

    ctx.clearRect(0, 0, width, height);

    // If image is loaded, draw image transformed
    if (imageObjRef.current) {
      const img = imageObjRef.current;
      ctx.save();
      ctx.translate(centerX + position.x, centerY + position.y);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.scale(scale, scale);

      // Fit image reasonably
      const maxDim = Math.max(img.width, img.height);
      const initialFitScale = (circleRadius * 2.4) / maxDim;
      const renderW = img.width * initialFitScale;
      const renderH = img.height * initialFitScale;

      ctx.drawImage(img, -renderW / 2, -renderH / 2, renderW, renderH);
      ctx.restore();
    } else {
      // Empty placeholder
      ctx.fillStyle = '#f1f5f9';
      ctx.fillRect(0, 0, width, height);
    }

    // Draw dark overlay with circular hole
    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.65)';
    ctx.beginPath();
    ctx.rect(0, 0, width, height);
    ctx.arc(centerX, centerY, circleRadius, 0, Math.PI * 2, true);
    ctx.fill();

    // Circular crop border
    ctx.beginPath();
    ctx.arc(centerX, centerY, circleRadius, 0, Math.PI * 2);
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#38bdf8'; // Sky blue border
    ctx.stroke();

    // Grid lines inside the crop circle
    ctx.save();
    ctx.beginPath();
    ctx.arc(centerX, centerY, circleRadius, 0, Math.PI * 2);
    ctx.clip();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = 1;

    // Rule of thirds lines
    const third = (circleRadius * 2) / 3;
    ctx.beginPath();
    ctx.moveTo(centerX - circleRadius + third, centerY - circleRadius);
    ctx.lineTo(centerX - circleRadius + third, centerY + circleRadius);
    ctx.moveTo(centerX - circleRadius + third * 2, centerY - circleRadius);
    ctx.lineTo(centerX - circleRadius + third * 2, centerY + circleRadius);
    ctx.moveTo(centerX - circleRadius, centerY - circleRadius + third);
    ctx.lineTo(centerX + circleRadius, centerY - circleRadius + third);
    ctx.moveTo(centerX - circleRadius, centerY - circleRadius + third * 2);
    ctx.lineTo(centerX + circleRadius, centerY - circleRadius + third * 2);
    ctx.stroke();

    ctx.restore();
    ctx.restore();

    // Update small preview
    generatePreview();
  }, [position, rotation, scale]);

  // Update canvas on parameter changes
  useEffect(() => {
    drawCanvas();
  }, [drawCanvas, imageSrc, scale, rotation, position]);

  const generatePreview = () => {
    if (!imageObjRef.current) return;
    const previewCanvas = document.createElement('canvas');
    previewCanvas.width = 120;
    previewCanvas.height = 120;
    const pCtx = previewCanvas.getContext('2d');
    if (!pCtx) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const circleRadius = 140;

    // Circular clip
    pCtx.beginPath();
    pCtx.arc(60, 60, 60, 0, Math.PI * 2);
    pCtx.clip();

    // Draw from source canvas centered at crop circle
    pCtx.drawImage(
      canvas,
      centerX - circleRadius,
      centerY - circleRadius,
      circleRadius * 2,
      circleRadius * 2,
      0,
      0,
      120,
      120
    );

    setPreviewDataUrl(previewCanvas.toDataURL('image/png'));
  };

  // Drag handling
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!imageSrc) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Touch handling for tablets / interactive displays
  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!imageSrc || e.touches.length === 0) return;
    const touch = e.touches[0];
    setIsDragging(true);
    setDragStart({ x: touch.clientX - position.x, y: touch.clientY - position.y });
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDragging || e.touches.length === 0) return;
    const touch = e.touches[0];
    setPosition({
      x: touch.clientX - dragStart.x,
      y: touch.clientY - dragStart.y,
    });
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.1 : -0.1;
    setScale((prev) => Math.min(Math.max(0.4, prev + delta), 3.5));
  };

  const handleConfirmCrop = () => {
    const canvas = canvasRef.current;
    if (!canvas || !imageObjRef.current) return;

    // High-resolution export (256x256)
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = 256;
    exportCanvas.height = 256;
    const eCtx = exportCanvas.getContext('2d');
    if (!eCtx) return;

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const circleRadius = 140;

    // Crisp anti-aliased circular clip
    eCtx.imageSmoothingEnabled = true;
    eCtx.imageSmoothingQuality = 'high';
    eCtx.beginPath();
    eCtx.arc(128, 128, 128, 0, Math.PI * 2);
    eCtx.closePath();
    eCtx.clip();

    // Source coordinates on the main canvas
    eCtx.drawImage(
      canvas,
      centerX - circleRadius,
      centerY - circleRadius,
      circleRadius * 2,
      circleRadius * 2,
      0,
      0,
      256,
      256
    );

    const base64 = exportCanvas.toDataURL('image/png', 0.95);
    onCropComplete(base64, selectedStudentId || undefined);
    onClose();
  };

  if (!isOpen) return null;

  const activeStudentName = students.find((s) => s.id === selectedStudentId)?.name || initialName;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/75 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full overflow-hidden border border-slate-200">
        {/* Header with Quay lại button & Student Selector */}
        <div className="flex flex-col gap-2.5 px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {imageSrc ? (
                <button
                  type="button"
                  onClick={() => setImageSrc(null)}
                  className="px-3 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
                  title="Quay lại chọn ảnh khác"
                >
                  <ArrowLeft size={16} /> Quay lại
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
                  title="Quay lại"
                >
                  <ArrowLeft size={16} /> Quay lại
                </button>
              )}
              <div>
                <h3 className="text-base font-extrabold text-slate-800">Cắt ảnh đại diện tròn</h3>
                <p className="text-xs text-slate-500">Đang cắt ảnh cho: <strong className="text-sky-700 font-bold">{activeStudentName}</strong></p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
            >
              <X size={20} />
            </button>
          </div>

          {/* Student Selector Dropdown: Cho phép chọn lại tên học sinh khi cắt ảnh */}
          {students && students.length > 0 && (
            <div className="flex items-center gap-2 bg-sky-50 px-3 py-1.5 rounded-xl border border-sky-200">
              <User size={15} className="text-sky-600 shrink-0" />
              <span className="text-xs font-extrabold text-sky-900 whitespace-nowrap">Chọn lại học sinh:</span>
              <select
                value={selectedStudentId || ''}
                onChange={(e) => setSelectedStudentId(e.target.value)}
                className="w-full bg-white border border-sky-300 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-sky-400 cursor-pointer"
              >
                {students.map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.name} ({st.className}) {st.avatar ? '✓ Đã có ảnh' : ''}
                  </option>
                ))}
              </select>
              {selectedStudentId && students.find((s) => s.id === selectedStudentId)?.avatar && onDeletePhoto && (
                <button
                  type="button"
                  onClick={() => {
                    onDeletePhoto(selectedStudentId);
                    onClose();
                  }}
                  className="px-2.5 py-1 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg shrink-0 flex items-center gap-1 cursor-pointer transition-colors"
                  title="Xóa ảnh chân dung hiện tại của học sinh này"
                >
                  <Trash2 size={12} />
                  <span>Xóa ảnh</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-4">
          {!imageSrc ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-sky-300 bg-sky-50/40 hover:bg-sky-50 rounded-xl p-10 flex flex-col items-center justify-center cursor-pointer transition-colors group"
            >
              <div className="w-16 h-16 rounded-full bg-sky-100 text-sky-600 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <Upload size={28} />
              </div>
              <p className="font-semibold text-slate-700 mb-1">Nhấp để chọn ảnh từ máy tính</p>
              <p className="text-xs text-slate-500">Hỗ trợ ảnh chân dung JPG, PNG, WebP</p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>
          ) : (
            <div className="space-y-4">
              {/* Canvas viewport */}
              <div className="relative mx-auto w-full max-w-[380px] aspect-square rounded-xl overflow-hidden shadow-inner bg-slate-950 flex items-center justify-center">
                <canvas
                  ref={canvasRef}
                  width={380}
                  height={380}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                  onTouchStart={handleTouchStart}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={handleTouchEnd}
                  onWheel={handleWheel}
                  className={`w-full h-full ${isDragging ? 'cursor-grabbing' : 'cursor-grab'} touch-none`}
                />
                <div className="absolute top-2 left-2 px-2.5 py-1 rounded bg-black/60 text-[11px] text-white/90 backdrop-blur-xs flex items-center gap-1.5 pointer-events-none">
                  <Move size={12} /> Kéo để di chuyển · Cuộn để thu phóng
                </div>
              </div>

              {/* Controls bar */}
              <div className="space-y-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                {/* Scale slider */}
                <div className="flex items-center gap-3">
                  <ZoomOut size={16} className="text-slate-500 shrink-0" />
                  <input
                    type="range"
                    min="0.5"
                    max="3.0"
                    step="0.05"
                    value={scale}
                    onChange={(e) => setScale(parseFloat(e.target.value))}
                    className="w-full accent-sky-600 cursor-pointer h-1.5 bg-slate-200 rounded-lg"
                  />
                  <ZoomIn size={16} className="text-slate-500 shrink-0" />
                  <span className="text-xs font-mono text-slate-600 w-10 text-right">
                    {Math.round(scale * 100)}%
                  </span>
                </div>

                {/* Auxiliary actions & Preview */}
                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setRotation((r) => (r + 90) % 360)}
                      className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 flex items-center gap-1.5"
                    >
                      <RotateCw size={14} /> Xoay 90°
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setScale(1);
                        setPosition({ x: 0, y: 0 });
                        setRotation(0);
                      }}
                      className="px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-100"
                    >
                      Đặt lại vị trí
                    </button>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-3 py-1.5 text-xs font-medium text-sky-700 bg-sky-50 border border-sky-200 rounded-lg hover:bg-sky-100"
                    >
                      Đổi ảnh khác
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </div>

                  {previewDataUrl && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500">Xem trước:</span>
                      <img
                        src={previewDataUrl}
                        alt="Preview"
                        className="w-10 h-10 rounded-full border-2 border-sky-500 shadow-sm object-cover"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors"
          >
            Hủy bỏ
          </button>
          <button
            type="button"
            disabled={!imageSrc}
            onClick={handleConfirmCrop}
            className="px-5 py-2 text-sm font-bold text-white bg-sky-600 hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl shadow-md hover:shadow-lg transition-all flex items-center gap-2"
          >
            <Check size={18} /> Cắt & Áp dụng
          </button>
        </div>
      </div>
    </div>
  );
};
