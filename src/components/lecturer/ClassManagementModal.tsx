import React, { useState, useRef } from 'react';
import { useExam } from '../../context/ExamContext';
import { ClassFile, ClassGroup } from '../../types';
import {
  uploadFileToFirestore,
  downloadFileResource,
  formatFileSize,
  MAX_UPLOAD_FILE_BYTES,
} from '../../lib/fileStorage';
import {
  X,
  Layers,
  Plus,
  Edit2,
  Trash2,
  Users,
  Search,
  Check,
  AlertCircle,
  GraduationCap,
  FileText,
  Upload,
  Download,
  Paperclip,
  Loader2,
} from 'lucide-react';

interface ClassManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ClassManagementModal: React.FC<ClassManagementModalProps> = ({
  isOpen,
  onClose,
}) => {
  const {
    classes,
    addClass,
    updateClass,
    deleteClass,
    addClassFile,
    deleteClassFile,
    users,
    currentUser,
  } = useExam();

  const [searchTerm, setSearchTerm] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<ClassGroup | null>(null);

  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [academicYear, setAcademicYear] = useState('2024/2025 Genap');
  const [description, setDescription] = useState('');

  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  // Selected class & right-panel subtab
  const [selectedClassForView, setSelectedClassForView] = useState<ClassGroup | null>(null);
  const [detailTab, setDetailTab] = useState<'students' | 'files'>('students');
  const [classToDelete, setClassToDelete] = useState<ClassGroup | null>(null);
  const [fileToDelete, setFileToDelete] = useState<ClassFile | null>(null);

  // Class file upload states
  const [fileTitle, setFileTitle] = useState('');
  const [fileDesc, setFileDesc] = useState('');
  const [selectedFileObj, setSelectedFileObj] = useState<File | null>(null);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [downloadingFileId, setDownloadingFileId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const liveSelectedClass = selectedClassForView
    ? classes.find((c) => c.id === selectedClassForView.id) || null
    : null;

  const showToast = (msg: string) => {
    setErrorBanner(null);
    setStatusMessage(msg);
    setTimeout(() => setStatusMessage(null), 3500);
  };

  const showError = (msg: string) => {
    setErrorBanner(msg);
    setTimeout(() => setErrorBanner(null), 5000);
  };

  const filteredClasses = classes.filter((c) => {
    const term = searchTerm.toLowerCase();
    return (
      c.name.toLowerCase().includes(term) ||
      c.code.toLowerCase().includes(term) ||
      (c.academicYear && c.academicYear.toLowerCase().includes(term))
    );
  });

  const getStudentsInClass = (classId: string) => {
    return users.filter((u) => u.role === 'mahasiswa' && u.classId === classId);
  };

  const handleOpenAdd = () => {
    setEditingClass(null);
    setName('');
    setCode('');
    setAcademicYear('2024/2025 Genap');
    setDescription('');
    setFormError(null);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (cls: ClassGroup) => {
    setEditingClass(cls);
    setName(cls.name);
    setCode(cls.code);
    setAcademicYear(cls.academicYear || '2024/2025 Genap');
    setDescription(cls.description || '');
    setFormError(null);
    setIsFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !code.trim()) {
      setFormError('Nama Kelas dan Kode Kelas wajib diisi.');
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    try {
      if (editingClass) {
        await updateClass({
          ...editingClass,
          name: name.trim(),
          code: code.trim().toUpperCase(),
          academicYear: academicYear.trim(),
          description: description.trim(),
        });
        showToast(`Kelas "${name.trim()}" berhasil diperbarui.`);
      } else {
        await addClass({
          name: name.trim(),
          code: code.trim().toUpperCase(),
          academicYear: academicYear.trim(),
          description: description.trim(),
          files: [],
        });
        showToast(`Kelas baru "${name.trim()}" berhasil ditambahkan.`);
      }
      setIsFormOpen(false);
    } catch (err: any) {
      setFormError(err.message || 'Gagal menyimpan kelas ke database.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmDeleteClass = async () => {
    if (!classToDelete) return;
    try {
      await deleteClass(classToDelete.id);
      if (selectedClassForView?.id === classToDelete.id) {
        setSelectedClassForView(null);
      }
      showToast(`Kelas "${classToDelete.name}" berhasil dihapus.`);
      setClassToDelete(null);
    } catch (err: any) {
      showError('Gagal menghapus kelas: ' + (err?.message || 'Terjadi kesalahan'));
      setClassToDelete(null);
    }
  };

  const handleUploadClassFile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!liveSelectedClass) return;
    if (!selectedFileObj) {
      showError('Silakan pilih berkas terlebih dahulu untuk diunggah.');
      return;
    }

    setIsUploadingFile(true);
    setUploadProgress(5);
    setErrorBanner(null);

    try {
      const uploaded = await uploadFileToFirestore(
        selectedFileObj,
        {
          scope: 'class_file',
          scopeId: liveSelectedClass.id,
          uploadedBy: currentUser?.name || 'Administrator',
        },
        (pct) => setUploadProgress(pct)
      );

      await addClassFile(liveSelectedClass.id, {
        title: fileTitle.trim() || uploaded.fileName,
        description: fileDesc.trim() || undefined,
        fileType: uploaded.fileType,
        fileName: uploaded.fileName,
        fileId: uploaded.fileId,
        fileUrl: uploaded.fileUrl,
        mimeType: uploaded.mimeType,
        fileSize: uploaded.fileSizeLabel,
        sizeBytes: uploaded.sizeBytes,
        uploadedBy: currentUser?.name || 'Administrator',
      });

      setFileTitle('');
      setFileDesc('');
      setSelectedFileObj(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      showToast(`File "${uploaded.fileName}" berhasil diunggah ke kelas ${liveSelectedClass.name}.`);
    } catch (err: any) {
      showError(err?.message || 'Gagal mengunggah file kelas ke Firebase.');
    } finally {
      setIsUploadingFile(false);
      setUploadProgress(0);
    }
  };

  const handleDownloadClassFile = async (fileItem: ClassFile) => {
    setDownloadingFileId(fileItem.id);
    try {
      await downloadFileResource({
        fileId: fileItem.fileId,
        fileUrl: fileItem.fileUrl,
        fileName: fileItem.fileName,
        mimeType: fileItem.mimeType,
      });
    } catch (err: any) {
      showError(err?.message || 'Gagal mengunduh berkas kelas.');
    } finally {
      setDownloadingFileId(null);
    }
  };

  const handleConfirmDeleteFile = async () => {
    if (!liveSelectedClass || !fileToDelete) return;
    try {
      await deleteClassFile(liveSelectedClass.id, fileToDelete.id);
      showToast(`Berkas "${fileToDelete.title}" berhasil dihapus.`);
    } catch (err: any) {
      showError(err?.message || 'Gagal menghapus berkas.');
    } finally {
      setFileToDelete(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Pengelompokan Kelas &amp; Berkas Rombel
              </h2>
              <p className="text-xs text-slate-500">
                Kelola rombongan belajar (rombel), anggota mahasiswa, serta unggah berkas/dokumen khusus kelas
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-2 rounded-lg hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status / Error Toast */}
        {statusMessage && (
          <div className="px-6 py-2.5 bg-emerald-50 border-b border-emerald-200 text-xs font-semibold text-emerald-800 flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{statusMessage}</span>
          </div>
        )}
        {errorBanner && (
          <div className="px-6 py-2.5 bg-rose-50 border-b border-rose-200 text-xs font-semibold text-rose-800 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorBanner}</span>
          </div>
        )}

        {/* Toolbar */}
        <div className="px-6 py-3.5 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="relative w-64 sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Cari kelas, kode, atau tahun ajaran..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <button
            type="button"
            id="btn-add-new-class"
            onClick={handleOpenAdd}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl text-xs flex items-center gap-1.5 shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4" />
            Tambah Kelas Baru
          </button>
        </div>

        {/* Body content */}
        <div className="flex-1 p-6 overflow-y-auto grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Class list (Left) */}
          <div className="lg:col-span-7 space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-500 pb-1">
              <span>Daftar Kelas ({filteredClasses.length})</span>
              <span>Klik kartu kelas untuk mengelola anggota &amp; berkas kelas</span>
            </div>

            {filteredClasses.length === 0 ? (
              <div className="text-center py-16 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-slate-400 text-xs">
                Tidak ada kelas yang sesuai. Klik "Tambah Kelas Baru" untuk membuat rombel.
              </div>
            ) : (
              <div className="space-y-3">
                {filteredClasses.map((cls) => {
                  const studentList = getStudentsInClass(cls.id);
                  const fileCount = cls.files?.length || 0;
                  const isSelected = liveSelectedClass?.id === cls.id;

                  return (
                    <div
                      key={cls.id}
                      onClick={() => setSelectedClassForView(cls)}
                      className={`p-4 rounded-xl border transition-all cursor-pointer ${
                        isSelected
                          ? 'border-indigo-500 bg-indigo-50/40 shadow-xs'
                          : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-bold text-slate-900 text-sm">
                              {cls.name}
                            </span>
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-100 text-slate-700 border border-slate-200">
                              {cls.code}
                            </span>
                            {cls.academicYear && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                                {cls.academicYear}
                              </span>
                            )}
                          </div>
                          {cls.description && (
                            <p className="text-xs text-slate-500 line-clamp-1">
                              {cls.description}
                            </p>
                          )}
                          <div className="flex items-center gap-4 pt-1 text-[11px] text-slate-600">
                            <span className="flex items-center gap-1 font-semibold text-indigo-700">
                              <Users className="w-3.5 h-3.5" />
                              {studentList.length} Mahasiswa
                            </span>
                            <span className="flex items-center gap-1 font-semibold text-emerald-700">
                              <FileText className="w-3.5 h-3.5" />
                              {fileCount} Berkas Kelas
                            </span>
                          </div>
                        </div>

                        {/* Actions */}
                        <div
                          className="flex items-center gap-1.5"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedClassForView(cls);
                              setDetailTab('files');
                            }}
                            className="px-2 py-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors flex items-center gap-1"
                            title="Kelola & Upload Berkas Kelas"
                          >
                            <Upload className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Berkas</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(cls)}
                            className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                            title="Edit Kelas"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setClassToDelete(cls)}
                            className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            title="Hapus Kelas"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right sidebar: Class details, students, & class files */}
          <div className="lg:col-span-5 bg-slate-50 rounded-xl border border-slate-200 p-4 flex flex-col min-h-[400px]">
            {liveSelectedClass ? (
              <div className="space-y-4 flex-1 flex flex-col">
                <div className="border-b border-slate-200 pb-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-indigo-900 uppercase tracking-wider">
                      Detail Kelas
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedClassForView(null)}
                      className="text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <h3 className="font-extrabold text-slate-900 text-base mt-1">
                    {liveSelectedClass.name}
                  </h3>
                  <div className="text-xs text-slate-500">
                    Kode: <strong>{liveSelectedClass.code}</strong> •{' '}
                    {liveSelectedClass.academicYear}
                  </div>

                  {/* Sub-tabs: Students vs Class Files */}
                  <div className="flex gap-2 mt-3">
                    <button
                      type="button"
                      onClick={() => setDetailTab('students')}
                      className={`flex-1 py-1.5 px-2.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 border transition-colors ${
                        detailTab === 'students'
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <Users className="w-3.5 h-3.5" />
                      <span>Mahasiswa ({getStudentsInClass(liveSelectedClass.id).length})</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDetailTab('files')}
                      className={`flex-1 py-1.5 px-2.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 border transition-colors ${
                        detailTab === 'files'
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>Berkas Kelas ({liveSelectedClass.files?.length || 0})</span>
                    </button>
                  </div>
                </div>

                {detailTab === 'students' ? (
                  <div className="flex-1 overflow-y-auto space-y-2">
                    {getStudentsInClass(liveSelectedClass.id).length === 0 ? (
                      <div className="text-center py-8 text-xs text-slate-400">
                        Belum ada mahasiswa yang dialokasikan ke kelas ini. Anda dapat mengalokasikan kelas di menu "Data Mahasiswa &amp; Dosen".
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {getStudentsInClass(liveSelectedClass.id).map((student) => (
                          <div
                            key={student.id}
                            className="p-2.5 bg-white rounded-lg border border-slate-200 flex items-center justify-between text-xs"
                          >
                            <div>
                              <div className="font-bold text-slate-900">{student.name}</div>
                              <div className="text-[11px] text-slate-500 font-mono">
                                NIM: {student.nimOrNip}
                              </div>
                            </div>
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              Aktif
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col space-y-3 overflow-y-auto">
                    {/* Upload Form for Class File */}
                    <form
                      onSubmit={handleUploadClassFile}
                      className="bg-white p-3 rounded-xl border border-slate-200 space-y-2.5 text-xs"
                    >
                      <div className="font-bold text-slate-800 flex items-center gap-1.5">
                        <Upload className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Upload Berkas untuk Kelas {liveSelectedClass.name}</span>
                      </div>

                      <input
                        type="text"
                        placeholder="Judul dokumen (opsional, default nama file)"
                        value={fileTitle}
                        onChange={(e) => setFileTitle(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />

                      <input
                        type="text"
                        placeholder="Catatan singkat untuk mahasiswa (opsional)"
                        value={fileDesc}
                        onChange={(e) => setFileDesc(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />

                      <div>
                        <input
                          ref={fileInputRef}
                          type="file"
                          onChange={(e) => {
                            const f = e.target.files?.[0] || null;
                            if (f && f.size > MAX_UPLOAD_FILE_BYTES) {
                              showError(`Ukuran file (${formatFileSize(f.size)}) melebihi batas 10 MB.`);
                              setSelectedFileObj(null);
                              e.target.value = '';
                              return;
                            }
                            setSelectedFileObj(f);
                            if (f && !fileTitle.trim()) {
                              setFileTitle(f.name.replace(/\.[^/.]+$/, ''));
                            }
                          }}
                          className="w-full text-[11px] file:mr-2 file:py-1 file:px-2.5 file:rounded-md file:border-0 file:bg-emerald-50 file:text-emerald-700 file:font-semibold hover:file:bg-emerald-100"
                        />
                        {selectedFileObj && (
                          <div className="mt-1 text-[11px] text-emerald-700 font-medium flex items-center gap-1">
                            <Paperclip className="w-3 h-3" />
                            <span className="truncate">{selectedFileObj.name}</span>
                            <span className="shrink-0 font-mono">({formatFileSize(selectedFileObj.size)})</span>
                          </div>
                        )}
                      </div>

                      {isUploadingFile && (
                        <div className="space-y-1">
                          <div className="flex justify-between text-[11px] text-emerald-700 font-semibold">
                            <span>Mengunggah ke Firebase...</span>
                            <span>{uploadProgress}%</span>
                          </div>
                          <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                            <div
                              className="bg-emerald-600 h-full transition-all"
                              style={{ width: `${uploadProgress}%` }}
                            />
                          </div>
                        </div>
                      )}

                      <button
                        type="submit"
                        disabled={isUploadingFile || !selectedFileObj}
                        className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold flex items-center justify-center gap-1.5 disabled:opacity-50 transition-colors"
                      >
                        {isUploadingFile ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Upload className="w-3.5 h-3.5" />
                        )}
                        <span>{isUploadingFile ? 'Mengunggah...' : 'Upload & Simpan ke Kelas'}</span>
                      </button>
                    </form>

                    {/* Uploaded Class Files List */}
                    <div className="space-y-2 flex-1">
                      <div className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                        Daftar Berkas Kelas ({liveSelectedClass.files?.length || 0})
                      </div>

                      {!liveSelectedClass.files || liveSelectedClass.files.length === 0 ? (
                        <div className="text-center py-6 bg-white rounded-xl border border-dashed border-slate-200 text-xs text-slate-400">
                          Belum ada berkas yang diunggah untuk kelas ini. Mahasiswa di kelas ini akan dapat mengunduh file yang Anda unggah di sini.
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {liveSelectedClass.files.map((fileItem) => (
                            <div
                              key={fileItem.id}
                              className="p-2.5 bg-white rounded-lg border border-slate-200 space-y-1.5 text-xs"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <div className="font-bold text-slate-900 truncate">
                                    {fileItem.title}
                                  </div>
                                  <div className="text-[11px] text-slate-500 truncate">
                                    {fileItem.fileName} {fileItem.fileSize ? `(${fileItem.fileSize})` : ''}
                                  </div>
                                  {fileItem.description && (
                                    <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">
                                      {fileItem.description}
                                    </p>
                                  )}
                                </div>

                                <div className="flex items-center gap-1 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => handleDownloadClassFile(fileItem)}
                                    disabled={downloadingFileId === fileItem.id}
                                    className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-md font-semibold text-[11px] flex items-center gap-1 disabled:opacity-50"
                                    title="Unduh File"
                                  >
                                    {downloadingFileId === fileItem.id ? (
                                      <Loader2 className="w-3 h-3 animate-spin" />
                                    ) : (
                                      <Download className="w-3 h-3" />
                                    )}
                                    <span>Unduh</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setFileToDelete(fileItem)}
                                    className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                                    title="Hapus Berkas"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-slate-400 text-xs space-y-2">
                <GraduationCap className="w-8 h-8 text-slate-300" />
                <p className="font-semibold text-slate-600">Pilih Kelas</p>
                <p className="text-[11px]">
                  Pilih salah satu kelas di sebelah kiri untuk melihat anggota mahasiswa serta mengunggah berkas kelas yang dapat diunduh mahasiswa.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Confirmation Modal: Delete Class */}
      {classToDelete && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-900">Hapus Kelas "{classToDelete.name}"?</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              {getStudentsInClass(classToDelete.id).length > 0
                ? `Terdapat ${getStudentsInClass(classToDelete.id).length} mahasiswa di kelas ini. Menghapus kelas akan mengosongkan status kelas mahasiswa tersebut dan menghapus seluruh berkas kelas.`
                : 'Apakah Anda yakin ingin menghapus kelas ini beserta seluruh berkasnya?'}
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setClassToDelete(null)}
                className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteClass}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold"
              >
                Ya, Hapus Kelas
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal: Delete Class File */}
      {fileToDelete && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-900">Hapus Berkas Kelas?</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Berkas <strong>{fileToDelete.title}</strong> ({fileToDelete.fileName}) akan dihapus dari kelas dan tidak dapat lagi diunduh mahasiswa.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setFileToDelete(null)}
                className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteFile}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold"
              >
                Ya, Hapus Berkas
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Form Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Layers className="w-4 h-4 text-indigo-600" />
                {editingClass ? 'Edit Informasi Kelas' : 'Tambah Kelas Baru'}
              </h3>
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-3.5 text-xs">
              {formError && (
                <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 flex items-center gap-2 font-medium">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Nama Kelas / Rombel *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: TI-3A, TI-3B, SI-2A"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50 focus:bg-white text-slate-900"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Kode Kelas Singkat *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: TI-3A"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50 focus:bg-white uppercase font-mono text-slate-900"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Tahun Ajaran / Semester
                </label>
                <input
                  type="text"
                  placeholder="Contoh: 2024/2025 Genap"
                  value={academicYear}
                  onChange={(e) => setAcademicYear(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50 focus:bg-white text-slate-900"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Keterangan / Deskripsi
                </label>
                <textarea
                  rows={2}
                  placeholder="Contoh: Kelas Reguler Pagi - Jurusan Teknik Informatika"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50 focus:bg-white text-slate-900 resize-none"
                />
              </div>

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
                  className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm disabled:opacity-50"
                >
                  {isSubmitting ? 'Menyimpan...' : editingClass ? 'Simpan Perubahan' : 'Buat Kelas'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
