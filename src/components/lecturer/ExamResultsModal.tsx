import React, { useState, useMemo } from 'react';
import { Exam } from '../../types';
import { useExam } from '../../context/ExamContext';
import { calibrateExamItems, calculateAttemptIRTScore } from '../../utils/irtScoring';
import {
  X,
  Award,
  CheckCircle2,
  XCircle,
  ShieldAlert,
  Send,
  Eye,
  EyeOff,
  Download,
  RefreshCw,
  BarChart3,
} from 'lucide-react';

interface ExamResultsModalProps {
  isOpen: boolean;
  onClose: () => void;
  exam: Exam;
}

export const ExamResultsModal: React.FC<ExamResultsModalProps> = ({
  isOpen,
  onClose,
  exam,
}) => {
  const {
    exams,
    attempts,
    toggleScoreAnnouncement,
    publishScores,
    recalibrateExamScores,
  } = useExam();

  const [isRecalibrating, setIsRecalibrating] = useState(false);

  // Always read latest exam state from context
  const liveExam = exams.find((e) => e.id === exam.id) || exam;
  const isIRT = liveExam.scoringMethod === 'irt';

  const examAttempts = useMemo(
    () => attempts.filter((att) => att.examId === liveExam.id),
    [attempts, liveExam.id]
  );

  const completedAttempts = useMemo(
    () => examAttempts.filter((att) => att.isCompleted),
    [examAttempts]
  );

  const itemAnalyses = useMemo(
    () => calibrateExamItems(liveExam, completedAttempts, liveExam.irtModel || '3PL'),
    [liveExam, completedAttempts]
  );

  if (!isOpen) return null;

  const totalSubmissions = completedAttempts.length;
  const averageScore =
    totalSubmissions > 0
      ? Number(
          (
            completedAttempts.reduce((sum, att) => sum + (att.score || 0), 0) /
            totalSubmissions
          ).toFixed(1)
        )
      : 0;

  const averageScaledIRT =
    totalSubmissions > 0
      ? Math.round(
          completedAttempts.reduce((sum, att) => {
            const calc = calculateAttemptIRTScore(liveExam, att, itemAnalyses);
            return sum + (att.irtScaledScore ?? calc.irtScaledScore);
          }, 0) / totalSubmissions
        )
      : 500;

  const handleRecalibrateNow = async () => {
    setIsRecalibrating(true);
    await recalibrateExamScores(
      liveExam.id,
      'irt',
      liveExam.irtModel || '3PL'
    );
    setIsRecalibrating(false);
  };

  const handleExportCSV = () => {
    const headers = [
      'NIM',
      'Nama Mahasiswa',
      'Benar',
      'Theta IRT',
      'Skor Standar IRT (500)',
      'Nilai Akhir',
      'Skor Maksimal',
      'Persentase',
      'Status',
      'Pelanggaran AI',
      'Waktu Pengumpulan',
    ];
    const rows = examAttempts.map((att) => {
      const calc = att.isCompleted
        ? calculateAttemptIRTScore(liveExam, att, itemAnalyses)
        : null;
      return [
        att.studentNim,
        `"${att.studentName}"`,
        att.correctCount ?? calc?.correctCount ?? '-',
        att.irtTheta ?? calc?.irtTheta ?? '-',
        att.irtScaledScore ?? calc?.irtScaledScore ?? '-',
        att.score ?? '-',
        att.maxScore ?? '-',
        `${att.percentage ?? '-'}%`,
        att.isPassed ? 'Lulus' : 'Tidak Lulus',
        att.violationsCount,
        att.submittedAt ? new Date(att.submittedAt).toLocaleString('id-ID') : 'Belum Selesai',
      ];
    });

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `rekap_nilai_${liveExam.courseCode}_${liveExam.id}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Rekap &amp; Pengumuman Nilai Ujian
              </h2>
              <p className="text-xs text-slate-500">
                {liveExam.courseName} ({liveExam.courseCode}) · {liveExam.title} ·{' '}
                <strong>
                  {isIRT
                    ? `Sistem IRT (${liveExam.irtModel || '3PL'})`
                    : 'Sistem Klasik (Bobot Tetap)'}
                </strong>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-2 rounded-lg hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Score Announcement & IRT Calibration Bar */}
        <div className="px-6 py-4 bg-slate-100 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className={`p-2 rounded-lg ${
                liveExam.isScorePublished || liveExam.showScoreImmediately
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-amber-100 text-amber-700'
              }`}
            >
              {liveExam.isScorePublished || liveExam.showScoreImmediately ? (
                <Eye className="w-5 h-5" />
              ) : (
                <EyeOff className="w-5 h-5" />
              )}
            </div>
            <div>
              <div className="text-xs font-bold text-slate-900">
                Status Pengumuman Nilai:{' '}
                <span
                  className={
                    liveExam.isScorePublished || liveExam.showScoreImmediately
                      ? 'text-emerald-700 font-extrabold'
                      : 'text-amber-700 font-extrabold'
                  }
                >
                  {liveExam.isScorePublished || liveExam.showScoreImmediately
                    ? 'Nilai Terbuka (Diumumkan ke Mahasiswa)'
                    : 'Nilai Ditahan (Belum Diumumkan)'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                {isIRT
                  ? `Penilaian berbasis IRT (${liveExam.irtModel || '3PL'}) aktif: bobot soal terkalibrasi otomatis dari kesulitan empiris.`
                  : 'Mode penilaian klasik aktif. Anda dapat beralih dan mengkalibrasi ulang ke IRT kapan saja.'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={isRecalibrating}
              onClick={handleRecalibrateNow}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors"
              title="Kalibrasi ulang skor peserta dengan metode Item Response Theory"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRecalibrating ? 'animate-spin' : ''}`} />
              <span>{isIRT ? 'Kalibrasi Ulang IRT' : 'Konversi ke Skor IRT'}</span>
            </button>

            {!liveExam.isScorePublished && !liveExam.showScoreImmediately && (
              <button
                id="btn-publish-scores-now"
                type="button"
                onClick={() => publishScores(liveExam.id)}
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Publikasikan Nilai</span>
              </button>
            )}

            <button
              type="button"
              onClick={() =>
                toggleScoreAnnouncement(liveExam.id, !liveExam.showScoreImmediately)
              }
              className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-medium rounded-lg transition-colors"
            >
              {liveExam.showScoreImmediately ? 'Tahan Nilai' : 'Nilai Otomatis'}
            </button>

            <button
              type="button"
              onClick={handleExportCSV}
              className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-medium rounded-lg flex items-center gap-1 transition-colors"
              title="Unduh Rekap CSV"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>Ekspor CSV</span>
            </button>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="px-6 py-3 bg-white border-b border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
          <div className="p-3 bg-slate-50 rounded-xl">
            <div className="text-xl font-extrabold font-mono tabular-nums text-slate-800">
              {totalSubmissions}
            </div>
            <div className="text-[11px] text-slate-500 font-medium">Mahasiswa Selesai</div>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl">
            <div className="text-xl font-extrabold font-mono tabular-nums text-blue-600">
              {averageScore} / {isIRT ? 100 : liveExam.totalPoints}
            </div>
            <div className="text-[11px] text-slate-500 font-medium">Rata-rata Nilai Akhir</div>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl">
            <div className="text-xl font-extrabold font-mono tabular-nums text-indigo-600">
              {averageScaledIRT}
            </div>
            <div className="text-[11px] text-slate-500 font-medium">Rerata Skor IRT (Skala 500)</div>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl">
            <div className="text-xl font-extrabold font-mono tabular-nums text-slate-800">
              {liveExam.passingGrade}
            </div>
            <div className="text-[11px] text-slate-500 font-medium">Batas Kelulusan (KKM)</div>
          </div>
        </div>

        {/* Student Attempts Table */}
        <div className="flex-1 p-6 overflow-y-auto">
          {examAttempts.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-xs">
              Belum ada mahasiswa yang memulai ujian ini.
            </div>
          ) : (
            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 font-bold text-slate-700">
                  <tr>
                    <th className="px-4 py-3">Mahasiswa</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Benar</th>
                    <th className="px-4 py-3 text-right">Theta (θ)</th>
                    <th className="px-4 py-3 text-right">Skor IRT</th>
                    <th className="px-4 py-3 text-right">Nilai Akhir</th>
                    <th className="px-4 py-3">Kelulusan</th>
                    <th className="px-4 py-3">Pelanggaran AI</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {examAttempts.map((att) => {
                    const calc = att.isCompleted
                      ? calculateAttemptIRTScore(liveExam, att, itemAnalyses)
                      : null;
                    const thetaVal = att.irtTheta ?? calc?.irtTheta;
                    const scaledVal = att.irtScaledScore ?? calc?.irtScaledScore;
                    const correctVal = att.correctCount ?? calc?.correctCount;

                    return (
                      <tr key={att.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-semibold text-slate-900">{att.studentName}</div>
                          <div className="font-mono text-[11px] text-slate-500">
                            {att.studentNim}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {att.isCompleted ? (
                            <span className="text-emerald-700 font-semibold">
                              {att.status === 'timed_out' ? 'Waktu Habis' : 'Selesai'}
                            </span>
                          ) : (
                            <span className="text-blue-700 font-semibold">
                              Sedang Mengerjakan
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums">
                          {att.isCompleted
                            ? `${correctVal ?? 0}/${liveExam.questions.length}`
                            : '-'}
                        </td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums font-semibold">
                          {att.isCompleted && thetaVal !== undefined
                            ? thetaVal > 0
                              ? `+${thetaVal}`
                              : thetaVal
                            : '-'}
                        </td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums font-bold text-blue-700">
                          {att.isCompleted && scaledVal !== undefined ? (
                            <span className="inline-flex items-center gap-1">
                              <BarChart3 className="w-3 h-3 text-blue-500" />
                              {scaledVal}
                            </span>
                          ) : (
                            '-'
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums font-bold text-slate-900">
                          {att.isCompleted ? (
                            <span>
                              {att.score} / {att.maxScore}{' '}
                              <span className="text-[11px] text-slate-400 font-normal">
                                ({att.percentage}%)
                              </span>
                            </span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {att.isCompleted ? (
                            att.isPassed ? (
                              <span className="inline-flex items-center gap-1 text-emerald-700 font-bold">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                Lulus
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-rose-700 font-bold">
                                <XCircle className="w-3.5 h-3.5 text-rose-600" />
                                Belum Lulus
                              </span>
                            )
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {att.violationsCount > 0 ? (
                            <span className="text-rose-700 font-bold inline-flex items-center gap-1 font-mono tabular-nums">
                              <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
                              {att.violationsCount}x
                            </span>
                          ) : (
                            <span className="text-emerald-700 font-semibold text-[11px]">
                              0 (Aman)
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
