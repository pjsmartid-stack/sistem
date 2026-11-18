import React, { useEffect, useState } from 'react';
import { useExam } from '../../context/ExamContext';
import { Course } from '../../types';
import { CourseUserPicker } from './CourseUserPicker';
import { BookOpen, Layers, X, Loader2, AlertCircle } from 'lucide-react';

interface CourseFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  courseToEdit?: Course | null;
  onSaved?: (course: Course) => void;
}

export const CourseFormModal: React.FC<CourseFormModalProps> = ({
  isOpen,
  onClose,
  courseToEdit,
  onSaved,
}) => {
  const { currentUser, classes, users, addCourse, updateCourse } = useExam();

  const [formCode, setFormCode] = useState('');
  const [formName, setFormName] = useState('');
  const [formCredits, setFormCredits] = useState(3);
  const [formLecturerId, setFormLecturerId] = useState('');
  const [formLecturerName, setFormLecturerName] = useState('');
  const [formSemester, setFormSemester] = useState('Semester 1');
  const [formSchedule, setFormSchedule] = useState('Senin, 08:00 - 10:30 WIB');
  const [formDesc, setFormDesc] = useState('');
  const [formAssignedClassIds, setFormAssignedClassIds] = useState<string[]>([]);
  const [formEnrolledUserIds, setFormEnrolledUserIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const lecturerUsers = users.filter((u) => u.role === 'dosen' || u.role === 'admin');

  useEffect(() => {
    if (!isOpen) return;
    setFormError(null);
    if (courseToEdit) {
      setFormCode(courseToEdit.code);
      setFormName(courseToEdit.name);
      setFormCredits(courseToEdit.credits);
      setFormLecturerId(courseToEdit.lecturerId);
      setFormLecturerName(courseToEdit.lecturerName);
      setFormSemester(courseToEdit.semester || 'Semester 1');
      setFormSchedule(courseToEdit.schedule || '');
      setFormDesc(courseToEdit.description || '');
      setFormAssignedClassIds(courseToEdit.assignedClassIds || []);
      setFormEnrolledUserIds(courseToEdit.enrolledUserIds || []);
    } else {
      setFormCode('');
      setFormName('');
      setFormCredits(3);
      setFormLecturerId(currentUser?.id || '');
      setFormLecturerName(currentUser?.name || '');
      setFormSemester('Semester 1');
      setFormSchedule('Senin, 08:00 - 10:30 WIB');
      setFormDesc('');
      setFormAssignedClassIds([]);
      setFormEnrolledUserIds(currentUser?.id ? [currentUser.id] : []);
    }
  }, [isOpen, courseToEdit, currentUser]);

  if (!isOpen) return null;

  const handleToggleClass = (classId: string) => {
    setFormAssignedClassIds((prev) =>
      prev.includes(classId) ? prev.filter((id) => id !== classId) : [...prev, classId]
    );
  };

  const handleIncludeClassMembers = () => {
    if (formAssignedClassIds.length === 0) return;
    const classSet = new Set(formAssignedClassIds);
    const matchingUserIds = users
      .filter((u) => u.classId && classSet.has(u.classId))
      .map((u) => u.id);
    setFormEnrolledUserIds((prev) => Array.from(new Set([...prev, ...matchingUserIds])));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formCode.trim() || !formName.trim()) {
      setFormError('Kode Mata Kuliah dan Nama Mata Kuliah wajib diisi.');
      return;
    }

    // Pastikan dosen pengampu (jika dipilih dari daftar) ikut tercatat bila belum dicentang manual
    const finalEnrolledIds = Array.from(new Set(formEnrolledUserIds));

    setIsSubmitting(true);
    try {
      if (courseToEdit) {
        const updated: Course = {
          ...courseToEdit,
          code: formCode.trim().toUpperCase(),
          name: formName.trim(),
          credits: Number(formCredits) || 3,
          lecturerId: formLecturerId || courseToEdit.lecturerId,
          lecturerName: formLecturerName.trim() || 'Dosen Pengampu',
          semester: formSemester.trim(),
          schedule: formSchedule.trim(),
          description: formDesc.trim(),
          assignedClassIds: formAssignedClassIds,
          enrolledUserIds: finalEnrolledIds,
        };
        await updateCourse(updated);
        if (onSaved) onSaved(updated);
      } else {
        const created = await addCourse({
          code: formCode.trim().toUpperCase(),
          name: formName.trim(),
          credits: Number(formCredits) || 3,
          lecturerId: formLecturerId || currentUser?.id || 'admin',
          lecturerName: formLecturerName.trim() || currentUser?.name || 'Dosen Pengampu',
          semester: formSemester.trim(),
          schedule: formSchedule.trim(),
          description: formDesc.trim(),
          assignedClassIds: formAssignedClassIds,
          enrolledUserIds: finalEnrolledIds,
        });
        if (onSaved) onSaved(created);
      }
      onClose();
    } catch (err: any) {
      setFormError(err?.message || 'Gagal menyimpan data mata kuliah ke Firebase.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div>
            <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-blue-600" />
              <span>{courseToEdit ? 'Edit Data Mata Kuliah' : 'Tambah Mata Kuliah Baru'}</span>
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Lengkapi detail mata kuliah dan tambahkan pengguna (Mahasiswa, Dosen, Admin) ke dalam kelas ini.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5 text-xs">
          {formError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {/* Section 1: Core Course Identity */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Kode MK *
              </label>
              <input
                type="text"
                required
                placeholder="IF-301"
                value={formCode}
                onChange={(e) => setFormCode(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono uppercase"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block font-semibold text-slate-700 mb-1">
                Nama Mata Kuliah *
              </label>
              <input
                type="text"
                required
                placeholder="Contoh: Struktur Data & Algoritma"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Jumlah SKS
              </label>
              <input
                type="number"
                min="1"
                max="8"
                value={formCredits}
                onChange={(e) => setFormCredits(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono tabular-nums"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Semester
              </label>
              <input
                type="text"
                value={formSemester}
                onChange={(e) => setFormSemester(e.target.value)}
                placeholder="Contoh: Semester 3"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Jadwal Perkuliahan
              </label>
              <input
                type="text"
                value={formSchedule}
                onChange={(e) => setFormSchedule(e.target.value)}
                placeholder="Senin, 08:00 - 10:30 WIB"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Dosen Pengampu Utama
              </label>
              {lecturerUsers.length > 0 && (
                <select
                  value={formLecturerId}
                  onChange={(e) => {
                    const uid = e.target.value;
                    setFormLecturerId(uid);
                    const found = lecturerUsers.find((u) => u.id === uid);
                    if (found) {
                      setFormLecturerName(found.name);
                      setFormEnrolledUserIds((prev) =>
                        prev.includes(found.id) ? prev : [...prev, found.id]
                      );
                    }
                  }}
                  className="w-full px-3 py-2 mb-1.5 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- Pilih atau Ketik Manual --</option>
                  {lecturerUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.role === 'admin' ? 'Admin' : 'Dosen'})
                    </option>
                  ))}
                </select>
              )}
              <input
                type="text"
                value={formLecturerName}
                onChange={(e) => setFormLecturerName(e.target.value)}
                placeholder="Nama lengkap dosen pengampu"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Deskripsi Mata Kuliah
              </label>
              <textarea
                rows={3}
                placeholder="Silabus singkat atau capaian pembelajaran mata kuliah..."
                value={formDesc}
                onChange={(e) => setFormDesc(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Section 2: Class Rombel Allocation */}
          {classes.length > 0 && (
            <div className="space-y-1.5 pt-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="font-semibold text-slate-700 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-slate-500" />
                  <span>Alokasi Kelas / Rombel (Opsional)</span>
                </label>
                {formAssignedClassIds.length > 0 && (
                  <button
                    type="button"
                    onClick={handleIncludeClassMembers}
                    className="text-[11px] font-semibold text-blue-700 hover:underline"
                  >
                    + Centang Semua Anggota Kelas Terpilih ke Daftar Pengguna
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {classes.map((cls) => {
                  const active = formAssignedClassIds.includes(cls.id);
                  return (
                    <button
                      key={cls.id}
                      type="button"
                      onClick={() => handleToggleClass(cls.id)}
                      className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                        active
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      {cls.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Section 3: Add Any User to Course */}
          <CourseUserPicker
            selectedUserIds={formEnrolledUserIds}
            onChange={setFormEnrolledUserIds}
            assignedClassIds={formAssignedClassIds}
            primaryLecturerId={formLecturerId}
            compactHeightClass="max-h-60"
          />

          {/* Footer Buttons */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 font-semibold"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold inline-flex items-center gap-1.5 disabled:opacity-50"
            >
              {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>
                {isSubmitting
                  ? 'Menyimpan ke Firebase...'
                  : courseToEdit
                  ? 'Simpan Perubahan'
                  : 'Simpan Mata Kuliah Baru'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
