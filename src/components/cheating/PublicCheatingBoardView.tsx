import React, { useState } from 'react';
import { useExam } from '../../context/ExamContext';
import { ViolationLog } from '../../types';
import {
  ShieldAlert,
  Search,
  Filter,
  AlertTriangle,
  Clock,
  User,
  GraduationCap,
  Layers,
  Camera,
  ExternalLink,
  ChevronDown,
  CheckCircle,
  Eye,
  Activity,
  Flame,
  ArrowLeft,
  RefreshCw,
  Trash2,
  Monitor,
  AlertOctagon,
} from 'lucide-react';

interface PublicCheatingBoardViewProps {
  onBack?: () => void;
}

export const PublicCheatingBoardView: React.FC<PublicCheatingBoardViewProps> = ({
  onBack,
}) => {
  const { violations, exams, classes, users, currentUser, deleteViolation, clearViolations } = useExam();

  const isAuthorizedToDelete = currentUser?.role === 'admin' || currentUser?.role === 'dosen';

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedSeverity, setSelectedSeverity] = useState<string>('all');
  const [selectedClass, setSelectedClass] = useState<string>('all');
  const [selectedViolationForPreview, setSelectedViolationForPreview] = useState<ViolationLog | null>(null);

  // Filter violations
  const filteredViolations = violations.filter((v) => {
    if (selectedType !== 'all' && v.violationType !== selectedType) return false;
    if (selectedSeverity !== 'all' && v.severity !== selectedSeverity) return false;
    if (selectedClass !== 'all') {
      const student = users.find((u) => u.id === v.studentId);
      const studentClassId = student?.classId;
      if (studentClassId !== selectedClass && v.studentClassName !== selectedClass) return false;
    }

    const term = searchTerm.toLowerCase();
    const student = users.find((u) => u.id === v.studentId);
    const className = v.studentClassName || student?.className || '';

    return (
      v.studentName.toLowerCase().includes(term) ||
      v.studentNim.toLowerCase().includes(term) ||
      v.examTitle.toLowerCase().includes(term) ||
      v.title.toLowerCase().includes(term) ||
      v.description.toLowerCase().includes(term) ||
      className.toLowerCase().includes(term)
    );
  });

  // Calculate statistics
  const totalViolations = violations.length;
  const uniqueStudents = new Set(violations.map((v) => v.studentId)).size;
  const highSeverityCount = violations.filter((v) => v.severity === 'high').length;
  const tabSwitchCount = violations.filter((v) => v.violationType === 'tab_switch' || v.violationType === 'fullscreen_exit').length;

  const getSeverityBadge = (severity: ViolationLog['severity']) => {
    switch (severity) {
      case 'high':
        return (
          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-200 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-600 animate-pulse"></span>
            Tinggi (Kritis)
          </span>
        );
      case 'medium':
        return (
          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
            Sedang
          </span>
        );
      case 'low':
        return (
          <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            Ringan
          </span>
        );
    }
  };

  const getViolationTypeLabel = (type: ViolationLog['violationType']) => {
    switch (type) {
      case 'tab_switch':
        return 'Pindah Tab / Keluar Jendela';
      case 'fullscreen_exit':
        return 'Keluar Layar Penuh (Terkunci)';
      case 'no_face':
        return 'Wajah Tidak Terdeteksi';
      case 'multiple_faces':
        return 'Terdeteksi > 1 Orang';
      case 'audio_noise':
        return 'Suara / Percakapan Mencurigakan';
      case 'right_click_attempt':
        return 'Klik Kanan / Tombol Dilarang';
      default:
        return type;
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Top Banner & Header */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-6">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              {onBack && (
                <button
                  type="button"
                  onClick={onBack}
                  className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 mr-1"
                  title="Kembali ke Dashboard"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
              )}
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
                <span className="w-2 h-2 rounded-full bg-rose-600 animate-ping"></span>
                <span>Papan Transparansi Publik</span>
              </div>
              <span className="text-xs text-slate-500 font-medium">
                Dapat dilihat secara terbuka oleh seluruh mahasiswa &amp; dosen
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
              <ShieldAlert className="w-7 h-7 text-rose-600" />
              Laporan Pelanggaran &amp; Kecurangan Mahasiswa
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 max-w-3xl leading-relaxed">
              Halaman ini menayangkan rekapitulasi transparansi setiap insiden kecurangan yang terdeteksi oleh sensor penguncian layar, AI webcam proctoring, dan pengawas ujian secara real-time demi menjamin keadilan akademik.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start md:self-center">
            <div className="px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700 flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-600 animate-pulse" />
              <span>Sensor AI: Aktif Real-Time</span>
            </div>

            {isAuthorizedToDelete && violations.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  if (confirm('PERINGATAN: Apakah Anda yakin ingin MENGHAPUS SEMUA catatan pelanggaran kecurangan? Tindakan ini bersifat permanen dan hanya dapat dilakukan oleh Dosen / Admin.')) {
                    clearViolations();
                  }
                }}
                className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs"
                title="Hapus seluruh riwayat kecurangan"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                <span>Hapus Semua Riwayat</span>
              </button>
            )}
          </div>
        </div>

        {/* Statistical Overview Bento */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-1">
            <div className="text-xs font-semibold text-slate-500">Total Pelanggaran</div>
            <div className="text-2xl font-extrabold text-slate-900 font-mono">
              {totalViolations}
            </div>
            <div className="text-[11px] text-slate-400">Insiden tercatat di sistem</div>
          </div>

          <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/50 space-y-1">
            <div className="text-xs font-semibold text-amber-800">Mahasiswa Terindikasi</div>
            <div className="text-2xl font-extrabold text-amber-900 font-mono">
              {uniqueStudents}
            </div>
            <div className="text-[11px] text-amber-700">Peserta dengan rekam jejak</div>
          </div>

          <div className="p-4 rounded-xl border border-rose-200 bg-rose-50/50 space-y-1">
            <div className="text-xs font-semibold text-rose-800">Pelanggaran Kritis</div>
            <div className="text-2xl font-extrabold text-rose-900 font-mono">
              {highSeverityCount}
            </div>
            <div className="text-[11px] text-rose-700">Tingkat keparahan tinggi</div>
          </div>

          <div className="p-4 rounded-xl border border-indigo-200 bg-indigo-50/50 space-y-1">
            <div className="text-xs font-semibold text-indigo-800">Percobaan Keluar Layar / Tab</div>
            <div className="text-2xl font-extrabold text-indigo-900 font-mono">
              {tabSwitchCount}
            </div>
            <div className="text-[11px] text-indigo-700">Sensor lock &amp; visibility</div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
          {/* Search box */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Cari nama mahasiswa, NIM, judul ujian, atau jenis pelanggaran..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500 text-slate-900"
            />
          </div>

          {/* Filter by Type */}
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-300 bg-slate-50 text-slate-700 focus:bg-white focus:outline-none"
          >
            <option value="all">Semua Jenis Pelanggaran</option>
            <option value="tab_switch">Pindah Tab / Keluar Jendela</option>
            <option value="fullscreen_exit">Keluar Layar Penuh</option>
            <option value="no_face">Wajah Tidak Terdeteksi</option>
            <option value="multiple_faces">Terdeteksi &gt; 1 Orang</option>
            <option value="right_click_attempt">Klik Kanan / Shortcut Dilarang</option>
            <option value="audio_noise">Suara Mencurigakan</option>
          </select>

          {/* Filter by Severity */}
          <select
            value={selectedSeverity}
            onChange={(e) => setSelectedSeverity(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-300 bg-slate-50 text-slate-700 focus:bg-white focus:outline-none"
          >
            <option value="all">Semua Keparahan</option>
            <option value="high">Kritis (Tinggi)</option>
            <option value="medium">Sedang</option>
            <option value="low">Ringan</option>
          </select>

          {/* Filter by Class */}
          {classes.length > 0 && (
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-300 bg-slate-50 text-slate-700 focus:bg-white focus:outline-none"
            >
              <option value="all">Semua Kelas</option>
              {classes.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  Kelas {cls.name}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="text-slate-500 font-semibold">
          Menampilkan <strong>{filteredViolations.length}</strong> dari {violations.length} insiden
        </div>
      </div>

      {/* Violation Feed Table & Cards */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        {filteredViolations.length === 0 ? (
          <div className="p-16 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
              <CheckCircle className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-slate-800 text-sm">
              Tidak Ada Catatan Pelanggaran
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Tidak ditemukan data pelanggaran yang cocok dengan kriteria filter, atau seluruh peserta ujian mematuhi integritas dengan baik.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 font-bold text-slate-700">
                <tr>
                  <th className="px-5 py-3.5">Peserta Mahasiswa</th>
                  <th className="px-5 py-3.5">Kelas / Rombel</th>
                  <th className="px-5 py-3.5">Mata Kuliah / Ujian</th>
                  <th className="px-5 py-3.5">Jenis &amp; Deskripsi Pelanggaran</th>
                  <th className="px-5 py-3.5">Tingkat</th>
                  <th className="px-5 py-3.5">Waktu Kejadian</th>
                  <th className="px-5 py-3.5 text-center">Bukti Sensor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredViolations.map((v) => {
                  const student = users.find((u) => u.id === v.studentId);
                  const className = v.studentClassName || student?.className;

                  return (
                    <tr
                      key={v.id}
                      className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                      onClick={() => setSelectedViolationForPreview(v)}
                    >
                      {/* Mahasiswa */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full overflow-hidden bg-slate-200 border border-slate-300 shrink-0">
                            {student?.avatar ? (
                              <img
                                src={student.avatar}
                                alt={v.studentName}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center font-bold text-slate-700 text-xs">
                                {v.studentName.charAt(0)}
                              </div>
                            )}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900">{v.studentName}</div>
                            <div className="text-[11px] font-mono text-slate-500">
                              NIM: {v.studentNim}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Kelas */}
                      <td className="px-5 py-3.5">
                        {className ? (
                          <span className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                            {className}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">
                            Reguler
                          </span>
                        )}
                      </td>

                      {/* Ujian */}
                      <td className="px-5 py-3.5">
                        <div className="font-semibold text-slate-900 line-clamp-1">
                          {v.examTitle}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          ID: {v.examId.substring(0, 10)}...
                        </div>
                      </td>

                      {/* Pelanggaran */}
                      <td className="px-5 py-3.5 max-w-xs">
                        <div className="font-bold text-slate-900 flex items-center gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                          <span>{v.title || getViolationTypeLabel(v.violationType)}</span>
                        </div>
                        <p className="text-[11px] text-slate-500 line-clamp-2 mt-0.5">
                          {v.description}
                        </p>
                      </td>

                      {/* Tingkat Keparahan */}
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        {getSeverityBadge(v.severity)}
                      </td>

                      {/* Waktu */}
                      <td className="px-5 py-3.5 whitespace-nowrap font-mono text-[11px] text-slate-500">
                        {new Date(v.timestamp).toLocaleTimeString('id-ID', {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}{' '}
                        WIB
                        <div className="text-[10px] text-slate-400">
                          {new Date(v.timestamp).toLocaleDateString('id-ID', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </div>
                      </td>

                      {/* Bukti Sensor & Aksi */}
                      <td className="px-5 py-3.5 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {v.snapshotUrl ? (
                            <button
                              type="button"
                              onClick={() => setSelectedViolationForPreview(v)}
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all border ${
                                v.violationType === 'tab_switch' || v.violationType === 'fullscreen_exit'
                                  ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200'
                                  : 'bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200'
                              }`}
                            >
                              {v.violationType === 'tab_switch' || v.violationType === 'fullscreen_exit' ? (
                                <Monitor className="w-3.5 h-3.5 text-rose-600" />
                              ) : (
                                <Camera className="w-3.5 h-3.5 text-blue-600" />
                              )}
                              <span>
                                {v.violationType === 'tab_switch' || v.violationType === 'fullscreen_exit'
                                  ? 'Screenshot'
                                  : 'Webcam'}
                              </span>
                            </button>
                          ) : (
                            <span className="text-slate-400 text-[11px] px-2 py-1">Sensor Layar</span>
                          )}

                          {isAuthorizedToDelete && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (confirm(`Hapus catatan kecurangan untuk mahasiswa "${v.studentName}"?`)) {
                                  deleteViolation(v.id);
                                }
                              }}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                              title="Hapus Catatan Pelanggaran (Dosen / Admin)"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detail Modal / Snapshot Viewer */}
      {selectedViolationForPreview && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-rose-600" />
                <h3 className="font-bold text-slate-900 text-sm">
                  Rincian Bukti Pelanggaran Mahasiswa
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedViolationForPreview(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Peserta Ujian</span>
                  <span className="font-bold text-slate-900">
                    {selectedViolationForPreview.studentName}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">NIM</span>
                  <span className="font-mono font-bold text-slate-800">
                    {selectedViolationForPreview.studentNim}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Kelas / Rombel</span>
                  <span className="font-bold text-indigo-700">
                    {selectedViolationForPreview.studentClassName || 'Reguler'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Mata Kuliah / Ujian</span>
                  <span className="font-semibold text-slate-800">
                    {selectedViolationForPreview.examTitle}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Waktu Deteksi</span>
                  <span className="font-mono text-slate-700">
                    {new Date(selectedViolationForPreview.timestamp).toLocaleString('id-ID')} WIB
                  </span>
                </div>
              </div>

              <div>
                <div className="font-bold text-slate-800 text-sm flex items-center gap-2 mb-1">
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                  {selectedViolationForPreview.title ||
                    getViolationTypeLabel(selectedViolationForPreview.violationType)}
                </div>
                <p className="text-slate-600 leading-relaxed bg-rose-50/50 p-3 rounded-xl border border-rose-200">
                  {selectedViolationForPreview.description}
                </p>
              </div>

              {/* Screenshot / Webcam snapshot if available */}
              {selectedViolationForPreview.snapshotUrl && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 flex items-center gap-1.5">
                      {selectedViolationForPreview.violationType === 'tab_switch' ||
                      selectedViolationForPreview.violationType === 'fullscreen_exit' ? (
                        <>
                          <Monitor className="w-4 h-4 text-rose-600" />
                          <span>Tangkapan Layar Bukti Kecurangan (Screenshot Otomatis)</span>
                        </>
                      ) : (
                        <>
                          <Camera className="w-4 h-4 text-blue-600" />
                          <span>Tangkapan Kamera Depan (Webcam Snapshot)</span>
                        </>
                      )}
                    </span>
                    <span className="text-[10px] font-mono font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                      Bukti Digital Sah
                    </span>
                  </div>

                  <div className="rounded-xl overflow-hidden border border-slate-300 bg-slate-950 aspect-video flex items-center justify-center relative group">
                    <img
                      src={selectedViolationForPreview.snapshotUrl}
                      alt="Bukti Kecurangan"
                      className="w-full h-full object-contain"
                    />
                    <a
                      href={selectedViolationForPreview.snapshotUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="absolute bottom-2 right-2 px-2.5 py-1 bg-black/75 hover:bg-black text-white text-[10px] font-bold rounded-lg backdrop-blur-xs flex items-center gap-1 transition-all"
                    >
                      <ExternalLink className="w-3 h-3" />
                      <span>Buka Ukuran Asli</span>
                    </a>
                  </div>
                  <p className="text-[10px] text-slate-500 italic">
                    * Tangkapan layar otomatis diambil oleh sistem saat peserta beralih tab, meminimalkan browser, atau keluar dari jendela ujian.
                  </p>
                </div>
              )}

              {selectedViolationForPreview.aiConfidence && (
                <div className="text-[11px] text-slate-500 flex items-center justify-between pt-1">
                  <span>Tingkat Kepastian Deteksi AI (Confidence):</span>
                  <strong className="text-slate-800 font-mono">
                    {Math.round(selectedViolationForPreview.aiConfidence * 100)}%
                  </strong>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-2">
              {isAuthorizedToDelete ? (
                <button
                  type="button"
                  onClick={() => {
                    if (
                      confirm(
                        `Hapus bukti kecurangan untuk "${selectedViolationForPreview.studentName}"?`
                      )
                    ) {
                      deleteViolation(selectedViolationForPreview.id);
                      setSelectedViolationForPreview(null);
                    }
                  }}
                  className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors shadow-xs"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Hapus Bukti Ini (Dosen/Admin)</span>
                </button>
              ) : (
                <div></div>
              )}

              <button
                type="button"
                onClick={() => setSelectedViolationForPreview(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-semibold rounded-xl text-xs transition-colors"
              >
                Tutup Rincian
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
