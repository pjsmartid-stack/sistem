import React, { useState, useMemo } from 'react';
import { useExam } from '../../context/ExamContext';
import { IRTModel, ScoringMethod } from '../../types';
import {
  calibrateExamItems,
  calculateAttemptIRTScore,
  generateIRCCurvePoints,
} from '../../utils/irtScoring';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  BarChart,
  Bar,
  Cell,
} from 'recharts';
import {
  BarChart3,
  RefreshCw,
  CheckCircle2,
  Sliders,
  Download,
  HelpCircle,
  Award,
  FileSpreadsheet,
} from 'lucide-react';

export const IRTAnalyticsView: React.FC = () => {
  const { currentUser, exams, attempts, recalibrateExamScores } = useExam();

  const isStaff = currentUser?.role === 'admin' || currentUser?.role === 'dosen';

  const [selectedExamId, setSelectedExamId] = useState<string>(() => exams[0]?.id || '');
  const [previewModel, setPreviewModel] = useState<IRTModel>('3PL');
  const [isRecalibrating, setIsRecalibrating] = useState(false);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  const selectedExam = useMemo(() => {
    return exams.find((e) => e.id === selectedExamId) || exams[0] || null;
  }, [exams, selectedExamId]);

  const activeModel: IRTModel = selectedExam?.irtModel || previewModel;

  // Completed attempts for the selected exam
  const completedAttempts = useMemo(() => {
    if (!selectedExam) return [];
    return attempts.filter((a) => a.examId === selectedExam.id && a.isCompleted);
  }, [attempts, selectedExam]);

  // Calibrated item parameters (p, b, a, c, irtWeight)
  const itemAnalyses = useMemo(() => {
    if (!selectedExam) return [];
    return calibrateExamItems(selectedExam, completedAttempts, previewModel);
  }, [selectedExam, completedAttempts, previewModel]);

  // Student IRT score evaluations
  const evaluatedRows = useMemo(() => {
    if (!selectedExam) return [];
    return completedAttempts
      .map((att) => {
        const calc = calculateAttemptIRTScore(
          selectedExam,
          att,
          itemAnalyses,
          previewModel
        );
        // Classical comparison score (0-100)
        const totalClassicalMax = selectedExam.questions.reduce(
          (s, q) => s + (q.points || 10),
          0
        );
        let classicalEarned = 0;
        selectedExam.questions.forEach((q) => {
          if (att.answers[q.id]?.selectedOption === q.correctAnswer) {
            classicalEarned += q.points || 10;
          }
        });
        const classicalPct =
          totalClassicalMax > 0
            ? Number(((classicalEarned / totalClassicalMax) * 100).toFixed(1))
            : 0;

        return {
          attempt: att,
          ...calc,
          classicalPct,
          deltaIrtVsClassical: Number((calc.rawScore - classicalPct).toFixed(1)),
        };
      })
      .sort((a, b) => b.irtScaledScore - a.irtScaledScore);
  }, [selectedExam, completedAttempts, itemAnalyses, previewModel]);

  const curveData = useMemo(() => {
    return generateIRCCurvePoints(itemAnalyses);
  }, [itemAnalyses]);

  const summaryStats = useMemo(() => {
    if (evaluatedRows.length === 0) {
      return {
        participants: 0,
        meanScaled: 500,
        maxScaled: 500,
        meanTheta: 0,
        meanScore100: 0,
        easyCount: itemAnalyses.filter((i) => i.difficultyCategory === 'Mudah').length,
        mediumCount: itemAnalyses.filter((i) => i.difficultyCategory === 'Sedang').length,
        hardCount: itemAnalyses.filter((i) => i.difficultyCategory === 'Sulit').length,
      };
    }

    const n = evaluatedRows.length;
    const meanScaled = Math.round(
      evaluatedRows.reduce((s, r) => s + r.irtScaledScore, 0) / n
    );
    const maxScaled = Math.max(...evaluatedRows.map((r) => r.irtScaledScore));
    const meanTheta = Number(
      (evaluatedRows.reduce((s, r) => s + r.irtTheta, 0) / n).toFixed(2)
    );
    const meanScore100 = Number(
      (evaluatedRows.reduce((s, r) => s + r.finalScore, 0) / n).toFixed(1)
    );

    return {
      participants: n,
      meanScaled,
      maxScaled,
      meanTheta,
      meanScore100,
      easyCount: itemAnalyses.filter((i) => i.difficultyCategory === 'Mudah').length,
      mediumCount: itemAnalyses.filter((i) => i.difficultyCategory === 'Sedang').length,
      hardCount: itemAnalyses.filter((i) => i.difficultyCategory === 'Sulit').length,
    };
  }, [evaluatedRows, itemAnalyses]);

  const handleApplyAndCalibrate = async (methodToSave: ScoringMethod = 'irt') => {
    if (!selectedExam) return;
    setIsRecalibrating(true);
    setStatusNotice(null);
    await recalibrateExamScores(selectedExam.id, methodToSave, previewModel);
    setIsRecalibrating(false);
    setStatusNotice(
      methodToSave === 'irt'
        ? `Penilaian IRT (${previewModel}) berhasil diterapkan & seluruh lembar jawaban peserta telah dikalibrasi ulang.`
        : 'Sistem penilaian dikembalikan ke mode Klasik (Bobot Tetap).'
    );
  };

  const handleExportIRTCSV = () => {
    if (!selectedExam) return;
    const headers = [
      'Peringkat',
      'NIM',
      'Nama Mahasiswa',
      'Kelas',
      'Benar',
      'Total Soal',
      'Theta (Kemampuan)',
      'SE(Theta)',
      'Skor Standar IRT (Skala 500)',
      'Nilai Murni IRT (0-100)',
      'Nilai Klasik (0-100)',
      'Penalti AI',
      'Nilai Akhir',
      'Status Kelulusan',
    ];
    const rows = evaluatedRows.map((row, idx) => [
      idx + 1,
      row.attempt.studentNim,
      `"${row.attempt.studentName}"`,
      `"${row.attempt.studentClassName || '-'}"`,
      row.correctCount,
      selectedExam.questions.length,
      row.irtTheta,
      row.irtStandardError,
      row.irtScaledScore,
      row.rawScore,
      row.classicalPct,
      row.penaltyDeduction,
      row.finalScore,
      row.isPassed ? 'Lulus' : 'Belum Lulus',
    ]);

    const csv =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csv));
    link.setAttribute(
      'download',
      `analisis_irt_${selectedExam.courseCode}_${previewModel}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ==================== STUDENT IRT PROFILE VIEW ====================
  if (!isStaff) {
    const myReleasedAttempts = attempts.filter((att) => {
      if (att.studentId !== currentUser?.id || !att.isCompleted) return false;
      const ex = exams.find((e) => e.id === att.examId);
      return ex && (ex.showScoreImmediately || ex.isScorePublished);
    });

    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-2">
          <div className="text-xs font-medium text-slate-500">
            Evaluasi Psikometri · Item Response Theory
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Profil Nilai &amp; Kemampuan IRT Saya
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 max-w-3xl leading-relaxed">
            Pada sistem penilaian berbasis <strong>IRT (Item Response Theory)</strong>, setiap butir soal memiliki bobot dinamis berdasarkan tingkat kesulitan empiris (<span className="font-mono">b</span>), daya pembeda (<span className="font-mono">a</span>), dan koreksi tebakan semu (<span className="font-mono">c</span>). Menjawab benar pada soal sulit memberikan kontribusi skor kemampuan (<span className="font-mono">Theta θ</span>) lebih tinggi dibandingkan soal mudah.
          </p>
        </div>

        {myReleasedAttempts.length === 0 ? (
          <div className="bg-white rounded-xl border border-dashed border-slate-300 p-12 text-center space-y-2">
            <Award className="w-10 h-10 text-slate-300 mx-auto" />
            <div className="text-sm font-semibold text-slate-700">
              Belum Ada Riwayat Skor IRT yang Dirilis
            </div>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Skor kemampuan Theta, Skor Standar IRT (Skala UTBK 500), serta rincian bobot butir soal akan tampil di sini setelah ujian selesai dan nilai diumumkan dosen.
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200">
              <h2 className="text-sm font-bold text-slate-900">
                Rekapitulasi Skor IRT Ujian Saya
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                  <tr>
                    <th className="px-5 py-3">Mata Kuliah &amp; Ujian</th>
                    <th className="px-5 py-3">Metode</th>
                    <th className="px-5 py-3 text-right">Jawaban Benar</th>
                    <th className="px-5 py-3 text-right">Kemampuan (θ)</th>
                    <th className="px-5 py-3 text-right">Skor Standar IRT</th>
                    <th className="px-5 py-3 text-right">Nilai Akhir</th>
                    <th className="px-5 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {myReleasedAttempts.map((att) => {
                    const ex = exams.find((e) => e.id === att.examId)!;
                    const allCompleted = attempts.filter(
                      (a) => a.examId === ex.id && a.isCompleted
                    );
                    const items = calibrateExamItems(ex, allCompleted, ex.irtModel || '3PL');
                    const calc = calculateAttemptIRTScore(ex, att, items, ex.irtModel || '3PL');

                    return (
                      <tr key={att.id} className="hover:bg-slate-50/70">
                        <td className="px-5 py-3.5">
                          <div className="font-semibold text-slate-900">{ex.title}</div>
                          <div className="text-[11px] text-slate-500">
                            {ex.courseCode} · {ex.courseName}
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-slate-600">
                          {ex.scoringMethod === 'irt'
                            ? `IRT (${ex.irtModel || '3PL'})`
                            : 'Klasik + Profil IRT'}
                        </td>
                        <td className="px-5 py-3.5 text-right font-mono tabular-nums">
                          {att.correctCount ?? calc.correctCount} / {ex.questions.length}
                        </td>
                        <td className="px-5 py-3.5 text-right font-mono tabular-nums font-semibold text-slate-900">
                          {(att.irtTheta ?? calc.irtTheta) > 0
                            ? `+${att.irtTheta ?? calc.irtTheta}`
                            : att.irtTheta ?? calc.irtTheta}{' '}
                          <span className="text-slate-400 font-normal">
                            ±{att.irtStandardError ?? calc.irtStandardError}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-right font-mono tabular-nums font-bold text-blue-700">
                          {att.irtScaledScore ?? calc.irtScaledScore}
                        </td>
                        <td className="px-5 py-3.5 text-right font-mono tabular-nums font-bold text-slate-900">
                          {att.score ?? calc.finalScore} / {att.maxScore ?? 100}
                        </td>
                        <td className="px-5 py-3.5">
                          <span
                            className={`font-semibold ${
                              att.isPassed ? 'text-emerald-700' : 'text-rose-700'
                            }`}
                          >
                            {att.isPassed ? 'Lulus' : 'Belum Lulus'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ==================== ADMIN & LECTURER IRT ANALYTICS WORKSPACE ====================
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="text-xs text-slate-500">
            Sistem Penilaian Psikometri · Standar UTBK &amp; Computerized Testing
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Sistem Penilaian Berbasis IRT (Item Response Theory)
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 max-w-3xl">
            Kalibrasi tingkat kesulitan soal (<span className="font-mono">b</span>), daya pembeda (<span className="font-mono">a</span>), dan faktor tebakan semu (<span className="font-mono">c</span>) secara otomatis dari pola jawaban peserta untuk menghasilkan estimasi kemampuan <span className="font-mono">Theta (θ)</span>, Skor Standar IRT (Skala 500), dan Nilai Konversi Akademik (0–100).
          </p>
        </div>

        {selectedExam && (
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              disabled={isRecalibrating}
              onClick={() => handleApplyAndCalibrate('irt')}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors whitespace-nowrap"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRecalibrating ? 'animate-spin' : ''}`} />
              <span>Terapkan &amp; Kalibrasi IRT ({previewModel})</span>
            </button>

            <button
              type="button"
              onClick={handleExportIRTCSV}
              disabled={evaluatedRows.length === 0}
              className="px-3.5 py-2 bg-white hover:bg-slate-50 disabled:opacity-50 text-slate-700 border border-slate-300 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Unduh CSV IRT</span>
            </button>
          </div>
        )}
      </div>

      {statusNotice && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{statusNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusNotice(null)}
            className="text-emerald-700 hover:text-emerald-900 font-semibold"
          >
            Tutup
          </button>
        </div>
      )}

      {exams.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-slate-300 p-12 text-center space-y-2">
          <BarChart3 className="w-10 h-10 text-slate-300 mx-auto" />
          <div className="text-sm font-semibold text-slate-700">
            Belum Ada Paket Ujian untuk Dianalisis
          </div>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Silakan buat ujian baru pada menu <strong>Dashboard &amp; Ujian</strong> dan impor butir soal pilihan ganda untuk mulai menggunakan kalibrasi penilaian IRT.
          </p>
        </div>
      ) : (
        <>
          {/* Filter & IRT Model Selector Toolbar */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-1">
              <label className="text-xs font-semibold text-slate-700 whitespace-nowrap">
                Pilih Paket Ujian:
              </label>
              <select
                value={selectedExam?.id || ''}
                onChange={(e) => {
                  const ex = exams.find((item) => item.id === e.target.value);
                  setSelectedExamId(e.target.value);
                  if (ex?.irtModel) setPreviewModel(ex.irtModel);
                }}
                className="w-full sm:max-w-md px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {exams.map((ex) => (
                  <option key={ex.id} value={ex.id}>
                    {ex.courseCode} — {ex.title} (
                    {ex.scoringMethod === 'irt'
                      ? `Aktif IRT ${ex.irtModel || '3PL'}`
                      : 'Mode Klasik'}
                    )
                  </option>
                ))}
              </select>
            </div>

            {/* Segmented Model Control: 1PL | 2PL | 3PL */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-600 flex items-center gap-1 whitespace-nowrap">
                <Sliders className="w-3.5 h-3.5 text-slate-400" />
                Model Logistik:
              </span>
              <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                {(['1PL', '2PL', '3PL'] as IRTModel[]).map((mdl) => (
                  <button
                    key={mdl}
                    type="button"
                    onClick={() => setPreviewModel(mdl)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                      previewModel === mdl
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {mdl === '1PL'
                      ? '1PL (Rasch)'
                      : mdl === '2PL'
                      ? '2PL (a, b)'
                      : '3PL (Standar UTBK)'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Summary Metrics Strip */}
          {selectedExam && (
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="bg-white p-4 rounded-xl border border-slate-200">
                <div className="text-xs text-slate-500">Status Sistem Nilai</div>
                <div className="mt-1.5 text-base font-bold text-slate-900">
                  {selectedExam.scoringMethod === 'irt'
                    ? `IRT Aktif (${activeModel})`
                    : 'Klasik (Simulasi IRT)'}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  {selectedExam.questions.length} butir soal terkalibrasi
                </div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200">
                <div className="text-xs text-slate-500">Peserta Selesai</div>
                <div className="mt-1.5 text-xl font-bold font-mono tabular-nums text-slate-900">
                  {summaryStats.participants}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Responden empiris
                </div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200">
                <div className="text-xs text-slate-500">Rerata Skor Standar IRT</div>
                <div className="mt-1.5 text-xl font-bold font-mono tabular-nums text-blue-700">
                  {summaryStats.meanScaled}{' '}
                  <span className="text-xs font-normal text-slate-400">
                    / Max {summaryStats.maxScaled}
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Skala 200–850 (Mean 500)
                </div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200">
                <div className="text-xs text-slate-500">Rerata Theta (θ) &amp; Nilai</div>
                <div className="mt-1.5 text-xl font-bold font-mono tabular-nums text-slate-900">
                  {summaryStats.meanTheta > 0
                    ? `+${summaryStats.meanTheta}`
                    : summaryStats.meanTheta}{' '}
                  <span className="text-xs font-normal text-slate-500">
                    ({summaryStats.meanScore100}/100)
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Estimasi EAP Normal Standar
                </div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200">
                <div className="text-xs text-slate-500">Sebaran Kesulitan Soal</div>
                <div className="mt-1.5 text-xs font-mono tabular-nums font-semibold text-slate-900 flex items-center gap-2">
                  <span className="text-emerald-700">{summaryStats.easyCount} Mudah</span>
                  <span>·</span>
                  <span className="text-blue-700">{summaryStats.mediumCount} Sedang</span>
                  <span>·</span>
                  <span className="text-amber-700">{summaryStats.hardCount} Sulit</span>
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Berdasarkan indeks kesulitan b
                </div>
              </div>
            </div>
          )}

          {/* Psychometric Charts: ICC Curves + Item Weight Distribution */}
          {selectedExam && itemAnalyses.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* ICC & TCC Chart */}
              <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
                <div>
                  <h2 className="text-sm font-bold text-slate-900">
                    Kurva Karakteristik Butir Soal (ICC - Model {previewModel})
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Peluang menjawab benar <span className="font-mono">P(θ)</span> berdasarkan tingkat kemampuan peserta <span className="font-mono">Theta (-3.0 s/d +3.0)</span>
                  </p>
                </div>

                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={curveData} margin={{ top: 8, right: 16, left: -16, bottom: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis
                        dataKey="theta"
                        tick={{ fontSize: 11, fill: '#64748b' }}
                        label={{
                          value: 'Kemampuan Peserta (θ)',
                          position: 'insideBottom',
                          offset: -4,
                          fontSize: 11,
                          fill: '#64748b',
                        }}
                      />
                      <YAxis
                        domain={[0, 100]}
                        tick={{ fontSize: 11, fill: '#64748b' }}
                        unit="%"
                      />
                      <Tooltip
                        formatter={(value: any, name: any) => [`${value}%`, name]}
                        labelFormatter={(lbl) => `Kemampuan θ = ${lbl}`}
                      />
                      <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                      <Line
                        type="monotone"
                        dataKey="easyProb"
                        name="Soal Mudah (Peluang Benar)"
                        stroke="#16a34a"
                        strokeWidth={2}
                        dot={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="mediumProb"
                        name="Soal Sedang (Peluang Benar)"
                        stroke="#2563eb"
                        strokeWidth={2}
                        dot={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="hardProb"
                        name="Soal Sulit / HOTS (Peluang Benar)"
                        stroke="#dc2626"
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Dynamic Item Weight Bar Chart */}
              <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
                <div>
                  <h2 className="text-sm font-bold text-slate-900">
                    Distribusi Bobot Poin IRT per Nomor Soal (Total = 100)
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Soal yang lebih sulit (<span className="font-mono">b</span> tinggi) dan berdaya pembeda kuat (<span className="font-mono">a</span> tinggi) memperoleh bobot poin lebih besar
                  </p>
                </div>

                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={itemAnalyses.map((it) => ({
                        name: `No.${it.questionNumber}`,
                        weight: it.irtWeight,
                        category: it.difficultyCategory,
                        difficultyB: it.difficultyB,
                      }))}
                      margin={{ top: 8, right: 16, left: -16, bottom: 8 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} />
                      <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                      <Tooltip
                        formatter={(val: any, _name: any, props: any) => [
                          `${val} Poin (${props.payload.category}, b = ${props.payload.difficultyB})`,
                          'Bobot IRT',
                        ]}
                      />
                      <Bar dataKey="weight" radius={[4, 4, 0, 0]}>
                        {itemAnalyses.map((entry, idx) => (
                          <Cell
                            key={`w-bar-${idx}`}
                            fill={
                              entry.difficultyCategory === 'Sulit'
                                ? '#d97706'
                                : entry.difficultyCategory === 'Mudah'
                                ? '#16a34a'
                                : '#2563eb'
                            }
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {/* Table 1: Item Calibration Parameters */}
          {selectedExam && (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-bold text-slate-900">
                    Tabel Kalibrasi Parameter Butir Soal IRT ({itemAnalyses.length} Butir)
                  </h2>
                  <p className="text-xs text-slate-500">
                    Parameter <span className="font-mono">p</span> (proporsi benar), <span className="font-mono">b</span> (tingkat kesulitan), <span className="font-mono">a</span> (daya pembeda), <span className="font-mono">c</span> (tebakan semu), dan bobot poin dinamis IRT
                  </p>
                </div>
                <div className="text-xs text-slate-500 flex items-center gap-1.5">
                  <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
                  <span>Total Bobot Terkalibrasi: 100.0 Poin</span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                    <tr>
                      <th className="px-4 py-3">No</th>
                      <th className="px-4 py-3">Pertanyaan Soal</th>
                      <th className="px-4 py-3">Kunci</th>
                      <th className="px-4 py-3 text-right">Penjawab Benar (p)</th>
                      <th className="px-4 py-3 text-right">Kesulitan (b)</th>
                      <th className="px-4 py-3 text-right">Daya Beda (a)</th>
                      <th className="px-4 py-3 text-right">Tebakan (c)</th>
                      <th className="px-4 py-3">Tingkat Kesulitan</th>
                      <th className="px-4 py-3 text-right">Bobot IRT</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {itemAnalyses.map((item) => (
                      <tr key={item.questionId} className="hover:bg-slate-50/70">
                        <td className="px-4 py-3 font-mono tabular-nums font-semibold text-slate-700">
                          {item.questionNumber}
                        </td>
                        <td className="px-4 py-3 max-w-md">
                          <div className="text-slate-900 font-medium line-clamp-1">
                            {item.questionText}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            Kualitas Daya Beda: {item.qualityStatus}
                          </div>
                        </td>
                        <td className="px-4 py-3 font-mono font-bold text-slate-800">
                          {item.correctAnswer}
                        </td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-700">
                          {item.totalRespondents > 0
                            ? `${item.correctCount}/${item.totalRespondents} (${Math.round(
                                item.proportionCorrect * 100
                              )}%)`
                            : 'Prior Awal'}
                        </td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums font-semibold text-slate-900">
                          {item.difficultyB > 0 ? `+${item.difficultyB}` : item.difficultyB}
                        </td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-700">
                          {item.discriminationA.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-500">
                          {item.guessingC.toFixed(2)}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`font-semibold ${
                              item.difficultyCategory === 'Sulit'
                                ? 'text-amber-700'
                                : item.difficultyCategory === 'Mudah'
                                ? 'text-emerald-700'
                                : 'text-blue-700'
                            }`}
                          >
                            {item.difficultyCategory}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums font-bold text-blue-700">
                          {item.irtWeight.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Table 2: Student IRT Ranking & Score Comparison */}
          {selectedExam && (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-bold text-slate-900">
                    Daftar Nilai Peserta Berbasis IRT vs Klasik ({evaluatedRows.length} Mahasiswa)
                  </h2>
                  <p className="text-xs text-slate-500">
                    Membandingkan skor bobot tetap klasik dengan hasil pembobotan psikometri IRT (<span className="font-mono">Theta</span>, Skor Standar 500, dan Nilai Konversi 0–100)
                  </p>
                </div>

                {selectedExam.scoringMethod === 'irt' && (
                  <button
                    type="button"
                    onClick={() => handleApplyAndCalibrate('classical')}
                    className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50 self-start sm:self-center"
                  >
                    Kembalikan ke Mode Klasik
                  </button>
                )}
              </div>

              {evaluatedRows.length === 0 ? (
                <div className="p-10 text-center text-xs text-slate-500 space-y-1">
                  <FileSpreadsheet className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <div className="font-semibold text-slate-700">
                    Belum Ada Mahasiswa yang Mengumpulkan Jawaban
                  </div>
                  <p>
                    Begitu mahasiswa menyelesaikan ujian ini, sistem otomatis menghitung parameter kesulitan soal secara empiris dan mengurutkan kemampuan Theta peserta.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                      <tr>
                        <th className="px-4 py-3">#</th>
                        <th className="px-4 py-3">Mahasiswa</th>
                        <th className="px-4 py-3 text-right">Benar</th>
                        <th className="px-4 py-3 text-right">Theta (θ ± SE)</th>
                        <th className="px-4 py-3 text-right">Skor IRT (UTBK)</th>
                        <th className="px-4 py-3 text-right">Klasik (0–100)</th>
                        <th className="px-4 py-3 text-right">Murni IRT (0–100)</th>
                        <th className="px-4 py-3 text-right">Penalti AI</th>
                        <th className="px-4 py-3 text-right">Nilai Akhir IRT</th>
                        <th className="px-4 py-3">Kelulusan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {evaluatedRows.map((row, index) => (
                        <tr key={row.attempt.id} className="hover:bg-slate-50/70">
                          <td className="px-4 py-3 font-mono tabular-nums text-slate-500">
                            {index + 1}
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-semibold text-slate-900">
                              {row.attempt.studentName}
                            </div>
                            <div className="text-[11px] text-slate-500 font-mono">
                              {row.attempt.studentNim}
                              {row.attempt.studentClassName
                                ? ` · ${row.attempt.studentClassName}`
                                : ''}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-700">
                            {row.correctCount} / {selectedExam.questions.length}
                          </td>
                          <td className="px-4 py-3 text-right font-mono tabular-nums font-semibold text-slate-900">
                            {row.irtTheta > 0 ? `+${row.irtTheta}` : row.irtTheta}{' '}
                            <span className="text-slate-400 font-normal">
                              ±{row.irtStandardError}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right font-mono tabular-nums font-bold text-blue-700">
                            {row.irtScaledScore}
                          </td>
                          <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-500">
                            {row.classicalPct}
                          </td>
                          <td className="px-4 py-3 text-right font-mono tabular-nums font-semibold text-slate-900">
                            {row.rawScore}{' '}
                            {row.deltaIrtVsClassical !== 0 && (
                              <span
                                className={`text-[10px] ${
                                  row.deltaIrtVsClassical > 0
                                    ? 'text-emerald-600'
                                    : 'text-amber-600'
                                }`}
                              >
                                ({row.deltaIrtVsClassical > 0 ? '+' : ''}
                                {row.deltaIrtVsClassical})
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right font-mono tabular-nums text-rose-600">
                            {row.penaltyDeduction > 0 ? `-${row.penaltyDeduction}` : '0'}
                          </td>
                          <td className="px-4 py-3 text-right font-mono tabular-nums font-bold text-slate-900">
                            {row.finalScore}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`font-semibold ${
                                row.isPassed ? 'text-emerald-700' : 'text-rose-700'
                              }`}
                            >
                              {row.isPassed ? 'Lulus' : 'Belum Lulus'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};
