import React, { useMemo } from 'react';
import { Exam, ExamAttempt } from '../../types';
import { useExam } from '../../context/ExamContext';
import { calibrateExamItems, calculateAttemptIRTScore } from '../../utils/irtScoring';
import {
  Award,
  Clock,
  ShieldCheck,
  ShieldAlert,
  ArrowLeft,
  FileCheck,
  EyeOff,
  BarChart3,
} from 'lucide-react';

interface ExamResultViewProps {
  exam: Exam;
  attempt: ExamAttempt;
  onBackToDashboard: () => void;
}

export const ExamResultView: React.FC<ExamResultViewProps> = ({
  exam,
  attempt,
  onBackToDashboard,
}) => {
  const { exams, attempts } = useExam();

  const liveExam = exams.find((e) => e.id === exam.id) || exam;
  const liveAttempt = attempts.find((a) => a.id === attempt.id) || attempt;

  const isScoreReleased = liveExam.showScoreImmediately || liveExam.isScorePublished;
  const isIRT = liveExam.scoringMethod === 'irt';

  const completedPeers = useMemo(
    () => attempts.filter((a) => a.examId === liveExam.id && a.isCompleted),
    [attempts, liveExam.id]
  );

  const itemAnalyses = useMemo(
    () => calibrateExamItems(liveExam, completedPeers, liveExam.irtModel || '3PL'),
    [liveExam, completedPeers]
  );

  const irtEvaluation = useMemo(
    () => calculateAttemptIRTScore(liveExam, liveAttempt, itemAnalyses, liveExam.irtModel || '3PL'),
    [liveExam, liveAttempt, itemAnalyses]
  );

  const displayTheta = liveAttempt.irtTheta ?? irtEvaluation.irtTheta;
  const displaySE = liveAttempt.irtStandardError ?? irtEvaluation.irtStandardError;
  const displayScaled = liveAttempt.irtScaledScore ?? irtEvaluation.irtScaledScore;

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Back button */}
        <button
          onClick={onBackToDashboard}
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 px-3 py-1.5 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Kembali ke Dashboard Mahasiswa
        </button>

        {isScoreReleased ? (
          /* ================= RELEASED SCORE VIEW ================= */
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            {/* Score Header */}
            <div
              className={`p-6 sm:p-8 text-center text-white ${
                liveAttempt.isPassed
                  ? 'bg-emerald-700'
                  : 'bg-rose-700'
              }`}
            >
              <div className="inline-flex p-3 rounded-full bg-white/15 mb-3">
                <Award className="w-8 h-8 text-white" />
              </div>

              <div className="text-xs font-medium text-white/85">
                Pengumuman Nilai Resmi ·{' '}
                {isIRT
                  ? `Penilaian Berbasis IRT (${liveExam.irtModel || '3PL'})`
                  : 'Penilaian Klasik'}
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold mt-1">{liveExam.title}</h1>
              <p className="text-xs text-white/80 mt-1">
                {liveExam.courseName} ({liveExam.courseCode}) · Pengampu: {liveExam.lecturerName}
              </p>

              {/* Main Score Display */}
              <div className="mt-6 flex flex-wrap items-center justify-center gap-4">
                <div className="inline-flex items-baseline justify-center gap-2 bg-white/15 px-7 py-4 rounded-2xl border border-white/20">
                  <span className="text-4xl sm:text-5xl font-black font-mono tabular-nums">
                    {liveAttempt.score ?? 0}
                  </span>
                  <span className="text-lg font-bold text-white/75 font-mono tabular-nums">
                    / {liveAttempt.maxScore ?? (isIRT ? 100 : liveExam.totalPoints)}
                  </span>
                </div>

                {isIRT && (
                  <div className="inline-flex flex-col items-center justify-center bg-white/15 px-6 py-3.5 rounded-2xl border border-white/20">
                    <span className="text-[11px] text-white/80">Skor Standar IRT (Skala UTBK)</span>
                    <span className="text-2xl sm:text-3xl font-extrabold font-mono tabular-nums mt-0.5">
                      {displayScaled}
                    </span>
                    <span className="text-[11px] font-mono text-white/80">
                      Theta θ = {displayTheta > 0 ? `+${displayTheta}` : displayTheta} ± {displaySE}
                    </span>
                  </div>
                )}
              </div>

              <div className="mt-4 flex items-center justify-center gap-3 text-xs font-semibold">
                <span>Persentase: {liveAttempt.percentage ?? 0}%</span>
                <span>·</span>
                <span className="px-3 py-1 rounded-lg bg-white text-slate-900 font-bold">
                  {liveAttempt.isPassed ? 'LULUS' : 'BELUM LULUS'}
                </span>
              </div>
            </div>

            {/* Performance Summary Metrics */}
            <div className="p-6 bg-slate-50 border-b border-slate-200 grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs">
              <div className="p-3 bg-white rounded-xl border border-slate-200 text-center">
                <span className="text-slate-400 font-medium">Jawaban Benar</span>
                <div className="text-base font-bold font-mono tabular-nums text-slate-800 mt-0.5">
                  {irtEvaluation.correctCount} / {liveExam.questions.length}
                </div>
              </div>

              <div className="p-3 bg-white rounded-xl border border-slate-200 text-center">
                <span className="text-slate-400 font-medium">Batas Kelulusan (KKM)</span>
                <div className="text-base font-bold font-mono tabular-nums text-slate-800 mt-0.5">
                  {liveExam.passingGrade} Poin
                </div>
              </div>

              <div className="p-3 bg-white rounded-xl border border-slate-200 text-center">
                <span className="text-slate-400 font-medium">Kemampuan IRT (θ)</span>
                <div className="text-base font-bold font-mono tabular-nums text-blue-700 mt-0.5 flex items-center justify-center gap-1">
                  <BarChart3 className="w-4 h-4" />
                  <span>{displayTheta > 0 ? `+${displayTheta}` : displayTheta}</span>
                </div>
              </div>

              <div className="p-3 bg-white rounded-xl border border-slate-200 text-center">
                <span className="text-slate-400 font-medium">Catatan AI Proctor</span>
                <div className="text-base font-bold mt-0.5 flex items-center justify-center gap-1">
                  {liveAttempt.violationsCount > 0 ? (
                    <span className="text-rose-600 flex items-center gap-1 font-mono tabular-nums">
                      <ShieldAlert className="w-4 h-4" />
                      {liveAttempt.violationsCount} Pelanggaran
                    </span>
                  ) : (
                    <span className="text-emerald-600 flex items-center gap-1">
                      <ShieldCheck className="w-4 h-4" />
                      Aman (0)
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Answer Key & Discussion Review with IRT Item Weights */}
            <div className="p-6 sm:p-8 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    Pembahasan Lembar Jawaban ({liveExam.questions.length} Butir Soal)
                  </h2>
                  {isIRT && (
                    <p className="text-xs text-slate-500 mt-0.5">
                      Bobot poin tiap soal dihitung dinamis berdasarkan tingkat kesulitan empiris IRT (<span className="font-mono">b</span>) dan daya pembeda (<span className="font-mono">a</span>).
                    </p>
                  )}
                </div>
                <span className="text-xs text-slate-500 font-medium">
                  Kunci jawaban resmi dosen
                </span>
              </div>

              <div className="space-y-4">
                {liveExam.questions.map((q, idx) => {
                  const studentAns = liveAttempt.answers[q.id]?.selectedOption;
                  const isCorrect = studentAns === q.correctAnswer;
                  const itemMeta = itemAnalyses.find((it) => it.questionId === q.id);
                  const earnedPointDisplay = isIRT
                    ? itemMeta
                      ? itemMeta.irtWeight.toFixed(2)
                      : q.points
                    : q.points;

                  return (
                    <div
                      key={q.id}
                      className={`p-4 rounded-xl border text-xs space-y-3 ${
                        isCorrect
                          ? 'bg-emerald-50/40 border-emerald-200'
                          : 'bg-rose-50/40 border-rose-200'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-2.5">
                          <span
                            className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs shrink-0 font-mono ${
                              isCorrect
                                ? 'bg-emerald-600 text-white'
                                : 'bg-rose-600 text-white'
                            }`}
                          >
                            {idx + 1}
                          </span>
                          <div className="space-y-1">
                            <span className="font-semibold text-slate-900 text-sm block">
                              {q.text}
                            </span>
                            {itemMeta && (
                              <div className="text-[11px] text-slate-500 font-mono">
                                Kesulitan IRT: <strong>{itemMeta.difficultyCategory}</strong> (b ={' '}
                                {itemMeta.difficultyB > 0
                                  ? `+${itemMeta.difficultyB}`
                                  : itemMeta.difficultyB}
                                , a = {itemMeta.discriminationA.toFixed(2)})
                              </div>
                            )}
                          </div>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-bold font-mono tabular-nums shrink-0 ${
                            isCorrect
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {isCorrect ? `+${earnedPointDisplay} Poin` : '0 Poin'}
                        </span>
                      </div>

                      {/* Options breakdown */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-8">
                        {q.options.map((opt) => {
                          const isOptionCorrectKey = opt.id === q.correctAnswer;
                          const isOptionStudentChoice = opt.id === studentAns;

                          let itemClass = 'bg-white border-slate-200 text-slate-700';
                          if (isOptionCorrectKey) {
                            itemClass = 'bg-emerald-100 border-emerald-300 text-emerald-950 font-bold';
                          } else if (isOptionStudentChoice && !isCorrect) {
                            itemClass = 'bg-rose-100 border-rose-300 text-rose-950 font-medium';
                          }

                          return (
                            <div
                              key={opt.id}
                              className={`p-2 rounded-lg border text-xs flex items-center justify-between ${itemClass}`}
                            >
                              <div className="flex items-center gap-2">
                                <span className="font-bold">{opt.id}.</span>
                                <span>{opt.text}</span>
                              </div>
                              <div className="flex items-center gap-1 text-[10px]">
                                {isOptionCorrectKey && (
                                  <span className="text-emerald-700 font-extrabold uppercase">
                                    Kunci
                                  </span>
                                )}
                                {isOptionStudentChoice && (
                                  <span className="text-slate-600 italic">
                                    (Pilihan Anda)
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          /* ================= WITHHELD SCORE VIEW ================= */
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-8 sm:p-12 text-center space-y-6">
            <div className="w-16 h-16 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center mx-auto">
              <EyeOff className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-800">
                <Clock className="w-3.5 h-3.5" />
                <span>Nilai Dalam Proses Kalibrasi &amp; Evaluasi Dosen</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
                Lembar Jawaban Berhasil Dikumpulkan
              </h1>
              <p className="text-sm text-slate-600 max-w-lg mx-auto leading-relaxed">
                Terima kasih, <strong>{liveAttempt.studentName}</strong>. Jawaban ujian{' '}
                <strong>"{liveExam.title}"</strong> telah tersimpan di sistem.
              </p>
            </div>

            <div className="max-w-md mx-auto p-4 rounded-xl bg-slate-50 border border-slate-200 text-left text-xs space-y-2.5">
              <div className="font-bold text-slate-800 flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-blue-600" />
                Kebijakan Pengumuman Nilai &amp; Kalibrasi IRT
              </div>
              <p className="text-slate-600 leading-relaxed">
                Dosen Pengampu (<strong>{liveExam.lecturerName}</strong>) menahan pengumuman nilai langsung hingga proses kalibrasi IRT seluruh peserta dan verifikasi rekaman pengawas AI selesai dilakukan.
              </p>
              <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-slate-500 text-[11px]">
                <span>Status Jawaban:</span>
                <span className="font-semibold text-emerald-600">Lengkap &amp; Tersimpan</span>
              </div>
              <div className="flex items-center justify-between text-slate-500 text-[11px]">
                <span>Waktu Submit:</span>
                <span className="font-medium font-mono">
                  {liveAttempt.submittedAt
                    ? new Date(liveAttempt.submittedAt).toLocaleString('id-ID')
                    : 'Baru saja'}
                </span>
              </div>
            </div>

            <button
              onClick={onBackToDashboard}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition-colors"
            >
              Kembali ke Halaman Utama Ujian
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
