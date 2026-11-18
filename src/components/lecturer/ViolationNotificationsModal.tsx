import React, { useState } from 'react';
import { useExam } from '../../context/ExamContext';
import { ViolationLog, ViolationType } from '../../types';
import {
  X,
  ShieldAlert,
  CheckCheck,
  Camera,
  AlertTriangle,
  User,
  Clock,
  Filter,
  Eye,
  CheckCircle2,
  Trash2,
} from 'lucide-react';

interface ViolationNotificationsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ViolationNotificationsModal: React.FC<ViolationNotificationsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const {
    violations,
    markViolationReviewed,
    markAllViolationsReviewed,
    unreadViolationsCount,
    exams,
  } = useExam();

  const [filterExamId, setFilterExamId] = useState<string>('all');
  const [selectedSnapshot, setSelectedSnapshot] = useState<ViolationLog | null>(null);

  if (!isOpen) return null;

  const filteredViolations = violations.filter((v) => {
    if (filterExamId !== 'all' && v.examId !== filterExamId) return false;
    return true;
  });

  const getViolationBadge = (type: ViolationType) => {
    switch (type) {
      case 'tab_switch':
        return {
          label: 'Pindah Tab / Blur',
          color: 'bg-amber-100 text-amber-800 border-amber-200',
        };
      case 'fullscreen_exit':
        return {
          label: 'Keluar Fullscreen',
          color: 'bg-rose-100 text-rose-800 border-rose-200',
        };
      case 'face_absence':
        return {
          label: 'Wajah Hilang',
          color: 'bg-orange-100 text-orange-800 border-orange-200',
        };
      case 'multiple_faces':
        return {
          label: 'Lebih dari 1 Orang',
          color: 'bg-red-100 text-red-800 border-red-200',
        };
      case 'gadget_detected':
        return {
          label: 'Gawai / HP Terdeteksi',
          color: 'bg-red-100 text-red-900 border-red-300 font-bold',
        };
      case 'looking_away':
        return {
          label: 'Pandangan Menoleh',
          color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
        };
      case 'right_click_attempt':
        return {
          label: 'Percobaan Copy/Klik',
          color: 'bg-slate-100 text-slate-800 border-slate-200',
        };
      default:
        return {
          label: 'Anomali AI',
          color: 'bg-purple-100 text-purple-800 border-purple-200',
        };
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center font-bold">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900">
                  Laporan Notifikasi Deteksi Kecurangan AI
                </h2>
                {unreadViolationsCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-rose-600 text-white">
                    {unreadViolationsCount} Baru
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500">
                Rekaman sensor real-time: kamera pengawas, perpindahan tab, dan pola mencurigakan
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

        {/* Filters and Actions */}
        <div className="px-6 py-3 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <span className="font-semibold text-slate-700">Filter Ujian:</span>
            <select
              value={filterExamId}
              onChange={(e) => setFilterExamId(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg border border-slate-300 text-slate-800 bg-slate-50 font-medium"
            >
              <option value="all">Semua Ujian ({violations.length} insiden)</option>
              {exams.map((ex) => (
                <option key={ex.id} value={ex.id}>
                  {ex.title.length > 35 ? `${ex.title.slice(0, 35)}...` : ex.title}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={markAllViolationsReviewed}
            disabled={unreadViolationsCount === 0}
            className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 rounded-lg flex items-center gap-1.5 transition-colors"
          >
            <CheckCheck className="w-4 h-4 text-slate-600" />
            Tandai Semua Telah Ditinjau
          </button>
        </div>

        {/* Violations Feed */}
        <div className="flex-1 p-6 overflow-y-auto space-y-3">
          {filteredViolations.length === 0 ? (
            <div className="text-center py-16 text-slate-400 space-y-2">
              <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
              <div className="font-bold text-slate-700 text-sm">Tidak Ada Catatan Kecurangan</div>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Seluruh mahasiswa mematuhi etika ujian daring. Rekaman pengawas AI bersih.
              </p>
            </div>
          ) : (
            filteredViolations.map((v) => {
              const badge = getViolationBadge(v.violationType);
              const isUnread = !v.reviewedByLecturer;

              return (
                <div
                  key={v.id}
                  className={`p-4 rounded-xl border transition-all ${
                    isUnread
                      ? 'bg-rose-50/40 border-rose-200 shadow-xs'
                      : 'bg-white border-slate-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                          v.severity === 'high'
                            ? 'bg-rose-600 text-white'
                            : v.severity === 'medium'
                            ? 'bg-amber-500 text-white'
                            : 'bg-blue-500 text-white'
                        }`}
                      >
                        <ShieldAlert className="w-5 h-5" />
                      </div>

                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-slate-900 text-sm">{v.studentName}</span>
                          <span className="text-xs font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                            NIM: {v.studentNim}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${badge.color}`}
                          >
                            {badge.label}
                          </span>
                          {isUnread && (
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-extrabold bg-rose-600 text-white">
                              BARU
                            </span>
                          )}
                        </div>

                        <div className="text-xs font-semibold text-slate-700">{v.title}</div>
                        <p className="text-xs text-slate-600 leading-relaxed">{v.description}</p>

                        <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-400 pt-1">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            {new Date(v.timestamp).toLocaleTimeString('id-ID', {
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit',
                            })}{' '}
                            • {new Date(v.timestamp).toLocaleDateString('id-ID')}
                          </span>
                          <span>Ujian: {v.examTitle}</span>
                          {v.aiConfidence && (
                            <span className="font-semibold text-purple-700 bg-purple-50 px-1.5 py-0.2 rounded border border-purple-200">
                              AI Akurasi: {Math.round(v.aiConfidence * 100)}%
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {v.snapshotUrl && (
                        <button
                          type="button"
                          onClick={() => setSelectedSnapshot(v)}
                          className="px-2.5 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg flex items-center gap-1.5 transition-colors"
                        >
                          <Camera className="w-3.5 h-3.5" />
                          Bukti Kamera
                        </button>
                      )}

                      {isUnread && (
                        <button
                          type="button"
                          onClick={() => markViolationReviewed(v.id)}
                          className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                          title="Tandai telah diperiksa"
                        >
                          <CheckCheck className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs">
          <div className="text-slate-500">
            Total {violations.length} insiden terekam oleh sistem pengawasan AI.
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors"
          >
            Tutup
          </button>
        </div>
      </div>

      {/* Snapshot Preview Modal */}
      {selectedSnapshot && selectedSnapshot.snapshotUrl && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/80 p-4">
          <div className="bg-slate-900 text-white rounded-2xl p-4 max-w-lg w-full space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-xs font-bold">
                Tangkapan Bukti Sensor AI - {selectedSnapshot.studentName} ({selectedSnapshot.studentNim})
              </div>
              <button
                onClick={() => setSelectedSnapshot(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="rounded-xl overflow-hidden bg-black border border-slate-700 aspect-video flex items-center justify-center">
              <img
                src={selectedSnapshot.snapshotUrl}
                alt="Bukti Kecurangan"
                className="w-full h-full object-contain"
              />
            </div>
            <div className="text-xs text-slate-300 bg-slate-800 p-2.5 rounded-lg">
              <strong>Catatan AI:</strong> {selectedSnapshot.description}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
