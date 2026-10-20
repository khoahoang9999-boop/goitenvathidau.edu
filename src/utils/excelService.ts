import * as XLSX from 'xlsx';
import { Student } from '../types';
import { AVATAR_COLORS } from './defaultData';

/**
 * Excel file processing service for classroom student lists.
 */

// Generate and download a sample Excel file (.xlsx) formatted for Vietnamese classrooms
export function downloadSampleExcelTemplate(): void {
  const sampleData = [
    {
      'STT': 1,
      'Họ và tên': 'Nguyễn Hoàng Nam',
      'Lớp': '6A1',
      'Khối': 'Khối 6',
      'Ghi chú': 'Tổ 1 - Lớp phó',
    },
    {
      'STT': 2,
      'Họ và tên': 'Trần Thị Mai Anh',
      'Lớp': '6A1',
      'Khối': 'Khối 6',
      'Ghi chú': 'Tổ 1 - Cờ đỏ',
    },
    {
      'STT': 3,
      'Họ và tên': 'Lê Quốc Bảo',
      'Lớp': '6A1',
      'Khối': 'Khối 6',
      'Ghi chú': 'Tổ 2',
    },
    {
      'STT': 4,
      'Họ và tên': 'Phạm Minh Thư',
      'Lớp': '6A1',
      'Khối': 'Khối 6',
      'Ghi chú': 'Tổ 2',
    },
    {
      'STT': 5,
      'Họ và tên': 'Hoàng Gia Huy',
      'Lớp': '6A2',
      'Khối': 'Khối 6',
      'Ghi chú': 'Tổ 1',
    },
    {
      'STT': 6,
      'Họ và tên': 'Đỗ Thuý Hằng',
      'Lớp': '6A2',
      'Khối': 'Khối 6',
      'Ghi chú': 'Tổ 1',
    },
    {
      'STT': 7,
      'Họ và tên': 'Vũ Đức Anh',
      'Lớp': '7A1',
      'Khối': 'Khối 7',
      'Ghi chú': 'Lớp trưởng',
    },
    {
      'STT': 8,
      'Họ và tên': 'Bùi Phương Linh',
      'Lớp': '7A1',
      'Khối': 'Khối 7',
      'Ghi chú': 'Tổ 2',
    },
  ];

  const worksheet = XLSX.utils.json_to_sheet(sampleData);

  // Set column widths for readability in Excel
  worksheet['!cols'] = [
    { wch: 8 },  // STT
    { wch: 28 }, // Họ và tên
    { wch: 12 }, // Lớp
    { wch: 14 }, // Khối
    { wch: 22 }, // Ghi chú
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Danh sách học sinh mẫu');

  XLSX.writeFile(workbook, 'Mau_Danh_Sach_Hoc_Sinh.xlsx');
}

// Export current class or all students to Excel (.xlsx)
export function exportStudentsToExcel(students: Student[], targetClassName?: string): void {
  const filtered = targetClassName && targetClassName !== 'ALL'
    ? students.filter((s) => s.className === targetClassName)
    : students;

  const data = filtered.map((s, idx) => ({
    'STT': idx + 1,
    'Họ và tên': s.name,
    'Lớp': s.className || 'Chưa phân lớp',
    'Khối': s.grade || '',
    'Trạng thái': s.called ? 'Đã gọi lên bảng' : 'Chưa gọi',
    'Số lần được gọi': s.calledCount || 0,
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);

  worksheet['!cols'] = [
    { wch: 8 },
    { wch: 28 },
    { wch: 14 },
    { wch: 14 },
    { wch: 20 },
    { wch: 18 },
  ];

  const workbook = XLSX.utils.book_new();
  const sheetTitle = targetClassName && targetClassName !== 'ALL'
    ? targetClassName.replace(/[:\\/?*[\]]/g, '')
    : 'Tat_ca_hoc_sinh';

  XLSX.utils.book_append_sheet(workbook, worksheet, sheetTitle.substring(0, 31));

  const fileName = targetClassName && targetClassName !== 'ALL'
    ? `Danh_Sach_${targetClassName.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.xlsx`
    : `Danh_Sach_Hoc_Sinh_${new Date().toISOString().slice(0, 10)}.xlsx`;

  XLSX.writeFile(workbook, fileName);
}

export interface ParsedStudentRow {
  name: string;
  className: string;
  grade?: string;
}

// Parse uploaded Excel file (.xlsx, .xls, .csv)
export function parseExcelFile(
  file: File,
  defaultClassName: string = 'Lớp 6A1'
): Promise<ParsedStudentRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });

        const firstSheetName = workbook.SheetNames[0];
        if (!firstSheetName) {
          resolve([]);
          return;
        }

        const worksheet = workbook.Sheets[firstSheetName];
        const rawJson = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
          defval: '',
        });

        if (!rawJson || rawJson.length === 0) {
          resolve([]);
          return;
        }

        const results: ParsedStudentRow[] = [];

        rawJson.forEach((row) => {
          // Flexible key lookup
          let name = '';
          let className = defaultClassName;
          let grade = '';

          for (const key of Object.keys(row)) {
            const cleanKey = key.trim().toLowerCase();
            const val = String(row[key]).trim();

            if (
              cleanKey === 'họ và tên' ||
              cleanKey === 'ho va ten' ||
              cleanKey === 'họ tên' ||
              cleanKey === 'ho ten' ||
              cleanKey === 'tên' ||
              cleanKey === 'ten' ||
              cleanKey === 'name' ||
              cleanKey === 'full name'
            ) {
              name = val;
            } else if (
              cleanKey === 'lớp' ||
              cleanKey === 'lop' ||
              cleanKey === 'class' ||
              cleanKey === 'classname'
            ) {
              if (val) className = val.startsWith('Lớp') ? val : `Lớp ${val}`;
            } else if (
              cleanKey === 'khối' ||
              cleanKey === 'khoi' ||
              cleanKey === 'grade'
            ) {
              if (val) grade = val.startsWith('Khối') ? val : `Khối ${val}`;
            }
          }

          if (name) {
            results.push({
              name,
              className: className || defaultClassName,
              grade: grade || deriveGradeFromClassName(className),
            });
          }
        });

        resolve(results);
      } catch (err) {
        reject(err);
      }
    };

    reader.onerror = (err) => reject(err);
    reader.readAsArrayBuffer(file);
  });
}

export function deriveGradeFromClassName(className: string): string {
  const match = className.match(/(\d+)/);
  if (match) {
    return `Khối ${match[1]}`;
  }
  return 'Khối 6';
}
