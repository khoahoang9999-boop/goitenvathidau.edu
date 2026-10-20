import React from 'react';
import { Student } from '../../types';
import { getInitials, getShortName } from '../../utils/defaultData';

interface SprintTrackArenaProps {
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

export const SprintTrackArena: React.FC<SprintTrackArenaProps> = ({
  teamBlueScore,
  teamRedScore,
  targetPoints,
  teamBlueMembers,
  teamRedMembers,
  activeBlueStudent,
  activeRedStudent,
  showStudentFaces,
  teamBlueName,
  teamRedName,
}) => {
  const safeTarget = Math.max(1, targetPoints);
  const blueProgress = Math.min(1, teamBlueScore / safeTarget);
  const redProgress = Math.min(1, teamRedScore / safeTarget);

  // Runner X coordinates (Track range: 90px to 660px in 800px width viewBox)
  const blueX = 90 + blueProgress * 570;
  const redX = 90 + redProgress * 570;

  const isBlueFinished = teamBlueScore >= safeTarget;
  const isRedFinished = teamRedScore >= safeTarget;

  return (
    <svg viewBox="0 0 800 380" className="w-full h-full select-none" preserveAspectRatio="xMidYMid meet">
      <defs>
        <clipPath id="blue-runner-face"><circle cx="0" cy="0" r="24" /></clipPath>
        <clipPath id="red-runner-face"><circle cx="0" cy="0" r="24" /></clipPath>

        <linearGradient id="sprintSky" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#bae6fd" />
          <stop offset="40%" stopColor="#e0f2fe" />
          <stop offset="100%" stopColor="#fef3c7" />
        </linearGradient>

        <linearGradient id="runningTrack" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#f97316" />
          <stop offset="40%" stopColor="#ea580c" />
          <stop offset="80%" stopColor="#c2410c" />
          <stop offset="100%" stopColor="#9a3412" />
        </linearGradient>

        <linearGradient id="goldCupGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fef08a" />
          <stop offset="50%" stopColor="#eab308" />
          <stop offset="100%" stopColor="#854d0e" />
        </linearGradient>

        <filter id="glow">
          <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>

      {/* Sky Background */}
      <rect x="0" y="0" width="800" height="380" fill="url(#sprintSky)" />

      {/* Floating Stadium Balloons */}
      {[{ x: 80, y: 35, c: '#f43f5e' }, { x: 190, y: 25, c: '#3b82f6' }, { x: 420, y: 20, c: '#eab308' }, { x: 620, y: 30, c: '#10b981' }].map((b, i) => (
        <g key={i} transform={`translate(${b.x}, ${b.y})`}>
          <ellipse cx="0" cy="0" rx="9" ry="12" fill={b.c} />
          <polygon points="-2,12 2,12 0,14" fill={b.c} />
          <path d="M 0 14 Q 3 22 -1 28" fill="none" stroke="#64748b" strokeWidth="1" />
        </g>
      ))}

      {/* Stadium Bleachers with Cheering Crowd */}
      <rect x="0" y="48" width="800" height="48" fill="#e2e8f0" opacity="0.8" />
      <line x1="0" y1="96" x2="800" y2="96" stroke="#94a3b8" strokeWidth="2" />
      
      {/* Crowd Silhouettes & Banners */}
      {Array.from({ length: 24 }).map((_, i) => (
        <circle key={i} cx={20 + i * 33} cy={68 + (i % 3) * 4} r={6} fill={['#3b82f6', '#ef4444', '#f59e0b', '#10b981', '#6366f1'][i % 5]} opacity="0.6" />
      ))}

      {/* Hanging Festival Pennants */}
      {Array.from({ length: 16 }).map((_, i) => (
        <polygon
          key={i}
          points={`${i * 50},50 ${i * 50 + 25},74 ${i * 50 + 50},50`}
          fill={['#38bdf8', '#f87171', '#facc15', '#4ade80', '#c084fc'][i % 5]}
        />
      ))}

      {/* Infield Grass Top & Bottom */}
      <rect x="0" y="96" width="800" height="24" fill="#22c55e" />
      <rect x="0" y="345" width="800" height="35" fill="#15803d" />

      {/* Main Running Track Surface */}
      <rect x="0" y="120" width="800" height="225" fill="url(#runningTrack)" />

      {/* Track Boundary Lines & Center Dash Line */}
      <line x1="0" y1="120" x2="800" y2="120" stroke="#ffffff" strokeWidth="4" />
      <line x1="0" y1="232" x2="800" y2="232" stroke="#ffffff" strokeWidth="3.5" strokeDasharray="16 12" />
      <line x1="0" y1="345" x2="800" y2="345" stroke="#ffffff" strokeWidth="4" />

      {/* Distance Markers */}
      {[
        { x: 90, label: 'START (0m)' },
        { x: 235, label: '25m' },
        { x: 380, label: '50m' },
        { x: 525, label: '75m' },
      ].map((m, idx) => (
        <g key={idx}>
          <line x1={m.x} y1="120" x2={m.x} y2="345" stroke="#ffffff" strokeWidth="1.5" strokeDasharray="5 5" opacity="0.8" />
          <rect x={m.x - 30} y="100" width="60" height="16" fill="#0369a1" rx="4" />
          <text x={m.x} y="112" fill="#ffffff" fontSize="9" fontWeight="900" textAnchor="middle">{m.label}</text>
        </g>
      ))}

      {/* Start Line Blocks */}
      <rect x="85" y="120" width="8" height="225" fill="#ffffff" />
      <text x="45" y="178" fill="#1e3a8a" fontSize="15" fontWeight="900" textAnchor="middle">LÀN 1</text>
      <text x="45" y="290" fill="#991b1b" fontSize="15" fontWeight="900" textAnchor="middle">LÀN 2</text>

      {/* Finish Line Gate & Trophy */}
      <g transform="translate(680, 75)">
        <rect x="0" y="45" width="12" height="225" fill="#1e293b" />
        <rect x="3" y="45" width="6" height="225" fill="#ffffff" strokeDasharray="10 10" strokeWidth="6" stroke="#000000" />
        
        {/* Arch Header */}
        <path d="M -18 45 L 30 45 L 30 12 L -18 12 Z" fill="#dc2626" stroke="#991b1b" strokeWidth="2" rx="4" />
        <text x="6" y="34" fill="#ffffff" fontSize="11" fontWeight="900" textAnchor="middle">🏁 ĐÍCH</text>
        
        {/* Golden Trophy on Pedestal */}
        <g transform="translate(6, -14)">
          <path d="M -14 20 L 14 20 L 10 30 L -10 30 Z" fill="#78350f" />
          <path d="M -16 2 L 16 2 C 16 16 -16 16 -16 2 Z" fill="url(#goldCupGrad)" stroke="#854d0e" strokeWidth="1.5" />
          <path d="M -16 5 C -24 5 -24 14 -16 14" fill="none" stroke="url(#goldCupGrad)" strokeWidth="2.5" />
          <path d="M 16 5 C 24 5 24 14 16 14" fill="none" stroke="url(#goldCupGrad)" strokeWidth="2.5" />
          <polygon points="0,5 3,11 9,11 4,14 6,20 0,16 -6,20 -4,14 -9,11 -3,11" fill="#ffffff" />
        </g>
      </g>

      {/* ============================================================== */}
      {/* 1. BLUE SPRINTER (LANE 1) */}
      {/* ============================================================== */}
      <g transform={`translate(${blueX}, 175)`}>
        <ellipse cx="-15" cy="46" rx="32" ry="7" fill="#7c2d12" opacity="0.35" />

        {/* Speed Wind / Turbo Flame Effects */}
        <path d="M -48 6 L -16 6 M -60 22 L -20 22 M -42 36 L -12 36" stroke="#38bdf8" strokeWidth="3" strokeLinecap="round" opacity="0.85" />
        <polygon points="-32,18 -18,22 -32,26" fill="#60a5fa" opacity="0.6" />

        {isBlueFinished && (
          <g transform="translate(0, -50)">
            <rect x="-42" y="-14" width="84" height="20" fill="#facc15" rx="6" stroke="#ca8a04" strokeWidth="1.5" />
            <text x="0" y="0" fill="#78350f" fontSize="11" fontWeight="900" textAnchor="middle">🏆 VÔ ĐỊCH!</text>
          </g>
        )}

        {/* Back Leg (Driving behind) */}
        <path d="M -10 16 C -26 24 -46 22 -54 12" fill="none" stroke="#fed7aa" strokeWidth="12" strokeLinecap="round" />
        {/* Blue Sneaker with White Sole */}
        <rect x="-62" y="6" width="16" height="10" rx="3" fill="#1d4ed8" stroke="#1e1b4b" strokeWidth="1.5" />
        <rect x="-64" y="13" width="18" height="4" rx="1.5" fill="#ffffff" />

        {/* Front Leg (Driving Forward High Knee) */}
        <path d="M 6 16 C 18 26 34 36 30 46" fill="none" stroke="#fed7aa" strokeWidth="12" strokeLinecap="round" />
        {/* Front Sneaker */}
        <rect x="22" y="40" width="18" height="11" rx="3" fill="#1d4ed8" stroke="#1e1b4b" strokeWidth="1.5" />
        <rect x="20" y="48" width="20" height="4" rx="1.5" fill="#ffffff" />

        {/* Athletic Shorts */}
        <path d="M -18 6 L 14 6 L 10 24 L -14 24 Z" fill="#1e293b" stroke="#0f172a" strokeWidth="1.5" />

        {/* Torso leaning forward (~20 deg) */}
        <g transform="rotate(20, 0, 0)">
          {/* Blue Sport Jersey */}
          <path d="M -16 -24 L 16 -24 L 12 12 L -12 12 Z" fill="#2563eb" stroke="#1e1b4b" strokeWidth="2" />
          <text x="0" y="-4" fill="#ffffff" fontSize="13" fontWeight="900" textAnchor="middle">1</text>
          
          {/* Pumping Arms */}
          <path d="M -16 -16 C -28 -6 -34 8 -26 18" fill="none" stroke="#fed7aa" strokeWidth="10" strokeLinecap="round" />
          <circle cx="-26" cy="18" r="5" fill="#fed7aa" stroke="#1e1b4b" strokeWidth="1.2" />
          
          <path d="M 16 -16 C 30 -22 42 -10 38 4" fill="none" stroke="#fed7aa" strokeWidth="10" strokeLinecap="round" />
          <circle cx="38" cy="4" r="5" fill="#fed7aa" stroke="#1e1b4b" strokeWidth="1.2" />
        </g>

        {/* Anime Sprinter Head / Student Photo */}
        <g transform="translate(10, -32)">
          {showStudentFaces ? (
            <g>
              <circle cx="0" cy="0" r="26" fill="#1e3a8a" stroke="#60a5fa" strokeWidth="3" />
              {activeBlueStudent?.avatar ? (
                <image href={activeBlueStudent.avatar} x="-24" y="-24" width="48" height="48" clipPath="url(#blue-runner-face)" preserveAspectRatio="xMidYMid slice" />
              ) : (
                <text x="0" y="6" textAnchor="middle" fill="#ffffff" fontSize="13" fontWeight="900">
                  {activeBlueStudent ? getInitials(activeBlueStudent.name) : 'B1'}
                </text>
              )}
            </g>
          ) : (
            /* Anime Sprinter Face with Headband */
            <g>
              <circle cx="0" cy="0" r="19" fill="#fed7aa" stroke="#1e1b4b" strokeWidth="2" />
              {/* Hair Back & Spikes */}
              <path d="M -20 -4 C -24 -22 10 -26 20 -8 C 8 -12 -8 -12 -20 -4 Z" fill="#1e1b4b" />
              {/* Blue Headband */}
              <rect x="-20" y="-7" width="40" height="7" fill="#2563eb" rx="2" stroke="#1e1b4b" strokeWidth="1" />
              {/* Anime Sparkling Eyes */}
              <ellipse cx="6" cy="2" rx="3" ry="4.2" fill="#1e1b4b" />
              <circle cx="7" cy="1" r="1.3" fill="#ffffff" />
              <circle cx="5" cy="4" r="0.7" fill="#ffffff" />
              {/* Smile & Blush */}
              <path d="M 1 9 Q 7 14 12 9" fill="#f43f5e" stroke="#1e1b4b" strokeWidth="1.5" />
              <ellipse cx="12" cy="7" rx="3" ry="1.8" fill="#fb7185" opacity="0.7" />
            </g>
          )}
        </g>
      </g>

      {/* ============================================================== */}
      {/* 2. RED SPRINTER (LANE 2) */}
      {/* ============================================================== */}
      <g transform={`translate(${redX}, 288)`}>
        <ellipse cx="-15" cy="46" rx="32" ry="7" fill="#7c2d12" opacity="0.35" />

        {/* Speed Wind / Turbo Flame Effects */}
        <path d="M -48 6 L -16 6 M -60 22 L -20 22 M -42 36 L -12 36" stroke="#f87171" strokeWidth="3" strokeLinecap="round" opacity="0.85" />
        <polygon points="-32,18 -18,22 -32,26" fill="#f87171" opacity="0.6" />

        {isRedFinished && (
          <g transform="translate(0, -50)">
            <rect x="-42" y="-14" width="84" height="20" fill="#facc15" rx="6" stroke="#ca8a04" strokeWidth="1.5" />
            <text x="0" y="0" fill="#78350f" fontSize="11" fontWeight="900" textAnchor="middle">🏆 VÔ ĐỊCH!</text>
          </g>
        )}

        {/* Back Leg */}
        <path d="M -10 16 C -26 24 -46 22 -54 12" fill="none" stroke="#fed7aa" strokeWidth="12" strokeLinecap="round" />
        {/* Red Sneaker */}
        <rect x="-62" y="6" width="16" height="10" rx="3" fill="#dc2626" stroke="#1e1b4b" strokeWidth="1.5" />
        <rect x="-64" y="13" width="18" height="4" rx="1.5" fill="#ffffff" />

        {/* Front Leg */}
        <path d="M 6 16 C 18 26 34 36 30 46" fill="none" stroke="#fed7aa" strokeWidth="12" strokeLinecap="round" />
        {/* Front Sneaker */}
        <rect x="22" y="40" width="18" height="11" rx="3" fill="#dc2626" stroke="#1e1b4b" strokeWidth="1.5" />
        <rect x="20" y="48" width="20" height="4" rx="1.5" fill="#ffffff" />

        {/* Athletic Shorts */}
        <path d="M -18 6 L 14 6 L 10 24 L -14 24 Z" fill="#1e293b" stroke="#0f172a" strokeWidth="1.5" />

        {/* Torso leaning forward */}
        <g transform="rotate(20, 0, 0)">
          {/* Red Jersey */}
          <path d="M -16 -24 L 16 -24 L 12 12 L -12 12 Z" fill="#dc2626" stroke="#1e1b4b" strokeWidth="2" />
          <text x="0" y="-4" fill="#ffffff" fontSize="13" fontWeight="900" textAnchor="middle">1</text>
          
          {/* Pumping Arms */}
          <path d="M -16 -16 C -28 -6 -34 8 -26 18" fill="none" stroke="#fed7aa" strokeWidth="10" strokeLinecap="round" />
          <circle cx="-26" cy="18" r="5" fill="#fed7aa" stroke="#1e1b4b" strokeWidth="1.2" />
          
          <path d="M 16 -16 C 30 -22 42 -10 38 4" fill="none" stroke="#fed7aa" strokeWidth="10" strokeLinecap="round" />
          <circle cx="38" cy="4" r="5" fill="#fed7aa" stroke="#1e1b4b" strokeWidth="1.2" />
        </g>

        {/* Anime Sprinter Head / Student Photo */}
        <g transform="translate(10, -32)">
          {showStudentFaces ? (
            <g>
              <circle cx="0" cy="0" r="26" fill="#991b1b" stroke="#f87171" strokeWidth="3" />
              {activeRedStudent?.avatar ? (
                <image href={activeRedStudent.avatar} x="-24" y="-24" width="48" height="48" clipPath="url(#red-runner-face)" preserveAspectRatio="xMidYMid slice" />
              ) : (
                <text x="0" y="6" textAnchor="middle" fill="#ffffff" fontSize="13" fontWeight="900">
                  {activeRedStudent ? getInitials(activeRedStudent.name) : 'R1'}
                </text>
              )}
            </g>
          ) : (
            <g>
              <circle cx="0" cy="0" r="19" fill="#fed7aa" stroke="#1e1b4b" strokeWidth="2" />
              <path d="M -20 -4 C -24 -22 10 -26 20 -8 C 8 -12 -8 -12 -20 -4 Z" fill="#78350f" />
              <rect x="-20" y="-7" width="40" height="7" fill="#dc2626" rx="2" stroke="#1e1b4b" strokeWidth="1" />
              <ellipse cx="6" cy="2" rx="3" ry="4.2" fill="#1e1b4b" />
              <circle cx="7" cy="1" r="1.3" fill="#ffffff" />
              <circle cx="5" cy="4" r="0.7" fill="#ffffff" />
              <path d="M 1 9 Q 7 14 12 9" fill="#f43f5e" stroke="#1e1b4b" strokeWidth="1.5" />
              <ellipse cx="12" cy="7" rx="3" ry="1.8" fill="#fb7185" opacity="0.7" />
            </g>
          )}
        </g>
      </g>
    </svg>
  );
};
