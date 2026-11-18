import React, { useState, useEffect } from 'react';
import {
  CourseTopic,
  PeerAssessmentScoringType,
  PeerProjectAssignment,
  PeerRubricCriterion,
} from '../../types';
import { useExam } from '../../context/ExamContext';
import {
  getSelectableComponentsForActivity,
  resolveGradeConfig,
} from '../../utils/gradebook';
import {
  computeRubricMaxPoints,
  createDefaultPeerRubricCriteria,
} from '../../utils/peerAssessment';
import {
  formatFileSize,
  MAX_UPLOAD_FILE_BYTES,
  uploadFileToFirestore,
} from '../../lib/fileStorage';
import {
  AlertTriangle,
  Award,
  CheckSquare,
  Plus,
  Trash2,
  Users,
  X,
} from 'lucide-react';

interface PeerProjectModalProps {
  isOpen: boolean;
  courseId: string;
  topics: CourseTopic[];
  defaultTopicId?: string;
  projectToEdit?: PeerProjectAssignment | null;
  onClose: () => void;
  onSaved: (message: string) => void;
}

function toLocalDateTimeInput(dateInput?: string | Date): string {
  const d = dateInput ? new Date(dateInput) : new Date();
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export const PeerProjectModal: React.FC<PeerProjectModalProps> = ({
  isOpen,
  courseId,
  topics,
  defaultTopicId,
  projectToEdit,
  onClose,
  onSaved,
}) => {
  const { currentUser, gradeConfigs, addPeerProject, updatePeerProject } = useExam();

  const [topicId, setTopicId] = useState<string>(defaultTopicId || '');
  const [gradingComponentId, setGradingComponentId] = useState<string>('');
  const [title, setTitle] = useState('');
  const [instructions, setInstructions] = useState('');
  const [openDate, setOpenDate] = useState(() => toLocalDateTimeInput(new Date()));
  const [dueDate, setDueDate] = useState(() =>
    toLocalDateTimeInput(new Date(Date.now() + 7 * 86400000))
  );
  const [lockAfterDeadline, setLockAfterDeadline] = useState(true);
  const [reviewersPerSubmission, setReviewersPerSubmission] = useState<number>(3);
  const [anonymousPeerReview, setAnonymousPeerReview] = useState<boolean>(false);
  const [scoringType, setScoringType] = useState<PeerAssessmentScoringType>('rubric_options');
  const [directMaxPoints, setDirectMaxPoints] = useState<number>(100);
  const [rubricCriteria, setRubricCriteria] = useState<PeerRubricCriterion[]>(
    createDefaultPeerRubricCriteria()
  );
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    if (projectToEdit) {
      setTopicId(projectToEdit.topicId || '');
      setGradingComponentId(projectToEdit.gradingComponentId || '');
      setTitle(projectToEdit.title);
      setInstructions(projectToEdit.instructions);
      setOpenDate(toLocalDateTimeInput(projectToEdit.openDate || projectToEdit.createdAt));
      setDueDate(toLocalDateTimeInput(projectToEdit.dueDate));
      setLockAfterDeadline(projectToEdit.lockAfterDeadline !== false);
      setReviewersPerSubmission(projectToEdit.reviewersPerSubmission || 3);
      setAnonymousPeerReview(Boolean(projectToEdit.anonymousPeerReview));
      setScoringType(projectToEdit.scoringType || 'direct_score');
      setDirectMaxPoints(projectToEdit.maxPoints || 100);
      setRubricCriteria(
        projectToEdit.rubricCriteria && projectToEdit.rubricCriteria.length > 0
          ? projectToEdit.rubricCriteria.map((c) => ({
              ...c,
              options: c.options.map((o) => ({ ...o })),
            }))
          : createDefaultPeerRubricCriteria()
      );
    } else {
      setTopicId(defaultTopicId || '');
      setGradingComponentId('');
      setTitle('');
      setInstructions('');
      setOpenDate(toLocalDateTimeInput(new Date()));
      setDueDate(toLocalDateTimeInput(new Date(Date.now() + 7 * 86400000)));
      setLockAfterDeadline(true);
      setReviewersPerSubmission(3);
      setAnonymousPeerReview(false);
      setScoringType('rubric_options');
      setDirectMaxPoints(100);
      setRubricCriteria(createDefaultPeerRubricCriteria());
    }
    setAttachmentFile(null);
    setUploadProgress(0);
    setFormError('');
  }, [isOpen, projectToEdit, defaultTopicId]);

  if (!isOpen) return null;

  const activeConfig = resolveGradeConfig(gradeConfigs, { courseId });
  const selectableGroups = getSelectableComponentsForActivity(activeConfig, 'assignment');
  const flatComponents = selectableGroups.flatMap((g) => g.components);
  const selectedComp = flatComponents.find((c) => c.id === gradingComponentId);

  const computedRubricMax = computeRubricMaxPoints(rubricCriteria);
  const effectiveMaxPoints =
    scoringType === 'rubric_options' ? computedRubricMax : Number(directMaxPoints) || 100;

  const handleAddCriterion = () => {
    const newId = `crit-${Date.now().toString(36)}`;
    setRubricCriteria((prev) => [
      ...prev,
      {
        id: newId,
        title: `Kriteria ${prev.length + 1}`,
        description: '',
        options: [
          { id: `${newId}-opt1`, label: 'Sangat Baik', points: 25 },
          { id: `${newId}-opt2`, label: 'Baik', points: 18 },
          { id: `${newId}-opt3`, label: 'Cukup', points: 10 },
        ],
      },
    ]);
  };

  const handleAddOption = (critIdx: number) => {
    setRubricCriteria((prev) =>
      prev.map((c, idx) =>
        idx === critIdx
          ? {
              ...c,
              options: [
                ...c.options,
                { id: `opt-${Date.now().toString(36)}`, label: 'Opsi Baru', points: 10 },
              ],
            }
          : c
      )
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!gradingComponentId || !selectedComp) {
      setFormError(
        'Pilih Komponen Penilaian terlebih dahulu agar nilai Tugas Projek Mahasiswa masuk ke Buku Nilai Moodle.'
      );
      return;
    }
    if (!title.trim()) {
      setFormError('Judul Tugas Projek Mahasiswa wajib diisi.');
      return;
    }

    const parsedDue = new Date(dueDate);
    if (Number.isNaN(parsedDue.getTime())) {
      setFormError('Tenggat pengumpulan wajib diisi dengan benar.');
      return;
    }
    const parsedOpen = openDate ? new Date(openDate) : new Date();
    if (!Number.isNaN(parsedOpen.getTime()) && parsedDue.getTime() <= parsedOpen.getTime()) {
      setFormError('Tenggat akhir pengumpulan harus lebih lambat dari jadwal mulai dibuka.');
      return;
    }

    if (reviewersPerSubmission < 1 || reviewersPerSubmission > 20) {
      setFormError('Jumlah penilai mahasiswa per tugas minimal 1 dan maksimal 20 orang.');
      return;
    }

    if (scoringType === 'rubric_options') {
      if (rubricCriteria.length === 0) {
        setFormError('Tambahkan minimal 1 kriteria penilaian untuk mode Opsi Pilihan Poin.');
        return;
      }
      for (const crit of rubricCriteria) {
        if (!crit.title.trim()) {
          setFormError('Nama kriteria rubrik tidak boleh kosong.');
          return;
        }
        if (crit.options.length < 2) {
          setFormError(`Kriteria "${crit.title}" minimal harus memiliki 2 opsi pilihan poin.`);
          return;
        }
      }
      if (computedRubricMax <= 0) {
        setFormError('Total poin maksimal rubrik harus lebih besar dari 0.');
        return;
      }
    }

    if (attachmentFile && attachmentFile.size > MAX_UPLOAD_FILE_BYTES) {
      setFormError('Ukuran file lampiran panduan melebihi batas 10 MB.');
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    try {
      let attachmentFields: Partial<PeerProjectAssignment> = projectToEdit
        ? {
            attachmentFileId: projectToEdit.attachmentFileId,
            attachmentFileName: projectToEdit.attachmentFileName,
            attachmentFileSize: projectToEdit.attachmentFileSize,
            attachmentMimeType: projectToEdit.attachmentMimeType,
            attachmentFileUrl: projectToEdit.attachmentFileUrl,
          }
        : {};

      if (attachmentFile) {
        const uploaded = await uploadFileToFirestore(
          attachmentFile,
          {
            scope: 'assignment_attachment',
            scopeId: courseId,
            uploadedBy: currentUser?.name || 'Dosen Pengampu',
          },
          (pct) => setUploadProgress(pct)
        );
        attachmentFields = {
          attachmentFileId: uploaded.fileId,
          attachmentFileName: uploaded.fileName,
          attachmentFileSize: uploaded.fileSizeLabel,
          attachmentMimeType: uploaded.mimeType,
          attachmentFileUrl: uploaded.fileUrl,
        };
      }

      if (projectToEdit) {
        await updatePeerProject(courseId, {
          ...projectToEdit,
          topicId: topicId || undefined,
          title: title.trim(),
          instructions: instructions.trim(),
          openDate: parsedOpen.toISOString(),
          dueDate: parsedDue.toISOString(),
          lockAfterDeadline,
          maxPoints: effectiveMaxPoints,
          scoringType,
          rubricCriteria: scoringType === 'rubric_options' ? rubricCriteria : undefined,
          reviewersPerSubmission: Number(reviewersPerSubmission),
          anonymousPeerReview,
          gradingGroupId: selectedComp.groupId,
          gradingComponentId: selectedComp.id,
          gradingComponentName: selectedComp.name,
          ...attachmentFields,
        });
        onSaved('Pengaturan Tugas Projek Mahasiswa berhasil diperbarui.');
      } else {
        await addPeerProject(courseId, {
          topicId: topicId || undefined,
          title: title.trim(),
          instructions: instructions.trim(),
          openDate: parsedOpen.toISOString(),
          dueDate: parsedDue.toISOString(),
          lockAfterDeadline,
          maxPoints: effectiveMaxPoints,
          scoringType,
          rubricCriteria: scoringType === 'rubric_options' ? rubricCriteria : undefined,
          reviewersPerSubmission: Number(reviewersPerSubmission),
          anonymousPeerReview,
          gradingGroupId: selectedComp.groupId,
          gradingComponentId: selectedComp.id,
          gradingComponentName: selectedComp.name,
          ...attachmentFields,
        });
        onSaved('Slot Tugas Projek Mahasiswa (Penilaian Sejawat) berhasil diterbitkan.');
      }
      onClose();
    } catch (err: any) {
      setFormError(err?.message || 'Gagal menyimpan Tugas Projek Mahasiswa.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
            <Users className="w-4 h-4 text-teal-700" />
            <span>
              {projectToEdit
                ? 'Edit Tugas Projek Mahasiswa'
                : 'Buat Slot Tugas Projek Mahasiswa (Penilaian Antar Mahasiswa)'}
            </span>
          </h3>
          <button
            type="button"
            disabled={uploading}
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto text-xs">
          {formError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl flex items-center gap-2 font-semibold">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {/* Mandatory Gradebook Component Selection */}
          <div className="p-3.5 rounded-xl border border-teal-200 bg-teal-50/40 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <label className="font-bold text-teal-950 flex items-center gap-1.5">
                <Award className="w-4 h-4 text-teal-700" />
                <span>
                  Langkah Wajib: Masuk ke Komponen Penilaian <span className="text-rose-600">*</span>
                </span>
              </label>
              {selectedComp && (
                <span className="text-[11px] font-mono font-bold text-teal-800">
                  Kontribusi: {selectedComp.effectiveWeight}%
                </span>
              )}
            </div>
            <select
              id="select-peer-project-grading-component"
              required
              disabled={uploading}
              value={gradingComponentId}
              onChange={(e) => setGradingComponentId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-teal-300 bg-white text-slate-900 font-semibold"
            >
              <option value="">-- Pilih Grup &amp; Komponen Penilaian di Buku Nilai --</option>
              {selectableGroups.map((entry) => (
                <optgroup
                  key={entry.group.id}
                  label={`${entry.group.name} (Bobot Grup ${entry.group.weight}%)`}
                >
                  {entry.components.map((comp) => (
                    <option key={comp.id} value={comp.id}>
                      {comp.name} · Kontribusi {comp.effectiveWeight}% ke Nilai Akhir
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Letakkan Pada Pertemuan / Topik
              </label>
              <select
                value={topicId}
                disabled={uploading}
                onChange={(e) => setTopicId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-semibold"
              >
                <option value="">Topik Umum / Pengantar Mata Kuliah</option>
                {topics.map((t) => (
                  <option key={t.id} value={t.id}>
                    Pertemuan {t.meetingNumber} · {t.title}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Judul Tugas Projek Mahasiswa *
              </label>
              <input
                type="text"
                required
                disabled={uploading}
                placeholder="Contoh: Proyek Rancang Bangun Sistem E-Commerce"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">
              Petunjuk Pengerjaan &amp; Panduan Penilaian Sejawat *
            </label>
            <textarea
              rows={3}
              required
              disabled={uploading}
              placeholder="Jelaskan spesifikasi proyek, format file dikumpulkan, dan hal yang wajib diperhatikan oleh mahasiswa penilai..."
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 leading-relaxed"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Jadwal Mulai Dibuka *
              </label>
              <input
                type="datetime-local"
                required
                disabled={uploading}
                value={openDate}
                onChange={(e) => setOpenDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Tenggat Akhir Pengumpulan *
              </label>
              <input
                type="datetime-local"
                required
                disabled={uploading}
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono"
              />
            </div>
          </div>

          {/* Peer Reviewer Configuration */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
            <div className="font-bold text-slate-900">
              Pengaturan Penilai Antar Mahasiswa (Otomatis oleh Sistem)
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Jumlah Penilai Mahasiswa per 1 Tugas *
                </label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  required
                  value={reviewersPerSubmission}
                  onChange={(e) => setReviewersPerSubmission(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-mono font-bold"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Sistem otomatis memilihkan {reviewersPerSubmission} mahasiswa berbeda untuk menilai
                  setiap tugas, lalu skornya dirata-ratakan.
                </p>
              </div>

              <div className="space-y-2">
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={lockAfterDeadline}
                    onChange={(e) => setLockAfterDeadline(e.target.checked)}
                    className="mt-0.5 rounded border-slate-300 text-teal-600"
                  />
                  <span>Kunci pengumpulan otomatis setelah tenggat</span>
                </label>
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={anonymousPeerReview}
                    onChange={(e) => setAnonymousPeerReview(e.target.checked)}
                    className="mt-0.5 rounded border-slate-300 text-teal-600"
                  />
                  <span>Samarkan nama penilai di tampilan mahasiswa penerima nilai</span>
                </label>
              </div>
            </div>
          </div>

          {/* Scoring Mode Selector */}
          <div className="p-4 rounded-xl border border-slate-200 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="font-bold text-slate-900">
                Jenis Penilaian Mahasiswa Sejawat
              </div>
              <div className="text-[11px] font-mono font-bold text-teal-800">
                Skor Maksimal: {effectiveMaxPoints} Poin
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setScoringType('direct_score')}
                className={`p-3 rounded-xl border text-left transition-colors ${
                  scoringType === 'direct_score'
                    ? 'bg-teal-50 border-teal-500 text-teal-950'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <div className="font-bold flex items-center gap-1.5">
                  <span>Skor Langsung (Numerik)</span>
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Penilai memberi skor angka langsung (0 s/d nilai maksimal) beserta komentar.
                </div>
              </button>

              <button
                type="button"
                onClick={() => setScoringType('rubric_options')}
                className={`p-3 rounded-xl border text-left transition-colors ${
                  scoringType === 'rubric_options'
                    ? 'bg-teal-50 border-teal-500 text-teal-950'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <div className="font-bold flex items-center gap-1.5">
                  <CheckSquare className="w-3.5 h-3.5" />
                  <span>Opsi Pilihan Poin (Rubrik Ditotalkan)</span>
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Penilai memilih opsi poin pada tiap kriteria, lalu sistem otomatis menjumlahkannya.
                </div>
              </button>
            </div>

            {scoringType === 'direct_score' ? (
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Nilai Maksimal Skor Langsung
                </label>
                <input
                  type="number"
                  min={10}
                  max={1000}
                  value={directMaxPoints}
                  onChange={(e) => setDirectMaxPoints(Number(e.target.value))}
                  className="w-40 px-3 py-2 rounded-lg border border-slate-300 font-mono font-bold"
                />
              </div>
            ) : (
              <div className="space-y-3 pt-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800">
                    Daftar Kriteria &amp; Opsi Pilihan Poin
                  </span>
                  <button
                    type="button"
                    onClick={handleAddCriterion}
                    className="px-2.5 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-bold flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Tambah Kriteria</span>
                  </button>
                </div>

                <div className="space-y-3 max-h-[280px] overflow-y-auto pr-1">
                  {rubricCriteria.map((crit, cIdx) => (
                    <div
                      key={crit.id}
                      className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5"
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          placeholder="Judul Kriteria (mis. Kualitas UI/UX)"
                          value={crit.title}
                          onChange={(e) =>
                            setRubricCriteria((prev) =>
                              prev.map((c, i) => (i === cIdx ? { ...c, title: e.target.value } : c))
                            )
                          }
                          className="flex-1 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-bold"
                        />
                        <button
                          type="button"
                          onClick={() => handleAddOption(cIdx)}
                          className="px-2 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 font-semibold text-slate-700"
                        >
                          + Opsi
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setRubricCriteria((prev) => prev.filter((_, i) => i !== cIdx))
                          }
                          className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="space-y-1.5 pl-2">
                        {crit.options.map((opt, oIdx) => (
                          <div key={opt.id} className="flex items-center gap-2">
                            <input
                              type="text"
                              placeholder="Label Pilihan"
                              value={opt.label}
                              onChange={(e) =>
                                setRubricCriteria((prev) =>
                                  prev.map((c, i) =>
                                    i === cIdx
                                      ? {
                                          ...c,
                                          options: c.options.map((o, j) =>
                                            j === oIdx ? { ...o, label: e.target.value } : o
                                          ),
                                        }
                                      : c
                                  )
                                )
                              }
                              className="flex-1 px-2.5 py-1 rounded-lg border border-slate-300 bg-white"
                            />
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                min={0}
                                max={1000}
                                value={opt.points}
                                onChange={(e) =>
                                  setRubricCriteria((prev) =>
                                    prev.map((c, i) =>
                                      i === cIdx
                                        ? {
                                            ...c,
                                            options: c.options.map((o, j) =>
                                              j === oIdx
                                                ? { ...o, points: Number(e.target.value) }
                                                : o
                                            ),
                                          }
                                        : c
                                    )
                                  )
                                }
                                className="w-20 px-2 py-1 rounded-lg border border-slate-300 bg-white text-right font-mono font-bold"
                              />
                              <span className="text-[11px] font-mono text-slate-500">pts</span>
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                setRubricCriteria((prev) =>
                                  prev.map((c, i) =>
                                    i === cIdx
                                      ? {
                                          ...c,
                                          options: c.options.filter((_, j) => j !== oIdx),
                                        }
                                      : c
                                  )
                                )
                              }
                              className="p-1 text-slate-400 hover:text-rose-600"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1">
              {projectToEdit?.attachmentFileName
                ? `Ganti Lampiran Panduan Projek (Saat ini: ${projectToEdit.attachmentFileName})`
                : 'Lampirkan File Panduan / Template Projek (Opsional, Maks 10 MB)'}
            </label>
            <input
              type="file"
              disabled={uploading}
              accept=".pdf,.ppt,.pptx,.doc,.docx,.xls,.xlsx,.zip,.txt"
              onChange={(e) => setAttachmentFile(e.target.files?.[0] || null)}
              className="w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-teal-50 file:text-teal-700"
            />
            {attachmentFile && (
              <div className="mt-1 text-[11px] font-mono text-teal-700">
                Terpilih: {attachmentFile.name} ({formatFileSize(attachmentFile.size)})
              </div>
            )}
          </div>

          {uploading && attachmentFile && (
            <div className="p-3 rounded-xl bg-teal-50 border border-teal-200 text-teal-800 font-semibold">
              Mengunggah lampiran panduan... {uploadProgress}%
            </div>
          )}

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              disabled={uploading}
              onClick={onClose}
              className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600 font-bold"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={uploading}
              className="px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white rounded-xl font-bold disabled:opacity-60"
            >
              {uploading
                ? 'Menyimpan...'
                : projectToEdit
                ? 'Simpan Perubahan Projek'
                : 'Terbitkan Tugas Projek Mahasiswa'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
