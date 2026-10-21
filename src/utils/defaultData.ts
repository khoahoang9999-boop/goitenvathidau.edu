import { Student } from '../types';
import {
  saveToAppDB,
  getFromAppDB,
  getCurrentUserScope,
  getUserScopedKey,
} from '../services/dataStorage';

export const AVATAR_COLORS = [
  '#3B82F6', // Blue
  '#10B981', // Emerald
  '#F59E0B', // Amber
  '#EF4444', // Red
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#06B6D4', // Cyan
  '#14B8A6', // Teal
  '#F97316', // Orange
  '#6366F1', // Indigo
  '#84CC16', // Lime
  '#D946EF', // Fuchsia
];

export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  // Usually in Vietnam, last word is given name
  const firstLetter = parts[0].charAt(0).toUpperCase();
  const lastLetter = parts[parts.length - 1].charAt(0).toUpperCase();
  return `${firstLetter}${lastLetter}`;
}

export function getShortName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length <= 2) return fullName;
  return parts.slice(-2).join(' '); // e.g. "Mai Anh", "Gia Huy"
}

// Generate nice illustrated SVG avatar as base64
function generatePresetAvatarSvg(bgColor: string, emoji: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
    <circle cx="50" cy="50" r="50" fill="${bgColor}"/>
    <text x="50" y="58" font-size="44" text-anchor="middle" dominant-baseline="middle" font-family="system-ui, sans-serif">${emoji}</text>
  </svg>`;
  return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
}

export const SAMPLE_CLASSES: { id: string; name: string; grade: string }[] = [
  { id: 'cls-6a1', name: 'Lớp 6A1', grade: 'Khối 6' },
  { id: 'cls-6a2', name: 'Lớp 6A2', grade: 'Khối 6' },
  { id: 'cls-7a1', name: 'Lớp 7A1', grade: 'Khối 7' },
  { id: 'cls-8a1', name: 'Lớp 8A1', grade: 'Khối 8' },
  { id: 'cls-9a1', name: 'Lớp 9A1', grade: 'Khối 9' },
];

export const SAMPLE_STUDENTS: Student[] = [
  { id: 'std-1', name: 'Nguyễn Hoàng Nam', className: 'Lớp 6A1', grade: 'Khối 6', color: '#3B82F6', called: false, calledCount: 0, avatar: generatePresetAvatarSvg('#3B82F6', '🦁') },
  { id: 'std-2', name: 'Trần Thị Mai Anh', className: 'Lớp 6A1', grade: 'Khối 6', color: '#EC4899', called: false, calledCount: 0, avatar: generatePresetAvatarSvg('#EC4899', '🌸') },
  { id: 'std-3', name: 'Lê Quốc Bảo', className: 'Lớp 6A1', grade: 'Khối 6', color: '#10B981', called: false, calledCount: 0, avatar: generatePresetAvatarSvg('#10B981', '🚀') },
  { id: 'std-4', name: 'Phạm Minh Thư', className: 'Lớp 6A1', grade: 'Khối 6', color: '#8B5CF6', called: false, calledCount: 0, avatar: generatePresetAvatarSvg('#8B5CF6', '🦄') },
  { id: 'std-5', name: 'Hoàng Gia Huy', className: 'Lớp 6A1', grade: 'Khối 6', color: '#F59E0B', called: false, calledCount: 0, avatar: generatePresetAvatarSvg('#F59E0B', '⚡') },
  { id: 'std-6', name: 'Đỗ Thuý Hằng', className: 'Lớp 6A1', grade: 'Khối 6', color: '#06B6D4', called: false, calledCount: 0, avatar: generatePresetAvatarSvg('#06B6D4', '🐬') },
  { id: 'std-7', name: 'Vũ Đức Anh', className: 'Lớp 6A1', grade: 'Khối 6', color: '#EF4444', called: false, calledCount: 0, avatar: generatePresetAvatarSvg('#EF4444', '🔥') },
  { id: 'std-8', name: 'Bùi Phương Linh', className: 'Lớp 6A1', grade: 'Khối 6', color: '#14B8A6', called: false, calledCount: 0, avatar: generatePresetAvatarSvg('#14B8A6', '🌺') },
  { id: 'std-9', name: 'Phan Đình Trọng', className: 'Lớp 6A2', grade: 'Khối 6', color: '#6366F1', called: false, calledCount: 0, avatar: generatePresetAvatarSvg('#6366F1', '⚽') },
  { id: 'std-10', name: 'Đặng Hải Đăng', className: 'Lớp 6A2', grade: 'Khối 6', color: '#F97316', called: false, calledCount: 0, avatar: generatePresetAvatarSvg('#F97316', '🌟') },
  { id: 'std-11', name: 'Trịnh Thảo My', className: 'Lớp 6A2', grade: 'Khối 6', color: '#D946EF', called: false, calledCount: 0, avatar: generatePresetAvatarSvg('#D946EF', '🎀') },
  { id: 'std-12', name: 'Võ Thanh Tùng', className: 'Lớp 6A2', grade: 'Khối 6', color: '#84CC16', called: false, calledCount: 0, avatar: generatePresetAvatarSvg('#84CC16', '🌲') },
  { id: 'std-13', name: 'Dương Ngọc Ánh', className: 'Lớp 7A1', grade: 'Khối 7', color: '#0EA5E9', called: false, calledCount: 0, avatar: generatePresetAvatarSvg('#0EA5E9', '💎') },
  { id: 'std-14', name: 'Lý Minh Khôi', className: 'Lớp 7A1', grade: 'Khối 7', color: '#E11D48', called: false, calledCount: 0, avatar: generatePresetAvatarSvg('#E11D48', '👑') },
  { id: 'std-15', name: 'Mai Tuyết Nhi', className: 'Lớp 7A1', grade: 'Khối 7', color: '#A855F7', called: false, calledCount: 0, avatar: generatePresetAvatarSvg('#A855F7', '❄️') },
  { id: 'std-16', name: 'Hồ Quang Dũng', className: 'Lớp 7A1', grade: 'Khối 7', color: '#059669', called: false, calledCount: 0, avatar: generatePresetAvatarSvg('#059669', '🎯') },
];

export const STORAGE_KEY = 'classroom_picker_students_v3';
export const STORAGE_CLASSES_KEY = 'classroom_picker_classes_v3';
export const STORAGE_ACTIVE_CLASS_KEY = 'classroom_picker_active_class_v3';

const LEGACY_STUDENT_KEYS = [
  'classroom_picker_students_v3',
  'classroom_picker_students_v2',
  'classroom_picker_students_v1',
  'classroom_picker_students',
  'cp_students',
];

const LEGACY_CLASS_KEYS = [
  'classroom_picker_classes_v3',
  'classroom_picker_classes_v2',
  'classroom_picker_classes_v1',
  'classroom_picker_classes',
  'cp_classes',
];

export function loadSavedActiveClass(explicitUsername?: string | null): string {
  try {
    const scope = getCurrentUserScope(explicitUsername);
    const scopedKey = getUserScopedKey(STORAGE_ACTIVE_CLASS_KEY, scope);
    const saved = localStorage.getItem(scopedKey);
    if (saved) return saved;
    if (scope === 'admin') {
      const legacy = localStorage.getItem(STORAGE_ACTIVE_CLASS_KEY);
      if (legacy) return legacy;
    }
  } catch {}
  return 'Lớp 6A1';
}

export function saveActiveClass(selectedClass: string, explicitUsername?: string | null): void {
  try {
    const scopedKey = getUserScopedKey(STORAGE_ACTIVE_CLASS_KEY, explicitUsername);
    localStorage.setItem(scopedKey, selectedClass);
  } catch {}
}

export function loadSavedClasses(
  explicitUsername?: string | null
): { id: string; name: string; grade: string }[] {
  try {
    const scope = getCurrentUserScope(explicitUsername);
    const scopedKey = getUserScopedKey(STORAGE_CLASSES_KEY, scope);
    const rawScoped = localStorage.getItem(scopedKey);
    if (rawScoped) {
      const parsed = JSON.parse(rawScoped);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }

    // Only allow legacy unscoped fallback for root admin account
    if (scope === 'admin') {
      for (const key of LEGACY_CLASS_KEYS) {
        const raw = localStorage.getItem(key);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      }
    }
  } catch {}
  return SAMPLE_CLASSES.map((c) => ({ ...c }));
}

export async function loadSavedClassesAsync(
  explicitUsername?: string | null
): Promise<{ id: string; name: string; grade: string }[] | null> {
  try {
    const dbClasses = await getFromAppDB<{ id: string; name: string; grade: string }[]>(
      'classes',
      explicitUsername
    );
    if (Array.isArray(dbClasses) && dbClasses.length > 0) {
      return dbClasses;
    }
  } catch {}
  return null;
}

export function saveClasses(
  classes: { id: string; name: string; grade: string }[],
  explicitUsername?: string | null
): void {
  saveToAppDB('classes', classes, explicitUsername).catch(() => {});
  try {
    const scopedKey = getUserScopedKey(STORAGE_CLASSES_KEY, explicitUsername);
    localStorage.setItem(scopedKey, JSON.stringify(classes));
  } catch {}
}

function normalizeStudentArray(parsed: Partial<Student>[]): Student[] {
  return parsed.map((s: Partial<Student>, idx: number) => ({
    ...s,
    id: s.id || `std-${idx}-${Date.now()}`,
    name: s.name || `Học sinh ${idx + 1}`,
    className: s.className || 'Lớp 6A1',
    grade: s.grade || 'Khối 6',
    called: !!s.called,
    calledCount: s.calledCount || 0,
    color: s.color || AVATAR_COLORS[idx % AVATAR_COLORS.length],
    excluded: !!s.excluded,
  })) as Student[];
}

export function loadSavedStudents(explicitUsername?: string | null): Student[] {
  try {
    const scope = getCurrentUserScope(explicitUsername);
    const scopedKey = getUserScopedKey(STORAGE_KEY, scope);
    const rawScoped = localStorage.getItem(scopedKey);
    if (rawScoped) {
      const parsed = JSON.parse(rawScoped);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return normalizeStudentArray(parsed);
      }
    }

    // Only allow legacy unscoped fallback for root admin account
    if (scope === 'admin') {
      for (const key of LEGACY_STUDENT_KEYS) {
        const raw = localStorage.getItem(key);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return normalizeStudentArray(parsed);
          }
        }
      }
    }
  } catch {}
  return SAMPLE_STUDENTS.map((s) => ({ ...s }));
}

export async function loadSavedStudentsAsync(
  explicitUsername?: string | null
): Promise<Student[] | null> {
  try {
    const dbStudents = await getFromAppDB<Student[]>('students', explicitUsername);
    if (Array.isArray(dbStudents) && dbStudents.length > 0) {
      return normalizeStudentArray(dbStudents);
    }
  } catch {}
  return null;
}

export function saveStudents(students: Student[], explicitUsername?: string | null): void {
  // Always persist full high-resolution student list + avatars to IndexedDB (unlimited quota)
  saveToAppDB('students', students, explicitUsername).catch(() => {});

  const scopedKey = getUserScopedKey(STORAGE_KEY, explicitUsername);
  try {
    localStorage.setItem(scopedKey, JSON.stringify(students));
  } catch {
    // If localStorage hits 5MB quota due to many cropped student photos,
    // save student list with lightweight SVG fallback in localStorage while IndexedDB keeps 100% of photos
    try {
      const lightweight = students.map((s) => ({
        ...s,
        avatar: s.avatar && s.avatar.length > 15000 ? undefined : s.avatar,
      }));
      localStorage.setItem(scopedKey, JSON.stringify(lightweight));
    } catch {}
  }
}
