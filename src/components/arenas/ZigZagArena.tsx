import React from 'react';
import { Student } from '../../types';
import { getInitials, getShortName } from '../../utils/defaultData';

interface ZigZagArenaProps {
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

export const ZigZagArena: React.FC<ZigZagArenaProps> = ({
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

  // Generate ZigZag Waypoints for a given track Y center
  const getZigZagWaypoints = (centerY: number, amplitude: number) => {
    const points: { x: number; y: number }[] = [];
    const startX = 80;
    const endX = 720;
    const totalWidth = endX - startX;

    for (let i = 0; i <= safeTarget; i++) {
      const fraction = i / safeTarget;
      const x = startX + fraction * totalWidth;
      // Alternate direction up & down
      const direction = i % 2 === 0 ? 1 : -1;
      const y = centerY + direction * amplitude;
      points.push({ x, y });
    }
    return points;
  };

  const bluePoints = getZigZagWaypoints(115, 30);
  const redPoints = getZigZagWaypoints(275, 30);

  // Get exact current position along waypoints based on score
  const getInterpolatedPosition = (
    waypoints: { x: number; y: number }[],
    score: number
  ) => {
    const clampedScore = Math.max(0, Math.min(safeTarget, score));
    const index = Math.floor(clampedScore);
    const fraction = clampedScore - index;

    if (index >= safeTarget) {
      return waypoints[safeTarget];
    }
    const current = waypoints[index];
    const next = waypoints[index + 1] || current;

    return {
      x: current.x + (next.x - current.x) * fraction,
      y: current.y + (next.y - current.y) * fraction,
    };
  };

  const bluePos = getInterpolatedPosition(bluePoints, teamBlueScore);
  const redPos = getInterpolatedPosition(redPoints, teamRedScore);

  // Build SVG path string for ZigZag lines
  const buildPathString = (waypoints: { x: number; y: number }[]) => {
    if (waypoints.length === 0) return '';
    let path = `M ${waypoints[0].x} ${waypoints[0].y}`;
    for (let i = 1; i < waypoints.length; i++) {
      path += ` L ${waypoints[i].x} ${waypoints[i].y}`;
    }
    return path;
  };

  const bluePathString = buildPathString(bluePoints);
  const redPathString = buildPathString(redPoints);

  const isBlueFinished = teamBlueScore >= safeTarget;
  const isRedFinished = teamRedScore >= safeTarget;

  return (
    <svg
      viewBox="0 0 800 380"
      className="w-full h-full select-none"
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <clipPath id="blue-zigzag-face">
          <circle cx="0" cy="0" r="22" />
        </clipPath>
        <clipPath id="red-zigzag-face">
          <circle cx="0" cy="0" r="22" />
        </clipPath>

        {/* Sky / Grid Background Gradient */}
        <linearGradient id="zigzagBg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#0f172a" />
          <stop offset="50%" stopColor="#1e1b4b" />
          <stop offset="100%" stopColor="#311042" />
        </linearGradient>

        {/* Blue Ball Sphere Gradient */}
        <radialGradient id="blueSphere" cx="35%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#60a5fa" />
          <stop offset="50%" stopColor="#2563eb" />
          <stop offset="100%" stopColor="#1e3a8a" />
        </radialGradient>

        {/* Red Ball Sphere Gradient */}
        <radialGradient id="redSphere" cx="35%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#f87171" />
          <stop offset="50%" stopColor="#dc2626" />
          <stop offset="100%" stopColor="#7f1d1d" />
        </radialGradient>

        {/* Blue Track Glow */}
        <filter id="glowBlue" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        {/* Red Track Glow */}
        <filter id="glowRed" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        {/* Gold Trophy Grad */}
        <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fef08a" />
          <stop offset="50%" stopColor="#eab308" />
          <stop offset="100%" stopColor="#854d0e" />
        </linearGradient>
      </defs>

      {/* Dark Futuristic Sci-Fi Grid Arena Background */}
      <rect x="0" y="0" width="800" height="380" fill="url(#zigzagBg)" />

      {/* Sci-Fi Grid Lines */}
      <g opacity="0.12">
        {Array.from({ length: 21 }).map((_, i) => (
          <line
            key={`v-${i}`}
            x1={i * 40}
            y1="0"
            x2={i * 40}
            y2="380"
            stroke="#a855f7"
            strokeWidth="1"
          />
        ))}
        {Array.from({ length: 10 }).map((_, i) => (
          <line
            key={`h-${i}`}
            x1="0"
            y1={i * 40}
            x2="800"
            y2={i * 40}
            stroke="#38bdf8"
            strokeWidth="1"
          />
        ))}
      </g>

      {/* Decorative Neon Speed Arrows in Background */}
      {Array.from({ length: 6 }).map((_, i) => (
        <path
          key={i}
          d={`M ${120 + i * 110} 182 L ${135 + i * 110} 190 L ${120 + i * 110} 198`}
          fill="none"
          stroke="#f43f5e"
          strokeWidth="3"
          opacity="0.3"
        />
      ))}

      {/* Header Title Banner */}
      <rect x="250" y="10" width="300" height="30" fill="#1e293b" rx="15" stroke="#38bdf8" strokeWidth="1.5" />
      <text
        x="400"
        y="30"
        fill="#38bdf8"
        fontSize="13"
        fontWeight="900"
        textAnchor="middle"
        className="tracking-wider"
      >
        🌀 ĐƯỜNG ĐUA ZICZAC - VƯỢT CÁC ẢI 🔀
      </text>

      {/* ========================================================= */}
      {/* 1. BLUE ZICZAC TRACK */}
      {/* ========================================================= */}
      {/* Outer Glow Path */}
      <path
        d={bluePathString}
        fill="none"
        stroke="#3b82f6"
        strokeWidth="16"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.3"
        filter="url(#glowBlue)"
      />
      {/* Base Track Border */}
      <path
        d={bluePathString}
        fill="none"
        stroke="#1d4ed8"
        strokeWidth="12"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Inner Neon Core Line */}
      <path
        d={bluePathString}
        fill="none"
        stroke="#60a5fa"
        strokeWidth="4"
        strokeDasharray="10 6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* ========================================================= */}
      {/* 2. RED ZICZAC TRACK */}
      {/* ========================================================= */}
      {/* Outer Glow Path */}
      <path
        d={redPathString}
        fill="none"
        stroke="#ef4444"
        strokeWidth="16"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.3"
        filter="url(#glowRed)"
      />
      {/* Base Track Border */}
      <path
        d={redPathString}
        fill="none"
        stroke="#b91c1c"
        strokeWidth="12"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Inner Neon Core Line */}
      <path
        d={redPathString}
        fill="none"
        stroke="#f87171"
        strokeWidth="4"
        strokeDasharray="10 6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* ========================================================= */}
      {/* OBSTACLE GATES (CÁC ẢI) ALONG THE ZICZAC PATH */}
      {/* ========================================================= */}
      {/* Start Gates */}
      <g transform={`translate(${bluePoints[0].x}, ${bluePoints[0].y})`}>
        <circle cx="0" cy="0" r="14" fill="#1e3a8a" stroke="#60a5fa" strokeWidth="2" />
        <text x="0" y="4" fill="#ffffff" fontSize="9" fontWeight="900" textAnchor="middle">
          XUẤT PHÁT
        </text>
      </g>
      <g transform={`translate(${redPoints[0].x}, ${redPoints[0].y})`}>
        <circle cx="0" cy="0" r="14" fill="#831843" stroke="#f43f5e" strokeWidth="2" />
        <text x="0" y="4" fill="#ffffff" fontSize="9" fontWeight="900" textAnchor="middle">
          XUẤT PHÁT
        </text>
      </g>

      {/* Intermediate Gates (Ải 1, Ải 2, ..., Ải N-1) */}
      {Array.from({ length: safeTarget - 1 }).map((_, idx) => {
        const gateNum = idx + 1;
        const bPt = bluePoints[gateNum];
        const rPt = redPoints[gateNum];

        const isBluePassed = teamBlueScore >= gateNum;
        const isRedPassed = teamRedScore >= gateNum;

        return (
          <React.Fragment key={`gate-${gateNum}`}>
            {/* Blue Gate */}
            <g transform={`translate(${bPt.x}, ${bPt.y})`}>
              {/* Gate Ring / Arch */}
              <circle
                cx="0"
                cy="0"
                r="18"
                fill={isBluePassed ? '#1e40af' : '#0f172a'}
                stroke={isBluePassed ? '#22c55e' : '#3b82f6'}
                strokeWidth="3"
                className="transition-all duration-300"
              />
              {/* Obstacle Cone / Gate icon */}
              <text
                x="0"
                y="-2"
                fill={isBluePassed ? '#4ade80' : '#93c5fd'}
                fontSize="10"
                fontWeight="900"
                textAnchor="middle"
              >
                {isBluePassed ? '✅' : `Ải ${gateNum}`}
              </text>
              <text
                x="0"
                y="10"
                fill="#ffffff"
                fontSize="7"
                fontWeight="800"
                textAnchor="middle"
              >
                {isBluePassed ? 'VƯỢT' : 'CHẶN'}
              </text>
            </g>

            {/* Red Gate */}
            <g transform={`translate(${rPt.x}, ${rPt.y})`}>
              <circle
                cx="0"
                cy="0"
                r="18"
                fill={isRedPassed ? '#9f1239' : '#0f172a'}
                stroke={isRedPassed ? '#22c55e' : '#ef4444'}
                strokeWidth="3"
                className="transition-all duration-300"
              />
              <text
                x="0"
                y="-2"
                fill={isRedPassed ? '#4ade80' : '#fca5a5'}
                fontSize="10"
                fontWeight="900"
                textAnchor="middle"
              >
                {isRedPassed ? '✅' : `Ải ${gateNum}`}
              </text>
              <text
                x="0"
                y="10"
                fill="#ffffff"
                fontSize="7"
                fontWeight="800"
                textAnchor="middle"
              >
                {isRedPassed ? 'VƯỢT' : 'CHẶN'}
              </text>
            </g>
          </React.Fragment>
        );
      })}

      {/* FINISH GATES (ĐÍCH VỀ) AT LAST WAYPOINT */}
      <g transform={`translate(${bluePoints[safeTarget].x}, ${bluePoints[safeTarget].y})`}>
        <circle cx="0" cy="0" r="22" fill="#15803d" stroke="#facc15" strokeWidth="3.5" />
        <text x="0" y="4" fill="#ffffff" fontSize="11" fontWeight="900" textAnchor="middle">
          🏁 ĐÍCH
        </text>
      </g>
      <g transform={`translate(${redPoints[safeTarget].x}, ${redPoints[safeTarget].y})`}>
        <circle cx="0" cy="0" r="22" fill="#15803d" stroke="#facc15" strokeWidth="3.5" />
        <text x="0" y="4" fill="#ffffff" fontSize="11" fontWeight="900" textAnchor="middle">
          🏁 ĐÍCH
        </text>
      </g>

      {/* Track Labels */}
      <text
        x="15"
        y="120"
        fill="#60a5fa"
        fontSize="11"
        fontWeight="900"
        textAnchor="start"
      >
        🔵 {getShortName(teamBlueName)}
      </text>
      <text
        x="15"
        y="280"
        fill="#f87171"
        fontSize="11"
        fontWeight="900"
        textAnchor="start"
      >
        🔴 {getShortName(teamRedName)}
      </text>

      {/* ========================================================= */}
      {/* BLUE ROLLING BALL / RUNNER AVATAR */}
      {/* ========================================================= */}
      <g
        transform={`translate(${bluePos.x}, ${bluePos.y})`}
        className="transition-transform duration-500 ease-out"
      >
        {/* Rolling Shadow */}
        <ellipse cx="0" cy="24" rx="22" ry="6" fill="#000000" opacity="0.4" />

        {/* Active Blue Student Name Banner */}
        {activeBlueStudent && (
          <g transform="translate(0, -38)">
            <rect
              x="-40"
              y="-12"
              width="80"
              height="18"
              fill="#1d4ed8"
              rx="9"
              stroke="#60a5fa"
              strokeWidth="1.5"
            />
            <text
              x="0"
              y="1"
              fill="#ffffff"
              fontSize="10"
              fontWeight="900"
              textAnchor="middle"
            >
              {getShortName(activeBlueStudent.name)}
            </text>
          </g>
        )}

        {/* Rolling Sphere / Avatar */}
        {showStudentFaces && activeBlueStudent?.avatar ? (
          <g>
            <circle cx="0" cy="0" r="24" fill="#2563eb" stroke="#60a5fa" strokeWidth="3" />
            <image
              href={activeBlueStudent.avatar}
              x="-22"
              y="-22"
              width="44"
              height="44"
              preserveAspectRatio="xMidYMid slice"
              clipPath="url(#blue-zigzag-face)"
            />
            <circle cx="0" cy="0" r="22" fill="none" stroke="#60a5fa" strokeWidth="2.5" />
          </g>
        ) : (
          <g className="animate-spin-slow">
            {/* 3D Sphere Ball with Roll Ring */}
            <circle cx="0" cy="0" r="22" fill="url(#blueSphere)" stroke="#93c5fd" strokeWidth="2.5" />
            {/* Spinning ZigZag Stripe Accent */}
            <path
              d="M -16 -8 Q 0 12 16 -8 M -16 8 Q 0 -12 16 8"
              fill="none"
              stroke="#ffffff"
              strokeWidth="2.5"
              opacity="0.8"
            />
            <circle cx="-6" cy="-8" r="4" fill="#ffffff" opacity="0.6" />
          </g>
        )}

        {/* Finished Winner Crown */}
        {isBlueFinished && (
          <g transform="translate(0, -32)">
            <text x="0" y="0" fontSize="22" textAnchor="middle" className="animate-bounce">
              👑
            </text>
          </g>
        )}
      </g>

      {/* ========================================================= */}
      {/* RED ROLLING BALL / RUNNER AVATAR */}
      {/* ========================================================= */}
      <g
        transform={`translate(${redPos.x}, ${redPos.y})`}
        className="transition-transform duration-500 ease-out"
      >
        {/* Rolling Shadow */}
        <ellipse cx="0" cy="24" rx="22" ry="6" fill="#000000" opacity="0.4" />

        {/* Active Red Student Name Banner */}
        {activeRedStudent && (
          <g transform="translate(0, -38)">
            <rect
              x="-40"
              y="-12"
              width="80"
              height="18"
              fill="#b91c1c"
              rx="9"
              stroke="#f87171"
              strokeWidth="1.5"
            />
            <text
              x="0"
              y="1"
              fill="#ffffff"
              fontSize="10"
              fontWeight="900"
              textAnchor="middle"
            >
              {getShortName(activeRedStudent.name)}
            </text>
          </g>
        )}

        {/* Rolling Sphere / Avatar */}
        {showStudentFaces && activeRedStudent?.avatar ? (
          <g>
            <circle cx="0" cy="0" r="24" fill="#dc2626" stroke="#f87171" strokeWidth="3" />
            <image
              href={activeRedStudent.avatar}
              x="-22"
              y="-22"
              width="44"
              height="44"
              preserveAspectRatio="xMidYMid slice"
              clipPath="url(#red-zigzag-face)"
            />
            <circle cx="0" cy="0" r="22" fill="none" stroke="#f87171" strokeWidth="2.5" />
          </g>
        ) : (
          <g className="animate-spin-slow">
            {/* 3D Sphere Ball with Roll Ring */}
            <circle cx="0" cy="0" r="22" fill="url(#redSphere)" stroke="#fca5a5" strokeWidth="2.5" />
            {/* Spinning ZigZag Stripe Accent */}
            <path
              d="M -16 -8 Q 0 12 16 -8 M -16 8 Q 0 -12 16 8"
              fill="none"
              stroke="#ffffff"
              strokeWidth="2.5"
              opacity="0.8"
            />
            <circle cx="-6" cy="-8" r="4" fill="#ffffff" opacity="0.6" />
          </g>
        )}

        {/* Finished Winner Crown */}
        {isRedFinished && (
          <g transform="translate(0, -32)">
            <text x="0" y="0" fontSize="22" textAnchor="middle" className="animate-bounce">
              👑
            </text>
          </g>
        )}
      </g>
    </svg>
  );
};
