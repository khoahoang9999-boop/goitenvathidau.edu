import React, { useState, useId, useRef } from 'react';
import { Student, ClassGroup } from '../types';
import { AVATAR_COLORS, getInitials, SAMPLE_STUDENTS } from '../utils/defaultData';
import {
  downloadSampleExcelTemplate,
  parseExcelFile,
  deriveGradeFromClassName,
} from '../utils/excelService';
import { ImageCropperModal } from './ImageCropperModal';
import { ClassPhotoCropperModal } from './ClassPhotoCropperModal';
import {
  UserPlus,
  UserX,
  UserCheck,
  Ban,
  FileText,
  RotateCcw,
  Trash2,
  Edit2,
  Camera,
  CheckCircle2,
  Circle,
  Upload,
  RefreshCw,
  School,
  Plus,
  FileSpreadsheet,
  Check,
  TableProperties,
  LayoutGrid,
  Image as ImageIcon,
  AlertTriangle,
  Settings,
  X,
} from 'lucide-react';

interface StudentManagerProps {
  students: Student[];
  onUpdateStudents: (students: Student[]) => void;
  classes: ClassGroup[];
  onUpdateClasses: (classes: ClassGroup[]) => void;
  selectedClass: string;
  onSelectClass: (className: string) => void;
}

