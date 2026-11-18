import React, { useState } from 'react';
import { useExam } from '../../context/ExamContext';
import { Exam } from '../../types';
import { ExamFormModal } from './ExamFormModal';
import { AikenImportModal } from './AikenImportModal';
import { ExamResultsModal } from './ExamResultsModal';
import { ViolationNotificationsModal } from './ViolationNotificationsModal';
import { GradeDistributionChart } from './GradeDistributionChart';
import { UserManagementModal } from './UserManagementModal';
import { doesExamMatchCourse, getExamCategoryLabel } from '../../utils/gradebook';
import {
  Plus,
  FileText,
  ShieldAlert,
  Clock,
  Calendar,
  Eye,
  EyeOff,
  Edit,
  Trash2,
  Award,
  AlertTriangle,
  CheckCircle,
  Users,
  Search,
  ExternalLink,
  GraduationCap,
  TrendingUp,
  Database,
  RefreshCw,
  Loader2,
  X,
} from 'lucide-react';

export const LecturerDashboard: React.FC = () => {
  const {
    currentUser,
    users,
    exams,
    courses,
    deleteExam,
    toggleScoreAnnouncement,
    unreadViolationsCount,
    violations,
    getExamTimeStatus,
    attempts,
    firebaseStatus,
    lastFirebaseSyncTime,
    firestoreDbName,
    forceSyncFirebase,
    isFirebaseSyncing,
  } = useExam();

  const [isExamModalOpen, setIsExamModalOpen] = useState(false);
  const [examToEdit, setExamToEdit] = useState<Exam | null>(null);
  const [isManualSyncing, setIsManualSyncing] = useState(false);

  const [isAikenModalOpen, setIsAikenModalOpen] = useState(false);
  const [isResultsModalOpen, setIsResultsModalOpen] = useState(false);
  const [selectedExamForResults, setSelectedExamForResults] = useState<Exam | null>(null);

  const [isViolationsModalOpen, setIsViolationsModalOpen] = useState(false);
  const [isUsersModalOpen, setIsUsersModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const [examToDelete, setExamToDelete] = useState<Exam | null>(null);
  const [isDeletingExam, setIsDeletingExam] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const filteredExams = exams.filter(
    (e) =>
      e.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.courseName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.courseCode.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalQuestionsAll = exams.reduce((sum, e) => sum + e.questions.length, 0);
  const studentCount = users.filter((u) => u.role === 'mahasiswa').length;
  const lecturerCount = users.filter((u) => u.role === 'dosen' || u.role === 'admin').length;

  const handleOpenEdit = (exam: Exam) => {
    setExamToEdit(exam);
    setIsExamModalOpen(true);
  };

  const handleOpenCreate = () => {
    setExamToEdit(null);
    setIsExamModalOpen(true);
  };

  const handleOpenResults = (exam: Exam) => {
    setSelectedExamForResults(exam);
    setIsResultsModalOpen(true);
  };

  const handleConfirmDeleteExam = async () => {
    if (!examToDelete) return;
    setIsDeletingExam(true);
    setDeleteError('');
    try {
      const deletedTitle = examToDelete.title;
      await deleteExam(examToDelete.id);
      setExamToDelete(null);
      setToast({
        type: 'success',
        message: `Ujian "${deletedTitle}" beserta soal dan data terkait berhasil dihapus permanen.`,
      });
      setTimeout(() => {
        setToast((prev) => (prev?.message.includes(deletedTitle) ? null : prev));
      }, 5000);
    } catch (err: any) {
      setDeleteError(err?.message || 'Gagal menghapus ujian dari Firestore. Silakan coba lagi.');
    } finally {
      setIsDeletingExam(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {toast && (
        <div
          className={`p-3.5 rounded-xl border text-xs font-semibold flex items-center justify-between gap-3 ${
            toast.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {toast.type === 'success' ? (
              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{toast.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="text-current opacity-60 hover:opacity-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      {/* Welcome Banner */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">
            <span>Portal Dosen &amp; Pengawas Ujian</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Selamat Datang, {currentUser?.name}
          </h1>
          <p className="text-sm text-slate-500 max-w-2xl">
            Kelola jadwal ujian, data mahasiswa &amp; dosen di Firebase, impor bank soal format Aiken standar LMS, analisis grafik distribusi nilai dengan Recharts, dan pantau pengawasan AI.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* User Management Button */}
          <button
            id="btn-manage-users-header"
            type="button"
            onClick={() => setIsUsersModalOpen(true)}
            className="px-4 py-2.5 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-xl flex items-center gap-2 transition-colors shadow-xs"
          >
            <Users className="w-4 h-4 text-blue-600" />
            <span>Data Mahasiswa &amp; Dosen</span>
            <span className="bg-blue-600 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">
              {users.length}
            </span>
          </button>

          <button
            id="btn-import-aiken-header"
            type="button"
            onClick={() => setIsAikenModalOpen(true)}
            className="px-4 py-2.5 text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-xl flex items-center gap-2 transition-colors shadow-xs"
          >
            <FileText className="w-4 h-4" />
            Impor Soal Aiken
          </button>

          <button
            id="btn-create-exam-header"
            type="button"
            onClick={handleOpenCreate}
            className="px-4 py-2.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl flex items-center gap-2 transition-colors shadow-sm shadow-blue-500/20"
          >
            <Plus className="w-4 h-4" />
            Buat Ujian Baru
          </button>
        </div>
      </div>

      {/* Firebase Firestore Real-Time Persistence Status Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white rounded-2xl p-5 shadow-sm border border-slate-700/60 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-300 shrink-0">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-sm tracking-tight">Penyimpanan Firebase Firestore Aktif</span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                {firebaseStatus === 'connected' ? 'Terhubung & Real-Time' : isFirebaseSyncing ? 'Menyinkronkan...' : 'Siap'}
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-1">
              Data ujian, bank butir soal, dan nilai mahasiswa disimpan secara permanen di cloud Firestore database: <span className="font-mono text-blue-300 font-semibold">{firestoreDbName}</span>.
              {lastFirebaseSyncTime && <span className="ml-2 text-slate-400">Pembaruan terakhir: {lastFirebaseSyncTime}</span>}
            </p>
          </div>
        </div>

        <button
          type="button"
          id="btn-sync-firebase-now"
          onClick={async () => {
            setIsManualSyncing(true);
            try {
              await forceSyncFirebase();
            } finally {
              setIsManualSyncing(false);
            }
          }}
          disabled={isManualSyncing || isFirebaseSyncing}
          className="px-4 py-2.5 text-xs font-semibold bg-white/10 hover:bg-white/20 active:bg-white/30 border border-white/20 rounded-xl transition-all flex items-center gap-2 self-start md:self-auto shrink-0 disabled:opacity-50 text-white shadow-xs"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isManualSyncing || isFirebaseSyncing ? 'animate-spin' : ''}`} />
          <span>{isManualSyncing || isFirebaseSyncing ? 'Menyinkronkan...' : 'Sinkronkan Ujian Sekarang'}</span>
        </button>
      </div>

      {/* KPI Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Users Management KPI */}
        <div
          onClick={() => setIsUsersModalOpen(true)}
          className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:border-blue-400 hover:bg-blue-50/20 cursor-pointer transition-all group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Data Pengguna
            </span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-slate-900">{users.length}</span>
            <span className="text-xs text-blue-600 font-medium">({studentCount} Mhs, {lecturerCount} Dosen)</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Total Ujian
            </span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-slate-900">{exams.length}</span>
            <span className="text-xs text-slate-500">paket ujian</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Bank Soal Aiken
            </span>
            <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-slate-900">{totalQuestionsAll}</span>
            <span className="text-xs text-slate-500">butir pilihan ganda</span>
          </div>
        </div>

        {/* AI Violations Card with Alert click */}
        <div
          onClick={() => setIsViolationsModalOpen(true)}
          className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:border-rose-300 hover:bg-rose-50/20 cursor-pointer transition-all group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Insiden AI Proctor
            </span>
            <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center group-hover:scale-110 transition-transform">
              <ShieldAlert className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-rose-600">{violations.length}</span>
            {unreadViolationsCount > 0 ? (
              <span className="text-xs font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-full animate-pulse">
                {unreadViolationsCount} Perlu Ditinjau
              </span>
            ) : (
              <span className="text-xs text-slate-500">terekam</span>
            )}
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Submisi Mahasiswa
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Award className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-slate-900">
              {attempts.filter((a) => a.isCompleted).length}
            </span>
            <span className="text-xs text-slate-500">lembar jawaban</span>
          </div>
        </div>
      </div>

      {/* Recharts Grade Distribution Section */}
      <GradeDistributionChart exams={exams} attempts={attempts} />

      {/* Main Exam Management Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-6 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Daftar Pelaksanaan Ujian</h2>
            <p className="text-xs text-slate-500">
              Pantau jadwal akses, batasan waktu pengerjaan, dan status pengumuman nilai mahasiswa
            </p>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Cari ujian / mata kuliah..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 font-bold text-slate-700">
              <tr>
                <th className="px-6 py-3.5">Mata Kuliah &amp; Judul Ujian</th>
                <th className="px-6 py-3.5">Status Akses Jadwal</th>
                <th className="px-6 py-3.5">Timer Durasi</th>
                <th className="px-6 py-3.5">Soal &amp; Metode Nilai</th>
                <th className="px-6 py-3.5">Pengumuman Nilai</th>
                <th className="px-6 py-3.5 text-right">Tindakan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredExams.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                    Tidak ditemukan data ujian yang sesuai.
                  </td>
                </tr>
              ) : (
                filteredExams.map((exam) => {
                  const timeStatus = getExamTimeStatus(exam);
                  const examAttempts = attempts.filter((a) => a.examId === exam.id);
                  const matchedCourse = courses.find((c) => doesExamMatchCourse(exam, c));
                  const matchedTopic =
                    matchedCourse && exam.topicId
                      ? (matchedCourse.topics || []).find((t) => t.id === exam.topicId)
                      : undefined;
                  const categoryLabel = getExamCategoryLabel(exam.examCategory);

                  return (
                    <tr key={exam.id} className="hover:bg-slate-50/60 transition-colors">
                      {/* Title and Course */}
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[11px] font-bold text-emerald-700">
                            {categoryLabel}
                          </span>
                          <span aria-hidden="true" className="text-slate-300">·</span>
                          <span className="font-bold text-slate-900 text-sm">{exam.title}</span>
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5 flex flex-wrap items-center gap-1.5">
                          <span>{exam.courseName}</span>
                          <span aria-hidden="true" className="text-slate-300">·</span>
                          <span className="font-mono bg-slate-100 px-1 rounded">
                            {exam.courseCode}
                          </span>
                          {matchedTopic && (
                            <>
                              <span aria-hidden="true" className="text-slate-300">·</span>
                              <span className="text-blue-700 font-semibold">
                                Pertemuan {matchedTopic.meetingNumber}: {matchedTopic.title}
                              </span>
                            </>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(exam.schedule.startTime).toLocaleString('id-ID', {
                            dateStyle: 'short',
                            timeStyle: 'short',
                          })}{' '}
                          s/d{' '}
                          {new Date(exam.schedule.endTime).toLocaleString('id-ID', {
                            dateStyle: 'short',
                            timeStyle: 'short',
                          })}
                        </div>
                      </td>

                      {/* Time window status */}
                      <td className="px-6 py-4">
                        {timeStatus.status === 'upcoming' && (
                          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200 inline-flex items-center gap-1">
                            <Clock className="w-3 h-3 text-amber-600" />
                            Belum Waktunya
                          </span>
                        )}
                        {timeStatus.status === 'ongoing' && (
                          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 inline-flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                            Sedang Berlangsung
                          </span>
                        )}
                        {timeStatus.status === 'completed' && (
                          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-600 border border-slate-200 inline-flex items-center gap-1">
                            Waktu Habis
                          </span>
                        )}
                      </td>

                      {/* Duration */}
                      <td className="px-6 py-4 font-semibold text-slate-800">
                        {exam.durationMinutes} Menit
                      </td>

                      {/* Aiken questions & IRT method */}
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-900 font-mono tabular-nums">
                          {exam.questions.length} Butir Soal
                        </div>
                        <div className="text-[11px] text-blue-700 font-semibold mt-0.5">
                          {exam.scoringMethod === 'irt'
                            ? `Penilaian IRT (${exam.irtModel || '3PL'})`
                            : 'Penilaian Klasik'}
                        </div>
                      </td>

                      {/* Score announcement state & toggle */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              toggleScoreAnnouncement(exam.id, !exam.showScoreImmediately)
                            }
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border flex items-center gap-1 transition-colors ${
                              exam.showScoreImmediately || exam.isScorePublished
                                ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
                                : 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100'
                            }`}
                            title="Klik untuk mengubah mode pengumuman nilai"
                          >
                            {exam.showScoreImmediately || exam.isScorePublished ? (
                              <>
                                <Eye className="w-3 h-3 text-emerald-600" />
                                Nilai Langsung
                              </>
                            ) : (
                              <>
                                <EyeOff className="w-3 h-3 text-amber-600" />
                                Nilai Ditahan
                              </>
                            )}
                          </button>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleOpenResults(exam)}
                            className="px-2.5 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg flex items-center gap-1 transition-colors"
                            title="Lihat Hasil & Rekap Nilai"
                          >
                            <Award className="w-3.5 h-3.5 text-blue-600" />
                            Hasil ({examAttempts.length})
                          </button>

                          <button
                            type="button"
                            onClick={() => handleOpenEdit(exam)}
                            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                            title="Ubah Konfigurasi Ujian"
                          >
                            <Edit className="w-4 h-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setDeleteError('');
                              setExamToDelete(exam);
                            }}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            title="Hapus Ujian"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Live AI Cheating Feeds (Quick Glance for Lecturer) */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-rose-500 animate-ping" />
            <h3 className="font-bold text-slate-900 text-sm">
              Rekaman Aktivitas Sensor Pengawas AI Terkini
            </h3>
          </div>
          <button
            type="button"
            onClick={() => setIsViolationsModalOpen(true)}
            className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1"
          >
            Lihat Semua Laporan ({violations.length})
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>

        {violations.length === 0 ? (
          <div className="text-center py-6 text-slate-400 text-xs">
            Belum ada indikasi kecurangan terdeteksi.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {violations.slice(0, 4).map((v) => (
              <div
                key={v.id}
                className="p-3 rounded-xl border border-slate-200 bg-slate-50/50 flex items-start gap-3 text-xs"
              >
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                    v.severity === 'high'
                      ? 'bg-rose-600 text-white'
                      : 'bg-amber-500 text-white'
                  }`}
                >
                  <ShieldAlert className="w-4 h-4" />
                </div>
                <div className="space-y-0.5 flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 truncate">{v.studentName}</span>
                    <span className="text-[10px] text-slate-400">
                      {new Date(v.timestamp).toLocaleTimeString('id-ID', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <div className="font-semibold text-slate-700 truncate">{v.title}</div>
                  <p className="text-slate-500 text-[11px] line-clamp-1">{v.description}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      <ExamFormModal
        isOpen={isExamModalOpen}
        onClose={() => {
          setIsExamModalOpen(false);
          setExamToEdit(null);
        }}
        examToEdit={examToEdit}
      />

      <AikenImportModal
        isOpen={isAikenModalOpen}
        onClose={() => setIsAikenModalOpen(false)}
        onImportQuestions={(questions) => {
          setExamToEdit({
            id: `exam-${Date.now()}`,
            title: 'Ujian Baru (Hasil Impor Aiken)',
            courseCode: 'IF3000',
            courseName: 'Mata Kuliah Umum',
            lecturerId: currentUser?.id || 'dosen-1',
            lecturerName: currentUser?.name || 'Dosen Pengampu',
            durationMinutes: 45,
            schedule: {
              startTime: new Date().toISOString(),
              endTime: new Date(Date.now() + 120 * 60 * 1000).toISOString(),
            },
            questions,
            totalPoints: 100,
            passingGrade: 70,
            scoringMethod: 'irt',
            irtModel: '3PL',
            showScoreImmediately: false,
            isScorePublished: false,
            aiProctoringEnabled: true,
            allowLateSubmission: false,
            shuffleQuestions: true,
            createdAt: new Date().toISOString(),
          });
          setIsExamModalOpen(true);
        }}
      />

      {selectedExamForResults && (
        <ExamResultsModal
          isOpen={isResultsModalOpen}
          onClose={() => {
            setIsResultsModalOpen(false);
            setSelectedExamForResults(null);
          }}
          exam={selectedExamForResults}
        />
      )}

      <ViolationNotificationsModal
        isOpen={isViolationsModalOpen}
        onClose={() => setIsViolationsModalOpen(false)}
      />

      <UserManagementModal
        isOpen={isUsersModalOpen}
        onClose={() => setIsUsersModalOpen(false)}
      />

      {examToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-900">Hapus Ujian Permanen</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Apakah Anda yakin ingin menghapus ujian <strong>{examToDelete.title}</strong> ({examToDelete.courseCode} · {examToDelete.courseName})?
                </p>
              </div>
            </div>

            {(() => {
              const relatedAttempts = attempts.filter((a) => a.examId === examToDelete.id).length;
              const relatedViolations = violations.filter((v) => v.examId === examToDelete.id).length;
              return (
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-600 space-y-1">
                  <div>
                    Butir soal: <strong className="text-slate-900">{examToDelete.questions.length} soal</strong>
                  </div>
                  {(relatedAttempts > 0 || relatedViolations > 0) && (
                    <div className="text-rose-700 font-medium">
                      Menghapus ujian ini juga akan menghapus {relatedAttempts} lembar pengerjaan mahasiswa dan {relatedViolations} catatan pengawasan terkait dari database.
                    </div>
                  )}
                </div>
              );
            })()}

            {deleteError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 font-medium flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{deleteError}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={isDeletingExam}
                onClick={() => {
                  setExamToDelete(null);
                  setDeleteError('');
                }}
                className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isDeletingExam}
                onClick={handleConfirmDeleteExam}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5 disabled:opacity-60"
              >
                {isDeletingExam ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Menghapus...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Ya, Hapus Ujian</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
