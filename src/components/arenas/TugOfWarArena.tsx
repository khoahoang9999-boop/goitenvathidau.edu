import React from 'react';
import { Student } from '../../types';
import { getShortName } from '../../utils/defaultData';

export const DEFAULT_TUG_OF_WAR_IMAGE = '/assets/aistudio/Gemini_Generated_Image__85e633ec.png';

interface TugOfWarArenaProps {
  ropePosition: number;
  teamBlueMembers: Student[];
  teamRedMembers: Student[];
  activeBlueStudent?: Student;
  activeRedStudent?: Student;
  showStudentFaces: boolean;
  teamBlueName: string;
  teamRedName: string;
  customImage?: string | null;
}

// Exact head coordinates (% of image width/height) for the 6 students in Gemini_Generated_Image__85e633ec.png (1376x768)
const BLUE_HEAD_POSITIONS = [
  { left: '33.5%', top: '31%' }, // Front Blue boy (closest to center)
  { left: '21.0%', top: '33%' }, // Middle Blue boy
  { left: '9.8%', top: '31%' },  // Back Blue girl
];

const RED_HEAD_POSITIONS = [
  { left: '67.2%', top: '32.5%' }, // Front Red boy (closest to center)
  { left: '80.5%', top: '35.0%' }, // Middle Red girl
  { left: '91.6%', top: '34.5%' }, // Back Red boy
];

export const TugOfWarArena: React.FC<TugOfWarArenaProps> = ({
  ropePosition,
  teamBlueMembers,
  teamRedMembers,
  showStudentFaces,
  teamBlueName,
  teamRedName,
  customImage,
}) => {
  const imageSrc = customImage || DEFAULT_TUG_OF_WAR_IMAGE;
  const isDefaultArtwork = !customImage;

  const blueStudents = teamBlueMembers.slice(0, 3);
  const redStudents = teamRedMembers.slice(0, 3);

  return (
    <div className="relative w-full h-full bg-white flex flex-col items-center justify-center overflow-hidden select-none p-1 sm:p-2">
      {/* Subtle Ground Shadow & Center/Boundary Markers */}
      <div className="absolute inset-x-4 bottom-3 h-5 rounded-full bg-slate-200/50 blur-xs pointer-events-none" />

      {/* Center Reference Line */}
      <div className="absolute top-2 bottom-2 left-1/2 -translate-x-1/2 w-0.5 border-r-2 border-dashed border-rose-400/70 pointer-events-none z-0" />
      <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-rose-50 border border-rose-200 text-[9px] font-black text-rose-600 uppercase tracking-wider pointer-events-none z-10">
        Vạch Giữa Sân
      </div>

      {/* Left (Blue) & Right (Red) Win Boundary Lines */}
      <div className="absolute top-8 bottom-4 left-[22%] w-0.5 border-r border-dashed border-blue-300/70 pointer-events-none z-0" />
      <div className="absolute top-8 bottom-4 right-[22%] w-0.5 border-r border-dashed border-red-300/70 pointer-events-none z-0" />

      {/* Team Name Badges (Top Left & Top Right) */}
      <div className="absolute top-2 left-2.5 z-10 px-3 py-1 rounded-full bg-blue-600 text-white text-[11px] font-black shadow-xs border border-blue-400">
        {teamBlueName}
      </div>
      <div className="absolute top-2 right-2.5 z-10 px-3 py-1 rounded-full bg-red-600 text-white text-[11px] font-black shadow-xs border border-red-400">
        {teamRedName}
      </div>

      {/* Dynamic Pulling Container (moves left/right with ropePosition) */}
      <div
        className="relative w-full h-full flex items-center justify-center transition-transform duration-300 ease-out z-10"
        style={{
          transform: `translateX(${(ropePosition / 100) * 95}px)`,
        }}
      >
        <div className="relative inline-flex items-center justify-center max-w-full max-h-full aspect-[1376/768]">
          <img
            src={imageSrc}
            alt="Kéo co 2 đội"
            className="w-full h-full max-h-[220px] sm:max-h-[270px] object-contain pointer-events-none select-none"
          />

          {/* Optional Student Avatar & Name Overlay when showStudentFaces is enabled on default artwork */}
          {isDefaultArtwork && showStudentFaces && (
            <>
              {BLUE_HEAD_POSITIONS.map((pos, idx) => {
                const student = blueStudents[idx];
                if (!student) return null;
                return (
                  <div
                    key={`blue-head-${student.id || idx}`}
                    className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center pointer-events-none"
                    style={{ left: pos.left, top: pos.top }}
                  >
                    <span className="mb-0.5 px-1.5 py-0.2 rounded-full bg-blue-900/90 text-white text-[9px] font-extrabold whitespace-nowrap shadow-xs border border-blue-300">
                      {getShortName(student.name)}
                    </span>
                    {student.avatar && (
                      <img
                        src={student.avatar}
                        alt={student.name}
                        className="w-9 h-9 sm:w-11 sm:h-11 rounded-full object-cover border-2 border-blue-500 bg-white shadow-md"
                      />
                    )}
                  </div>
                );
              })}

              {RED_HEAD_POSITIONS.map((pos, idx) => {
                const student = redStudents[idx];
                if (!student) return null;
                return (
                  <div
                    key={`red-head-${student.id || idx}`}
                    className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center pointer-events-none"
                    style={{ left: pos.left, top: pos.top }}
                  >
                    <span className="mb-0.5 px-1.5 py-0.2 rounded-full bg-red-900/90 text-white text-[9px] font-extrabold whitespace-nowrap shadow-xs border border-red-300">
                      {getShortName(student.name)}
                    </span>
                    {student.avatar && (
                      <img
                        src={student.avatar}
                        alt={student.name}
                        className="w-9 h-9 sm:w-11 sm:h-11 rounded-full object-cover border-2 border-red-500 bg-white shadow-md"
                      />
                    )}
                  </div>
                );
              })}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
