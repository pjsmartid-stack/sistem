import React, { useState } from 'react';
import {
  Course,
  LecturerPeerOverrideMode,
  PeerProjectAssignment,
  PeerProjectSubmission,
} from '../../types';
import { useExam } from '../../context/ExamContext';
import {
  calculateRubricSelectionTotal,
  computePeerSubmissionMetrics,
} from '../../utils/peerAssessment';
import {
  downloadFileResource,
  formatFileSize,
  MAX_UPLOAD_FILE_BYTES,
  uploadFileToFirestore,
} from '../../lib/fileStorage';
import {
  AlertTriangle,
  Award,
  CheckCircle2,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  Clock,
  Download,
  Edit2,
  FileText,
  Loader2,
  Lock,
  Send,
  ShieldCheck,
  Shuffle,
  Trash2,
  Unlock,
  Upload,
  UserCheck,
  Users,
  X,
} from 'lucide-react';

interface PeerProjectSectionProps {
  course: Course;
  project: PeerProjectAssignment;
  isTeacherOrAdmin: boolean;
  nowMs: number;
  onEditProject: (project: PeerProjectAssignment) => void;
  onDeleteProject: (project: PeerProjectAssignment) => void;
  onToast: (type: 'success' | 'error', message: string) => void;
}

function formatDateTimeId(iso?: string): string {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  return (
    d.toLocaleString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }) + ' WIB'
  );
}