export const StudentManager: React.FC<StudentManagerProps> = ({
  students,
  onUpdateStudents,
  classes,
  onUpdateClasses,
  selectedClass,
  onSelectClass,
}) => {
  // View mode: 'details' (default, like Windows Explorer Details) or 'grid'
  const [viewMode, setViewMode] = useState<'details' | 'grid'>('details');

  const [filter, setFilter] = useState<'all' | 'uncalled' | 'called' | 'excluded'>('all');
  const [search, setSearch] = useState<string>('');
  const [singleName, setSingleName] = useState<string>('');
  const [singleClass, setSingleClass] = useState<string>(
    selectedClass !== 'ALL' ? selectedClass : (classes[0]?.name || 'Lớp 6A1')
  );

  const [bulkText, setBulkText] = useState<string>('');
  const [showBulkModal, setShowBulkModal] = useState<boolean>(false);
  const [showAddClassModal, setShowAddClassModal] = useState<boolean>(false);
  const [showManageClassesModal, setShowManageClassesModal] = useState<boolean>(false);
  const [classToDelete, setClassToDelete] = useState<ClassGroup | null>(null);
  const [classError, setClassError] = useState<string | null>(null);
  const [newClassName, setNewClassName] = useState<string>('');
  const [newClassGrade, setNewClassGrade] = useState<string>('Khối 6');

  // Edit class state
  const [editingClass, setEditingClass] = useState<ClassGroup | null>(null);
  const [editClassName, setEditClassName] = useState<string>('');
  const [editClassGrade, setEditClassGrade] = useState<string>('Khối 6');
  const [editClassError, setEditClassError] = useState<string | null>(null);

  // Class photo modal state
  const [showClassPhotoModal, setShowClassPhotoModal] = useState<boolean>(false);

  // Excel import status feedback
  const [importNotification, setImportNotification] = useState<string | null>(null);

  const singleNameInputId = useId();
  const searchInputId = useId();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Individual cropper state
  const [cropperOpen, setCropperOpen] = useState<boolean>(false);
  const [croppingStudentId, setCroppingStudentId] = useState<string | null>(null);

  // Dedicated Add Student modal state
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [modalStudentName, setModalStudentName] = useState<string>('');
  const [modalStudentClass, setModalStudentClass] = useState<string>('');
  const [modalStudentAvatar, setModalStudentAvatar] = useState<string | null>(null);
  const [modalStudentExcluded, setModalStudentExcluded] = useState<boolean>(false);
  const [modalStudentError, setModalStudentError] = useState<string | null>(null);
  const modalAvatarInputRef = useRef<HTMLInputElement | null>(null);

  // Edit student modal state
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);

  // Bulk delete class photos modal state
  const [showBulkDeletePhotosModal, setShowBulkDeletePhotosModal] = useState<boolean>(false);
  const [bulkDeletePhotosClass, setBulkDeletePhotosClass] = useState<string>(selectedClass);

  // Synchronize singleClass with selectedClass whenever selectedClass or classes change
  React.useEffect(() => {
    if (selectedClass !== 'ALL') {
      setSingleClass(selectedClass);
    } else if (classes.length > 0 && !classes.some((c) => c.name === singleClass)) {
      setSingleClass(classes[0].name);
    }
  }, [selectedClass, classes, singleClass]);

  // Filter students by selected class first
  const classFilteredStudents = selectedClass === 'ALL'
    ? students
    : students.filter((s) => s.className === selectedClass);

  // Excluded, called, uncalled metrics
  const excludedCount = classFilteredStudents.filter((s) => s.excluded).length;
  const activeStudentsCount = classFilteredStudents.length - excludedCount;
  const calledCount = classFilteredStudents.filter((s) => s.called && !s.excluded).length;
  const uncalledCount = classFilteredStudents.filter((s) => !s.called && !s.excluded).length;

  // Further filter by called/excluded state and search
  const visibleStudents = classFilteredStudents.filter((s) => {
    if (filter === 'uncalled' && (s.called || s.excluded)) return false;
    if (filter === 'called' && (!s.called || s.excluded)) return false;
    if (filter === 'excluded' && !s.excluded) return false;
    if (search && !s.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  // Toggle called state
  const handleToggleCalled = (id: string) => {
    const updated = students.map((s) =>
      s.id === id
        ? {
            ...s,
            called: !s.called,
            calledCount: !s.called ? s.calledCount + 1 : Math.max(0, s.calledCount - 1),
          }
        : s
    );
    onUpdateStudents(updated);
  };

  // Toggle excluded state (Loại khỏi danh sách gọi / Vắng mặt)
  const handleToggleExcluded = (id: string) => {
    const updated = students.map((s) =>
      s.id === id
        ? {
            ...s,
            excluded: !s.excluded,
          }
        : s
    );
    onUpdateStudents(updated);
  };

  // Un-exclude all students in current class or ALL
  const handleUnexcludeAll = () => {
    const updated = students.map((s) => {
      if (selectedClass === 'ALL' || s.className === selectedClass) {
        return { ...s, excluded: false };
      }
      return s;
    });
    onUpdateStudents(updated);
  };

  // Reset all called states for CURRENT class
  const handleResetCurrentClassCalled = () => {
    const updated = students.map((s) => {
      if (selectedClass === 'ALL' || s.className === selectedClass) {
        return { ...s, called: false };
      }
      return s;
    });
    onUpdateStudents(updated);
  };

  // Add single student (or comma/newline-separated list of students)
  const handleAddSingle = (e: React.FormEvent) => {
    e.preventDefault();
    const raw = singleName.trim();
    if (!raw) {
      handleOpenAddModal();
      return;
    }

    // Split by comma, semicolon, newline or bullet points
    const splitNames = raw
      .split(/[,;\n\r]+/)
      .map((n) => n.replace(/^(\d+[\.\/\-:\)]\s*|[\-\*•]\s*)/, '').trim())
      .filter((n) => n.length > 0);

    if (splitNames.length === 0) return;

    // Validate that targetClass actually exists in classes
    let targetClass = singleClass;
    if (!classes.some((c) => c.name === targetClass)) {
      targetClass = selectedClass !== 'ALL' && classes.some((c) => c.name === selectedClass)
        ? selectedClass
        : (classes[0]?.name || 'Lớp 6A1');
    }
    const grade = deriveGradeFromClassName(targetClass);

    const newStudents: Student[] = splitNames.map((name, idx) => ({
      id: `std-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
      name,
      className: targetClass,
      grade,
      color: AVATAR_COLORS[(students.length + idx) % AVATAR_COLORS.length],
      called: false,
      calledCount: 0,
    }));

    onUpdateStudents([...students, ...newStudents]);
    setSingleName('');

    // Ensure view is on target class so user immediately sees the new student
    if (selectedClass !== 'ALL' && selectedClass !== targetClass) {
      onSelectClass(targetClass);
    }

    // Success feedback notification
    if (newStudents.length === 1) {
      setImportNotification(`Đã thêm thành công học sinh "${newStudents[0].name}" vào ${targetClass}!`);
    } else {
      setImportNotification(`Đã thêm thành công ${newStudents.length} học sinh vào ${targetClass}!`);
    }
    setTimeout(() => setImportNotification(null), 3500);
  };

  // Open Add Student modal
  const handleOpenAddModal = () => {
    const defaultCls = selectedClass !== 'ALL' && classes.some((c) => c.name === selectedClass)
      ? selectedClass
      : (classes.some((c) => c.name === singleClass) ? singleClass : (classes[0]?.name || 'Lớp 6A1'));
    setModalStudentClass(defaultCls);
    setModalStudentName('');
    setModalStudentAvatar(null);
    setModalStudentExcluded(false);
    setModalStudentError(null);
    setShowAddModal(true);
  };

  // Handle avatar upload from local file
  const handleModalAvatarFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const size = 120;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const minDim = Math.min(img.width, img.height);
          const sx = (img.width - minDim) / 2;
          const sy = (img.height - minDim) / 2;
          ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, size, size);
          const compressed = canvas.toDataURL('image/jpeg', 0.85);
          setModalStudentAvatar(compressed);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Save student from modal
  const handleSaveModalStudent = (e: React.FormEvent) => {
    e.preventDefault();
    const raw = modalStudentName.trim();
    if (!raw) {
      setModalStudentError('Vui lòng nhập họ và tên học sinh');
      return;
    }

    let targetClass = modalStudentClass;
    if (!classes.some((c) => c.name === targetClass)) {
      targetClass = selectedClass !== 'ALL' && classes.some((c) => c.name === selectedClass)
        ? selectedClass
        : (classes[0]?.name || 'Lớp 6A1');
    }
    const grade = deriveGradeFromClassName(targetClass);

    const splitNames = raw
      .split(/[,;\n\r]+/)
      .map((n) => n.replace(/^(\d+[\.\/\-:\)]\s*|[\-\*•]\s*)/, '').trim())
      .filter((n) => n.length > 0);

    if (splitNames.length === 0) {
      setModalStudentError('Vui lòng nhập tên hợp lệ');
      return;
    }

    const newStudents: Student[] = splitNames.map((name, idx) => ({
      id: `std-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
      name,
      className: targetClass,
      grade,
      avatar: idx === 0 && modalStudentAvatar ? modalStudentAvatar : undefined,
      color: AVATAR_COLORS[(students.length + idx) % AVATAR_COLORS.length],
      called: false,
      calledCount: 0,
      excluded: modalStudentExcluded,
    }));

    onUpdateStudents([...students, ...newStudents]);

    if (selectedClass !== 'ALL' && selectedClass !== targetClass) {
      onSelectClass(targetClass);
    }

    if (newStudents.length === 1) {
      setImportNotification(`Đã thêm thành công học sinh "${newStudents[0].name}" vào ${targetClass}!`);
    } else {
      setImportNotification(`Đã thêm thành công ${newStudents.length} học sinh vào ${targetClass}!`);
    }
    setTimeout(() => setImportNotification(null), 3500);

    setShowAddModal(false);
  };

  // Create new class
  const handleCreateClass = (e: React.FormEvent) => {
    e.preventDefault();
    const formatted = newClassName.trim().startsWith('Lớp')
      ? newClassName.trim()
      : `Lớp ${newClassName.trim()}`;

    if (!formatted) return;

    if (classes.some((c) => c.name.toLowerCase() === formatted.toLowerCase())) {
      setClassError('Lớp học này đã tồn tại!');
      return;
    }

    const newClass: ClassGroup = {
      id: `cls-${Date.now()}`,
      name: formatted,
      grade: newClassGrade || deriveGradeFromClassName(formatted),
    };

    const updated = [...classes, newClass];
    onUpdateClasses(updated);
    onSelectClass(formatted);
    setSingleClass(formatted);
    setNewClassName('');
    setClassError(null);
    setShowAddClassModal(false);
    setImportNotification(`Đã tạo thành công lớp "${formatted}"!`);
    setTimeout(() => setImportNotification(null), 3000);
  };

  // Delete class confirmation
  const confirmDeleteClass = (classNameToDelete: string) => {
    const updatedClasses = classes.filter((c) => c.name !== classNameToDelete);
    const updatedStudents = students.filter((s) => s.className !== classNameToDelete);
    onUpdateClasses(updatedClasses);
    onUpdateStudents(updatedStudents);
    if (selectedClass === classNameToDelete) {
      onSelectClass(updatedClasses[0]?.name || 'ALL');
    }
    setClassToDelete(null);
    setImportNotification(`Đã xóa thành công lớp "${classNameToDelete}"!`);
    setTimeout(() => setImportNotification(null), 4000);
  };

  // Open edit class modal
  const handleOpenEditClass = (cls: ClassGroup) => {
    setEditingClass(cls);
    setEditClassName(cls.name);
    setEditClassGrade(cls.grade || deriveGradeFromClassName(cls.name));
    setEditClassError(null);
  };

  // Save edited class name and grade
  const handleSaveEditClass = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClass) return;

    const trimmed = editClassName.trim();
    if (!trimmed) {
      setEditClassError('Vui lòng nhập tên lớp');
      return;
    }

    const formatted = trimmed.startsWith('Lớp ') ? trimmed : `Lớp ${trimmed}`;
    const oldName = editingClass.name;

    // Check if new name conflicts with another class
    const duplicate = classes.some(
      (c) => c.id !== editingClass.id && c.name.toLowerCase() === formatted.toLowerCase()
    );
    if (duplicate) {
      setEditClassError(`Lớp "${formatted}" đã tồn tại! Vui lòng chọn tên khác.`);
      return;
    }

    // 1. Update in classes array
    const updatedClasses = classes.map((c) =>
      c.id === editingClass.id ? { ...c, name: formatted, grade: editClassGrade } : c
    );
    onUpdateClasses(updatedClasses);

    // 2. Cascade rename to all students in this class
    if (oldName !== formatted || editingClass.grade !== editClassGrade) {
      const updatedStudents = students.map((s) =>
        s.className === oldName
          ? { ...s, className: formatted, grade: editClassGrade }
          : s
      );
      onUpdateStudents(updatedStudents);
    }

    // 3. Update active selections
    if (selectedClass === oldName) {
      onSelectClass(formatted);
    }
    if (singleClass === oldName) {
      setSingleClass(formatted);
    }

    setImportNotification(`Đã đổi tên lớp "${oldName}" thành "${formatted}"!`);
    setTimeout(() => setImportNotification(null), 4000);

    setEditingClass(null);
    setEditClassError(null);
  };

  // Bulk import via text box
  const handleBulkImport = (mode: 'append' | 'replace') => {
    const lines = bulkText
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length === 0) return;

    const targetClass = selectedClass !== 'ALL' ? selectedClass : (classes[0]?.name || 'Lớp 6A1');
    const grade = deriveGradeFromClassName(targetClass);

    const newStudents: Student[] = lines.map((name, idx) => ({
      id: `std-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
      name,
      className: targetClass,
      grade,
      color: AVATAR_COLORS[(students.length + idx) % AVATAR_COLORS.length],
      called: false,
      calledCount: 0,
    }));

    if (mode === 'replace') {
      const remaining = students.filter((s) => s.className !== targetClass);
      onUpdateStudents([...remaining, ...newStudents]);
    } else {
      onUpdateStudents([...students, ...newStudents]);
    }

    setBulkText('');
    setShowBulkModal(false);
  };

  // Import from Excel file (.xlsx, .xls, .csv)
  const handleExcelFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const defaultCls = selectedClass !== 'ALL' ? selectedClass : (classes[0]?.name || 'Lớp 6A1');
      const parsedRows = await parseExcelFile(file, defaultCls);

      if (parsedRows.length === 0) {
        setImportNotification('Không tìm thấy danh sách học sinh hợp lệ trong tệp Excel.');
        setTimeout(() => setImportNotification(null), 5000);
        return;
      }

      const existingClassNames = new Set(classes.map((c) => c.name.toLowerCase()));
      const newClassesToAdd: ClassGroup[] = [];

      parsedRows.forEach((row) => {
        if (!existingClassNames.has(row.className.toLowerCase())) {
          existingClassNames.add(row.className.toLowerCase());
          newClassesToAdd.push({
            id: `cls-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            name: row.className,
            grade: row.grade || deriveGradeFromClassName(row.className),
          });
        }
      });

      if (newClassesToAdd.length > 0) {
        onUpdateClasses([...classes, ...newClassesToAdd]);
      }

      const newStudents: Student[] = parsedRows.map((row, idx) => ({
        id: `std-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
        name: row.name,
        className: row.className,
        grade: row.grade || deriveGradeFromClassName(row.className),
        color: AVATAR_COLORS[(students.length + idx) % AVATAR_COLORS.length],
        called: false,
        calledCount: 0,
      }));

      onUpdateStudents([...students, ...newStudents]);

      setImportNotification(
        `Đã nhập thành công ${newStudents.length} học sinh từ file Excel "${file.name}"!`
      );
      setTimeout(() => setImportNotification(null), 5000);
    } catch {
      setImportNotification('Lỗi đọc file Excel. Vui lòng đảm bảo tệp định dạng .xlsx hoặc .csv chuẩn.');
      setTimeout(() => setImportNotification(null), 5000);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Delete student
  const handleDeleteStudent = (id: string) => {
    onUpdateStudents(students.filter((s) => s.id !== id));
  };

  // Delete individual student photo
  const handleDeleteStudentPhoto = (id: string) => {
    const student = students.find((s) => s.id === id);
    const updated = students.map((s) =>
      s.id === id ? { ...s, avatar: undefined } : s
    );
    onUpdateStudents(updated);
    if (student) {
      setImportNotification(`Đã xóa ảnh chân dung của học sinh "${student.name}"!`);
      setTimeout(() => setImportNotification(null), 3000);
    }
  };

  // Bulk delete class photos
  const handleExecuteBulkDeletePhotos = () => {
    const targetClass = bulkDeletePhotosClass;
    const affectedStudents = students.filter(
      (s) => (targetClass === 'ALL' || s.className === targetClass) && s.avatar
    );

    if (affectedStudents.length === 0) {
      setShowBulkDeletePhotosModal(false);
      return;
    }

    const updated = students.map((s) => {
      if ((targetClass === 'ALL' || s.className === targetClass) && s.avatar) {
        return { ...s, avatar: undefined };
      }
      return s;
    });

    onUpdateStudents(updated);
    setShowBulkDeletePhotosModal(false);
    setImportNotification(
      `Đã xóa thành công ${affectedStudents.length} ảnh chân dung của ${
        targetClass === 'ALL' ? 'tất cả các lớp' : `lớp ${targetClass}`
      }!`
    );
    setTimeout(() => setImportNotification(null), 4000);
  };

  // Single avatar crop complete
  const handleCropComplete = (base64Avatar: string, targetStudentId?: string) => {
    const finalStudentId = targetStudentId || croppingStudentId;
    if (!finalStudentId) return;

    const updated = students.map((s) =>
      s.id === finalStudentId ? { ...s, avatar: base64Avatar } : s
    );
    onUpdateStudents(updated);
    setCroppingStudentId(null);
  };

  // Collective class photo avatars saved
  const handleSaveClassPhotoAvatars = (assignedMap: Record<string, string>) => {
    const updated = students.map((s) => {
      if (assignedMap[s.id]) {
        return { ...s, avatar: assignedMap[s.id] };
      }
      return s;
    });
    onUpdateStudents(updated);
    setImportNotification(`Đã cập nhật ảnh chân dung cho ${Object.keys(assignedMap).length} học sinh từ ảnh tập thể!`);
    setTimeout(() => setImportNotification(null), 5000);
  };

  return (
    <div className="w-full max-w-6xl mx-auto space-y-5 py-2">
      {/* Import Notification Banner */}
      {importNotification && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-300 text-emerald-800 rounded-2xl flex items-center justify-between text-sm animate-fade-in shadow-xs">
          <div className="flex items-center gap-2 font-medium">
            <Check size={18} className="text-emerald-600" />
            <span>{importNotification}</span>
          </div>
          <button
            onClick={() => setImportNotification(null)}
            className="text-emerald-600 hover:text-emerald-800 font-bold text-xs"
          >
            Đóng
          </button>
        </div>
      )}

      {/* Class / Grade Selector Tab Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <School size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-800">Quản lý theo Khối & Lớp học</h2>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-bold border border-indigo-200">
                  {classes.length} lớp · {students.length} học sinh
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Các trò chơi quay gọi tên sẽ <strong className="text-indigo-600">chỉ áp dụng</strong> cho học sinh thuộc lớp đang được chọn
              </p>
            </div>
          </div>

          {/* Class action buttons */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setShowAddClassModal(true)}
              className="px-3.5 py-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Plus size={15} /> Thêm lớp mới
            </button>
            <button
              onClick={() => setShowManageClassesModal(true)}
              className="px-3.5 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
              title="Xem danh sách và xóa các lớp học đã tạo"
            >
              <Settings size={14} className="text-slate-600" />
              <span>Quản lý / Xóa lớp</span>
            </button>
          </div>
        </div>

        {/* Classes pill strip */}
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100">
          <button
            onClick={() => onSelectClass('ALL')}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${
              selectedClass === 'ALL'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
            }`}
          >
            <span>{classes.length > 1 ? `Tất cả (${classes.length} lớp)` : 'Tất cả học sinh'}</span>
            <span
              className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono ${
                selectedClass === 'ALL' ? 'bg-white/25 text-white' : 'bg-slate-200 text-slate-700'
              }`}
            >
              {students.length} em
            </span>
          </button>

          {classes.map((cls) => {
            const countInClass = students.filter((s) => s.className === cls.name).length;
            const isSelected = selectedClass === cls.name;
            return (
              <div
                key={cls.id}
                className={`inline-flex items-center rounded-xl border transition-all ${
                  isSelected
                    ? 'bg-sky-600 border-sky-700 text-white shadow-sm'
                    : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <button
                  onClick={() => onSelectClass(cls.name)}
                  className="px-3 py-1.5 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <span>{cls.name}</span>
                  <span
                    className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono ${
                      isSelected ? 'bg-white/25 text-white' : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {countInClass} em
                  </span>
                </button>

                {/* Direct edit class button on pill */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenEditClass(cls);
                  }}
                  className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                    isSelected
                      ? 'text-white/80 hover:text-white hover:bg-white/20'
                      : 'text-slate-400 hover:text-indigo-600 hover:bg-indigo-50'
                  }`}
                  title={`Sửa tên ${cls.name}`}
                  aria-label={`Sửa tên ${cls.name}`}
                >
                  <Edit2 size={12} />
                </button>

                {/* Direct delete button on class pill */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setClassToDelete(cls);
                  }}
                  className={`p-1.5 mr-1 rounded-lg transition-colors cursor-pointer ${
                    isSelected
                      ? 'text-white/80 hover:text-white hover:bg-white/20'
                      : 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'
                  }`}
                  title={`Xóa ${cls.name}`}
                  aria-label={`Xóa ${cls.name}`}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Action Bar: Excel Tools & Class Photo Face Extractor */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-bold text-slate-800">
              Danh sách: {selectedClass === 'ALL' ? (classes.length > 1 ? `Toàn bộ ${classes.length} lớp (${students.length} em)` : 'Toàn bộ học sinh') : selectedClass}
            </h3>
            {selectedClass !== 'ALL' && (
              <button
                type="button"
                onClick={() => {
                  const curr = classes.find((c) => c.name === selectedClass);
                  if (curr) handleOpenEditClass(curr);
                }}
                className="px-2 py-1 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 rounded-xl transition-all cursor-pointer flex items-center gap-1 text-xs font-semibold shadow-2xs"
                title={`Sửa tên lớp ${selectedClass}`}
              >
                <Edit2 size={12} className="text-indigo-500" />
                <span>Sửa tên lớp</span>
              </button>
            )}
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-sky-100 text-sky-800 font-bold">
              {classFilteredStudents.length} học sinh
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-1">
            <span>Sẵn sàng: <strong className="text-sky-600 font-mono">{uncalledCount}</strong></span>
            <span>·</span>
            <span>Đã gọi: <strong className="text-emerald-600 font-mono">{calledCount}</strong></span>
            {excludedCount > 0 && (
              <>
                <span>·</span>
                <span className="text-rose-600 font-bold flex items-center gap-1">
                  <UserX size={13} />
                  Đã loại khỏi DS: <strong className="font-mono text-rose-700">{excludedCount}</strong> em vắng
                </span>
              </>
            )}
          </div>
        </div>

        {/* Action bar */}
        <div className="flex flex-wrap items-center gap-2">
          {/* NÚT THÊM HỌC SINH MỚI RÕ RÀNG */}
          <button
            onClick={handleOpenAddModal}
            className="px-4 py-2 text-xs font-bold text-white bg-sky-600 hover:bg-sky-700 active:scale-95 rounded-xl transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
            title="Mở bảng thêm học sinh mới (nhập tên, chọn lớp, tải ảnh)"
          >
            <UserPlus size={15} />
            <span>+ Thêm học sinh</span>
          </button>

          {/* BỎ LOẠI TẤT CẢ (Nếu có học sinh bị loại) */}
          {excludedCount > 0 && (
            <button
              onClick={handleUnexcludeAll}
              className="px-3.5 py-2 text-xs font-bold text-rose-800 bg-rose-100 hover:bg-rose-200 border border-rose-300 rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer animate-fade-in"
              title="Khôi phục tất cả các học sinh bị loại quay lại danh sách gọi tên"
            >
              <UserCheck size={15} className="text-rose-600" />
              <span>Bỏ loại tất cả ({excludedCount})</span>
            </button>
          )}

          {/* CẮT ẢNH TẬP THỂ CẢ LỚP (Feature 2) */}
          <button
            onClick={() => setShowClassPhotoModal(true)}
            className="px-3.5 py-2 text-xs font-bold text-purple-900 bg-purple-100 hover:bg-purple-200 border border-purple-300 rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
            title="Tải ảnh chụp tập thể cả lớp lên và cắt khuôn mặt từng em"
          >
            <ImageIcon size={15} className="text-purple-600" />
            <span>Cắt ảnh từ ảnh cả lớp</span>
          </button>

          {/* XÓA HÀNG LOẠT ẢNH CỦA 1 LỚP */}
          <button
            onClick={() => {
              setBulkDeletePhotosClass(selectedClass);
              setShowBulkDeletePhotosModal(true);
            }}
            className="px-3.5 py-2 text-xs font-bold text-rose-800 bg-rose-50 hover:bg-rose-100 border border-rose-300 rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
            title="Xóa ảnh chân dung hàng loạt của học sinh trong lớp đang chọn"
          >
            <Trash2 size={15} className="text-rose-600" />
            <span>Xóa ảnh hàng loạt ({classFilteredStudents.filter((s) => s.avatar).length})</span>
          </button>

          {/* Download sample Excel template */}
          <button
            onClick={downloadSampleExcelTemplate}
            className="px-3.5 py-2 text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-xl transition-colors flex items-center gap-1.5 shadow-xs"
            title="Tải file mẫu Excel (.xlsx) chuẩn về máy để điền danh sách"
          >
            <FileSpreadsheet size={15} className="text-emerald-600" />
            <span>File Mẫu Excel</span>
          </button>

          {/* Import from Excel (.xlsx / .csv) */}
          <label className="px-3.5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-all shadow-sm flex items-center gap-1.5 cursor-pointer">
            <Upload size={15} />
            <span>Nhập Excel</span>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx, .xls, .csv"
              onChange={handleExcelFileUpload}
              className="hidden"
            />
          </label>

          {/* Reset called status */}
          <button
            onClick={handleResetCurrentClassCalled}
            disabled={calledCount === 0}
            className="px-3 py-2 text-xs font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 disabled:opacity-40 disabled:cursor-not-allowed border border-amber-200 rounded-xl transition-colors flex items-center gap-1.5"
            title="Khôi phục lượt gọi cho lớp hiện tại"
          >
            <RotateCcw size={14} /> Khôi phục lượt gọi
          </button>

          {/* Bulk text import */}
          <button
            onClick={() => setShowBulkModal(true)}
            className="px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors flex items-center gap-1.5"
            title="Dán nhanh danh sách tên từ clipboard"
          >
            <FileText size={14} /> Dán văn bản
          </button>
        </div>
      </div>

      {/* Add Single Student Form & Filters & View Mode (Details vs Grid) */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5 items-center">
        {/* Form add student */}
        <form
          onSubmit={handleAddSingle}
          className="md:col-span-5 bg-white rounded-2xl p-2.5 sm:p-3 border border-slate-200 shadow-sm flex items-center gap-2"
        >
          <label htmlFor={singleNameInputId} className="sr-only">Họ và tên học sinh mới</label>
          <input
            id={singleNameInputId}
            type="text"
            value={singleName}
            onChange={(e) => setSingleName(e.target.value)}
            placeholder="Thêm nhanh học sinh (hỗ trợ nhiều tên cách nhau dấu phẩy)..."
            className="flex-1 px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-sky-500 focus:outline-none"
          />

          <select
            value={singleClass}
            onChange={(e) => setSingleClass(e.target.value)}
            className="px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 border border-slate-200 rounded-xl outline-none cursor-pointer hover:bg-slate-200 transition-colors"
          >
            {classes.map((c) => (
              <option key={c.id} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>

          <button
            type="submit"
            className="px-3.5 py-1.5 text-xs font-bold text-white bg-sky-600 hover:bg-sky-700 active:scale-95 rounded-xl transition-all flex items-center gap-1 shrink-0 cursor-pointer shadow-xs"
            title={singleName.trim() ? `Thêm ${singleName.trim()} vào ${singleClass}` : 'Mở bảng thêm học sinh'}
          >
            <UserPlus size={14} /> Thêm
          </button>
        </form>

        {/* Search & Filter */}
        <div className="md:col-span-5 bg-white rounded-2xl p-2 border border-slate-200 shadow-sm flex items-center gap-2">
          <label htmlFor={searchInputId} className="sr-only">Tìm kiếm theo tên</label>
          <input
            id={searchInputId}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo tên..."
            className="flex-1 px-2.5 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none"
          />
          <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg text-xs shrink-0">
            <button
              onClick={() => setFilter('all')}
              className={`px-2 py-0.5 rounded-md text-[11px] transition-colors ${filter === 'all' ? 'bg-white font-bold text-slate-900 shadow-xs' : 'text-slate-600'}`}
            >
              Tất cả
            </button>
            <button
              onClick={() => setFilter('uncalled')}
              className={`px-2 py-0.5 rounded-md text-[11px] transition-colors ${filter === 'uncalled' ? 'bg-white font-bold text-sky-700 shadow-xs' : 'text-slate-600'}`}
            >
              Chưa gọi
            </button>
            <button
              onClick={() => setFilter('called')}
              className={`px-2 py-0.5 rounded-md text-[11px] transition-colors ${filter === 'called' ? 'bg-white font-bold text-emerald-700 shadow-xs' : 'text-slate-600'}`}
            >
              Đã gọi
            </button>
            <button
              onClick={() => setFilter('excluded')}
              className={`px-2 py-0.5 rounded-md text-[11px] transition-colors flex items-center gap-1 ${filter === 'excluded' ? 'bg-rose-600 font-bold text-white shadow-xs' : 'text-slate-600 hover:text-rose-700'}`}
              title="Xem danh sách học sinh bị loại khỏi lượt gọi (vắng mặt)"
            >
              <span>Đã loại</span>
              {excludedCount > 0 && (
                <span className={`px-1 rounded-full text-[9px] font-mono ${filter === 'excluded' ? 'bg-white text-rose-700 font-black' : 'bg-rose-100 text-rose-700 font-bold'}`}>
                  {excludedCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* View Mode Switcher: DETAILS (Default) vs GRID */}
        <div className="md:col-span-2 bg-white rounded-2xl p-1 border border-slate-200 shadow-sm flex items-center justify-center gap-1">
          <button
            onClick={() => setViewMode('details')}
            className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
              viewMode === 'details'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
            title="Chế độ xem bảng chi tiết (Details)"
          >
            <TableProperties size={14} />
            <span>Details</span>
          </button>
          <button
            onClick={() => setViewMode('grid')}
            className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
              viewMode === 'grid'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
            title="Chế độ xem lưới thẻ (Grid)"
          >
            <LayoutGrid size={14} />
            <span>Lưới</span>
          </button>
        </div>
      </div>

      {/* MODE 1: DETAILS VIEW (Default - Windows Explorer Details Style) */}
      {viewMode === 'details' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700 border-collapse">
              <thead>
                <tr className="bg-slate-50/90 border-b border-slate-200 font-bold text-slate-600 uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4 w-12 text-center">STT</th>
                  <th className="py-3 px-3 w-16 text-center">Ảnh</th>
                  <th className="py-3 px-4">Họ và tên</th>
                  <th className="py-3 px-3 w-28">Lớp</th>
                  <th className="py-3 px-3 w-24">Khối</th>
                  <th className="py-3 px-4 w-32 text-center">Trạng thái</th>
                  <th className="py-3 px-3 w-32 text-center">Loại (Vắng)</th>
                  <th className="py-3 px-3 w-20 text-center">Lượt gọi</th>
                  <th className="py-3 px-4 w-28 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visibleStudents.map((student, idx) => (
                  <tr
                    key={student.id}
                    className={`hover:bg-slate-50/80 transition-colors ${
                      student.excluded
                        ? 'bg-rose-50/30 text-slate-500'
                        : student.called
                        ? 'bg-emerald-50/30'
                        : ''
                    }`}
                  >
                    {/* STT */}
                    <td className="py-2.5 px-4 text-center font-mono font-medium text-slate-500">
                      {idx + 1}
                    </td>

                    {/* Avatar (Click to crop / upload single photo) */}
                    <td className="py-2 px-3 text-center">
                      <div
                        onClick={() => {
                          setCroppingStudentId(student.id);
                          setCropperOpen(true);
                        }}
                        className="relative group/avatar cursor-pointer inline-block"
                        title="Tải ảnh chân dung hoặc cắt ảnh cho học sinh này"
                      >
                        <div
                          className={`w-9 h-9 rounded-full overflow-hidden flex items-center justify-center border shadow-2xs ${
                            student.excluded ? 'border-rose-300 opacity-60' : 'border-slate-200'
                          }`}
                          style={{ backgroundColor: student.color || '#3b82f6' }}
                        >
                          {student.avatar ? (
                            <img
                              src={student.avatar}
                              alt={student.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="text-white font-bold text-xs">
                              {getInitials(student.name)}
                            </span>
                          )}
                        </div>
                        <div className="absolute inset-0 bg-black/45 rounded-full flex items-center justify-center opacity-0 group-hover/avatar:opacity-100 transition-opacity text-white">
                          <Camera size={13} />
                        </div>
                      </div>
                    </td>

                    {/* Name */}
                    <td className="py-2.5 px-4 font-bold text-slate-900 text-sm">
                      <span className={student.excluded ? 'line-through text-slate-400 font-normal' : ''}>
                        {student.name}
                      </span>
                      {student.excluded && (
                        <span className="ml-2 text-[10px] font-extrabold px-1.5 py-0.2 rounded bg-rose-100 text-rose-700 uppercase tracking-wider inline-flex items-center gap-0.5">
                          <UserX size={10} /> Đã loại
                        </span>
                      )}
                    </td>

                    {/* Class */}
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 font-semibold text-slate-700">
                        {student.className}
                      </span>
                    </td>

                    {/* Grade */}
                    <td className="py-2.5 px-3 text-slate-500">
                      {student.grade || '—'}
                    </td>

                    {/* Status with quick toggle */}
                    <td className="py-2.5 px-4 text-center">
                      <button
                        type="button"
                        onClick={() => handleToggleCalled(student.id)}
                        disabled={student.excluded}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-bold text-[11px] transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                          student.called
                            ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                            : 'bg-sky-50 text-sky-700 hover:bg-sky-100'
                        }`}
                        title={student.excluded ? 'Học sinh đang bị loại khỏi danh sách gọi' : 'Nhấp để chuyển trạng thái gọi'}
                      >
                        {student.called ? (
                          <>
                            <CheckCircle2 size={12} className="text-emerald-600" />
                            <span>Đã gọi</span>
                          </>
                        ) : (
                          <>
                            <Circle size={8} className="fill-sky-500 text-sky-500" />
                            <span>Sẵn sàng</span>
                          </>
                        )}
                      </button>
                    </td>

                    {/* Excluded Toggle Button Column (TÍCH CHỌN LOẠI KHỎI DANH SÁCH GỌI TÊN) */}
                    <td className="py-2.5 px-3 text-center">
                      <button
                        type="button"
                        onClick={() => handleToggleExcluded(student.id)}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${
                          student.excluded
                            ? 'bg-rose-600 text-white shadow-2xs hover:bg-rose-700'
                            : 'bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-700 border border-slate-200'
                        }`}
                        title={student.excluded ? 'Bỏ loại (Cho phép tham gia gọi tên)' : 'Tích chọn để loại học sinh này khỏi danh sách gọi tên'}
                      >
                        {student.excluded ? (
                          <>
                            <UserX size={12} />
                            <span>Đã loại</span>
                          </>
                        ) : (
                          <>
                            <UserCheck size={12} className="text-slate-400" />
                            <span>Tham gia</span>
                          </>
                        )}
                      </button>
                    </td>

                    {/* Called count */}
                    <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-600">
                      {student.calledCount || 0}
                    </td>

                    {/* Actions */}
                    <td className="py-2.5 px-4 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setCroppingStudentId(student.id);
                            setCropperOpen(true);
                          }}
                          className="p-1.5 text-slate-400 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition-colors"
                          title="Tải/Cắt ảnh chân dung riêng"
                        >
                          <Camera size={14} />
                        </button>
                        {student.avatar && (
                          <button
                            type="button"
                            onClick={() => handleDeleteStudentPhoto(student.id)}
                            className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors"
                            title="Xóa ảnh chân dung học sinh này"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setEditingStudent(student)}
                          className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                          title="Sửa thông tin"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteStudent(student.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          title="Xóa học sinh này"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {visibleStudents.length === 0 && (
            <div className="py-12 text-center text-slate-400 space-y-2">
              <p>Không có học sinh nào trong {selectedClass === 'ALL' ? 'danh sách' : selectedClass}.</p>
              <p className="text-xs text-slate-500">
                Bạn có thể tải file mẫu Excel hoặc nhấp <strong>"Nhập Excel"</strong> để thêm học sinh nhanh chóng.
              </p>
            </div>
          )}
        </div>
      )}

      {/* MODE 2: GRID / CARDS VIEW */}
      {viewMode === 'grid' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5">
          {visibleStudents.map((student) => (
            <div
              key={student.id}
              className={`group bg-white rounded-2xl p-3.5 border transition-all shadow-xs hover:shadow-md flex items-center justify-between gap-3 ${
                student.excluded
                  ? 'border-rose-200 bg-rose-50/30 opacity-80'
                  : student.called
                  ? 'border-emerald-200 bg-emerald-50/20 opacity-75'
                  : 'border-slate-200 hover:border-sky-300'
              }`}
            >
              {/* Left: Avatar with click-to-crop affordance */}
              <div
                className="relative group/avatar cursor-pointer shrink-0"
                onClick={() => {
                  setCroppingStudentId(student.id);
                  setCropperOpen(true);
                }}
                title="Nhấp để cắt ảnh chân dung"
              >
                <div
                  className={`w-12 h-12 rounded-full overflow-hidden flex items-center justify-center border-2 shadow-sm ${
                    student.excluded ? 'border-rose-300 opacity-60' : 'border-white'
                  }`}
                  style={{ backgroundColor: student.color || '#3b82f6' }}
                >
                  {student.avatar ? (
                    <img
                      src={student.avatar}
                      alt={student.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-white font-black text-base">
                      {getInitials(student.name)}
                    </span>
                  )}
                </div>
                <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover/avatar:opacity-100 transition-opacity text-white">
                  <Camera size={16} />
                </div>
              </div>

              {/* Middle: Student Name & Class & Status */}
              <div className="flex-1 min-w-0">
                <h4
                  className={`text-sm font-bold truncate ${
                    student.excluded ? 'line-through text-slate-400 font-normal' : 'text-slate-800'
                  }`}
                  title={student.name}
                >
                  {student.name}
                </h4>
                <div className="flex items-center gap-1.5 mt-0.5 text-[11px] flex-wrap">
                  <span className="px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-semibold font-mono">
                    {student.className}
                  </span>
                  {student.excluded ? (
                    <span className="text-rose-700 font-bold flex items-center gap-0.5">
                      <UserX size={11} /> Đã loại
                    </span>
                  ) : student.called ? (
                    <span className="text-emerald-700 font-semibold flex items-center gap-0.5">
                      <CheckCircle2 size={11} /> Đã gọi
                    </span>
                  ) : (
                    <span className="text-sky-600 font-medium flex items-center gap-0.5">
                      <Circle size={8} className="fill-sky-500" /> Sẵn sàng
                    </span>
                  )}
                  {!student.excluded && student.calledCount > 0 && (
                    <span className="text-slate-400 font-mono">({student.calledCount})</span>
                  )}
                </div>
              </div>

              {/* Right: Actions */}
              <div className="flex items-center gap-1 shrink-0">
                {/* Excluded Toggle Button */}
                <button
                  type="button"
                  onClick={() => handleToggleExcluded(student.id)}
                  className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                    student.excluded
                      ? 'bg-rose-600 text-white border-rose-700 shadow-2xs'
                      : 'bg-slate-50 text-slate-400 border-slate-200 hover:border-rose-300 hover:text-rose-600'
                  }`}
                  title={student.excluded ? 'Bỏ loại (Cho phép tham gia gọi tên)' : 'Tích loại khỏi danh sách gọi tên'}
                >
                  <UserX size={16} />
                </button>

                <button
                  type="button"
                  onClick={() => handleToggleCalled(student.id)}
                  disabled={student.excluded}
                  className={`p-1.5 rounded-lg border transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
                    student.called
                      ? 'bg-emerald-500 text-white border-emerald-600'
                      : 'bg-slate-50 text-slate-400 border-slate-200 hover:border-sky-400'
                  }`}
                  title={student.called ? 'Bỏ đánh dấu đã gọi' : 'Đánh dấu đã gọi'}
                >
                  <CheckCircle2 size={16} />
                </button>

                <button
                  type="button"
                  onClick={() => setEditingStudent(student)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                  title="Sửa thông tin"
                >
                  <Edit2 size={15} />
                </button>

                {student.avatar && (
                  <button
                    type="button"
                    onClick={() => handleDeleteStudentPhoto(student.id)}
                    className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors"
                    title="Xóa ảnh chân dung học sinh này"
                  >
                    <Trash2 size={15} />
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => handleDeleteStudent(student.id)}
                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                  title="Xóa học sinh này"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}

          {visibleStudents.length === 0 && (
            <div className="col-span-full py-12 text-center bg-white rounded-2xl border border-dashed border-slate-200 text-slate-400 space-y-2">
              <p>Không có học sinh nào trong {selectedClass === 'ALL' ? 'danh sách' : selectedClass}.</p>
            </div>
          )}
        </div>
      )}

      {/* Class Photo Face Extractor Modal */}
      <ClassPhotoCropperModal
        isOpen={showClassPhotoModal}
        onClose={() => setShowClassPhotoModal(false)}
        students={students}
        currentClass={selectedClass}
        onSaveAvatars={handleSaveClassPhotoAvatars}
      />

      {/* Delete Class Confirmation Modal (Replaces browser confirm) */}
      {classToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-scale-up">
            <div className="flex items-center gap-2 text-rose-600 font-bold text-lg">
              <AlertTriangle size={22} />
              <span>Xác nhận xóa lớp học</span>
            </div>

            <p className="text-sm text-slate-700 leading-relaxed">
              Bạn có chắc chắn muốn xóa lớp <strong className="text-slate-900 font-bold">"{classToDelete.name}"</strong>?
            </p>

            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 space-y-1">
              <p className="font-bold flex items-center gap-1">
                <span>⚠️ Cảnh báo:</span>
              </p>
              <p>
                Lớp <strong>{classToDelete.name}</strong> cùng toàn bộ{' '}
                <strong>{students.filter((s) => s.className === classToDelete.name).length} học sinh</strong>{' '}
                trong lớp này sẽ bị xóa khỏi danh sách.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setClassToDelete(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={() => confirmDeleteClass(classToDelete.name)}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 size={14} /> Xác nhận xóa lớp
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manage & Delete Classes Modal */}
      {showManageClassesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-scale-up max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2 text-indigo-700 font-bold text-lg">
                <School size={20} />
                <span>Quản Lý, Sửa Tên & Xóa Lớp Học</span>
              </div>
              <button
                onClick={() => setShowManageClassesModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Hiện có <strong>{classes.length} lớp học</strong>. Bạn có thể sửa tên lớp, xóa lớp hoặc thêm lớp mới:
            </p>

            <div className="flex-1 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-2xl max-h-72">
              {classes.map((cls) => {
                const studentCount = students.filter((s) => s.className === cls.name).length;
                return (
                  <div
                    key={cls.id}
                    className="p-3 flex items-center justify-between gap-3 hover:bg-slate-50 transition-colors"
                  >
                    <div>
                      <div className="font-bold text-sm text-slate-800 flex items-center gap-2">
                        <span>{cls.name}</span>
                        <span className="text-[11px] font-normal px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                          {cls.grade}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        Số học sinh: <strong className="text-sky-600 font-mono">{studentCount} em</strong>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleOpenEditClass(cls)}
                        className="px-2.5 py-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
                        title={`Sửa tên ${cls.name}`}
                      >
                        <Edit2 size={13} /> Sửa tên
                      </button>

                      <button
                        type="button"
                        onClick={() => setClassToDelete(cls)}
                        className="px-2.5 py-1.5 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
                      >
                        <Trash2 size={13} /> Xóa lớp
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowManageClassesModal(false);
                  setShowAddClassModal(true);
                }}
                className="px-3.5 py-2 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Plus size={15} /> Thêm lớp mới
              </button>

              <button
                type="button"
                onClick={() => setShowManageClassesModal(false)}
                className="px-5 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add New Class Modal */}
      {showAddClassModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <form
            onSubmit={handleCreateClass}
            className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-scale-up"
          >
            <div className="flex items-center gap-2 text-indigo-700 font-bold text-lg">
              <School size={20} />
              <span>Tạo Lớp Học Mới</span>
            </div>

            {classError && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-medium">
                {classError}
              </div>
            )}

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Tên lớp học (ví dụ: 6A3, 7A2, 10 Tin, 12A1...)
              </label>
              <input
                type="text"
                autoFocus
                required
                value={newClassName}
                onChange={(e) => {
                  setNewClassName(e.target.value);
                  if (classError) setClassError(null);
                }}
                placeholder="Nhập tên lớp..."
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Thuộc khối lớp
              </label>
              <select
                value={newClassGrade}
                onChange={(e) => setNewClassGrade(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none"
              >
                <option value="Khối 6">Khối 6</option>
                <option value="Khối 7">Khối 7</option>
                <option value="Khối 8">Khối 8</option>
                <option value="Khối 9">Khối 9</option>
                <option value="Khối 10">Khối 10</option>
                <option value="Khối 11">Khối 11</option>
                <option value="Khối 12">Khối 12</option>
              </select>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowAddClassModal(false);
                  setClassError(null);
                }}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={!newClassName.trim()}
                className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl disabled:opacity-50 cursor-pointer"
              >
                Tạo lớp
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Edit Class Modal */}
      {editingClass && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <form
            onSubmit={handleSaveEditClass}
            className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-scale-up"
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2 text-indigo-700 font-bold text-lg">
                <Edit2 size={20} />
                <span>Sửa Tên & Khối Lớp</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditingClass(null);
                  setEditClassError(null);
                }}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Info notice */}
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 leading-relaxed">
              Lớp <strong>{editingClass.name}</strong> hiện có{' '}
              <strong>{students.filter((s) => s.className === editingClass.name).length} học sinh</strong>.
              Khi đổi tên, toàn bộ học sinh trong lớp sẽ tự động được cập nhật sang tên lớp mới.
            </div>

            {editClassError && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-medium">
                {editClassError}
              </div>
            )}

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Tên lớp học
              </label>
              <input
                type="text"
                autoFocus
                required
                value={editClassName}
                onChange={(e) => {
                  setEditClassName(e.target.value);
                  if (editClassError) setEditClassError(null);
                }}
                placeholder="Ví dụ: 6A1, 7A2, 10 Chuyên Toán..."
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Thuộc khối lớp
              </label>
              <select
                value={editClassGrade}
                onChange={(e) => setEditClassGrade(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none cursor-pointer"
              >
                <option value="Khối 6">Khối 6</option>
                <option value="Khối 7">Khối 7</option>
                <option value="Khối 8">Khối 8</option>
                <option value="Khối 9">Khối 9</option>
                <option value="Khối 10">Khối 10</option>
                <option value="Khối 11">Khối 11</option>
                <option value="Khối 12">Khối 12</option>
                <option value="Khác">Khối khác</option>
              </select>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setEditingClass(null);
                  setEditClassError(null);
                }}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={!editClassName.trim()}
                className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
              >
                Lưu thay đổi
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Bulk Text Import Modal */}
      {showBulkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <h3 className="text-lg font-bold text-slate-800">Dán danh sách học sinh cho {selectedClass}</h3>
            <p className="text-xs text-slate-500">
              Mỗi dòng một tên học sinh (có thể copy từ Word, Zalo, hoặc bảng tính).
            </p>

            <textarea
              rows={8}
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              placeholder="Nguyễn Văn A&#10;Trần Thị B&#10;Lê Văn C"
              className="w-full p-3 text-sm font-mono bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-sky-500 focus:outline-none"
            />

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => setShowBulkModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Hủy bỏ
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={!bulkText.trim()}
                  onClick={() => handleBulkImport('append')}
                  className="px-4 py-2 text-xs font-bold text-sky-700 bg-sky-50 hover:bg-sky-100 border border-sky-200 rounded-xl transition-colors disabled:opacity-50"
                >
                  Thêm nối tiếp
                </button>
                <button
                  type="button"
                  disabled={!bulkText.trim()}
                  onClick={() => handleBulkImport('replace')}
                  className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors disabled:opacity-50"
                >
                  Thay thế lớp này
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Student Modal */}
      {editingStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <h3 className="text-lg font-bold text-slate-800">Sửa thông tin học sinh</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">
                  Họ và tên
                </label>
                <input
                  type="text"
                  value={editingStudent.name}
                  onChange={(e) =>
                    setEditingStudent({ ...editingStudent, name: e.target.value })
                  }
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-sky-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">
                  Lớp học
                </label>
                <select
                  value={editingStudent.className}
                  onChange={(e) =>
                    setEditingStudent({
                      ...editingStudent,
                      className: e.target.value,
                      grade: deriveGradeFromClassName(e.target.value),
                    })
                  }
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none"
                >
                  {classes.map((c) => (
                    <option key={c.id} value={c.name}>
                      {c.name} ({c.grade})
                    </option>
                  ))}
                </select>
              </div>

              {/* Avatar management inside edit modal */}
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">
                  Ảnh chân dung
                </label>
                <div className="flex items-center gap-3 p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                  <div
                    className="w-12 h-12 rounded-full overflow-hidden border border-slate-200 flex items-center justify-center shrink-0 shadow-2xs"
                    style={{ backgroundColor: editingStudent.color || '#3b82f6' }}
                  >
                    {editingStudent.avatar ? (
                      <img
                        src={editingStudent.avatar}
                        alt={editingStudent.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-white font-bold text-sm">
                        {getInitials(editingStudent.name)}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 space-y-1">
                    {editingStudent.avatar ? (
                      <button
                        type="button"
                        onClick={() => setEditingStudent({ ...editingStudent, avatar: undefined })}
                        className="px-3 py-1.5 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg flex items-center gap-1.5 cursor-pointer transition-colors"
                      >
                        <Trash2 size={13} /> Xóa ảnh chân dung
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setCroppingStudentId(editingStudent.id);
                          setCropperOpen(true);
                        }}
                        className="px-3 py-1.5 text-xs font-bold text-sky-700 bg-sky-50 hover:bg-sky-100 border border-sky-200 rounded-lg flex items-center gap-1.5 cursor-pointer transition-colors"
                      >
                        <Camera size={13} /> Tải / Cắt ảnh chân dung
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Excluded status checkbox */}
              <div className="pt-1">
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer select-none bg-rose-50/50 p-2.5 rounded-xl border border-rose-200 hover:bg-rose-50">
                  <input
                    type="checkbox"
                    checked={!!editingStudent.excluded}
                    onChange={(e) =>
                      setEditingStudent({ ...editingStudent, excluded: e.target.checked })
                    }
                    className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500 border-slate-300 cursor-pointer"
                  />
                  <span className="text-slate-800">
                    Loại khỏi danh sách gọi tên (Vắng mặt / Tạm khóa)
                  </span>
                </label>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3">
              <button
                type="button"
                onClick={() => setEditingStudent(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() => {
                  onUpdateStudents(
                    students.map((s) =>
                      s.id === editingStudent.id ? editingStudent : s
                    )
                  );
                  setEditingStudent(null);
                }}
                className="px-4 py-2 text-xs font-bold text-white bg-sky-600 hover:bg-sky-700 rounded-xl shadow-sm"
              >
                Lưu thay đổi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Thêm học sinh mới */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-sky-100 text-sky-600 flex items-center justify-center">
                  <UserPlus size={18} />
                </div>
                <h3 className="text-base font-bold text-slate-800">Thêm học sinh mới</h3>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveModalStudent} className="space-y-4">
              {modalStudentError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
                  <AlertTriangle size={15} className="shrink-0 text-rose-500" />
                  <span>{modalStudentError}</span>
                </div>
              )}

              {/* Tên học sinh */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Họ và tên học sinh <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={modalStudentName}
                  onChange={(e) => {
                    setModalStudentName(e.target.value);
                    if (modalStudentError) setModalStudentError(null);
                  }}
                  placeholder="Ví dụ: Nguyễn Hoàng Nam (hoặc nhiều tên cách nhau dấu phẩy)"
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-sky-500 focus:outline-none"
                  autoFocus
                />
                <span className="text-[11px] text-slate-400 mt-1 block">
                  Mẹo: Bạn có thể nhập/dán nhiều tên cùng lúc cách nhau dấu phẩy hoặc xuống dòng.
                </span>
              </div>

              {/* Lớp học */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Lớp học nhận học sinh <span className="text-rose-500">*</span>
                </label>
                <select
                  value={modalStudentClass}
                  onChange={(e) => setModalStudentClass(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-sky-500 focus:outline-none cursor-pointer"
                >
                  {classes.map((c) => (
                    <option key={c.id} value={c.name}>
                      {c.name} ({c.grade})
                    </option>
                  ))}
                </select>
              </div>

              {/* Ảnh đại diện (Tùy chọn) */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1.5">
                  Ảnh chân dung (Tùy chọn)
                </label>
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-full border-2 border-slate-200 bg-slate-100 flex items-center justify-center overflow-hidden shrink-0">
                    {modalStudentAvatar ? (
                      <img
                        src={modalStudentAvatar}
                        alt="Avatar preview"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Camera size={20} className="text-slate-400" />
                    )}
                  </div>
                  <div className="flex-1 space-y-1">
                    <input
                      ref={modalAvatarInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleModalAvatarFile}
                      className="hidden"
                    />
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => modalAvatarInputRef.current?.click()}
                        className="px-3 py-1.5 text-xs font-semibold text-sky-700 bg-sky-50 hover:bg-sky-100 border border-sky-200 rounded-lg cursor-pointer"
                      >
                        {modalStudentAvatar ? 'Đổi ảnh khác' : 'Chọn ảnh từ máy'}
                      </button>
                      {modalStudentAvatar && (
                        <button
                          type="button"
                          onClick={() => setModalStudentAvatar(null)}
                          className="px-2 py-1.5 text-xs text-slate-500 hover:text-rose-600 rounded-lg cursor-pointer"
                        >
                          Xóa ảnh
                        </button>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-400">
                      Hỗ trợ định dạng JPG, PNG. Ảnh sẽ tự động được căn tròn đẹp mắt.
                    </p>
                  </div>
                </div>
              </div>

              {/* Tích chọn loại khỏi danh sách (Vắng mặt) ngay từ khi thêm */}
              <div>
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer select-none bg-rose-50/50 p-2.5 rounded-xl border border-rose-200 hover:bg-rose-50">
                  <input
                    type="checkbox"
                    checked={modalStudentExcluded}
                    onChange={(e) => setModalStudentExcluded(e.target.checked)}
                    className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500 border-slate-300 cursor-pointer"
                  />
                  <span className="text-slate-800">
                    Đánh dấu vắng mặt / loại khỏi danh sách gọi tên ngay
                  </span>
                </label>
              </div>

              {/* Action buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-sky-600 hover:bg-sky-700 rounded-xl shadow-sm cursor-pointer"
                >
                  Lưu học sinh
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Individual Circular Image Cropper Modal */}
      <ImageCropperModal
        isOpen={cropperOpen}
        onClose={() => {
          setCropperOpen(false);
          setCroppingStudentId(null);
        }}
        onCropComplete={handleCropComplete}
        onDeletePhoto={handleDeleteStudentPhoto}
        initialName={
          students.find((s) => s.id === croppingStudentId)?.name || 'học sinh'
        }
        students={students}
        croppingStudentId={croppingStudentId}
      />

      {/* Bulk Delete Class Photos Modal */}
      {showBulkDeletePhotosModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-scale-up">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2 text-rose-600 font-bold text-lg">
                <Trash2 size={20} />
                <span>Xóa Hàng Loạt Ảnh Chân Dung</span>
              </div>
              <button
                type="button"
                onClick={() => setShowBulkDeletePhotosModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Chọn lớp cần xóa toàn bộ ảnh chân dung:
                </label>
                <select
                  value={bulkDeletePhotosClass}
                  onChange={(e) => setBulkDeletePhotosClass(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none cursor-pointer font-semibold text-slate-800"
                >
                  <option value="ALL">Tất cả các lớp ({students.filter((s) => s.avatar).length} em có ảnh)</option>
                  {classes.map((c) => {
                    const countWithAvatar = students.filter((s) => s.className === c.name && s.avatar).length;
                    return (
                      <option key={c.id} value={c.name}>
                        {c.name} ({countWithAvatar} em có ảnh)
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-900 space-y-2 leading-relaxed">
                <div className="font-bold flex items-center gap-1.5 text-amber-800">
                  <AlertTriangle size={16} className="shrink-0 text-amber-600" />
                  <span>Xác nhận thông tin:</span>
                </div>
                <p>
                  Lớp <strong className="text-slate-900">{bulkDeletePhotosClass === 'ALL' ? 'Tất cả các lớp' : bulkDeletePhotosClass}</strong> có{' '}
                  <strong className="text-rose-600 font-bold">
                    {students.filter((s) => (bulkDeletePhotosClass === 'ALL' || s.className === bulkDeletePhotosClass) && s.avatar).length} học sinh
                  </strong>{' '}
                  đang có ảnh chân dung.
                </p>
                <p className="text-[11px] text-amber-800">
                  ⚠️ Thao tác này chỉ gỡ bỏ hình ảnh chân dung. Họ tên, lớp và điểm số/lịch sử quay của học sinh vẫn được lưu giữ nguyên vẹn.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowBulkDeletePhotosModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                disabled={
                  students.filter((s) => (bulkDeletePhotosClass === 'ALL' || s.className === bulkDeletePhotosClass) && s.avatar).length === 0
                }
                onClick={handleExecuteBulkDeletePhotos}
                className="px-5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 size={14} />
                <span>
                  Xác nhận xóa {students.filter((s) => (bulkDeletePhotosClass === 'ALL' || s.className === bulkDeletePhotosClass) && s.avatar).length} ảnh
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
