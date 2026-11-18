import React, { useState } from 'react';
import { useExam } from '../../context/ExamContext';
import { User, Role } from '../../types';
import {
  X,
  Users,
  UserPlus,
  Edit,
  Trash2,
  Search,
  GraduationCap,
  BookOpen,
  Check,
  AlertCircle,
  Layers,
  ShieldCheck,
} from 'lucide-react';
import { ClassManagementModal } from './ClassManagementModal';

interface UserManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenClassModal?: () => void;
}

export const UserManagementModal: React.FC<UserManagementModalProps> = ({
  isOpen,
  onClose,
  onOpenClassModal,
}) => {
  const {
    users,
    currentUser,
    addUser,
    updateUser,
    deleteUser,
    classes,
    courses,
    syncUserCourseEnrollments,
  } = useExam();

  const [roleFilter, setRoleFilter] = useState<'all' | 'mahasiswa' | 'dosen' | 'admin'>('all');
  const [classFilter, setClassFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isClassModalOpen, setIsClassModalOpen] = useState(false);

  // Form state for Add / Edit
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [isDeletingUser, setIsDeletingUser] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: 'mahasiswa' as Role,
    nimOrNip: '',
    department: '',
    classId: '',
  });
  const [selectedCourseIds, setSelectedCourseIds] = useState<string[]>([]);

  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  // Filtered users
  const filteredUsers = users.filter((u) => {
    if (roleFilter !== 'all' && u.role !== roleFilter) return false;
    if (classFilter !== 'all' && u.role === 'mahasiswa' && u.classId !== classFilter) return false;
    const term = searchTerm.toLowerCase();
    return (
      u.name.toLowerCase().includes(term) ||
      u.email.toLowerCase().includes(term) ||
      u.nimOrNip.toLowerCase().includes(term) ||
      u.department.toLowerCase().includes(term) ||
      (u.className && u.className.toLowerCase().includes(term))
    );
  });

  const studentCount = users.filter((u) => u.role === 'mahasiswa').length;
  const lecturerCount = users.filter((u) => u.role === 'dosen').length;

  const handleOpenAdd = () => {
    setEditingUser(null);
    setFormData({
      name: '',
      email: '',
      role: 'mahasiswa',
      nimOrNip: '',
      department: 'Teknik Informatika',
      classId: classes[0]?.id || '',
    });
    setSelectedCourseIds([]);
    setFormError(null);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (user: User) => {
    setEditingUser(user);
    setFormData({
      name: user.name,
      email: user.email,
      role: user.role,
      nimOrNip: user.nimOrNip,
      department: user.department,
      classId: user.classId || '',
    });
    const enrolledCourses = courses
      .filter((c) => (c.enrolledUserIds || []).includes(user.id))
      .map((c) => c.id);
    setSelectedCourseIds(enrolledCourses);
    setFormError(null);
    setIsFormOpen(true);
  };

  const handleToggleCourse = (courseId: string) => {
    setSelectedCourseIds((prev) =>
      prev.includes(courseId) ? prev.filter((id) => id !== courseId) : [...prev, courseId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.email.trim() || !formData.nimOrNip.trim()) {
      setFormError('Nama, Email, dan NIM/NIP wajib diisi.');
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    const selectedClass = classes.find((c) => c.id === formData.classId);
    const assignedClassName = formData.role === 'mahasiswa' && selectedClass ? selectedClass.name : undefined;
    const assignedClassId = formData.role === 'mahasiswa' && selectedClass ? selectedClass.id : undefined;

    try {
      let savedUserId: string;
      if (editingUser) {
        await updateUser({
          ...editingUser,
          name: formData.name.trim(),
          email: formData.email.trim(),
          role: formData.role,
          nimOrNip: formData.nimOrNip.trim(),
          department: formData.department.trim(),
          classId: assignedClassId,
          className: assignedClassName,
        });
        savedUserId = editingUser.id;
        setStatusMessage(`Pengguna "${formData.name}" berhasil diperbarui.`);
      } else {
        const created = await addUser({
          name: formData.name.trim(),
          email: formData.email.trim(),
          role: formData.role,
          nimOrNip: formData.nimOrNip.trim(),
          department: formData.department.trim(),
          classId: assignedClassId,
          className: assignedClassName,
          avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(
            formData.name.trim()
          )}`,
        });
        savedUserId = created.id;
        setStatusMessage(`Pengguna baru "${formData.name}" berhasil ditambahkan.`);
      }

      if (courses.length > 0) {
        await syncUserCourseEnrollments(savedUserId, selectedCourseIds);
      }

      setIsFormOpen(false);
      setTimeout(() => setStatusMessage(null), 3500);
    } catch (err: any) {
      setFormError(err.message || 'Gagal menyimpan data pengguna ke Firebase.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmDeleteUser = async () => {
    if (!userToDelete) return;
    if (userToDelete.id === currentUser?.id) {
      setErrorMessage('Anda tidak dapat menghapus akun yang sedang aktif digunakan.');
      setUserToDelete(null);
      return;
    }
    setIsDeletingUser(true);
    setErrorMessage(null);
    try {
      await deleteUser(userToDelete.id);
      setStatusMessage(`Pengguna "${userToDelete.name}" telah dihapus.`);
      setTimeout(() => setStatusMessage(null), 3000);
      setUserToDelete(null);
    } catch (err: any) {
      setErrorMessage('Gagal menghapus pengguna: ' + (err?.message || 'Error'));
    } finally {
      setIsDeletingUser(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Manajemen Data Mahasiswa &amp; Dosen
              </h2>
              <p className="text-xs text-slate-500">
                Tambah, ubah, dan hapus data civitas akademika yang terhubung langsung ke Firebase
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

        {/* Status Toast */}
        {statusMessage && (
          <div className="px-6 py-2 bg-emerald-50 border-b border-emerald-200 text-xs font-semibold text-emerald-800 flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-600" />
            <span>{statusMessage}</span>
          </div>
        )}
        {errorMessage && (
          <div className="px-6 py-2 bg-rose-50 border-b border-rose-200 text-xs font-semibold text-rose-800 flex items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600" />
              <span>{errorMessage}</span>
            </span>
            <button type="button" onClick={() => setErrorMessage(null)} className="text-rose-600">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Toolbar: Search, Filters, and Add Button */}
        <div className="px-6 py-3.5 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="relative w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Cari nama, NIM/NIP, email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* Role Filter Pills */}
            <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-100">
              <button
                type="button"
                onClick={() => setRoleFilter('all')}
                className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${
                  roleFilter === 'all'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                Semua ({users.length})
              </button>
              <button
                type="button"
                onClick={() => setRoleFilter('mahasiswa')}
                className={`px-3 py-1 rounded-md text-xs font-semibold flex items-center gap-1 transition-colors ${
                  roleFilter === 'mahasiswa'
                    ? 'bg-white text-blue-700 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <GraduationCap className="w-3.5 h-3.5" />
                Mahasiswa ({studentCount})
              </button>
              <button
                type="button"
                onClick={() => setRoleFilter('dosen')}
                className={`px-3 py-1 rounded-md text-xs font-semibold flex items-center gap-1 transition-colors ${
                  roleFilter === 'dosen'
                    ? 'bg-white text-purple-700 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                Dosen ({lecturerCount})
              </button>
            </div>

            {/* Class filter dropdown */}
            {classes.length > 0 && (
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-slate-400 font-medium">Filter Kelas:</span>
                <select
                  value={classFilter}
                  onChange={(e) => setClassFilter(e.target.value)}
                  className="px-2.5 py-1 text-xs rounded-lg border border-slate-300 bg-slate-50 focus:bg-white text-slate-700"
                >
                  <option value="all">Semua Kelas</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              id="btn-open-class-modal"
              onClick={() => (onOpenClassModal ? onOpenClassModal() : setIsClassModalOpen(true))}
              className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold rounded-xl text-xs flex items-center gap-1.5 border border-indigo-200 transition-colors"
            >
              <Layers className="w-4 h-4 text-indigo-600" />
              Kelola Rombel / Kelas
            </button>

            <button
              type="button"
              id="btn-add-new-user"
              onClick={handleOpenAdd}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-xs flex items-center gap-1.5 shadow-xs transition-colors"
            >
              <UserPlus className="w-4 h-4" />
              Tambah Pengguna Baru
            </button>
          </div>
        </div>

        {/* Users Table */}
        <div className="flex-1 p-6 overflow-y-auto">
          {filteredUsers.length === 0 ? (
            <div className="text-center py-16 text-slate-400 text-xs">
              Tidak ada data pengguna yang sesuai dengan filter pencarian.
            </div>
          ) : (
            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 font-bold text-slate-700">
                  <tr>
                    <th className="px-4 py-3">Pengguna</th>
                    <th className="px-4 py-3">Peran</th>
                    <th className="px-4 py-3">NIM / NIP</th>
                    <th className="px-4 py-3">Kelas / Rombel</th>
                    <th className="px-4 py-3">Mata Kuliah</th>
                    <th className="px-4 py-3">Program Studi</th>
                    <th className="px-4 py-3 text-right">Tindakan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredUsers.map((user) => {
                    const isSelf = user.id === currentUser?.id;
                    const isDosen = user.role === 'dosen';
                    const isAdminRole = user.role === 'admin';
                    const userCourseCount = courses.filter(
                      (c) =>
                        c.lecturerId === user.id ||
                        (c.enrolledUserIds || []).includes(user.id)
                    ).length;

                    return (
                      <tr key={user.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full overflow-hidden bg-slate-200 border border-slate-300 shrink-0">
                              {user.avatar ? (
                                <img
                                  src={user.avatar}
                                  alt={user.name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center font-bold text-slate-600 text-xs">
                                  {user.name.charAt(0)}
                                </div>
                              )}
                            </div>
                            <div>
                              <div className="font-bold text-slate-900 flex items-center gap-2">
                                <span>{user.name}</span>
                                {isSelf && (
                                  <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.2 rounded">
                                    Anda
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-slate-500">{user.email}</div>
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${
                              isAdminRole
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : isDosen
                                ? 'bg-purple-50 text-purple-700 border-purple-200'
                                : 'bg-blue-50 text-blue-700 border-blue-200'
                            }`}
                          >
                            {isAdminRole ? 'Admin' : isDosen ? 'Dosen' : 'Mahasiswa'}
                          </span>
                        </td>

                        <td className="px-4 py-3 font-mono font-medium text-slate-800">
                          {user.nimOrNip}
                        </td>

                        <td className="px-4 py-3">
                          {user.role === 'mahasiswa' ? (
                            user.className ? (
                              <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                {user.className}
                              </span>
                            ) : (
                              <span className="text-slate-400 italic text-[11px]">
                                Belum ada kelas
                              </span>
                            )
                          ) : (
                            <span className="text-slate-400 text-[11px]">-</span>
                          )}
                        </td>

                        <td className="px-4 py-3 font-mono tabular-nums text-[11px] text-slate-600">
                          {userCourseCount > 0 ? `${userCourseCount} MK` : '-'}
                        </td>

                        <td className="px-4 py-3 text-slate-600">
                          {user.department}
                        </td>

                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(user)}
                              className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                              title="Edit Pengguna"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              disabled={isSelf}
                              onClick={() => setUserToDelete(user)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-400 rounded-lg transition-colors"
                              title={isSelf ? 'Tidak dapat menghapus akun Anda sendiri' : 'Hapus Pengguna'}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
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
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
          <span>
            Total terdaftar: <strong>{users.length}</strong> pengguna (
            {lecturerCount} Dosen, {studentCount} Mahasiswa). Tersimpan di Firestore.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors"
          >
            Tutup
          </button>
        </div>
      </div>

      {/* Add / Edit User Submodal */}
      {isFormOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden">
            <div className="px-6 py-4 flex items-center justify-between border-b border-slate-100 bg-slate-50">
              <h3 className="font-bold text-slate-900 text-base">
                {editingUser ? 'Edit Data Pengguna' : 'Tambah Pengguna Baru'}
              </h3>
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-3.5 text-xs">
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Role Radio */}
              <div>
                <label className="font-bold text-slate-700 block mb-1.5">
                  Peran Pengguna
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, role: 'mahasiswa' })}
                    className={`p-2 rounded-xl border text-center font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                      formData.role === 'mahasiswa'
                        ? 'border-blue-600 bg-blue-50 text-blue-700'
                        : 'border-slate-200 bg-slate-50 text-slate-600'
                    }`}
                  >
                    <GraduationCap className="w-4 h-4" />
                    Mahasiswa
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, role: 'dosen' })}
                    className={`p-2 rounded-xl border text-center font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                      formData.role === 'dosen'
                        ? 'border-purple-600 bg-purple-50 text-purple-700'
                        : 'border-slate-200 bg-slate-50 text-slate-600'
                    }`}
                  >
                    <BookOpen className="w-4 h-4" />
                    Dosen
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, role: 'admin' })}
                    className={`p-2 rounded-xl border text-center font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                      formData.role === 'admin'
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-700'
                        : 'border-slate-200 bg-slate-50 text-slate-600'
                    }`}
                  >
                    <ShieldCheck className="w-4 h-4" />
                    Admin
                  </button>
                </div>
              </div>

              {/* Full Name */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Nama Lengkap *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Dr. Hendra Wijaya, M.Kom"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 focus:bg-white"
                />
              </div>

              {/* Email */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Alamat Email (Firebase Login) *
                </label>
                <input
                  type="email"
                  required
                  placeholder="e.g. hendra@kampus.ac.id"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 focus:bg-white"
                />
              </div>

              {/* NIM / NIP */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    {formData.role === 'mahasiswa' ? 'NIM *' : 'NIP / ID *'}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={formData.role === 'mahasiswa' ? '21010045' : '19800512200501'}
                    value={formData.nimOrNip}
                    onChange={(e) => setFormData({ ...formData, nimOrNip: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 focus:bg-white font-mono"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Program Studi / Jurusan *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Teknik Informatika"
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 focus:bg-white"
                  />
                </div>
              </div>

              {/* Class Group Assignment for Students */}
              {formData.role === 'mahasiswa' && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-bold text-slate-700 block">
                      Pengelompokan Kelas (Rombel)
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsClassModalOpen(true)}
                      className="text-[11px] text-indigo-600 hover:text-indigo-800 font-semibold underline"
                    >
                      + Buat Kelas Baru
                    </button>
                  </div>
                  <select
                    value={formData.classId}
                    onChange={(e) => setFormData({ ...formData, classId: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50 focus:bg-white text-slate-800"
                  >
                    <option value="">-- Belum Dialokasikan (Tanpa Kelas) --</option>
                    {classes.map((cls) => (
                      <option key={cls.id} value={cls.id}>
                        {cls.name} ({cls.code}) {cls.academicYear ? `- ${cls.academicYear}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Direct Course Enrollment for ANY User */}
              {courses.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-slate-700 block">
                      Daftarkan ke Mata Kuliah ({selectedCourseIds.length} dipilih)
                    </label>
                    <div className="flex items-center gap-2 text-[11px]">
                      <button
                        type="button"
                        onClick={() => setSelectedCourseIds(courses.map((c) => c.id))}
                        className="text-blue-600 hover:underline font-semibold"
                      >
                        Pilih Semua
                      </button>
                      {selectedCourseIds.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setSelectedCourseIds([])}
                          className="text-slate-500 hover:underline"
                        >
                          Kosongkan
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="border border-slate-200 rounded-xl max-h-36 overflow-y-auto divide-y divide-slate-100 bg-slate-50/60">
                    {courses.map((crs) => {
                      const checked = selectedCourseIds.includes(crs.id);
                      return (
                        <label
                          key={crs.id}
                          className={`px-3 py-2 flex items-center justify-between gap-2 cursor-pointer ${
                            checked ? 'bg-blue-50/70' : 'hover:bg-white'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => handleToggleCourse(crs.id)}
                              className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="font-mono font-bold text-blue-700 text-[11px] shrink-0">
                              {crs.code}
                            </span>
                            <span className="truncate font-medium text-slate-800">
                              {crs.name}
                            </span>
                          </div>
                          {checked && (
                            <span className="text-[10px] font-bold text-blue-700 shrink-0">
                              Terdaftar
                            </span>
                          )}
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-slate-100 rounded-lg"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm disabled:opacity-50"
                >
                  {isSubmitting ? 'Menyimpan ke Firebase...' : editingUser ? 'Simpan Perubahan' : 'Tambah Pengguna'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete User Confirmation Modal (no window.confirm) */}
      {userToDelete && (
        <div className="fixed inset-0 z-70 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-900">Hapus Pengguna?</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Apakah Anda yakin ingin menghapus pengguna{' '}
              <strong>
                {userToDelete.name} ({userToDelete.role.toUpperCase()})
              </strong>{' '}
              dari Firebase?
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={isDeletingUser}
                onClick={() => setUserToDelete(null)}
                className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isDeletingUser}
                onClick={handleConfirmDeleteUser}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold disabled:opacity-50"
              >
                {isDeletingUser ? 'Menghapus...' : 'Ya, Hapus Pengguna'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Class Management Modal */}
      <ClassManagementModal
        isOpen={isClassModalOpen}
        onClose={() => setIsClassModalOpen(false)}
      />
    </div>
  );
};