export const PeerProjectSection: React.FC<PeerProjectSectionProps> = ({
  course,
  project,
  isTeacherOrAdmin,
  nowMs,
  onEditProject,
  onDeleteProject,
  onToast,
}) => {
  const {
    currentUser,
    users,
    submitPeerProject,
    assignPeerReviewers,
    submitPeerReview,
    submitLecturerPeerGrade,
  } = useExam();

  const [expanded, setExpanded] = useState<boolean>(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  // Student project submission state
  const [fileObj, setFileObj] = useState<File | null>(null);
  const [notes, setNotes] = useState('');
  const [subError, setSubError] = useState('');
  const [subUploading, setSubUploading] = useState(false);
  const [subProgress, setSubProgress] = useState(0);

  // Peer Review Modal state (Student evaluates a peer)
  const [reviewingSubmission, setReviewingSubmission] =
    useState<PeerProjectSubmission | null>(null);
  const [directScoreInput, setDirectScoreInput] = useState<number>(80);
  const [selectedRubricOpts, setSelectedRubricOpts] = useState<Record<string, string>>({});
  const [reviewComment, setReviewComment] = useState('');
  const [reviewSaving, setReviewSaving] = useState(false);
  const [reviewError, setReviewError] = useState('');

  // Lecturer Intervention Modal state
  const [lecturerGradingSub, setLecturerGradingSub] =
    useState<PeerProjectSubmission | null>(null);
  const [lecturerScoreInput, setLecturerScoreInput] = useState<number>(85);
  const [lecturerModeInput, setLecturerModeInput] =
    useState<LecturerPeerOverrideMode>('replace');
  const [lecturerFeedbackInput, setLecturerFeedbackInput] = useState('');
  const [lecturerSaving, setLecturerSaving] = useState(false);

  // Auto-assign loading state
  const [assigningReviewers, setAssigningReviewers] = useState(false);

  const openMs = project.openDate ? new Date(project.openDate).getTime() : 0;
  const dueMs = new Date(project.dueDate).getTime();
  const hasNotOpened = Boolean(project.openDate && nowMs < openMs);
  const isPastDeadline = nowMs > dueMs;
  const isLocked = hasNotOpened || (isPastDeadline && project.lockAfterDeadline !== false);

  const submissions = project.submissions || [];
  const mySubmission = currentUser
    ? submissions.find((s) => s.studentId === currentUser.id)
    : undefined;

  // Submissions assigned to current student for peer evaluation
  const assignedToMe = currentUser && !isTeacherOrAdmin
    ? submissions.filter(
        (s) =>
          s.studentId !== currentUser.id &&
          (s.assignedReviewerIds || []).includes(currentUser.id)
      )
    : [];

  const getUserLabel = (userId: string): string => {
    const found = users.find((u) => u.id === userId);
    return found ? `${found.name} (${found.nimOrNip})` : userId;
  };

  const handleDownload = async (params: {
    id: string;
    fileId?: string;
    fileUrl?: string;
    fileName: string;
    mimeType?: string;
  }) => {
    setDownloadingId(params.id);
    try {
      await downloadFileResource(params);
    } catch (err: any) {
      onToast('error', err?.message || 'Gagal mengunduh file.');
    } finally {
      setDownloadingId(null);
    }
  };

  const handleStudentSubmitProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setSubError('');

    if (isLocked) {
      setSubError(
        hasNotOpened
          ? 'Slot Tugas Projek Mahasiswa ini belum dibuka.'
          : 'Tenggat waktu berakhir. Slot pengumpulan sudah terkunci otomatis.'
      );
      return;
    }

    if (!fileObj && !mySubmission?.fileId) {
      setSubError('Pilih berkas projek dari perangkat Anda terlebih dahulu.');
      return;
    }
    if (fileObj && fileObj.size > MAX_UPLOAD_FILE_BYTES) {
      setSubError(`Ukuran file (${formatFileSize(fileObj.size)}) melebihi batas 10 MB.`);
      return;
    }

    setSubUploading(true);
    setSubProgress(5);
    try {
      let fileId = mySubmission?.fileId;
      let fileUrl = mySubmission?.fileUrl;
      let mimeType = mySubmission?.mimeType;
      let fileSize = mySubmission?.fileSize;
      let sizeBytes = mySubmission?.sizeBytes;
      let finalFileName = fileObj?.name || mySubmission?.fileName || 'Projek.pdf';

      if (fileObj) {
        const uploaded = await uploadFileToFirestore(
          fileObj,
          {
            scope: 'assignment_submission',
            scopeId: `${course.id}_${project.id}_${currentUser.id}`,
            uploadedBy: currentUser.name,
          },
          (pct) => setSubProgress(pct)
        );
        fileId = uploaded.fileId;
        fileUrl = uploaded.fileUrl;
        mimeType = uploaded.mimeType;
        fileSize = uploaded.fileSizeLabel;
        sizeBytes = uploaded.sizeBytes;
        finalFileName = uploaded.fileName;
      }

      await submitPeerProject(course.id, project.id, {
        studentId: currentUser.id,
        studentName: currentUser.name,
        studentNim: currentUser.nimOrNip,
        studentClassName: currentUser.className,
        fileName: finalFileName,
        fileId,
        fileUrl,
        mimeType,
        fileSize,
        sizeBytes,
        notes: notes.trim(),
      });

      setFileObj(null);
      setNotes('');
      onToast(
        'success',
        `Tugas projek "${finalFileName}" berhasil dikumpulkan & penilai sejawat otomatis dialokasikan.`
      );
    } catch (err: any) {
      setSubError(err?.message || 'Gagal mengunggah tugas projek.');
    } finally {
      setSubUploading(false);
      setSubProgress(0);
    }
  };

  const handleOpenPeerReviewModal = (sub: PeerProjectSubmission) => {
    if (!currentUser) return;
    const existingReview = (sub.peerReviews || []).find(
      (r) => r.reviewerId === currentUser.id
    );
    setReviewError('');
    if (existingReview) {
      setDirectScoreInput(existingReview.directScore ?? existingReview.totalScore);
      setSelectedRubricOpts(existingReview.selectedOptions || {});
      setReviewComment(existingReview.comment || '');
    } else {
      setDirectScoreInput(Math.round(project.maxPoints * 0.8));
      setSelectedRubricOpts({});
      setReviewComment('');
    }
    setReviewingSubmission(sub);
  };

  const handleSubmitPeerReviewForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !reviewingSubmission) return;
    setReviewError('');

    let totalScore = 0;
    let criterionPoints: Record<string, number> | undefined;

    if (project.scoringType === 'rubric_options') {
      const criteria = project.rubricCriteria || [];
      const calc = calculateRubricSelectionTotal(criteria, selectedRubricOpts);
      if (!calc.isComplete) {
        setReviewError('Pilih salah satu opsi poin pada setiap kriteria penilaian.');
        return;
      }
      totalScore = calc.totalScore;
      criterionPoints = calc.criterionPoints;
    } else {
      const num = Number(directScoreInput);
      if (Number.isNaN(num) || num < 0 || num > project.maxPoints) {
        setReviewError(`Skor langsung harus berada di antara 0 hingga ${project.maxPoints}.`);
        return;
      }
      totalScore = Number(num.toFixed(2));
    }

    setReviewSaving(true);
    try {
      await submitPeerReview(course.id, project.id, reviewingSubmission.id, {
        reviewerId: currentUser.id,
        reviewerName: currentUser.name,
        reviewerNim: currentUser.nimOrNip,
        reviewerRole: 'mahasiswa',
        scoringType: project.scoringType,
        directScore: project.scoringType === 'direct_score' ? totalScore : undefined,
        selectedOptions:
          project.scoringType === 'rubric_options' ? selectedRubricOpts : undefined,
        criterionPoints,
        totalScore,
        comment: reviewComment.trim(),
      });
      setReviewingSubmission(null);
      onToast(
        'success',
        `Penilaian sejawat (${totalScore} poin) berhasil disimpan dan langsung memperbarui rata-rata nilai.`
      );
    } catch (err: any) {
      setReviewError(err?.message || 'Gagal menyimpan penilaian sejawat.');
    } finally {
      setReviewSaving(false);
    }
  };

  const handleOpenLecturerModal = (sub: PeerProjectSubmission) => {
    const metrics = computePeerSubmissionMetrics(sub, project.maxPoints);
    setLecturerScoreInput(
      sub.lecturerScore ?? metrics.peerAverageScore ?? Math.round(project.maxPoints * 0.85)
    );
    setLecturerModeInput(sub.lecturerMode || 'replace');
    setLecturerFeedbackInput(sub.lecturerFeedback || '');
    setLecturerGradingSub(sub);
  };

  const handleSaveLecturerGrade = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lecturerGradingSub) return;
    setLecturerSaving(true);
    try {
      await submitLecturerPeerGrade(
        course.id,
        project.id,
        lecturerGradingSub.id,
        Number(lecturerScoreInput),
        lecturerModeInput,
        lecturerFeedbackInput.trim()
      );
      setLecturerGradingSub(null);
      onToast(
        'success',
        `Nilai koreksi dosen untuk ${lecturerGradingSub.studentName} berhasil disimpan.`
      );
    } catch (err: any) {
      onToast('error', err?.message || 'Gagal menyimpan nilai koreksi dosen.');
    } finally {
      setLecturerSaving(false);
    }
  };

  const handleTriggerAutoAssign = async (forceReassign: boolean) => {
    setAssigningReviewers(true);
    try {
      await assignPeerReviewers(course.id, project.id, forceReassign);
      onToast(
        'success',
        forceReassign
          ? 'Sistem berhasil mengacak ulang dan menetapkan penilai mahasiswa secara seimbang.'
          : 'Sistem berhasil melengkapi slot penilai mahasiswa secara otomatis.'
      );
    } catch (err: any) {
      onToast('error', err?.message || 'Gagal mengalokasikan penilai otomatis.');
    } finally {
      setAssigningReviewers(false);
    }
  };

  // Metrics summary for lecturer
  const scoredList = submissions
    .map((s) => computePeerSubmissionMetrics(s, project.maxPoints).finalScore)
    .filter((v): v is number => v !== null);
  const projectClassAvg =
    scoredList.length > 0
      ? Number((scoredList.reduce((a, b) => a + b, 0) / scoredList.length).toFixed(2))
      : null;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      {/* Moodle Activity Header Row */}
      <div className="p-4 sm:p-5 bg-slate-50/70 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="mt-0.5 p-1 rounded-lg hover:bg-slate-200 text-slate-600 shrink-0"
            aria-label={expanded ? 'Tutup rincian projek' : 'Buka rincian projek'}
          >
            {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>

          <div className="w-9 h-9 rounded-xl bg-teal-50 border border-teal-200 text-teal-700 flex items-center justify-center shrink-0">
            <Users className="w-4 h-4" />
          </div>

          <div className="space-y-1 min-w-0">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500">
              <span className="font-bold text-teal-800">Tugas Projek Mahasiswa</span>
              {project.gradingComponentName && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>Komponen: {project.gradingComponentName}</span>
                </>
              )}
              <span aria-hidden="true">·</span>
              <span className="font-mono">
                {project.reviewersPerSubmission} Penilai Mhs/Tugas
              </span>
              <span aria-hidden="true">·</span>
              <span>
                {project.scoringType === 'rubric_options' ? 'Opsi Pilihan Poin' : 'Skor Langsung'}
              </span>
            </div>

            <h3
              onClick={() => setExpanded((v) => !v)}
              className="text-base font-extrabold text-slate-900 cursor-pointer hover:text-teal-800 transition-colors"
            >
              {project.title}
            </h3>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-mono text-slate-500">
              <span className="inline-flex items-center gap-1">
                {isLocked ? (
                  <Lock className="w-3 h-3 text-rose-600" />
                ) : (
                  <Unlock className="w-3 h-3 text-emerald-600" />
                )}
                <span className={isLocked ? 'text-rose-700 font-bold' : 'text-emerald-700 font-bold'}>
                  {isLocked ? 'Terkunci' : 'Terbuka'}
                </span>
              </span>
              <span>Tenggat: {formatDateTimeId(project.dueDate)}</span>
              <span>Maks: {project.maxPoints} Poin</span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 pl-10 lg:pl-0 shrink-0">
          {!isTeacherOrAdmin && assignedToMe.length > 0 && (
            <span className="text-xs font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg">
              {assignedToMe.filter((s) => !(s.peerReviews || []).some((r) => r.reviewerId === currentUser?.id)).length}{' '}
              Tugas Rekan Perlu Dinilai
            </span>
          )}

          {isTeacherOrAdmin && (
            <>
              <button
                type="button"
                onClick={() => onEditProject(project)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center gap-1"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>Edit</span>
              </button>
              <button
                type="button"
                onClick={() => onDeleteProject(project)}
                className="p-1.5 rounded-lg border border-rose-200 bg-white hover:bg-rose-50 text-rose-600"
                title="Hapus Tugas Projek Mahasiswa"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Expanded Body */}
      {expanded && (
        <div className="p-5 sm:p-6 space-y-6 text-xs">
          {/* Instructions + Optional Attachment */}
          <div className="space-y-3">
            <div className="text-slate-700 leading-relaxed whitespace-pre-wrap bg-slate-50 border border-slate-200 rounded-xl p-4">
              {project.instructions || 'Belum ada petunjuk tambahan.'}
            </div>

            {project.attachmentFileName && (
              <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl border border-slate-200 bg-white">
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="w-4 h-4 text-teal-700 shrink-0" />
                  <span className="font-semibold text-slate-800 truncate">
                    Panduan Projek: {project.attachmentFileName}
                  </span>
                  <span className="text-[11px] font-mono text-slate-400">
                    ({project.attachmentFileSize || '-'})
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    handleDownload({
                      id: `att-${project.id}`,
                      fileId: project.attachmentFileId,
                      fileUrl: project.attachmentFileUrl,
                      fileName: project.attachmentFileName!,
                      mimeType: project.attachmentMimeType,
                    })
                  }
                  disabled={downloadingId === `att-${project.id}`}
                  className="px-3 py-1.5 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-800 font-bold flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Unduh Panduan</span>
                </button>
              </div>
            )}
          </div>

          {/* =============================================================== */}
          {/* STUDENT WORKSPACE: MY SUBMISSION + PEER REVIEWS ASSIGNED TO ME  */}
          {/* =============================================================== */}
          {!isTeacherOrAdmin && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
              {/* Left (6 cols): My Project Submission & My Received Peer Grades */}
              <div className="lg:col-span-6 p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-extrabold text-slate-900 text-sm">
                    1. Pengumpulan Projek Saya
                  </h4>
                  {mySubmission ? (
                    <span className="font-bold text-emerald-700 flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Sudah Dikumpulkan</span>
                    </span>
                  ) : (
                    <span className="text-slate-500 font-semibold">Belum Mengumpulkan</span>
                  )}
                </div>

                {mySubmission && (
                  <div className="p-3.5 rounded-xl bg-white border border-slate-200 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-bold text-slate-900 truncate">
                          {mySubmission.fileName}
                        </div>
                        <div className="text-[11px] font-mono text-slate-500">
                          Dikumpulkan: {formatDateTimeId(mySubmission.submittedAt)} ·{' '}
                          {mySubmission.fileSize || '-'}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          handleDownload({
                            id: mySubmission.id,
                            fileId: mySubmission.fileId,
                            fileUrl: mySubmission.fileUrl,
                            fileName: mySubmission.fileName,
                            mimeType: mySubmission.mimeType,
                          })
                        }
                        className="px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 font-bold text-slate-700 flex items-center gap-1 shrink-0"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Unduh</span>
                      </button>
                    </div>

                    {/* Received Peer Grade Summary */}
                    {(() => {
                      const metrics = computePeerSubmissionMetrics(
                        mySubmission,
                        project.maxPoints
                      );
                      const studentReviews = (mySubmission.peerReviews || []).filter(
                        (r) => r.reviewerRole === 'mahasiswa'
                      );

                      return (
                        <div className="pt-3 border-t border-slate-100 space-y-2.5">
                          <div className="grid grid-cols-3 gap-2 text-center">
                            <div className="p-2 rounded-lg bg-slate-50 border border-slate-200">
                              <div className="text-[10px] text-slate-500">Penilai Mhs</div>
                              <div className="font-mono font-extrabold text-slate-900 text-sm">
                                {metrics.studentReviewsCount} /{' '}
                                {Math.max(
                                  metrics.assignedCount,
                                  project.reviewersPerSubmission
                                )}
                              </div>
                            </div>
                            <div className="p-2 rounded-lg bg-slate-50 border border-slate-200">
                              <div className="text-[10px] text-slate-500">Rata-rata Teman</div>
                              <div className="font-mono font-extrabold text-blue-700 text-sm">
                                {metrics.peerAverageScore !== null
                                  ? metrics.peerAverageScore
                                  : '-'}
                              </div>
                            </div>
                            <div className="p-2 rounded-lg bg-teal-50 border border-teal-200">
                              <div className="text-[10px] text-teal-800 font-bold">Nilai Akhir</div>
                              <div className="font-mono font-extrabold text-teal-900 text-sm">
                                {metrics.finalScore !== null ? metrics.finalScore : '-'}
                              </div>
                            </div>
                          </div>

                          {studentReviews.length > 0 && (
                            <div className="space-y-1.5">
                              <div className="text-[11px] font-bold text-slate-700">
                                Skor &amp; Ulasan Penilai Mahasiswa:
                              </div>
                              {studentReviews.map((rev, idx) => (
                                <div
                                  key={rev.id}
                                  className="p-2 rounded-lg bg-slate-50 border border-slate-200 flex items-start justify-between gap-2"
                                >
                                  <div>
                                    <div className="font-semibold text-slate-800">
                                      {project.anonymousPeerReview
                                        ? `Penilai Mahasiswa #${idx + 1}`
                                        : rev.reviewerName}
                                    </div>
                                    {rev.comment && (
                                      <div className="text-[11px] text-slate-600 mt-0.5">
                                        &ldquo;{rev.comment}&rdquo;
                                      </div>
                                    )}
                                  </div>
                                  <span className="font-mono font-extrabold text-teal-800 shrink-0">
                                    {rev.totalScore} / {project.maxPoints}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}

                          {metrics.hasLecturerOverride && (
                            <div className="p-2.5 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-900 space-y-0.5">
                              <div className="font-bold flex items-center justify-between">
                                <span className="flex items-center gap-1">
                                  <ShieldCheck className="w-3.5 h-3.5" />
                                  Penilaian Tambahan Dosen (
                                  {mySubmission.lecturerMode === 'include_in_average'
                                    ? 'Ikut Dirata-ratakan'
                                    : 'Penyesuaian Nilai Akhir'}
                                  )
                                </span>
                                <span className="font-mono font-extrabold">
                                  {mySubmission.lecturerScore}
                                </span>
                              </div>
                              {mySubmission.lecturerFeedback && (
                                <div className="text-[11px] text-indigo-800">
                                  Catatan Dosen: {mySubmission.lecturerFeedback}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                )}

                {isLocked ? (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 font-semibold flex items-center gap-2">
                    <Lock className="w-4 h-4 shrink-0" />
                    <span>
                      {hasNotOpened
                        ? `Slot pengumpulan akan dibuka pada ${formatDateTimeId(project.openDate)}.`
                        : 'Tenggat waktu telah lewat. Slot pengumpulan terkunci otomatis.'}
                    </span>
                  </div>
                ) : (
                  <form onSubmit={handleStudentSubmitProject} className="space-y-3">
                    {subError && (
                      <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 font-semibold">
                        {subError}
                      </div>
                    )}

                    <label className="block border-2 border-dashed border-slate-300 hover:border-teal-400 bg-white rounded-xl p-4 text-center cursor-pointer">
                      <input
                        type="file"
                        disabled={subUploading}
                        accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.zip,.rar,.txt,.png,.jpg,.jpeg"
                        onChange={(e) => {
                          setFileObj(e.target.files?.[0] || null);
                          setSubError('');
                        }}
                        className="hidden"
                      />
                      {fileObj ? (
                        <div className="space-y-1">
                          <div className="font-bold text-teal-800">{fileObj.name}</div>
                          <div className="text-[11px] font-mono text-slate-500">
                            {formatFileSize(fileObj.size)}
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <Upload className="w-5 h-5 text-slate-400 mx-auto" />
                          <div className="font-semibold text-slate-700">
                            {mySubmission
                              ? 'Pilih file baru untuk memperbarui tugas projek'
                              : 'Pilih file tugas projek Anda (Maks 10 MB)'}
                          </div>
                        </div>
                      )}
                    </label>

                    <textarea
                      rows={2}
                      disabled={subUploading}
                      placeholder="Catatan singkat mengenai projek yang dikumpulkan (opsional)..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white"
                    />

                    {subUploading && (
                      <div className="p-2.5 rounded-lg bg-teal-50 border border-teal-200 text-teal-800 font-semibold flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          Mengunggah file projek...
                        </span>
                        <span className="font-mono">{subProgress}%</span>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={subUploading || !fileObj}
                      className="w-full py-2.5 px-4 bg-teal-700 hover:bg-teal-800 text-white rounded-xl font-bold flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      <Send className="w-4 h-4" />
                      <span>
                        {mySubmission
                          ? 'Kirim Ulang Tugas Projek'
                          : 'Kumpulkan Tugas Projek Sekarang'}
                      </span>
                    </button>
                  </form>
                )}
              </div>

              {/* Right (6 cols): Peer Tasks Assigned to Me by System */}
              <div className="lg:col-span-6 p-4 rounded-xl border border-slate-200 bg-white space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-extrabold text-slate-900 text-sm">
                      2. Tugas Rekan Mahasiswa untuk Anda Nilai
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Sistem otomatis memilihkan tugas projek rekan sekelas untuk Anda beri nilai.
                    </p>
                  </div>
                  <span className="font-mono font-bold text-slate-700">
                    {assignedToMe.length} Tugas
                  </span>
                </div>

                {assignedToMe.length === 0 ? (
                  <div className="p-6 rounded-xl bg-slate-50 border border-dashed border-slate-300 text-center text-slate-500 space-y-1">
                    <UserCheck className="w-8 h-8 text-slate-300 mx-auto" />
                    <div className="font-semibold text-slate-700">
                      Belum Ada Tugas Rekan yang Dialokasikan
                    </div>
                    <p className="text-[11px]">
                      Penugasan penilai akan otomatis muncul setelah rekan mahasiswa mengumpulkan
                      tugas projek atau dosen memicu alokasi penilai.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {assignedToMe.map((peerSub, idx) => {
                      const myReview = (peerSub.peerReviews || []).find(
                        (r) => r.reviewerId === currentUser?.id
                      );
                      return (
                        <div
                          key={peerSub.id}
                          className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2.5"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="font-bold text-slate-900">
                                {project.anonymousPeerReview
                                  ? `Projek Rekan #${idx + 1}`
                                  : `${peerSub.studentName} (${peerSub.studentNim})`}
                              </div>
                              <div className="text-[11px] font-mono text-slate-600 truncate">
                                File: {peerSub.fileName} ({peerSub.fileSize || '-'})
                              </div>
                              {peerSub.notes && (
                                <div className="text-[11px] text-slate-500 mt-1">
                                  Catatan: {peerSub.notes}
                                </div>
                              )}
                            </div>

                            {myReview ? (
                              <span className="font-mono font-extrabold text-emerald-700 shrink-0">
                                Skor Anda: {myReview.totalScore}
                              </span>
                            ) : (
                              <span className="font-bold text-amber-700 shrink-0">
                                Belum Dinilai
                              </span>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200">
                            <button
                              type="button"
                              onClick={() =>
                                handleDownload({
                                  id: `peer-${peerSub.id}`,
                                  fileId: peerSub.fileId,
                                  fileUrl: peerSub.fileUrl,
                                  fileName: peerSub.fileName,
                                  mimeType: peerSub.mimeType,
                                })
                              }
                              disabled={downloadingId === `peer-${peerSub.id}`}
                              className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 font-bold text-slate-700 flex items-center gap-1.5"
                            >
                              <Download className="w-3.5 h-3.5" />
                              <span>Unduh Berkas Rekan</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleOpenPeerReviewModal(peerSub)}
                              className="px-3.5 py-1.5 rounded-lg bg-teal-700 hover:bg-teal-800 text-white font-bold flex items-center gap-1.5"
                            >
                              <CheckSquare className="w-3.5 h-3.5" />
                              <span>{myReview ? 'Edit Nilai Sejawat' : 'Beri Nilai Sejawat'}</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* =============================================================== */}
          {/* LECTURER / ADMIN WORKSPACE: ALLOCATE REVIEWERS & MONITOR SCORES */}
          {/* =============================================================== */}
          {isTeacherOrAdmin && (
            <div className="space-y-4">
              {/* Lecturer Toolbar & Stats */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-4 rounded-xl bg-slate-50 border border-slate-200">
                <div className="flex flex-wrap items-center gap-4">
                  <div>
                    <div className="text-[11px] text-slate-500">Total Mengumpulkan</div>
                    <div className="text-lg font-extrabold font-mono tabular-nums text-slate-900">
                      {submissions.length} Mahasiswa
                    </div>
                  </div>
                  <div className="h-8 w-px bg-slate-200 hidden sm:block" />
                  <div>
                    <div className="text-[11px] text-slate-500">Target Penilai/Tugas</div>
                    <div className="text-lg font-extrabold font-mono tabular-nums text-teal-800">
                      {project.reviewersPerSubmission} Orang
                    </div>
                  </div>
                  <div className="h-8 w-px bg-slate-200 hidden sm:block" />
                  <div>
                    <div className="text-[11px] text-slate-500">Rata-Rata Nilai Akhir</div>
                    <div className="text-lg font-extrabold font-mono tabular-nums text-blue-700">
                      {projectClassAvg !== null ? projectClassAvg : '-'}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={assigningReviewers || submissions.length === 0}
                    onClick={() => handleTriggerAutoAssign(false)}
                    className="px-3 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-800 font-bold flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <UserCheck className="w-3.5 h-3.5 text-teal-700" />
                    <span>Lengkapi Penilai Otomatis</span>
                  </button>

                  <button
                    type="button"
                    disabled={assigningReviewers || submissions.length === 0}
                    onClick={() => handleTriggerAutoAssign(true)}
                    className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <Shuffle className="w-3.5 h-3.5" />
                    <span>
                      {assigningReviewers ? 'Memilih...' : 'Acak Ulang Penilai Otomatis'}
                    </span>
                  </button>
                </div>
              </div>

              {/* Submissions & Peer Evaluators Table */}
              {submissions.length === 0 ? (
                <div className="p-8 rounded-xl border border-dashed border-slate-300 text-center text-slate-500">
                  Belum ada mahasiswa yang mengumpulkan Tugas Projek Mahasiswa ini.
                </div>
              ) : (
                <div className="border border-slate-200 rounded-xl overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-100 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                        <th className="py-3 px-4">Mahasiswa &amp; Berkas</th>
                        <th className="py-3 px-3">Penilai Mahasiswa (Otomatis)</th>
                        <th className="py-3 px-3 text-right">Rata-rata Mhs</th>
                        <th className="py-3 px-3 text-right">Skor Dosen</th>
                        <th className="py-3 px-3 text-right">Nilai Akhir</th>
                        <th className="py-3 px-4 text-right">Aksi Dosen</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {submissions.map((sub) => {
                        const metrics = computePeerSubmissionMetrics(sub, project.maxPoints);
                        const studentReviews = (sub.peerReviews || []).filter(
                          (r) => r.reviewerRole === 'mahasiswa'
                        );
                        const assignedIds = sub.assignedReviewerIds || [];

                        return (
                          <tr key={sub.id} className="hover:bg-slate-50/70 align-top">
                            <td className="py-3 px-4 min-w-[200px]">
                              <div className="font-bold text-slate-900">{sub.studentName}</div>
                              <div className="text-[11px] font-mono text-slate-500">
                                NIM {sub.studentNim} · {sub.studentClassName || 'Reguler'}
                              </div>
                              <button
                                type="button"
                                onClick={() =>
                                  handleDownload({
                                    id: sub.id,
                                    fileId: sub.fileId,
                                    fileUrl: sub.fileUrl,
                                    fileName: sub.fileName,
                                    mimeType: sub.mimeType,
                                  })
                                }
                                className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 hover:underline"
                              >
                                <Download className="w-3 h-3" />
                                <span className="truncate max-w-[180px]">{sub.fileName}</span>
                              </button>
                            </td>

                            <td className="py-3 px-3 min-w-[250px]">
                              <div className="font-mono font-bold text-slate-700 mb-1">
                                {metrics.studentReviewsCount} dari {assignedIds.length} penilai selesai
                              </div>
                              {assignedIds.length === 0 ? (
                                <span className="text-slate-400 italic">
                                  Belum ada penilai ditugaskan
                                </span>
                              ) : (
                                <div className="space-y-1">
                                  {assignedIds.map((rid) => {
                                    const rev = studentReviews.find((r) => r.reviewerId === rid);
                                    return (
                                      <div
                                        key={rid}
                                        className="flex items-center justify-between gap-2 text-[11px] bg-slate-50 px-2 py-1 rounded border border-slate-200"
                                      >
                                        <span className="truncate max-w-[160px] text-slate-700">
                                          {getUserLabel(rid)}
                                        </span>
                                        {rev ? (
                                          <span className="font-mono font-extrabold text-emerald-700">
                                            {rev.totalScore} pts
                                          </span>
                                        ) : (
                                          <span className="text-amber-700 font-semibold">
                                            Menunggu
                                          </span>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </td>

                            <td className="py-3 px-3 text-right font-mono tabular-nums font-bold text-slate-800">
                              {metrics.peerAverageScore !== null
                                ? metrics.peerAverageScore.toFixed(2)
                                : '-'}
                            </td>

                            <td className="py-3 px-3 text-right font-mono tabular-nums">
                              {metrics.hasLecturerOverride ? (
                                <div>
                                  <div className="font-bold text-indigo-700">
                                    {sub.lecturerScore}
                                  </div>
                                  <div className="text-[10px] font-sans text-slate-500">
                                    {sub.lecturerMode === 'include_in_average'
                                      ? 'Dirata-ratakan'
                                      : 'Ganti Nilai'}
                                  </div>
                                </div>
                              ) : (
                                <span className="text-slate-400">-</span>
                              )}
                            </td>

                            <td className="py-3 px-3 text-right font-mono tabular-nums font-extrabold text-sm text-teal-900">
                              {metrics.finalScore !== null ? metrics.finalScore.toFixed(2) : '-'}
                            </td>

                            <td className="py-3 px-4 text-right whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => handleOpenLecturerModal(sub)}
                                className="px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-800 font-bold inline-flex items-center gap-1"
                              >
                                <ShieldCheck className="w-3.5 h-3.5" />
                                <span>Ikut Nilai / Koreksi</span>
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL: MAHASISWA MENILAI TUGAS REKAN (DIRECT SCORE / OPSI POIN)     */}
      {/* =================================================================== */}
      {reviewingSubmission && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <CheckSquare className="w-4 h-4 text-teal-700" />
                <span>
                  Penilaian Sejawat:{' '}
                  {project.anonymousPeerReview
                    ? 'Karya Rekan Mahasiswa'
                    : reviewingSubmission.studentName}
                </span>
              </h3>
              <button
                type="button"
                disabled={reviewSaving}
                onClick={() => setReviewingSubmission(null)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitPeerReviewForm} className="p-5 space-y-4 overflow-y-auto text-xs">
              {reviewError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl font-semibold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{reviewError}</span>
                </div>
              )}

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-2">
                <div className="truncate font-semibold text-slate-700">
                  Berkas: {reviewingSubmission.fileName}
                </div>
                <button
                  type="button"
                  onClick={() =>
                    handleDownload({
                      id: `modal-${reviewingSubmission.id}`,
                      fileId: reviewingSubmission.fileId,
                      fileUrl: reviewingSubmission.fileUrl,
                      fileName: reviewingSubmission.fileName,
                      mimeType: reviewingSubmission.mimeType,
                    })
                  }
                  className="px-2.5 py-1 rounded-lg bg-white border border-slate-300 font-bold text-slate-700 flex items-center gap-1 shrink-0"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Unduh File</span>
                </button>
              </div>

              {project.scoringType === 'direct_score' ? (
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Skor Penilaian Langsung (0 – {project.maxPoints}) *
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={project.maxPoints}
                    step="0.5"
                    required
                    value={directScoreInput}
                    onChange={(e) => setDirectScoreInput(Number(e.target.value))}
                    className="w-full px-3 py-2.5 rounded-lg border border-slate-300 font-mono text-base font-extrabold text-teal-900"
                  />
                </div>
              ) : (
                <div className="space-y-3">
                  {(project.rubricCriteria || []).map((crit) => (
                    <div
                      key={crit.id}
                      className="p-3.5 rounded-xl border border-slate-200 bg-white space-y-2"
                    >
                      <div className="font-bold text-slate-900">{crit.title}</div>
                      {crit.description && (
                        <div className="text-[11px] text-slate-500">{crit.description}</div>
                      )}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                        {crit.options.map((opt) => {
                          const isSelected = selectedRubricOpts[crit.id] === opt.id;
                          return (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() =>
                                setSelectedRubricOpts((prev) => ({
                                  ...prev,
                                  [crit.id]: opt.id,
                                }))
                              }
                              className={`p-2.5 rounded-lg border text-left flex items-center justify-between gap-2 transition-colors ${
                                isSelected
                                  ? 'bg-teal-50 border-teal-500 text-teal-950 font-bold'
                                  : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                              }`}
                            >
                              <span>{opt.label}</span>
                              <span className="font-mono font-extrabold text-teal-700 shrink-0">
                                +{opt.points} pts
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}

                  {/* Live Total Preview */}
                  <div className="p-3 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-between font-bold text-teal-950">
                    <span>Total Poin Terhitung Otomatis:</span>
                    <span className="font-mono text-lg font-extrabold">
                      {
                        calculateRubricSelectionTotal(
                          project.rubricCriteria || [],
                          selectedRubricOpts
                        ).totalScore
                      }{' '}
                      / {project.maxPoints}
                    </span>
                  </div>
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Komentar &amp; Masukan Konstruktif
                </label>
                <textarea
                  rows={3}
                  placeholder="Tuliskan kelebihan atau saran perbaikan untuk karya rekan Anda..."
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  disabled={reviewSaving}
                  onClick={() => setReviewingSubmission(null)}
                  className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 font-bold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={reviewSaving}
                  className="px-4 py-2 rounded-lg bg-teal-700 hover:bg-teal-800 text-white font-bold disabled:opacity-60"
                >
                  {reviewSaving ? 'Menyimpan...' : 'Kirim Penilaian Sejawat'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL: INTERVENSI / PENILAIAN DOSEN JIKA NILAI SEJAWAT KURANG SESUAI */}
      {/* =================================================================== */}
      {isTeacherOrAdmin && lecturerGradingSub && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-indigo-700" />
                <span>Penilaian / Koreksi Dosen: {lecturerGradingSub.studentName}</span>
              </h3>
              <button
                type="button"
                onClick={() => setLecturerGradingSub(null)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveLecturerGrade} className="p-5 space-y-4 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                <div className="font-bold text-slate-800">
                  Ringkasan Nilai Mahasiswa Sejawat Saat Ini:
                </div>
                {(lecturerGradingSub.peerReviews || []).length === 0 ? (
                  <div className="text-slate-500">Belum ada penilai mahasiswa yang mengirim skor.</div>
                ) : (
                  <div className="space-y-1">
                    {lecturerGradingSub.peerReviews.map((r) => (
                      <div key={r.id} className="flex items-center justify-between text-slate-700">
                        <span>{r.reviewerName}</span>
                        <span className="font-mono font-bold">{r.totalScore} pts</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Skor dari Dosen (0 – {project.maxPoints}) *
                </label>
                <input
                  type="number"
                  min={0}
                  max={project.maxPoints}
                  step="0.5"
                  required
                  value={lecturerScoreInput}
                  onChange={(e) => setLecturerScoreInput(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono text-base font-extrabold text-indigo-800"
                />
              </div>

              <div className="space-y-2">
                <label className="block font-bold text-slate-700">
                  Cara Penggabungan Nilai Dosen
                </label>
                <div className="grid grid-cols-1 gap-2">
                  <button
                    type="button"
                    onClick={() => setLecturerModeInput('replace')}
                    className={`p-3 rounded-xl border text-left ${
                      lecturerModeInput === 'replace'
                        ? 'bg-indigo-50 border-indigo-500 text-indigo-950 font-bold'
                        : 'bg-white border-slate-200 text-slate-700'
                    }`}
                  >
                    <div>Tetapkan sebagai Nilai Akhir Resmi (Ganti Rata-rata Mahasiswa)</div>
                    <div className="text-[11px] font-normal text-slate-500 mt-0.5">
                      Gunakan ini jika skor mahasiswa dinilai terlalu tinggi/rendah dan perlu dikoreksi.
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setLecturerModeInput('include_in_average')}
                    className={`p-3 rounded-xl border text-left ${
                      lecturerModeInput === 'include_in_average'
                        ? 'bg-indigo-50 border-indigo-500 text-indigo-950 font-bold'
                        : 'bg-white border-slate-200 text-slate-700'
                    }`}
                  >
                    <div>Ikut Dirata-ratakan Bersama Penilai Mahasiswa</div>
                    <div className="text-[11px] font-normal text-slate-500 mt-0.5">
                      Skor dosen dihitung sebagai 1 penilai tambahan lalu dirata-ratakan bersama skor mahasiswa.
                    </div>
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Catatan Evaluasi Dosen (Opsional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Alasan koreksi atau catatan tambahan dari dosen..."
                  value={lecturerFeedbackInput}
                  onChange={(e) => setLecturerFeedbackInput(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  disabled={lecturerSaving}
                  onClick={() => setLecturerGradingSub(null)}
                  className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 font-bold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={lecturerSaving}
                  className="px-4 py-2 rounded-lg bg-indigo-700 hover:bg-indigo-800 text-white font-bold disabled:opacity-60"
                >
                  {lecturerSaving ? 'Menyimpan...' : 'Simpan Nilai Dosen'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
