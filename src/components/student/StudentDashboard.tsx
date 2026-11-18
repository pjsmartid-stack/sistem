import React, { useState } from 'react';
import { useExam } from '../../context/ExamContext';
import { ClassFile, Exam, ExamAttempt } from '../../types';
import { downloadFileResource } from '../../lib/fileStorage';
import { IntegrityPledgeModal } from './IntegrityPledgeModal';
import { doesExamMatchCourse } from '../../utils/gradebook';
import {
  Calendar,
  Clock,
  ShieldAlert,
  Award,
  Lock,
  Play,
  FileText,
  Download,
  Loader2,
  Layers,
  AlertCircle,
} from 'lucide-react';

interface StudentDashboardProps {
  onStartExam: (exam: Exam) => void;
  onViewResults: (exam: Exam, attempt: ExamAttempt) => void;
  onOpenCheatingBoard?: () => void;
}

export const StudentDashboard: React.FC<StudentDashboardProps> = ({
  onStartExam,
  onViewResults,
  onOpenCheatingBoard,
}) => {
  const {
    currentUser,
    exams,
    attempts,
    classes,
    courses,
    getExamTimeStatus,
    getExamAttemptRemainingSeconds,
    syncAttemptFromServer,
    violations,
  } = useExam();

  const [activeTab, setActiveTab] = useState<'ongoing' | 'upcoming' | 'completed'>('ongoing');
  const [selectedExamForPledge, setSelectedExamForPledge] = useState<Exam | null>(null);
  const [downloadingFileId, setDownloadingFileId] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  if (!currentUser) return null;

  const studentClass = currentUser.classId
    ? classes.find((c) => c.id === currentUser.classId)
    : undefined;

  const handleDownloadClassFile = async (fileItem: ClassFile) => {
    setDownloadingFileId(fileItem.id);
    setDownloadError(null);
    try {
      await downloadFileResource({
        fileId: fileItem.fileId,
        fileUrl: fileItem.fileUrl,
        fileName: fileItem.fileName,
        mimeType: fileItem.mimeType,
      });
    } catch (err: any) {
      setDownloadError(err?.message || 'Gagal mengunduh berkas kelas.');
    } finally {
      setDownloadingFileId(null);
    }
  };

  // Filter exams by assigned classes or explicit course enrollment
  const accessibleExams = exams.filter((ex) => {
    const enrolledInLinkedCourse = courses.some(
      (c) => doesExamMatchCourse(ex, c) && (c.enrolledUserIds || []).includes(currentUser.id)
    );
    if (enrolledInLinkedCourse) return true;
    if (!ex.assignedClassIds || ex.assignedClassIds.length === 0) return true;
    return currentUser.classId ? ex.assignedClassIds.includes(currentUser.classId) : false;
  });

  // Categorize exams for student
  const ongoingExams: Exam[] = [];
  const upcomingExams: Exam[] = [];
  const completedExams: Exam[] = [];

  accessibleExams.forEach((ex) => {
    const timeStatus = getExamTimeStatus(ex);
    const attempt = attempts.find((a) => a.examId === ex.id && a.studentId === currentUser.id);
    const isAttemptExpired =
      Boolean(attempt && !attempt.isCompleted && getExamAttemptRemainingSeconds(ex, attempt) <= 0);

    if (attempt?.isCompleted || isAttemptExpired || timeStatus.status === 'completed') {
      completedExams.push(ex);
    } else if (timeStatus.status === 'ongoing') {
      ongoingExams.push(ex);
    } else {
      upcomingExams.push(ex);
    }
  });

  const getActiveList = () => {
    switch (activeTab) {
      case 'ongoing':
        return ongoingExams;
      case 'upcoming':
        return upcomingExams;
      case 'completed':
        return completedExams;
    }
  };

  const currentList = getActiveList();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Student Welcome Header */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            <span>Portal Ujian Mahasiswa</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Halo, {currentUser.name}
          </h1>
          <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
            <span>
              NIM: <strong className="font-mono text-slate-800">{currentUser.nimOrNip}</strong>
            </span>
            <span>•</span>
            <span>Program Studi: {currentUser.department}</span>
            {currentUser.className && (
              <>
                <span>•</span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                  Kelas: {currentUser.className}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Action card for Cheating Board */}
        {onOpenCheatingBoard && (
          <div className="bg-rose-50/70 border border-rose-200 p-4 rounded-xl flex items-start justify-between gap-4 max-w-md">
            <div className="flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div className="text-xs space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-rose-950 block">
                    Papan Laporan Kecurangan
                  </span>
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] font-extrabold bg-rose-200 text-rose-800">
                    {violations.length} Kasus
                  </span>
                </div>
                <p className="text-rose-800/80 leading-relaxed text-[11px]">
                  Seluruh pelanggaran ujian disiarkan transparan. Klik untuk melihat daftar kecurangan mahasiswa lain.
                </p>
              </div>
            </div>
            <button
              type="button"
              id="btn-student-view-cheating"
              onClick={onOpenCheatingBoard}
              className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold text-xs shrink-0 shadow-xs transition-colors"
            >
              Lihat Laporan
            </button>
          </div>
        )}
      </div>

      {/* Downloadable Class Files for Student */}
      {studentClass && (studentClass.files?.length || 0) > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Layers className="w-4 h-4 text-indigo-600" />
                <span>Berkas &amp; Materi Kelas ({studentClass.name})</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Unduh file dokumen, modul, atau pengumuman yang dibagikan ke kelas Anda.
              </p>
            </div>
          </div>

          {downloadError && (
            <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{downloadError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {(studentClass.files || []).map((fileItem) => (
              <div
                key={fileItem.id}
                className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 flex flex-col justify-between gap-3 text-xs"
              >
                <div className="space-y-1">
                  <div className="font-bold text-slate-900 flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-blue-600 shrink-0" />
                    <span className="truncate">{fileItem.title}</span>
                  </div>
                  <div className="text-[11px] text-slate-500 truncate">
                    {fileItem.fileName} {fileItem.fileSize ? `• ${fileItem.fileSize}` : ''}
                  </div>
                  {fileItem.description && (
                    <p className="text-[11px] text-slate-600 line-clamp-2">
                      {fileItem.description}
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => handleDownloadClassFile(fileItem)}
                  disabled={downloadingFileId === fileItem.id}
                  className="w-full py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold flex items-center justify-center gap-1.5 disabled:opacity-50 transition-colors"
                >
                  {downloadingFileId === fileItem.id ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Download className="w-3.5 h-3.5" />
                  )}
                  <span>{downloadingFileId === fileItem.id ? 'Mengunduh...' : 'Unduh File'}</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-slate-200 gap-6 text-sm">
        <button
          type="button"
          onClick={() => setActiveTab('ongoing')}
          className={`pb-3 font-bold border-b-2 flex items-center gap-2 transition-colors ${
            activeTab === 'ongoing'
              ? 'border-blue-600 text-blue-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <span>Ujian Aktif (Sedang Berjalan)</span>
          <span className="px-2 py-0.5 rounded-full text-xs font-extrabold bg-blue-100 text-blue-800">
            {ongoingExams.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('upcoming')}
          className={`pb-3 font-bold border-b-2 flex items-center gap-2 transition-colors ${
            activeTab === 'upcoming'
              ? 'border-blue-600 text-blue-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <span>Akan Datang (Belum Waktunya)</span>
          <span className="px-2 py-0.5 rounded-full text-xs font-extrabold bg-amber-100 text-amber-800">
            {upcomingExams.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('completed')}
          className={`pb-3 font-bold border-b-2 flex items-center gap-2 transition-colors ${
            activeTab === 'completed'
              ? 'border-blue-600 text-blue-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <span>Riwayat &amp; Pengumuman Nilai</span>
          <span className="px-2 py-0.5 rounded-full text-xs font-extrabold bg-slate-100 text-slate-700">
            {completedExams.length}
          </span>
        </button>
      </div>

      {/* Exam Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {currentList.length === 0 ? (
          <div className="col-span-full py-16 text-center text-slate-400 text-xs bg-white rounded-2xl border border-slate-200">
            Tidak ada ujian pada kategori ini.
          </div>
        ) : (
          currentList.map((exam) => {
            const timeStatus = getExamTimeStatus(exam);
            const attempt = attempts.find(
              (a) => a.examId === exam.id && a.studentId === currentUser.id
            );
            const isInProgress = Boolean(
              attempt &&
                !attempt.isCompleted &&
                timeStatus.status === 'ongoing' &&
                getExamAttemptRemainingSeconds(exam, attempt) > 0
            );
            const hasFinished = Boolean(
              attempt?.isCompleted ||
                (attempt && !attempt.isCompleted && getExamAttemptRemainingSeconds(exam, attempt) <= 0)
            );

            return (
              <div
                key={exam.id}
                className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between space-y-5"
              >
                <div className="space-y-3">
                  {/* Top Status Line */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                      {exam.courseCode}
                    </span>

                    {hasFinished ? (
                      <span className="text-[11px] font-bold text-emerald-700 flex items-center gap-1">
                        <Lock className="w-3 h-3" />
                        Selesai · Jawaban Terkunci
                      </span>
                    ) : isInProgress ? (
                      <span className="text-[11px] font-bold text-amber-700 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Sesi Sedang Berjalan
                      </span>
                    ) : timeStatus.status === 'upcoming' ? (
                      <span className="text-[11px] font-bold text-amber-700 flex items-center gap-1">
                        <Lock className="w-3 h-3" />
                        Belum Waktunya
                      </span>
                    ) : timeStatus.status === 'completed' ? (
                      <span className="text-[11px] font-bold text-slate-600 flex items-center gap-1">
                        <Lock className="w-3 h-3" />
                        Waktu Habis
                      </span>
                    ) : (
                      <span className="text-[11px] font-bold text-emerald-700">
                        Tersedia · 1x Akses
                      </span>
                    )}
                  </div>

                  {/* Title and Course */}
                  <div>
                    <h3 className="font-bold text-slate-900 text-base leading-snug">
                      {exam.title}
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">
                      {exam.courseName} • Pengampu: {exam.lecturerName}
                    </p>
                  </div>

                  {/* Exam Specs */}
                  <div className="pt-2 border-t border-slate-100 space-y-1.5 text-xs text-slate-600">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-slate-400">
                        <Clock className="w-3.5 h-3.5" />
                        Durasi Pengerjaan:
                      </span>
                      <span className="font-bold text-slate-800">{exam.durationMinutes} Menit</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-slate-400">
                        <FileText className="w-3.5 h-3.5" />
                        Jumlah Soal:
                      </span>
                      <span className="font-bold text-slate-800">
                        {exam.questions.length} Butir ({exam.totalPoints} Poin)
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px]">
                      <span className="flex items-center gap-1.5 text-slate-400">
                        <Calendar className="w-3.5 h-3.5" />
                        Jadwal Berakhir:
                      </span>
                      <span className="text-slate-700">
                        {new Date(exam.schedule.endTime).toLocaleString('id-ID', {
                          dateStyle: 'short',
                          timeStyle: 'short',
                        })}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px]">
                      <span className="flex items-center gap-1.5 text-slate-400">
                        <Lock className="w-3.5 h-3.5" />
                        Ketentuan Akses:
                      </span>
                      <span className="font-semibold text-slate-700">
                        1x Akses · Terkunci Permanen
                      </span>
                    </div>
                  </div>
                </div>

                {/* Bottom Action Button */}
                <div className="pt-4 border-t border-slate-100">
                  {hasFinished && attempt ? (
                    <button
                      type="button"
                      id={`btn-view-results-${exam.id}`}
                      onClick={() => onViewResults(exam, attempt)}
                      className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Award className="w-4 h-4" />
                      Lihat Hasil &amp; Nilai (Terkunci)
                    </button>
                  ) : isInProgress ? (
                    <button
                      type="button"
                      id={`btn-resume-exam-${exam.id}`}
                      onClick={() => onStartExam(exam)}
                      className="w-full py-2.5 px-4 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-sm transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Play className="w-3.5 h-3.5" />
                      Lanjutkan Sesi Ujian
                    </button>
                  ) : timeStatus.status === 'upcoming' ? (
                    <button
                      type="button"
                      disabled
                      className="w-full py-2.5 px-4 bg-slate-100 text-slate-400 font-semibold text-xs rounded-xl border border-slate-200 cursor-not-allowed flex items-center justify-center gap-1.5"
                    >
                      <Lock className="w-3.5 h-3.5" />
                      Belum Waktunya (Terkunci)
                    </button>
                  ) : timeStatus.status === 'completed' ? (
                    <button
                      type="button"
                      disabled
                      className="w-full py-2.5 px-4 bg-slate-100 text-slate-400 font-semibold text-xs rounded-xl border border-slate-200 cursor-not-allowed flex items-center justify-center gap-1.5"
                    >
                      <Lock className="w-3.5 h-3.5" />
                      Waktu Habis (Akses Ditutup)
                    </button>
                  ) : (
                    <button
                      type="button"
                      id={`btn-start-exam-${exam.id}`}
                      onClick={async () => {
                        const fresh = await syncAttemptFromServer(exam.id, currentUser.id);
                        if (fresh?.isCompleted) {
                          onViewResults(exam, fresh);
                          return;
                        }
                        setSelectedExamForPledge(exam);
                      }}
                      className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-sm shadow-blue-500/20 transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Play className="w-3.5 h-3.5" />
                      Mulai Ujian Sekarang
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Pre-Exam Integrity Pledge Modal with Mandatory Checkbox & Penalty Rules */}
      {selectedExamForPledge && (
        <IntegrityPledgeModal
          isOpen={!!selectedExamForPledge}
          exam={selectedExamForPledge}
          onClose={() => setSelectedExamForPledge(null)}
          onConfirm={async () => {
            const target = selectedExamForPledge;
            setSelectedExamForPledge(null);
            const fresh = await syncAttemptFromServer(target.id, currentUser.id);
            if (fresh?.isCompleted) {
              onViewResults(target, fresh);
              return;
            }
            onStartExam(target);
          }}
        />
      )}
    </div>
  );
};
