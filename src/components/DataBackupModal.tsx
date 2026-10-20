import React, { useState, useRef, useEffect } from 'react';
import {
  Database,
  Download,
  Upload,
  CheckCircle2,
  AlertTriangle,
  X,
  HardDrive,
  Music,
  Users,
  Image as ImageIcon,
  ShieldCheck,
} from 'lucide-react';
import { Student, ClassGroup } from '../types';
import {
  createFullBackupData,
  restoreFullBackupData,
  getFromAppDB,
} from '../services/dataStorage';
import { sound } from '../services/sound';

interface DataBackupModalProps {
  isOpen: boolean;
  onClose: () => void;
  students: Student[];
  classes: ClassGroup[];
  selectedClass: string;
  onRestored: (data: {
    students: Student[];
    classes: ClassGroup[];
    selectedClass: string;
  }) => void;
}

export const DataBackupModal: React.FC<DataBackupModalProps> = ({
  isOpen,
  onClose,
  students,
  classes,
  selectedClass,
  onRestored,
}) => {
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [hasTugImage, setHasTugImage] = useState(false);
  const [musicName, setMusicName] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setStatusMessage(null);
    sound.ensureTrackLoaded().then((info) => {
      setMusicName(info.trackName || '');
    });
    getFromAppDB<string>('custom_tug_image').then((img) => {
      setHasTugImage(!!(img || localStorage.getItem('cp_custom_tug_image')));
    });
  }, [isOpen]);

  if (!isOpen) return null;

  const customPhotoCount = students.filter(
    (s) => s.avatar && !s.avatar.startsWith('data:image/svg+xml')
  ).length;

  const handleExportBackup = async () => {
    setIsExporting(true);
    setStatusMessage(null);
    try {
      const payload = await createFullBackupData(students, classes, selectedClass);
      const jsonStr = JSON.stringify(payload);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      const dateStr = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `SaoLuu_ClassroomPicker_${dateStr}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setStatusMessage({
        type: 'success',
        text: 'Đã tải xuống file sao lưu toàn bộ dữ liệu (Học sinh, Ảnh, Nhạc nền, Ảnh kéo co & Câu hỏi)!',
      });
    } catch (err) {
      console.error(err);
      setStatusMessage({
        type: 'error',
        text: 'Không thể xuất file sao lưu. Vui lòng thử lại.',
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setStatusMessage(null);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const restored = await restoreFullBackupData(parsed);
      onRestored(restored);

      const info = await sound.ensureTrackLoaded();
      setMusicName(info.trackName || '');
      const tugImg = await getFromAppDB<string>('custom_tug_image');
      setHasTugImage(!!(tugImg || localStorage.getItem('cp_custom_tug_image')));

      setStatusMessage({
        type: 'success',
        text: `Khôi phục thành công ${restored.students.length} học sinh, ${restored.classes.length} lớp, cùng toàn bộ ảnh và nhạc nền!`,
      });
      sound.playFanfare();
    } catch (err: any) {
      console.error(err);
      setStatusMessage({
        type: 'error',
        text: err?.message || 'File khôi phục không hợp lệ. Vui lòng chọn đúng file .json đã sao lưu.',
      });
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4 animate-fade-in">
      <div className="w-full max-w-lg rounded-3xl bg-white shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-sky-600 px-6 py-4 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-white/20 rounded-2xl">
              <Database size={22} />
            </div>
            <div>
              <h3 className="font-extrabold text-base sm:text-lg leading-tight">
                Bảo Vệ & Sao Lưu Dữ Liệu Vĩnh Viễn
              </h3>
              <p className="text-xs text-emerald-100 font-medium">
                Lưu trữ IndexedDB dung lượng lớn & Chuyển dữ liệu sang máy / web khác
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-white/80 hover:text-white hover:bg-white/20 transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto max-h-[80vh] text-slate-800">
          {/* Explanation of why data is safe now & how cross-domain works */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3.5 text-xs text-emerald-950 space-y-1.5">
            <div className="font-extrabold flex items-center gap-1.5 text-emerald-800 text-sm">
              <ShieldCheck size={17} />
              <span>Đã nâng cấp bộ nhớ chống mất dữ liệu (IndexedDB):</span>
            </div>
            <p className="leading-relaxed">
              • Trước đây trình duyệt giới hạn <strong>localStorage 5MB</strong> nên khi tải nhiều ảnh học sinh, ảnh kéo co và nhạc sẽ bị tràn bộ nhớ. Nay ứng dụng đã chuyển sang <strong>IndexedDB dung lượng lớn (hàng trăm MB)</strong>, tự động lưu vĩnh viễn trên máy.
            </p>
            <p className="leading-relaxed">
              • <strong>Lưu ý khi chuyển sang trang Cloudflare Pages hoặc đổi máy tính:</strong> Dữ liệu trên trình duyệt gắn với từng địa chỉ web. Bạn chỉ cần bấm <strong>&ldquo;Tải File Sao Lưu&rdquo;</strong> ở dưới rồi <strong>&ldquo;Khôi Phục&rdquo;</strong> trên trang web mới là có ngay 100% học sinh, ảnh và nhạc!
            </p>
          </div>

          {/* Current Storage Summary */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-sky-100 text-sky-700">
                <Users size={18} />
              </div>
              <div>
                <div className="text-[11px] font-bold text-slate-500">Danh sách lớp & HS</div>
                <div className="text-xs font-black text-slate-900">
                  {classes.length} lớp · {students.length} học sinh
                </div>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-indigo-100 text-indigo-700">
                <ImageIcon size={18} />
              </div>
              <div>
                <div className="text-[11px] font-bold text-slate-500">Ảnh HS & Đội Kéo Co</div>
                <div className="text-xs font-black text-slate-900">
                  {customPhotoCount > 0 ? `${customPhotoCount} ảnh thật` : 'Ảnh mặc định'}{' '}
                  {hasTugImage ? '+ Ảnh kéo co' : ''}
                </div>
              </div>
            </div>

            <div className="col-span-2 bg-slate-50 border border-slate-200 rounded-2xl p-3 flex items-center justify-between">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="p-2 rounded-xl bg-purple-100 text-purple-700 shrink-0">
                  <Music size={18} />
                </div>
                <div className="min-w-0">
                  <div className="text-[11px] font-bold text-slate-500">Nhạc nền tích hợp trong ứng dụng</div>
                  <div className="text-xs font-black text-slate-900 truncate">
                    {musicName
                      ? `🎵 ${musicName}`
                      : '🔥 Nhạc Geometry Dash mặc định (Nay_tui_ch_i_th__game_geometry_dash_nha_391866df.mp4)'}
                  </div>
                </div>
              </div>
              <span className="text-[10px] font-extrabold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full shrink-0">
                Hỗ trợ Offline
              </span>
            </div>
          </div>

          {/* Export & Import Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <button
              onClick={handleExportBackup}
              disabled={isExporting}
              className="flex flex-col items-center justify-center gap-1.5 p-4 rounded-2xl bg-gradient-to-br from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white shadow-lg cursor-pointer transition-all active:scale-95 disabled:opacity-50"
            >
              <Download size={22} />
              <span className="text-xs sm:text-sm font-black">
                {isExporting ? 'Đang đóng gói...' : 'Tải File Sao Lưu (.json)'}
              </span>
              <span className="text-[10px] text-sky-100 text-center">
                Lưu toàn bộ HS, Ảnh, Nhạc & Câu hỏi về máy
              </span>
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isImporting}
              className="flex flex-col items-center justify-center gap-1.5 p-4 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-lg cursor-pointer transition-all active:scale-95 disabled:opacity-50"
            >
              <Upload size={22} />
              <span className="text-xs sm:text-sm font-black">
                {isImporting ? 'Đang khôi phục...' : 'Khôi Phục Từ File (.json)'}
              </span>
              <span className="text-[10px] text-emerald-100 text-center">
                Nhập lại toàn bộ dữ liệu từ file đã lưu
              </span>
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              onChange={handleImportFile}
              className="hidden"
            />
          </div>

          {statusMessage && (
            <div
              className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 ${
                statusMessage.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'bg-rose-50 text-rose-700 border border-rose-200'
              }`}
            >
              {statusMessage.type === 'success' ? (
                <CheckCircle2 size={16} className="shrink-0 text-emerald-600" />
              ) : (
                <AlertTriangle size={16} className="shrink-0 text-rose-600" />
              )}
              <span>{statusMessage.text}</span>
            </div>
          )}
        </div>

        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
            <HardDrive size={13} /> Tự động lưu trữ Offline trên trình duyệt này
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
