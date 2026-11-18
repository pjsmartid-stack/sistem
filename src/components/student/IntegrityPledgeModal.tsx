import React, { useState } from 'react';
import { Exam } from '../../types';
import {
  ShieldAlert,
  ShieldCheck,
  Lock,
  ArrowRight,
  X,
  AlertTriangle,
} from 'lucide-react';

interface IntegrityPledgeModalProps {
  isOpen: boolean;
  exam: Exam;
  onClose: () => void;
  onConfirm: () => void;
}

export const IntegrityPledgeModal: React.FC<IntegrityPledgeModalProps> = ({
  isOpen,
  exam,
  onClose,
  onConfirm,
}) => {
  const [isAgreed, setIsAgreed] = useState(false);

  if (!isOpen) return null;

  // Active penalty rules (custom or default)
  const penaltyRules = exam.penaltyRules && exam.penaltyRules.length > 0
    ? exam.penaltyRules
    : [
        {
          minViolations: 1,
          maxViolations: 10,
          pointDeduction: 15,
          description: 'Pengurangan 15 Poin dari Nilai Akhir',
        },
        {
          minViolations: 11,
          maxViolations: 30,
          pointDeduction: 35,
          description: 'Pengurangan 35 Poin dari Nilai Akhir',
        },
        {
          minViolations: 31,
          maxViolations: 999,
          pointDeduction: 100,
          description: 'Pengurangan 100 Poin (Gugur / Nilai 0)',
        },
      ];

  const handleStart = () => {
    if (!isAgreed) return;
    onConfirm();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-2xl my-8 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center border border-white/20">
              <ShieldCheck className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-extrabold tracking-tight">
                Pakta Integritas &amp; Peraturan Ujian Daring
              </h2>
              <p className="text-xs text-blue-200">
                Wajib disetujui peserta sebelum memulai pengerjaan soal ujian
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5 text-xs text-slate-700 overflow-y-auto max-h-[70vh]">
          {/* Exam Overview Strip */}
          <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-200 space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <div>
                <span className="text-[11px] font-mono text-blue-700 font-bold">
                  {exam.courseCode} • {exam.courseName}
                </span>
                <h3 className="text-sm font-extrabold text-slate-900">{exam.title}</h3>
              </div>
              <div className="flex items-center gap-2 self-start sm:self-center">
                <span className="px-2.5 py-1 rounded-lg bg-white border border-blue-200 font-bold text-blue-800">
                  {exam.durationMinutes} Menit
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-white border border-blue-200 font-bold text-slate-800">
                  {exam.questions.length} Butir Soal
                </span>
              </div>
            </div>
          </div>

          {/* Peraturan Selama Ujian */}
          <div className="space-y-3">
            <h4 className="font-bold text-slate-900 text-xs flex items-center gap-1.5 uppercase tracking-wider text-slate-500">
              <Lock className="w-4 h-4 text-blue-600" />
              Tata Tertib &amp; Penguncian Keamanan Ujian:
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 space-y-1">
                <div className="font-bold text-slate-900 flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 text-rose-600" />
                  <span>Akses Terbatas &amp; Dilarang Keluar</span>
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Selama sesi berlangsung akses portal lain dikunci (hanya ruang ujian) dan salin/tempel dinonaktifkan. Membuka tab baru akan <strong>merekam tangkapan layar bukti</strong> dan membunyikan alarm.
                </p>
              </div>

              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 space-y-1">
                <div className="font-bold text-slate-900 flex items-center gap-1.5">
                  <Lock className="w-4 h-4 text-indigo-600" />
                  <span>Hanya 1x Akses &amp; Jawaban Permanen</span>
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Ujian hanya dapat diakses <strong>satu kali</strong>. Setelah selesai dikumpulkan atau waktu habis, seluruh jawaban terkunci otomatis dan tidak dapat diubah lagi.
                </p>
              </div>
            </div>
          </div>

          {/* Ketentuan Pengurangan Poin Kecurangan (Requested by user) */}
          <div className="space-y-3 pt-1">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-slate-900 text-xs flex items-center gap-1.5 uppercase tracking-wider text-slate-500">
                <AlertTriangle className="w-4 h-4 text-rose-600" />
                Ketentuan Pengurangan Poin Sanksi Kecurangan:
              </h4>
              <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                Sanksi Otomatis
              </span>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
              <div className="bg-slate-100 px-4 py-2 font-bold text-[11px] text-slate-700 grid grid-cols-12 gap-2">
                <span className="col-span-4">Frekuensi Pelanggaran</span>
                <span className="col-span-4 text-rose-600">Pemotongan Nilai</span>
                <span className="col-span-4">Keterangan Sanksi</span>
              </div>
              {penaltyRules.map((rule, idx) => (
                <div
                  key={idx}
                  className="px-4 py-2.5 bg-white grid grid-cols-12 gap-2 items-center text-[11px]"
                >
                  <span className="col-span-4 font-bold text-slate-800 font-mono">
                    {rule.minViolations} - {rule.maxViolations >= 999 ? '30+' : rule.maxViolations} kali
                  </span>
                  <span className="col-span-4 font-extrabold text-rose-700 font-mono">
                    - {rule.pointDeduction} Poin
                  </span>
                  <span className="col-span-4 text-slate-500 text-[10px]">
                    {rule.description || `Pengurangan ${rule.pointDeduction} poin`}
                  </span>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-slate-400 italic">
              * Nilai akhir ujian akan otomatis dikurangi berdasarkan total akumulasi insiden kecurangan yang terdeteksi saat ujian dikumpulkan.
            </p>
          </div>

          {/* Mandatory Checkbox */}
          <div className="pt-3 border-t border-slate-200">
            <label className="flex items-start gap-3 p-4 rounded-2xl bg-amber-50/70 border border-amber-300/80 cursor-pointer hover:bg-amber-100/50 transition-colors">
              <input
                type="checkbox"
                checked={isAgreed}
                onChange={(e) => setIsAgreed(e.target.checked)}
                className="mt-0.5 w-5 h-5 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
              />
              <div className="text-xs text-slate-800 space-y-1">
                <span className="font-extrabold text-slate-900 block">
                  Pernyataan Pakta Integritas Mahasiswa:
                </span>
                <p className="leading-relaxed text-[11px] text-slate-700">
                  "Saya menyatakan dengan sadar dan penuh tanggung jawab bahwa saya akan mengerjakan ujian ini secara jujur, mandiri, dan penuh integritas tanpa bantuan pihak lain atau gawai terlarang. Saya mematuhi tata tertib ujian dan bersedia menerima pemotongan nilai atau diskualifikasi bila terbukti melakukan kecurangan."
                </p>
              </div>
            </label>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-5 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-semibold text-xs hover:bg-slate-100 transition-colors"
          >
            Batal &amp; Kembali
          </button>

          <button
            type="button"
            disabled={!isAgreed}
            onClick={handleStart}
            className={`px-6 py-2.5 rounded-xl font-extrabold text-xs flex items-center gap-2 transition-all shadow-md ${
              isAgreed
                ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/25 cursor-pointer'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
            }`}
          >
            <span>Setuju &amp; Mulai Kerjakan Ujian</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
