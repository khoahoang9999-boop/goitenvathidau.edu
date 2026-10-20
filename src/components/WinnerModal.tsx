import React, { useEffect, useRef, useState } from 'react';
import { Student } from '../types';
import { ConfettiEngine } from '../services/confetti';
import { sound } from '../services/sound';
import { getInitials } from '../utils/defaultData';
import { X, Sparkles, Clock, RotateCcw } from 'lucide-react';

interface WinnerModalProps {
  winner: Student | null;
  isOpen: boolean;
  onClose: () => void;
  onRecallStudent: (student: Student) => void;
  flyDuration?: number; // in seconds, default 2.0
  onUpdateFlyDuration?: (duration: number) => void;
}

export const WinnerModal: React.FC<WinnerModalProps> = ({
  winner,
  isOpen,
  onClose,
  onRecallStudent,
  flyDuration = 2.0,
  onUpdateFlyDuration,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const confettiEngineRef = useRef<ConfettiEngine | null>(null);

  // Animation phase: 'flying' -> 'landed'
  const [animationPhase, setAnimationPhase] = useState<'flying' | 'landed'>('flying');

  useEffect(() => {
    if (isOpen && winner) {
      setAnimationPhase('flying');
      // Play celebratory sound
      sound.playFanfare();

      // After fly duration, transition to landed state and fire massive confetti
      const timer = setTimeout(() => {
        setAnimationPhase('landed');
        if (canvasRef.current) {
          const engine = new ConfettiEngine(canvasRef.current);
          confettiEngineRef.current = engine;
          engine.resize();
          engine.fireCelebration(300);

          setTimeout(() => {
            engine.fireCelebration(200);
          }, 800);
        }
      }, flyDuration * 1000 * 0.7);

      return () => clearTimeout(timer);
    }
  }, [isOpen, winner, flyDuration]);

  // Handle window resize for confetti canvas
  useEffect(() => {
    const handleResize = () => {
      confettiEngineRef.current?.resize();
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (!isOpen || !winner) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center select-none overflow-hidden animate-fade-in">
      {/* 
        Vibrant Gradient Background 
        Matching reference screenshot: Violet / Magenta -> Sunset Orange -> Golden Yellow 
      */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#9333ea] via-[#ec4899] to-[#f59e0b]" />

      {/* Floating ambient lights and decorative glows */}
      <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-white/20 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-amber-400/30 blur-3xl pointer-events-none" />

      {/* Confetti canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none z-20 w-full h-full" />

      {/* Top Bar with Fly Duration setting & Close Button */}
      <div className="absolute top-4 right-4 z-40 flex items-center gap-3">
        {/* Fly Duration Selector */}
        {onUpdateFlyDuration && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/25 backdrop-blur-md text-white text-xs font-semibold border border-white/20 shadow-lg">
            <Clock size={13} className="text-amber-300" />
            <span className="hidden sm:inline">Thời gian bay:</span>
            <select
              value={flyDuration}
              onChange={(e) => onUpdateFlyDuration(Number(e.target.value))}
              className="bg-transparent text-white font-bold outline-none cursor-pointer"
            >
              <option value={1.0} className="text-slate-900">1.0s (Nhanh)</option>
              <option value={1.5} className="text-slate-900">1.5s</option>
              <option value={2.0} className="text-slate-900">2.0s (Chuẩn)</option>
              <option value={2.5} className="text-slate-900">2.5s</option>
              <option value={3.0} className="text-slate-900">3.0s (Kịch tính)</option>
            </select>
          </div>
        )}

        {/* Circular Close Button (as shown in reference screenshot) */}
        <button
          onClick={onClose}
          className="w-10 h-10 rounded-full bg-black/30 hover:bg-black/50 text-white flex items-center justify-center transition-all backdrop-blur-md border border-white/25 shadow-xl hover:scale-105 active:scale-95"
          title="Đóng màn hình"
        >
          <X size={22} />
        </button>
      </div>

      {/* 
        Starting Origin Thumbnail (Bottom Right Corner)
        As in reference image, showing origin while avatar zooms to center 
      */}
      <div className="absolute bottom-6 right-6 z-20 pointer-events-none opacity-40 hover:opacity-100 transition-opacity">
        <div className="w-16 h-16 rounded-full border-2 border-white/70 overflow-hidden shadow-2xl bg-white/20 backdrop-blur-xs flex items-center justify-center">
          {winner.avatar ? (
            <img src={winner.avatar} alt={winner.name} className="w-full h-full object-cover" />
          ) : (
            <span className="text-white font-black text-xl">{getInitials(winner.name)}</span>
          )}
        </div>
      </div>

      {/* 
        Center Flying & Zooming Avatar Container
        Smooth CSS translation and scale from bottom-right towards center 
      */}
      <div className="relative z-30 flex flex-col items-center justify-center p-4">
        {/* Animated Flying Avatar Circle */}
        <div
          style={{
            transition: `transform ${flyDuration}s cubic-bezier(0.16, 1, 0.3, 1), opacity ${flyDuration * 0.5}s ease-out`,
            transform: animationPhase === 'flying'
              ? 'translate(120px, 120px) scale(0.35)'
              : 'translate(0px, 0px) scale(1)',
          }}
          className="relative mb-6"
        >
          {/* Glowing Aura Ring */}
          <div className="absolute -inset-4 sm:-inset-6 rounded-full bg-white/50 blur-xl animate-pulse pointer-events-none" />

          {/* Main Round Frame (Exactly like reference image: 8px white border, round shadow) */}
          <div className="relative w-56 h-56 sm:w-72 sm:h-72 md:w-80 md:h-80 rounded-full border-[7px] sm:border-[9px] border-white shadow-[0_0_60px_rgba(255,255,255,0.7),0_25px_50px_rgba(0,0,0,0.35)] overflow-hidden flex items-center justify-center bg-slate-900/10">
            {winner.avatar ? (
              <img
                src={winner.avatar}
                alt={winner.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div
                className="w-full h-full flex items-center justify-center text-white font-black text-6xl sm:text-8xl"
                style={{ backgroundColor: winner.color || '#3b82f6' }}
              >
                {getInitials(winner.name)}
              </div>
            )}
          </div>
        </div>

        {/* 
          Big White Pill Student Name Badge 
          (Directly under avatar with bold text, exactly matching screenshot)
        */}
        <div
          style={{
            transition: `opacity ${flyDuration * 0.6}s ease-out ${flyDuration * 0.4}s, transform ${flyDuration * 0.6}s cubic-bezier(0.16, 1, 0.3, 1) ${flyDuration * 0.4}s`,
            opacity: animationPhase === 'landed' ? 1 : 0,
            transform: animationPhase === 'landed' ? 'translateY(0)' : 'translateY(24px)',
          }}
          className="flex flex-col items-center gap-2"
        >
          <div className="bg-white text-indigo-900 font-black text-2xl sm:text-3xl md:text-4xl px-8 sm:px-12 py-3 rounded-full shadow-[0_15px_35px_rgba(0,0,0,0.25)] tracking-wide border-2 border-white/80">
            {winner.name}
          </div>

          {/* Class Subtitle Badge */}
          {winner.className && (
            <div className="px-4 py-1 rounded-full bg-black/25 backdrop-blur-md text-white text-xs sm:text-sm font-bold border border-white/20 shadow-md">
              {winner.className} {winner.grade && `· ${winner.grade}`}
            </div>
          )}

          {/* Quick Action Buttons */}
          <div className="flex items-center gap-3 mt-4">
            <button
              onClick={() => {
                confettiEngineRef.current?.fireCelebration(180);
                sound.playTick(1.4);
              }}
              className="px-4 py-2 rounded-xl bg-white/20 hover:bg-white/30 text-white font-bold text-xs backdrop-blur-md transition-all flex items-center gap-1.5 border border-white/20"
            >
              <Sparkles size={15} /> Thêm pháo hoa
            </button>

            <button
              onClick={() => {
                onRecallStudent(winner);
                onClose();
              }}
              className="px-4 py-2 rounded-xl bg-black/20 hover:bg-black/30 text-white/90 hover:text-white font-bold text-xs backdrop-blur-md transition-all flex items-center gap-1.5 border border-white/10"
            >
              <RotateCcw size={14} /> Bỏ lượt gọi em này
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
