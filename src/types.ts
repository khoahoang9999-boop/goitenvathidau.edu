export interface Student {
  id: string;
  name: string;
  className: string; // e.g. "Lớp 6A1"
  grade?: string; // e.g. "Khối 6"
  avatar?: string; // Base64 data URL
  color: string;
  called: boolean;
  calledCount: number;
  excluded?: boolean; // Tích chọn loại khỏi danh sách gọi tên (Vắng mặt / Ngoại trừ)
}

export interface ClassGroup {
  id: string;
  name: string;
  grade: string;
}

export type MainTab = 'picker' | 'quiz' | 'students';

export type PickerGameMode = 'wheel' | 'carousel' | 'race' | 'space3d' | 'ziczac' | 'tugofwar';

export type GameMode = PickerGameMode | 'quiz' | 'students';

export type RaceTheme = 'horse' | 'car' | 'duck' | 'rocket' | 'runner';

export type Space3DLayout = 'all' | 'wave' | 'infinity' | 'pendulum' | 'galaxy' | 'sphere';

export interface WinnerResult {
  student: Student;
  gameMode: GameMode;
  theme?: RaceTheme;
}

export interface TugTeam {
  id: string;
  name: string;
  color: string;
  badgeBg: string;
  textColor: string;
  members: Student[];
  score: number;
}

export interface AppSettings {
  noRepeat: boolean;
  flyDuration: number;
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number; // 0, 1, 2, 3
  explanation?: string;
  category?: string;
  points: number;
}

export interface QuizSet {
  id: string;
  title: string;
  category: string;
  description: string;
  questions: QuizQuestion[];
}

export interface QuizScoreRecord {
  studentId: string;
  studentName: string;
  className: string;
  avatar?: string;
  score: number;
  correctAnswers: number;
  totalAnswered: number;
}
