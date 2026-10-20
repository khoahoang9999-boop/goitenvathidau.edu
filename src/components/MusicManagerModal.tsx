import React, { useState, useEffect, useRef } from 'react';
import {
  Music,
  Upload,
  Trash2,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Check,
  RefreshCw,
  X,
  Sparkles,
  CheckCircle2,
} from 'lucide-react';
import {
  sound,
  DEFAULT_BGM_URL,
  DEFAULT_BGM_MP3_URL,
  DEFAULT_BGM_FILE_NAME,
} from '../services/sound';
import { saveTrackToDB, deleteTrackFromDB } from '../services/musicStorage';

interface MusicManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MusicManagerModal: React.FC<MusicManagerModalProps> = ({ isOpen, onClose }) => {
  const [selectedSource, setSelectedSource] = useState<string>(() => sound.getMusicSource());
  const [customTrackName, setCustomTrackName] = useState<string>(() => sound.getCustomTrackName());
  const [musicVolume, setMusicVolume] = useState<number>(() => sound.getMusicVolume());
  const [isPreviewing, setIsPreviewing] = useState<boolean>(false);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setSelectedSource(sound.getMusicSource());
      setCustomTrackName(sound.getCustomTrackName());
      setMusicVolume(sound.getMusicVolume());
      setUploadError('');
      sound.ensureTrackLoaded().then((info) => {
        setSelectedSource(info.source);
        setCustomTrackName(info.trackName);
        setMusicVolume(info.volume);
      });
    } else {
      sound.stopPreview();
      setIsPreviewing(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleFileUpload = async (file: File) => {
    if (!file) return;
    const maxMb = 1024; // Hỗ trợ file dung lượng lớn lên tới 1GB (1024MB)

    if (file.size > maxMb * 1024 * 1024) {
      setUploadError(`File quá lớn (> ${maxMb}MB). Vui lòng chọn file dưới 1GB.`);
      return;
    }

    setIsUploading(true);
    setUploadError('');

    try {
      // Save File/Blob directly into IndexedDB to support 100MB - 1GB files instantaneously
      let smallBuffer: ArrayBuffer | undefined;
      if (file.size <= 30 * 1024 * 1024) {
        try {
          smallBuffer = await file.arrayBuffer();
        } catch {}
      }

      const trackData = {
        id: 'bg_music',
        name: file.name,
        type: file.type || 'audio/mp3',
        size: file.size,
        blob: file,
        data: smallBuffer,
        updatedAt: Date.now(),
      };

      await saveTrackToDB(trackData);
      await sound.loadCustomTrackFromBlob(file, file.name);

      setSelectedSource('custom');
      setCustomTrackName(file.name);
      sound.setMusicSource('custom');
      setIsUploading(false);
    } catch (err) {
      console.error(err);
      setUploadError('Không thể lưu file nhạc. Vui lòng thử lại với file âm thanh/video khác.');
      setIsUploading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileUpload(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileUpload(file);
  };

  const handleRemoveCustomTrack = async () => {
    sound.stopPreview();
    setIsPreviewing(false);
    await deleteTrackFromDB('bg_music');
    sound.removeCustomTrack();
    setCustomTrackName('');
    setSelectedSource('default_track');
    sound.setMusicSource('default_track');
  };

  const handleSourceSelect = (source: string) => {
    setSelectedSource(source);
    sound.setMusicSource(source);
    if (isPreviewing) {
      sound.stopPreview();
      sound.startPreview();
    }
  };

  const handleVolumeChange = (v: number) => {
    setMusicVolume(v);
    sound.setMusicVolume(v);
  };

  const togglePreview = () => {
    if (isPreviewing) {
      sound.stopPreview();
      setIsPreviewing(false);
    } else {
      sound.startPreview();
      setIsPreviewing(true);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-md p-4 animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-indigo-600 via-sky-600 to-indigo-700 px-6 py-4 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-white/20 rounded-2xl backdrop-blur-xs">
              <Music size={22} className="text-white" />
            </div>
            <div>
              <h3 className="font-extrabold text-lg leading-tight">Quản Lý Nhạc Nền Trò Chơi</h3>
              <p className="text-xs text-indigo-100 font-medium">
                Đã tích hợp mặc định nhạc Geometry Dash & hỗ trợ tải file lớn tới 1GB
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-indigo-100 hover:text-white hover:bg-white/20 transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 space-y-4 overflow-y-auto max-h-[80vh]">
          {/* Audio Source Options */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2.5">
              Chọn Nguồn Nhạc Nền Phát Trong Trò Chơi
            </label>

            <div className="space-y-3">
              {/* Option 1: Built-in Default Track (Geometry Dash - User's uploaded file) */}
              <div
                onClick={() => handleSourceSelect('default_track')}
                className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer flex flex-col gap-2.5 ${
                  selectedSource === 'default_track'
                    ? 'border-indigo-600 bg-indigo-50/90 shadow-sm'
                    : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`p-2.5 rounded-xl shrink-0 ${
                        selectedSource === 'default_track'
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      <Music size={18} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h4 className="text-sm font-extrabold text-slate-900">
                          🔥 Nhạc Mặc Định (Geometry Dash)
                        </h4>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 size={11} /> ĐÃ TÍCH HỢP SẴN
                        </span>
                      </div>
                      <p className="text-xs text-indigo-700 font-semibold truncate mt-0.5">
                        File: {DEFAULT_BGM_FILE_NAME} (01:45)
                      </p>
                    </div>
                  </div>
                  {selectedSource === 'default_track' && (
                    <Check size={18} className="text-indigo-600 font-bold shrink-0 mt-1" />
                  )}
                </div>

                {/* Built-in Audio Player Preview for Default Track */}
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="bg-white/90 border border-indigo-200/80 rounded-xl px-3 py-2 flex flex-col gap-1"
                >
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-600">
                    <span>🎵 Nghe trực tiếp bản nhạc mặc định đã nhúng trong ứng dụng:</span>
                    <span className="text-emerald-600">Online & Offline</span>
                  </div>
                  <audio
                    controls
                    preload="metadata"
                    className="w-full h-8"
                  >
                    <source src={DEFAULT_BGM_MP3_URL} type="audio/mpeg" />
                    <source src={DEFAULT_BGM_URL} type="video/mp4" />
                  </audio>
                </div>
              </div>

              {/* Option 2: Custom Uploaded Track (Supports up to 1GB) */}
              <div
                onClick={() => {
                  if (customTrackName) handleSourceSelect('custom');
                }}
                className={`p-3.5 rounded-2xl border-2 transition-all flex flex-col gap-2.5 ${
                  selectedSource === 'custom'
                    ? 'border-emerald-500 bg-emerald-50/70 shadow-sm'
                    : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                } ${!customTrackName ? 'cursor-default' : 'cursor-pointer'}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`p-2.5 rounded-xl ${
                        selectedSource === 'custom'
                          ? 'bg-emerald-500 text-white'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      <Upload size={18} />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-800">
                        📂 Tải Thêm Nhạc / Video Dung Lượng Lớn (Tới 1GB)
                      </h4>
                      <p className="text-xs text-slate-500">
                        {customTrackName
                          ? `Đang dùng file tải lên: ${customTrackName}`
                          : `Đang dùng mặc định (${DEFAULT_BGM_FILE_NAME}) — bấm bên dưới nếu muốn đổi bài khác`}
                      </p>
                    </div>
                  </div>
                  {selectedSource === 'custom' && customTrackName && (
                    <Check size={18} className="text-emerald-600 font-bold shrink-0" />
                  )}
                </div>

                {/* File Dropzone & Upload Button */}
                {!customTrackName ? (
                  <div
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={handleDrop}
                    onClick={(e) => {
                      e.stopPropagation();
                      fileInputRef.current?.click();
                    }}
                    className="border-2 border-dashed border-slate-300 hover:border-sky-500 rounded-xl p-3.5 text-center bg-slate-50 hover:bg-sky-50/50 transition-colors cursor-pointer group"
                  >
                    <Upload
                      size={22}
                      className="mx-auto text-slate-400 group-hover:text-sky-600 transition-colors mb-1"
                    />
                    <p className="text-xs font-bold text-slate-700">
                      Bấm hoặc Kéo Thả File Nhạc / Video (.mp3, .mp4, .wav, .m4a, .mov) — Tối đa 1GB
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Hỗ trợ file dung lượng lớn lưu trực tiếp vào bộ nhớ trình duyệt
                    </p>
                  </div>
                ) : (
                  <div className="flex items-center justify-between bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs">
                    <span className="font-semibold text-slate-700 truncate max-w-[260px]">
                      {customTrackName}
                    </span>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          fileInputRef.current?.click();
                        }}
                        className="text-sky-600 hover:text-sky-800 font-bold hover:underline cursor-pointer flex items-center gap-1"
                      >
                        <RefreshCw size={12} /> Đổi file khác
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveCustomTrack();
                        }}
                        className="text-rose-500 hover:text-rose-700 p-1 rounded-md hover:bg-rose-50 cursor-pointer"
                        title="Xóa nhạc riêng & quay về nhạc Geometry Dash mặc định"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                )}

                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="audio/*,video/*,.mp3,.wav,.m4a,.mp4,.ogg,.aac,.flac,.webm,.mov,.mkv"
                  className="hidden"
                />
              </div>

              {/* Option 3: Built-in Web Audio Synth */}
              <div
                onClick={() => handleSourceSelect('synth')}
                className={`p-3 rounded-2xl border-2 transition-all cursor-pointer flex items-center justify-between ${
                  selectedSource === 'synth'
                    ? 'border-sky-500 bg-sky-50/70 shadow-sm'
                    : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`p-2 rounded-xl ${
                      selectedSource === 'synth'
                        ? 'bg-sky-500 text-white'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    <Sparkles size={16} />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-800">
                      🎹 Nhạc Điện Tử Synthesizer Nhẹ Nhàng
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Giai điệu điện tử nhẹ tạo bằng bộ tổng hợp âm thanh
                    </p>
                  </div>
                </div>
                {selectedSource === 'synth' && (
                  <Check size={16} className="text-sky-600 font-bold shrink-0" />
                )}
              </div>
            </div>

            {uploadError && (
              <p className="text-xs text-rose-600 font-medium mt-2 bg-rose-50 border border-rose-200 rounded-lg p-2">
                ⚠️ {uploadError}
              </p>
            )}

            {isUploading && (
              <p className="text-xs text-sky-600 font-bold mt-2 animate-pulse flex items-center gap-1.5">
                <RefreshCw size={14} className="animate-spin" /> Đang tải và lưu trữ file dung lượng lớn...
              </p>
            )}
          </div>

          {/* Volume Control Slider */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                {musicVolume === 0 ? (
                  <VolumeX size={16} className="text-slate-400" />
                ) : (
                  <Volume2 size={16} className="text-sky-600" />
                )}
                Âm Lượng Nhạc Nền (BGM)
              </label>
              <span className="text-xs font-bold text-slate-600 font-mono">
                {Math.round(musicVolume * 100)}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={musicVolume}
              onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
              className="w-full accent-sky-600 cursor-pointer h-2 bg-slate-200 rounded-lg"
            />
          </div>

          {/* Preview Playback Test */}
          <div className="flex items-center justify-between pt-1">
            <button
              onClick={togglePreview}
              className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all cursor-pointer shadow-sm ${
                isPreviewing
                  ? 'bg-amber-500 hover:bg-amber-600 text-white ring-2 ring-amber-300'
                  : 'bg-slate-900 hover:bg-slate-800 text-white'
              }`}
            >
              {isPreviewing ? <Pause size={16} /> : <Play size={16} />}
              <span>{isPreviewing ? 'Tạm Dừng Nghe Thử' : 'Nghe Thử Nhạc Đã Chọn'}</span>
            </button>

            <button
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs shadow-md transition-all cursor-pointer"
            >
              Hoàn Tất & Lưu
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
