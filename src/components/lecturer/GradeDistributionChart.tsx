import React, { useState, useMemo } from 'react';
import { Exam, ExamAttempt } from '../../types';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { Award, TrendingUp, Users, CheckCircle2, XCircle, Filter } from 'lucide-react';

interface GradeDistributionChartProps {
  exams: Exam[];
  attempts: ExamAttempt[];
}

interface ScoreRange {
  range: string;
  grade: string;
  count: number;
  description: string;
  color: string;
}

export const GradeDistributionChart: React.FC<GradeDistributionChartProps> = ({
  exams,
  attempts,
}) => {
  const [selectedExamId, setSelectedExamId] = useState<string>('all');

  // Filter completed attempts according to exam selection
  const relevantAttempts = useMemo(() => {
    return attempts.filter((att) => {
      if (!att.isCompleted) return false;
      if (selectedExamId === 'all') return true;
      return att.examId === selectedExamId;
    });
  }, [attempts, selectedExamId]);

  // Aggregate stats
  const stats = useMemo(() => {
    const total = relevantAttempts.length;
    if (total === 0) {
      return {
        total: 0,
        average: 0,
        highest: 0,
        lowest: 0,
        passed: 0,
        failed: 0,
        passRate: 0,
      };
    }

    const scores = relevantAttempts.map((a) => a.percentage ?? 0);
    const sum = scores.reduce((acc, curr) => acc + curr, 0);
    const avg = Math.round(sum / total);
    const high = Math.max(...scores);
    const low = Math.min(...scores);
    const passed = relevantAttempts.filter((a) => a.isPassed).length;
    const failed = total - passed;
    const passRate = Math.round((passed / total) * 100);

    return {
      total,
      average: avg,
      highest: high,
      lowest: low,
      passed,
      failed,
      passRate,
    };
  }, [relevantAttempts]);

  // Grade Distribution Data for BarChart
  const distributionData = useMemo((): ScoreRange[] => {
    const ranges: ScoreRange[] = [
      { range: '85 - 100', grade: 'Nilai A', count: 0, description: 'Sangat Memuaskan', color: '#10b981' },
      { range: '70 - 84', grade: 'Nilai B', count: 0, description: 'Baik', color: '#3b82f6' },
      { range: '55 - 69', grade: 'Nilai C', count: 0, description: 'Cukup', color: '#f59e0b' },
      { range: '40 - 54', grade: 'Nilai D', count: 0, description: 'Kurang', color: '#f97316' },
      { range: '0 - 39', grade: 'Nilai E', count: 0, description: 'Mengulang', color: '#ef4444' },
    ];

    relevantAttempts.forEach((att) => {
      const p = att.percentage ?? 0;
      if (p >= 85) ranges[0].count++;
      else if (p >= 70) ranges[1].count++;
      else if (p >= 55) ranges[2].count++;
      else if (p >= 40) ranges[3].count++;
      else ranges[4].count++;
    });

    return ranges;
  }, [relevantAttempts]);

  // Pass/Fail data for PieChart
  const passFailData = useMemo(() => {
    return [
      { name: 'Lulus KKM', value: stats.passed, color: '#10b981' },
      { name: 'Tidak Lulus', value: stats.failed, color: '#ef4444' },
    ];
  }, [stats]);

  const CustomBarTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload as ScoreRange;
      return (
        <div className="bg-slate-900 text-white p-3 rounded-xl shadow-xl text-xs space-y-1 border border-slate-700">
          <div className="font-bold text-amber-300">{data.grade} ({data.range})</div>
          <div className="text-slate-300">{data.description}</div>
          <div className="text-emerald-400 font-extrabold text-sm pt-1">
            {data.count} Mahasiswa ({stats.total > 0 ? Math.round((data.count / stats.total) * 100) : 0}%)
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
      {/* Header and Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-blue-600" />
            <h2 className="text-base font-bold text-slate-900">
              Analitik &amp; Grafik Distribusi Nilai Kelas
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Pantau sebaran performa akademik mahasiswa per rentang nilai standar perguruan tinggi
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <Filter className="w-4 h-4 text-slate-400" />
          <span className="font-semibold text-slate-700">Pilih Ujian:</span>
          <select
            value={selectedExamId}
            onChange={(e) => setSelectedExamId(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-800 bg-slate-50 font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
          >
            <option value="all">Semua Ujian Tergabung ({exams.length} Ujian)</option>
            {exams.map((ex) => (
              <option key={ex.id} value={ex.id}>
                {ex.courseCode} - {ex.title.length > 30 ? `${ex.title.slice(0, 30)}...` : ex.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl text-center">
          <span className="text-[11px] font-semibold text-slate-500 block">Peserta Mengumpulkan</span>
          <span className="text-xl font-extrabold text-slate-900 mt-0.5 inline-block">
            {stats.total}
          </span>
          <span className="text-[10px] text-slate-400 block">Mahasiswa</span>
        </div>

        <div className="p-3.5 bg-blue-50/50 border border-blue-100 rounded-xl text-center">
          <span className="text-[11px] font-semibold text-blue-700 block">Rata-Rata Nilai</span>
          <span className="text-xl font-extrabold text-blue-700 mt-0.5 inline-block">
            {stats.average}%
          </span>
          <span className="text-[10px] text-blue-600/80 block">Mean Score</span>
        </div>

        <div className="p-3.5 bg-emerald-50/50 border border-emerald-100 rounded-xl text-center">
          <span className="text-[11px] font-semibold text-emerald-700 block">Tingkat Kelulusan</span>
          <span className="text-xl font-extrabold text-emerald-700 mt-0.5 inline-block">
            {stats.passRate}%
          </span>
          <span className="text-[10px] text-emerald-600/80 block">{stats.passed} dari {stats.total} Lulus</span>
        </div>

        <div className="p-3.5 bg-purple-50/50 border border-purple-100 rounded-xl text-center">
          <span className="text-[11px] font-semibold text-purple-700 block">Rentang Tertinggi / Rendah</span>
          <span className="text-lg font-extrabold text-purple-700 mt-0.5 inline-block">
            {stats.highest}% <span className="text-xs font-normal text-slate-400">/</span> {stats.lowest}%
          </span>
          <span className="text-[10px] text-purple-600/80 block">Max vs Min</span>
        </div>
      </div>

      {/* Chart Layout: Bar Chart (70%) + Pass/Fail Donut Chart (30%) */}
      {stats.total === 0 ? (
        <div className="py-12 text-center text-slate-400 text-xs border border-dashed border-slate-200 rounded-xl">
          Belum ada data nilai ujian yang dikumpulkan untuk filter yang dipilih.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-2">
          {/* Main Bar Chart */}
          <div className="lg:col-span-2 space-y-2">
            <div className="text-xs font-bold text-slate-800 flex items-center justify-between">
              <span>Distribusi Frekuensi Mahasiswa Berdasarkan Grade</span>
              <span className="text-[11px] font-normal text-slate-400">Satuan: Jumlah Peserta</span>
            </div>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={distributionData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis
                    dataKey="grade"
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    axisLine={{ stroke: '#cbd5e1' }}
                    tickLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    axisLine={{ stroke: '#cbd5e1' }}
                    tickLine={false}
                  />
                  <Tooltip content={<CustomBarTooltip />} />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                    {distributionData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Donut Chart Pass vs Fail */}
          <div className="space-y-2 border-t lg:border-t-0 lg:border-l border-slate-100 lg:pl-6 pt-4 lg:pt-0">
            <div className="text-xs font-bold text-slate-800">
              Rasio Kelulusan Mahasiswa (KKM)
            </div>

            <div className="h-56 w-full flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={passFailData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {passFailData.map((entry, index) => (
                      <Cell key={`donut-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(val: any, name: any) => [
                      `${val} Mahasiswa (${stats.total > 0 ? Math.round((Number(val) / stats.total) * 100) : 0}%)`,
                      name,
                    ]}
                  />
                  <Legend
                    verticalAlign="bottom"
                    iconType="circle"
                    formatter={(value) => <span className="text-xs text-slate-700">{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
