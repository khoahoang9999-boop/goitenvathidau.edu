import React from 'react';
import { Student } from '../../types';
import { getInitials } from '../../utils/defaultData';

interface MountainClimbArenaProps {
  teamBlueScore: number;
  teamRedScore: number;
  targetPoints: number;
  teamBlueMembers: Student[];
  teamRedMembers: Student[];
  activeBlueStudent?: Student;
  activeRedStudent?: Student;
  showStudentFaces: boolean;
  teamBlueName: string;
  teamRedName: string;
}

export const MountainClimbArena: React.FC<MountainClimbArenaProps> = ({
  teamBlueScore,
  teamRedScore,
  targetPoints,
  activeBlueStudent,
  activeRedStudent,
  showStudentFaces,
  teamBlueName,
  teamRedName,
}) => {
  const safeTarget = Math.max(1, targetPoints);
  const blueProgress = Math.min(1, teamBlueScore / safeTarget);
  const redProgress = Math.min(1, teamRedScore / safeTarget);

  // Climber coordinates (From Base Y: 310 to Summit Y: 80)
  const blueY = 310 - blueProgress * 230;
  const blueX = 210 + blueProgress * 150;

  const redY = 310 - redProgress * 230;
  const redX = 590 - redProgress * 150;

  const isBlueSummit = teamBlueScore >= safeTarget;
  const isRedSummit = teamRedScore >= safeTarget;

  return (
    <svg viewBox="0 0 800 380" className="w-full h-full select-none" preserveAspectRatio="xMidYMid meet">
      <defs>
        <clipPath id="blue-climber-face"><circle cx="0" cy="0" r="22" /></clipPath>
        <clipPath id="red-climber-face"><circle cx="0" cy="0" r="22" /></clipPath>

        <linearGradient id="mountainSkyGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#0284c7" />
          <stop offset="40%" stopColor="#7dd3fc" />
          <stop offset="80%" stopColor="#bae6fd" />
          <stop offset="100%" stopColor="#fef3c7" />
        </linearGradient>

        <linearGradient id="rockGradLeft" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#64748b" />
          <stop offset="50%" stopColor="#475569" />
          <stop offset="100%" stopColor="#334155" />
        </linearGradient>

        <linearGradient id="rockGradRight" x1="100%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#64748b" />
          <stop offset="50%" stopColor="#475569" />
          <stop offset="100%" stopColor="#1e293b" />
        </linearGradient>

        <linearGradient id="snowGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#e2e8f0" />
        </linearGradient>
      </defs>

      {/* Sky Background */}
      <rect x="0" y="0" width="800" height="380" fill="url(#mountainSkyGrad)" />

      {/* Glowing Morning Sun */}
      <circle cx="400" cy="45" r="130" fill="rgba(254, 240, 138, 0.35)" />
      <circle cx="400" cy="45" r="50" fill="rgba(254, 240, 138, 0.6)" />

      {/* Distant Mountain Silhouettes */}
      <polygon points="60,260 200,120 340,260" fill="#94a3b8" opacity="0.5" />
      <polygon points="460,260 600,120 740,260" fill="#94a3b8" opacity="0.5" />

      {/* Fluffy Altitude Clouds */}
      <path d="M 40 130 Q 70 110 100 120 Q 130 105 160 120 Q 190 110 210 130 Z" fill="#ffffff" opacity="0.9" />
      <path d="M 590 110 Q 620 90 650 100 Q 680 85 710 100 Q 740 90 760 110 Z" fill="#ffffff" opacity="0.9" />

      {/* Hot Air Balloon */}
      <g transform="translate(720, 42)">
        <ellipse cx="0" cy="0" rx="16" ry="20" fill="#f43f5e" />
        <path d="M -16 0 C -16 10 -4 18 0 22 C 4 18 16 10 16 0 Z" fill="#fb7185" />
        <line x1="-6" y1="22" x2="-5" y2="28" stroke="#475569" strokeWidth="1.2" />
        <line x1="6" y1="22" x2="5" y2="28" stroke="#475569" strokeWidth="1.2" />
        <rect x="-6" y="28" width="12" height="7" fill="#78350f" rx="1" />
      </g>

      {/* MAIN MOUNTAIN PEAK */}
      <polygon points="400,45 740,380 60,380" fill="url(#rockGradLeft)" />
      <polygon points="400,45 740,380 400,380" fill="url(#rockGradRight)" opacity="0.45" />

      {/* Snowy Summit Cap with realistic edges */}
      <polygon points="400,45 455,95 425,90 400,105 375,90 345,95" fill="url(#snowGrad)" stroke="#cbd5e1" strokeWidth="1.5" />

      {/* Pine Trees at Mountain Base */}
      {Array.from({ length: 14 }).map((_, i) => (
        <polygon
          key={i}
          points={`${30 + i * 55},380 ${45 + i * 55},340 ${60 + i * 55},380`}
          fill="#14532d"
        />
      ))}

      {/* Climbing Routes */}
      <path d="M 210 310 Q 280 200 360 80" fill="none" stroke="#93c5fd" strokeWidth="3" strokeDasharray="6 6" />
      <path d="M 590 310 Q 520 200 440 80" fill="none" stroke="#fca5a5" strokeWidth="3" strokeDasharray="6 6" />

      {/* Climbing Holds */}
      {[
        { x: 230, y: 280, c: '#3b82f6' },
        { x: 260, y: 230, c: '#eab308' },
        { x: 295, y: 175, c: '#3b82f6' },
        { x: 330, y: 125, c: '#10b981' },
      ].map((h, i) => (
        <circle key={i} cx={h.x} cy={h.y} r="6" fill={h.c} stroke="#1e293b" strokeWidth="1.5" />
      ))}

      {[
        { x: 570, y: 280, c: '#ef4444' },
        { x: 540, y: 230, c: '#f97316' },
        { x: 505, y: 175, c: '#ef4444' },
        { x: 470, y: 125, c: '#a855f7' },
      ].map((h, i) => (
        <circle key={i} cx={h.x} cy={h.y} r="6" fill={h.c} stroke="#1e293b" strokeWidth="1.5" />
      ))}

      {/* Altitude Milestone Labels */}
      <g opacity="0.95">
        <rect x="25" y="325" width="105" height="20" fill="#1e293b" rx="5" />
        <text x="77" y="339" fill="#ffffff" fontSize="9" fontWeight="900" textAnchor="middle">🏔️ Xuất Phát (0m)</text>

        <rect x="25" y="195" width="105" height="20" fill="#1e293b" rx="5" />
        <text x="77" y="209" fill="#38bdf8" fontSize="9" fontWeight="900" textAnchor="middle">☁️ Vách Mây (4000m)</text>
      </g>

      {/* Summit Victory Flagpole */}
      <g transform="translate(400, 42)">
        <line x1="0" y1="0" x2="0" y2="-42" stroke="#78350f" strokeWidth="3.5" />
        <polygon points="0,-42 26,-32 0,-22" fill="#facc15" stroke="#ca8a04" strokeWidth="1.5" />
        <circle cx="0" cy="-42" r="4" fill="#f59e0b" />
        <text x="0" y="-48" fill="#92400e" fontSize="10" fontWeight="900" textAnchor="middle">
          🚩 ĐỈNH 8848M
        </text>
      </g>

      {/* ============================================================== */}
      {/* 1. BLUE MOUNTAINEER (LEFT CLIFF) */}
      {/* ============================================================== */}
      <g transform={`translate(${blueX}, ${blueY})`}>
        {isBlueSummit && (
          <g transform="translate(0, -42)">
            <rect x="-44" y="-12" width="88" height="18" fill="#facc15" rx="5" stroke="#ca8a04" strokeWidth="1" />
            <text x="0" y="1" fill="#78350f" fontSize="10" fontWeight="900" textAnchor="middle">👑 ĐÃ LÊN ĐỈNH!</text>
          </g>
        )}

        {/* Legs gripping rock holds */}
        <path d="M -12 14 L -22 28 L -14 34" fill="none" stroke="#fed7aa" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M 6 14 L 14 26 L 22 24" fill="none" stroke="#fed7aa" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="-14" cy="34" r="5.5" fill="#1d4ed8" />
        <circle cx="22" cy="24" r="5.5" fill="#1d4ed8" />

        {/* Harness & Shorts */}
        <path d="M -14 8 L 14 8 L 10 20 L -10 20 Z" fill="#1e293b" />
        <line x1="-10" y1="12" x2="10" y2="12" stroke="#facc15" strokeWidth="2.5" />

        {/* Torso & Arms Reaching */}
        <path d="M -14 -16 L 14 -16 L 10 10 L -10 10 Z" fill="#2563eb" stroke="#1e1b4b" strokeWidth="1.8" />
        <path d="M 0 12 Q -10 35 -15 60" fill="none" stroke="#facc15" strokeWidth="2.5" />

        {/* Reaching Arms */}
        <path d="M -12 -10 L -24 -24 L -18 -32" fill="none" stroke="#fed7aa" strokeWidth="8" strokeLinecap="round" />
        <circle cx="-18" cy="-32" r="4.5" fill="#fed7aa" stroke="#1e1b4b" strokeWidth="1" />
        
        <path d="M 12 -10 L 22 -18 L 26 -14" fill="none" stroke="#fed7aa" strokeWidth="8" strokeLinecap="round" />
        <circle cx="26" cy="-14" r="4.5" fill="#fed7aa" stroke="#1e1b4b" strokeWidth="1" />

        {/* Head / Avatar */}
        <g transform="translate(0, -26)">
          {showStudentFaces ? (
            <g>
              <circle cx="0" cy="0" r="22" fill="#1e3a8a" stroke="#60a5fa" strokeWidth="2.5" />
              {activeBlueStudent?.avatar ? (
                <image href={activeBlueStudent.avatar} x="-20" y="-20" width="40" height="40" clipPath="url(#blue-climber-face)" preserveAspectRatio="xMidYMid slice" />
              ) : (
                <text x="0" y="5" textAnchor="middle" fill="#ffffff" fontSize="11" fontWeight="900">
                  {activeBlueStudent ? getInitials(activeBlueStudent.name) : 'B1'}
                </text>
              )}
            </g>
          ) : (
            <g>
              <circle cx="0" cy="0" r="16" fill="#fed7aa" stroke="#1e1b4b" strokeWidth="1.6" />
              <path d="M -16 -4 C -16 -18 16 -18 16 -4 Z" fill="#3b82f6" stroke="#1e1b4b" strokeWidth="1.5" />
              <rect x="-4" y="-14" width="8" height="5" fill="#facc15" stroke="#1e1b4b" strokeWidth="1" />
              <ellipse cx="4" cy="2" rx="2.5" ry="3.5" fill="#1e1b4b" />
              <circle cx="5" cy="1" r="1" fill="#ffffff" />
              <path d="M 1 8 Q 5 11 9 8" fill="none" stroke="#e11d48" strokeWidth="1.4" />
            </g>
          )}
        </g>
      </g>

      {/* ============================================================== */}
      {/* 2. RED MOUNTAINEER (RIGHT CLIFF) */}
      {/* ============================================================== */}
      <g transform={`translate(${redX}, ${redY})`}>
        {isRedSummit && (
          <g transform="translate(0, -42)">
            <rect x="-44" y="-12" width="88" height="18" fill="#facc15" rx="5" stroke="#ca8a04" strokeWidth="1" />
            <text x="0" y="1" fill="#78350f" fontSize="10" fontWeight="900" textAnchor="middle">👑 ĐÃ LÊN ĐỈNH!</text>
          </g>
        )}

        {/* Legs gripping rock holds */}
        <path d="M -6 14 L -14 26 L -22 24" fill="none" stroke="#fed7aa" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M 12 14 L 22 28 L 14 34" fill="none" stroke="#fed7aa" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="-22" cy="24" r="5.5" fill="#dc2626" />
        <circle cx="14" cy="34" r="5.5" fill="#dc2626" />

        {/* Harness & Shorts */}
        <path d="M -14 8 L 14 8 L 10 20 L -10 20 Z" fill="#1e293b" />
        <line x1="-10" y1="12" x2="10" y2="12" stroke="#facc15" strokeWidth="2.5" />

        {/* Torso & Red Jersey */}
        <path d="M -14 -16 L 14 -16 L 10 10 L -10 10 Z" fill="#dc2626" stroke="#1e1b4b" strokeWidth="1.8" />
        <path d="M 0 12 Q 10 35 15 60" fill="none" stroke="#facc15" strokeWidth="2.5" />

        {/* Reaching Arms */}
        <path d="M -12 -10 L -22 -18 L -26 -14" fill="none" stroke="#fed7aa" strokeWidth="8" strokeLinecap="round" />
        <circle cx="-26" cy="-14" r="4.5" fill="#fed7aa" stroke="#1e1b4b" strokeWidth="1" />
        
        <path d="M 12 -10 L 24 -24 L 18 -32" fill="none" stroke="#fed7aa" strokeWidth="8" strokeLinecap="round" />
        <circle cx="18" cy="-32" r="4.5" fill="#fed7aa" stroke="#1e1b4b" strokeWidth="1" />

        {/* Head / Avatar */}
        <g transform="translate(0, -26)">
          {showStudentFaces ? (
            <g>
              <circle cx="0" cy="0" r="22" fill="#991b1b" stroke="#f87171" strokeWidth="2.5" />
              {activeRedStudent?.avatar ? (
                <image href={activeRedStudent.avatar} x="-20" y="-20" width="40" height="40" clipPath="url(#red-climber-face)" preserveAspectRatio="xMidYMid slice" />
              ) : (
                <text x="0" y="5" textAnchor="middle" fill="#ffffff" fontSize="11" fontWeight="900">
                  {activeRedStudent ? getInitials(activeRedStudent.name) : 'R1'}
                </text>
              )}
            </g>
          ) : (
            <g>
              <circle cx="0" cy="0" r="16" fill="#fed7aa" stroke="#1e1b4b" strokeWidth="1.6" />
              <path d="M -16 -4 C -16 -18 16 -18 16 -4 Z" fill="#ef4444" stroke="#1e1b4b" strokeWidth="1.5" />
              <rect x="-4" y="-14" width="8" height="5" fill="#facc15" stroke="#1e1b4b" strokeWidth="1" />
              <ellipse cx="-4" cy="2" rx="2.5" ry="3.5" fill="#1e1b4b" />
              <circle cx="-3" cy="1" r="1" fill="#ffffff" />
              <path d="M -1 8 Q -5 11 -9 8" fill="none" stroke="#e11d48" strokeWidth="1.4" />
            </g>
          )}
        </g>
      </g>
    </svg>
  );
};
