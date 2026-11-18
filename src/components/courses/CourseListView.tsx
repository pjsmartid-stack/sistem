import React, { useState } from 'react';
import { useExam } from '../../context/ExamContext';
import { ClassFile, Course } from '../../types';
import { downloadFileResource } from '../../lib/fileStorage';
import { doesExamMatchCourse, isUserEnrolledInCourse } from '../../utils/gradebook';
import {
  BookOpen,
  Plus,
  Search,
  Calendar,
  Clock,
  FileText,
  ClipboardList,
  Film,
  User,
  Users,
  GraduationCap,
  ArrowRight,
  Trash2,
  Edit,
  Layers,
  Download,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { CourseDetailView } from './CourseDetailView';
import { CourseFormModal } from './CourseFormModal';
import { CourseUsersModal } from './CourseUsersModal';

export const CourseListView: React.FC = () => {
  const {
    courses,
    currentUser,
    exams,
    classes,
    users,
    deleteCourse,
    getExamTimeStatus,
  } = useExam();

  const isAdmin = currentUser?.role === 'admin';
  const isStaff = currentUser?.role === 'admin' || currentUser?.role === 'dosen';
  const isStudent = currentUser?.role === 'mahasiswa';

  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [downloadingFileId, setDownloadingFileId] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  // Modal state for Add / Edit Course & Manage Enrolled Users
  const [isCourseModalOpen, setIsCourseModalOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [courseToDelete, setCourseToDelete] = useState<Course | null>(null);
  const [courseForUsers, setCourseForUsers] = useState<Course | null>(null);

  const studentClass = isStudent && currentUser?.classId
    ? classes.find((c) => c.id === currentUser.classId)
    : undefined;

  const classesWithFiles = isStudent
    ? studentClass && (studentClass.files?.length || 0) > 0
      ? [studentClass]
      : []
    : classes.filter((c) => (c.files?.length || 0) > 0);

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

  // Filter courses using class & per-user enrollment resolver
  const visibleCourses = courses.filter((c) => {
    if (!currentUser) return false;
    return isUserEnrolledInCourse(currentUser, c, users);
  });

  const filteredCourses = visibleCourses.filter((c) => {
    const q = searchTerm.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      c.code.toLowerCase().includes(q) ||
      c.lecturerName.toLowerCase().includes(q) ||
      (c.semester ? c.semester.toLowerCase().includes(q) : false)
    );
  });

  const handleOpenAddModal = () => {
    setEditingCourse(null);
    setIsCourseModalOpen(true);
  };

  const handleOpenEditModal = (course: Course) => {
    setEditingCourse(course);
    setIsCourseModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!courseToDelete) return;
    if (!isAdmin && courseToDelete.lecturerId !== currentUser?.id) return;
    await deleteCourse(courseToDelete.id);
    setCourseToDelete(null);
  };

  // If a specific course is selected, show detail classroom view
  if (selectedCourse) {
    const currentCourse = courses.find((c) => c.id === selectedCourse.id) || selectedCourse;
    return (
      <CourseDetailView
        course={currentCourse}
        onBack={() => setSelectedCourse(null)}
      />
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="text-xs text-slate-500">
            Portal Akademik · E-Learning &amp; Silabus Perkuliahan
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Daftar Mata Kuliah &amp; Kelas Daring
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 max-w-2xl leading-relaxed">
            Akses materi perkuliahan, pengumpulan tugas mahasiswa, video pembelajaran, serta jadwal ujian yang terintegrasi.{' '}
            {isStaff && 'Tambahkan mata kuliah baru dan kelola pengguna (mahasiswa maupun dosen) yang terdaftar di setiap mata kuliah.'}
          </p>
        </div>

        {isStaff && (
          <button
            id="btn-admin-add-course"
            type="button"
            onClick={handleOpenAddModal}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors shrink-0 self-start md:self-center whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Mata Kuliah Baru</span>
          </button>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200">
        <div className="relative w-full sm:w-96">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari kode, nama mata kuliah, dosen, semester..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="text-xs text-slate-500 font-medium self-end sm:self-center">
          Menampilkan <span className="text-slate-900 font-bold font-mono tabular-nums">{filteredCourses.length}</span> Mata Kuliah
        </div>
      </div>

      {/* Berkas & Dokumen Kelas (Rombel) yang dapat diunduh mahasiswa */}
      {classesWithFiles.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Layers className="w-4 h-4 text-indigo-600" />
                <span>
                  {isStudent && studentClass
                    ? `Berkas & Dokumen Kelas (${studentClass.name})`
                    : 'Berkas & Dokumen per Kelas (Rombel)'}
                </span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Dokumen dan materi pengantar khusus kelas yang dapat langsung diunduh mahasiswa.
              </p>
            </div>
          </div>

          {downloadError && (
            <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{downloadError}</span>
            </div>
          )}

          <div className="space-y-3">
            {classesWithFiles.map((cls) => (
              <div key={cls.id} className="space-y-2">
                {!isStudent && (
                  <div className="text-xs font-bold text-indigo-800 bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-100 inline-flex items-center gap-2">
                    <span>Kelas {cls.name}</span>
                    <span className="font-mono text-[10px] text-indigo-600">({cls.code})</span>
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {(cls.files || []).map((fileItem) => (
                    <div
                      key={fileItem.id}
                      className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 flex flex-col justify-between gap-3 text-xs"
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
            ))}
          </div>
        </div>
      )}

      {/* Courses Cards Grid */}
      {filteredCourses.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-slate-300 p-12 text-center space-y-3">
          <BookOpen className="w-10 h-10 text-slate-300 mx-auto" />
          <div className="font-bold text-slate-700 text-sm">Belum Ada Mata Kuliah</div>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            {searchTerm
              ? `Tidak ada mata kuliah yang cocok dengan pencarian "${searchTerm}".`
              : isStaff
              ? 'Belum ada mata kuliah yang terdaftar. Klik tombol "Tambah Mata Kuliah Baru" untuk membuat mata kuliah dan menambahkan penggunanya.'
              : 'Anda belum didaftarkan ke mata kuliah pada periode akademik ini.'}
          </p>
          {isStaff && !searchTerm && (
            <button
              type="button"
              onClick={handleOpenAddModal}
              className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Tambah Mata Kuliah Pertama</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filteredCourses.map((course) => {
            const linkedExams = exams.filter((e) => doesExamMatchCourse(e, course));

            const ongoingExam = linkedExams.find(
              (e) => getExamTimeStatus(e).status === 'ongoing'
            );

            const assignedClassNames = (course.assignedClassIds || [])
              .map((cid) => classes.find((c) => c.id === cid)?.name)
              .filter(Boolean);

            const canManageThisCourse = isAdmin || course.lecturerId === currentUser?.id;
            const enrolledCount = (course.enrolledUserIds || []).length;

            return (
              <div
                key={course.id}
                className="bg-white rounded-xl border border-slate-200 overflow-hidden hover:border-blue-400 transition-colors flex flex-col justify-between group"
              >
                <div className="p-5 space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-1.5 text-xs text-slate-500">
                        <span className="font-mono font-bold text-blue-700">{course.code}</span>
                        <span>·</span>
                        <span>{course.credits} SKS</span>
                        {course.semester && (
                          <>
                            <span>·</span>
                            <span>{course.semester}</span>
                          </>
                        )}
                      </div>
                      <h3
                        onClick={() => setSelectedCourse(course)}
                        className="font-bold text-slate-900 text-base group-hover:text-blue-600 transition-colors cursor-pointer line-clamp-1"
                      >
                        {course.name}
                      </h3>
                    </div>

                    {/* Staff Manage Users, Edit & Delete Controls */}
                    {isStaff && (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setCourseForUsers(course);
                          }}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                          title="Tambah / Kelola Pengguna Mata Kuliah"
                        >
                          <Users className="w-4 h-4" />
                        </button>
                        {canManageThisCourse && (
                          <>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenEditModal(course);
                              }}
                              className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Edit Mata Kuliah"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setCourseToDelete(course);
                              }}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                              title="Hapus Mata Kuliah"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  {course.description && (
                    <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                      {course.description}
                    </p>
                  )}

                  <div className="text-xs text-slate-600 space-y-1.5 pt-1 border-t border-slate-100">
                    <div className="flex items-center gap-2 text-slate-700">
                      <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="font-medium truncate">{course.lecturerName}</span>
                    </div>
                    {course.schedule && (
                      <div className="flex items-center gap-2 text-slate-500">
                        <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">{course.schedule}</span>
                      </div>
                    )}
                    {assignedClassNames.length > 0 && (
                      <div className="flex items-center gap-2 text-slate-500">
                        <GraduationCap className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">Kelas: {assignedClassNames.join(', ')}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between gap-2 text-slate-500">
                      <span className="flex items-center gap-2 truncate">
                        <Users className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="font-mono tabular-nums">
                          {enrolledCount > 0
                            ? `${enrolledCount} Pengguna Terdaftar`
                            : assignedClassNames.length > 0
                            ? 'Peserta via Rombel Kelas'
                            : 'Terbuka untuk Semua Pengguna'}
                        </span>
                      </span>
                      {isStaff && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setCourseForUsers(course);
                          }}
                          className="text-[11px] font-semibold text-blue-600 hover:underline shrink-0"
                        >
                          + Pengguna
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Clean E-Learning Resource Counters */}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-mono tabular-nums">
                    <span className="flex items-center gap-1">
                      <FileText className="w-3.5 h-3.5 text-slate-400" />
                      {course.materials.length} Materi
                    </span>
                    <span>·</span>
                    <span className="flex items-center gap-1">
                      <ClipboardList className="w-3.5 h-3.5 text-slate-400" />
                      {course.assignments.length} Tugas
                    </span>
                    <span>·</span>
                    <span className="flex items-center gap-1">
                      <Film className="w-3.5 h-3.5 text-slate-400" />
                      {course.videos.length} Video
                    </span>
                  </div>

                  {/* Linked Exam Status (Informational Only) */}
                  <div className="pt-1">
                    {ongoingExam ? (
                      <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 font-semibold flex items-center justify-between">
                        <span className="truncate">Jadwal Ujian Aktif: {ongoingExam.title}</span>
                      </div>
                    ) : linkedExams.length > 0 ? (
                      <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                        <span>{linkedExams.length} Jadwal Ujian Terhubung</span>
                      </div>
                    ) : (
                      <div className="text-[11px] text-slate-400">
                        Belum ada jadwal ujian terkait
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Action Footer: Always enter course room directly */}
                <div className="p-4 bg-slate-50 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setSelectedCourse(course)}
                    className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <span>Buka Ruang Kelas</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL: Tambah / Edit Mata Kuliah & Penambahan Semua Pengguna */}
      {isStaff && (
        <CourseFormModal
          isOpen={isCourseModalOpen}
          onClose={() => {
            setIsCourseModalOpen(false);
            setEditingCourse(null);
          }}
          courseToEdit={editingCourse}
        />
      )}

      {/* MODAL: Kelola Pengguna Mata Kuliah */}
      {isStaff && (
        <CourseUsersModal
          isOpen={Boolean(courseForUsers)}
          course={
            courseForUsers
              ? courses.find((c) => c.id === courseForUsers.id) || courseForUsers
              : null
          }
          onClose={() => setCourseForUsers(null)}
        />
      )}

      {/* MODAL: Konfirmasi Hapus Mata Kuliah (Tanpa window.confirm) */}
      {isStaff && courseToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-md p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-900">
              Hapus Mata Kuliah?
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Apakah Anda yakin ingin menghapus mata kuliah{' '}
              <strong>
                {courseToDelete.name} ({courseToDelete.code})
              </strong>
              ? Seluruh materi, tugas, dan tautan video di dalam kelas ini juga akan dihapus.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCourseToDelete(null)}
                className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold"
              >
                Ya, Hapus Mata Kuliah
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
