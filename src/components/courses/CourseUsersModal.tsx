import React, { useEffect, useState } from 'react';
import { useExam } from '../../context/ExamContext';
import { Course } from '../../types';
import { CourseUserPicker } from './CourseUserPicker';
import { X, Users, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

interface CourseUsersModalProps {
  isOpen: boolean;
  course: Course | null;
  onClose: () => void;
}

export const CourseUsersModal: React.FC<CourseUsersModalProps> = ({
  isOpen,
  course,
  onClose,
}) => {
  const { updateCourseEnrolledUsers } = useExam();
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState(false);

  useEffect(() => {
    if (isOpen && course) {
      setSelectedUserIds(course.enrolledUserIds || []);
      setError(null);
      setSavedNotice(false);
    }
  }, [isOpen, course]);

  if (!isOpen || !course) return null;

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await updateCourseEnrolledUsers(course.id, selectedUserIds);
      setSavedNotice(true);
      setTimeout(() => {
        onClose();
      }, 650);
    } catch (err: any) {
      setError(err?.message || 'Gagal menyimpan daftar pengguna mata kuliah ke Firebase.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-600 shrink-0" />
              <span className="truncate">Kelola Pengguna Mata Kuliah</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5 truncate">
              <span className="font-mono font-semibold text-blue-700">{course.code}</span> ·{' '}
              {course.name}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/70 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {savedNotice && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Daftar pengguna mata kuliah berhasil disimpan ke Firestore.</span>
            </div>
          )}

          <CourseUserPicker
            selectedUserIds={selectedUserIds}
            onChange={setSelectedUserIds}
            assignedClassIds={course.assignedClassIds || []}
            primaryLecturerId={course.lecturerId}
            compactHeightClass="max-h-80"
          />
        </div>

        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold inline-flex items-center gap-1.5 disabled:opacity-50"
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <span>{saving ? 'Menyimpan...' : 'Simpan Daftar Pengguna'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
