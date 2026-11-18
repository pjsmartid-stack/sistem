import React, { useState, useEffect, useMemo } from 'react';
import { useExam } from '../../context/ExamContext';
import {
  Course,
  CourseMaterial,
  CourseAssignment,
  CourseAssignmentSubmission,
  CourseTopic,
  CourseContentBlock,
  Exam,
  PeerProjectAssignment,
  StoredFileType,
} from '../../types';
import {
  uploadFileToFirestore,
  downloadFileResource,
  fetchStoredFileBlob,
  formatFileSize,
  inferStoredFileType,
  MAX_UPLOAD_FILE_BYTES,
} from '../../lib/fileStorage';
import {
  doesExamMatchCourse,
  getExamCategoryLabel,
  getSelectableComponentsForActivity,
  resolveGradeConfig,
} from '../../utils/gradebook';
import {
  ArrowLeft,
  BookOpen,
  FileText,
  ClipboardList,
  Calendar,
  Clock,
  Plus,
  Trash2,
  Download,
  Upload,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  Film,
  Award,
  User,
  FileCheck,
  Send,
  Eye,
  Link2,
  Loader2,
  X,
  Lock,
  Unlock,
  Edit2,
  Info,
  QrCode,
  ChevronDown,
  ChevronRight,
  Layers,
  Image as ImageIcon,
  Type as TypeIcon,
  Users,
  ListTree,
  ChevronsDownUp,
  ChevronsUpDown,
  GraduationCap,
  ArrowRightLeft,
  Search,
} from 'lucide-react';
import { AttendanceView } from '../attendance/AttendanceView';
import { GradebookView } from '../grades/GradebookView';
import { FirestoreImage } from './FirestoreImage';
import { PeerProjectModal } from './PeerProjectModal';
import { PeerProjectSection } from './PeerProjectSection';
import { CourseUsersModal } from './CourseUsersModal';
import { ExamFormModal } from '../lecturer/ExamFormModal';

interface CourseDetailViewProps {
  course: Course;
  onBack: () => void;
}

type MoodleContentFilter = 'all' | 'materials_text' | 'tasks_peer' | 'videos_exams';

function toLocalDateTimeInput(dateInput?: string | Date): string {
  const d = dateInput ? new Date(dateInput) : new Date();
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatFullIndonesianDateTime(isoString?: string): string {
  if (!isoString) return '-';
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return '-';
  return (
    d.toLocaleString('id-ID', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }) + ' WIB'
  );
}

function formatDurationHuman(ms: number): string {
  const abs = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(abs / 86400);
  const hours = Math.floor((abs % 86400) / 3600);
  const mins = Math.floor((abs % 3600) / 60);
  const secs = abs % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  if (days > 0) {
    return `${days} hari ${pad(hours)}j ${pad(mins)}m ${pad(secs)}d`;
  }
  return `${pad(hours)}j ${pad(mins)}m ${pad(secs)}d`;
}

export const CourseDetailView: React.FC<CourseDetailViewProps> = ({
  course,
  onBack,
}) => {
  const {
    currentUser,
    exams,
    attempts,
    addMaterial,
    deleteMaterial,
    addAssignment,
    updateAssignment,
    deleteAssignment,
    submitAssignment,
    gradeAssignmentSubmission,
    addVideo,
    deleteVideo,
    addCourseTopic,
    updateCourseTopic,
    deleteCourseTopic,
    addTopicBlock,
    updateTopicBlock,
    deleteTopicBlock,
    deletePeerProject,
    assignExamToTopic,
    deleteExam,
    getExamTimeStatus,
    gradeConfigs,
  } = useExam();

  const isTeacherOrAdmin = currentUser?.role === 'dosen' || currentUser?.role === 'admin';

  // Primary View Tab: 'course_page' (Single-Page Moodle Layout) | 'attendance' | 'gradebook'
  const [activeTab, setActiveTab] = useState<'course_page' | 'attendance' | 'gradebook'>(
    'course_page'
  );
  const [contentFilter, setContentFilter] = useState<MoodleContentFilter>('all');

  // Accordion state for Moodle sections (key: 'general' | topic.id -> boolean = collapsed)
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const [expandedVideoIds, setExpandedVideoIds] = useState<Record<string, boolean>>({});

  // Toast / feedback banner
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => {
      setToast((prev) => (prev?.message === message ? null : prev));
    }, 5000);
  };

  // Delete confirmation modal state
  const [deleteConfirm, setDeleteConfirm] = useState<{
    type: 'material' | 'assignment' | 'video' | 'topic' | 'block' | 'peer_project' | 'exam';
    id: string;
    title: string;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Modals state for Moodle Topics, Text/Image Blocks, Materials, Assignments, Videos, Peer Projects
  const [isTopicModalOpen, setIsTopicModalOpen] = useState(false);
  const [editingTopic, setEditingTopic] = useState<CourseTopic | null>(null);
  const [topicMeetingNumber, setTopicMeetingNumber] = useState<number>(1);
  const [topicTitle, setTopicTitle] = useState('');
  const [topicSummary, setTopicSummary] = useState('');
  const [topicSaving, setTopicSaving] = useState(false);
  const [topicError, setTopicError] = useState('');

  const [isBlockModalOpen, setIsBlockModalOpen] = useState(false);
  const [editingBlock, setEditingBlock] = useState<CourseContentBlock | null>(null);
  const [blockTopicId, setBlockTopicId] = useState<string>('');
  const [blockTitle, setBlockTitle] = useState('');
  const [blockText, setBlockText] = useState('');
  const [blockImageFile, setBlockImageFile] = useState<File | null>(null);
  const [blockImagePreviewUrl, setBlockImagePreviewUrl] = useState<string | null>(null);
  const [blockRemoveExistingImg, setBlockRemoveExistingImg] = useState(false);
  const [blockImageCaption, setBlockImageCaption] = useState('');
  const [blockUploading, setBlockUploading] = useState(false);
  const [blockUploadProgress, setBlockUploadProgress] = useState(0);
  const [blockError, setBlockError] = useState('');

  const [isPeerModalOpen, setIsPeerModalOpen] = useState(false);
  const [peerModalTopicId, setPeerModalTopicId] = useState<string>('');
  const [editingPeerProject, setEditingPeerProject] = useState<PeerProjectAssignment | null>(null);
  const [isCourseUsersModalOpen, setIsCourseUsersModalOpen] = useState(false);

  // Exam creation / editing & Pertemuan placement picker state
  const [isExamModalOpen, setIsExamModalOpen] = useState(false);
  const [examToEdit, setExamToEdit] = useState<Exam | null>(null);
  const [examModalDefaultTopicId, setExamModalDefaultTopicId] = useState<string>('');
  const [isPlaceExamModalOpen, setIsPlaceExamModalOpen] = useState(false);
  const [placeExamModalTopicId, setPlaceExamModalTopicId] = useState<string | undefined>(undefined);
  const [placeExamSearch, setPlaceExamSearch] = useState('');
  const [placeExamShowAllSystem, setPlaceExamShowAllSystem] = useState(false);
  const [placingExamId, setPlacingExamId] = useState<string | null>(null);

  const [isAddMaterialOpen, setIsAddMaterialOpen] = useState(false);
  const [matTopicId, setMatTopicId] = useState<string>('');
  const [matTitle, setMatTitle] = useState('');
  const [matDescription, setMatDescription] = useState('');
  const [matUploadMode, setMatUploadMode] = useState<'file' | 'link'>('file');
  const [matSelectedFile, setMatSelectedFile] = useState<File | null>(null);
  const [matExternalUrl, setMatExternalUrl] = useState('');
  const [matFormError, setMatFormError] = useState('');
  const [matUploading, setMatUploading] = useState(false);
  const [matUploadProgress, setMatUploadProgress] = useState(0);

  // Downloading / Preview state
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<{
    title: string;
    fileName: string;
    mimeType: string;
    objectUrl: string;
  } | null>(null);
  const [previewLoadingId, setPreviewLoadingId] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (previewFile?.objectUrl) {
        URL.revokeObjectURL(previewFile.objectUrl);
      }
    };
  }, [previewFile]);

  useEffect(() => {
    return () => {
      if (blockImagePreviewUrl) {
        URL.revokeObjectURL(blockImagePreviewUrl);
      }
    };
  }, [blockImagePreviewUrl]);

  // Live clock for real-time deadline countdown & automatic lock enforcement
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Assignment creation / edit state
  const [isAddAssignmentOpen, setIsAddAssignmentOpen] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<CourseAssignment | null>(null);
  const [assTopicId, setAssTopicId] = useState<string>('');
  const [assTitle, setAssTitle] = useState('');
  const [assInstructions, setAssInstructions] = useState('');
  const [assOpenDate, setAssOpenDate] = useState(() => toLocalDateTimeInput(new Date()));
  const [assDueDate, setAssDueDate] = useState(() =>
    toLocalDateTimeInput(new Date(Date.now() + 7 * 86400000))
  );
  const [assLockAfterDeadline, setAssLockAfterDeadline] = useState<boolean>(true);
  const [assMaxPoints, setAssMaxPoints] = useState<number>(100);
  const [assGradingComponentId, setAssGradingComponentId] = useState<string>('');
  const [assAttachmentFile, setAssAttachmentFile] = useState<File | null>(null);
  const [assUploading, setAssUploading] = useState(false);
  const [assUploadProgress, setAssUploadProgress] = useState(0);
  const [assFormError, setAssFormError] = useState('');

  const activeCourseGradeConfig = resolveGradeConfig(gradeConfigs, { courseId: course.id });
  const selectableAssGroups = getSelectableComponentsForActivity(activeCourseGradeConfig, 'assignment');
  const flatAssComponents = selectableAssGroups.flatMap((g) => g.components);
  const selectedAssGradingComp = flatAssComponents.find((c) => c.id === assGradingComponentId);

  // Inline per-assignment submission state for students
  const [submissionDrafts, setSubmissionDrafts] = useState<
    Record<
      string,
      {
        fileObj: File | null;
        notes: string;
        error: string;
        uploading: boolean;
        progress: number;
      }
    >
  >({});

  // Assignment grading modal for lecturer
  const [activeAssignmentToGrade, setActiveAssignmentToGrade] = useState<CourseAssignment | null>(null);
  const [gradingSubmission, setGradingSubmission] = useState<CourseAssignmentSubmission | null>(null);
  const [gradeInput, setGradeInput] = useState<number>(85);
  const [feedbackInput, setFeedbackInput] = useState<string>('');

  const liveAssignmentForGrading = activeAssignmentToGrade
    ? course.assignments.find((a) => a.id === activeAssignmentToGrade.id) || activeAssignmentToGrade
    : null;

  // Video form state
  const [isAddVideoOpen, setIsAddVideoOpen] = useState(false);
  const [vidTopicId, setVidTopicId] = useState<string>('');
  const [vidTitle, setVidTitle] = useState('');
  const [vidUrl, setVidUrl] = useState('');
  const [vidDescription, setVidDescription] = useState('');
  const [vidFormError, setVidFormError] = useState('');

  const extractYouTubeId = (url: string): string => {
    try {
      const trimmed = url.trim();
      if (trimmed.length === 11 && !trimmed.includes('/') && !trimmed.includes('?')) {
        return trimmed;
      }
      const match = trimmed.match(
        /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/
      );
      return match ? match[1] : '';
    } catch {
      return '';
    }
  };

  // Linked exams matching this course
  const linkedExams = useMemo(
    () => exams.filter((e) => doesExamMatchCourse(e, course)),
    [exams, course]
  );

  // Sorted topics & topic ID set for safe routing of orphaned items to General
  const sortedTopics = useMemo(
    () =>
      [...(course.topics || [])].sort((a, b) => {
        if (a.meetingNumber !== b.meetingNumber) return a.meetingNumber - b.meetingNumber;
        return a.order - b.order;
      }),
    [course.topics]
  );

  const validTopicIds = useMemo(
    () => new Set(sortedTopics.map((t) => t.id)),
    [sortedTopics]
  );

  const peerProjects = course.peerProjects || [];
  const contentBlocks = course.contentBlocks || [];

  const getItemsForSection = (sectionTopicId?: string) => {
    const matchesTopic = (itemTopicId?: string) => {
      if (!sectionTopicId) {
        return !itemTopicId || !validTopicIds.has(itemTopicId);
      }
      return itemTopicId === sectionTopicId;
    };

    const blocks = contentBlocks.filter((b) => matchesTopic(b.topicId));
    const materials = course.materials.filter((m) => matchesTopic(m.topicId));
    const videos = course.videos.filter((v) => matchesTopic(v.topicId));
    const assignments = course.assignments.filter((a) => matchesTopic(a.topicId));
    const projects = peerProjects.filter((p) => matchesTopic(p.topicId));
    const sectionExams = linkedExams.filter((ex) => matchesTopic(ex.topicId));

    const totalCount =
      blocks.length +
      materials.length +
      videos.length +
      assignments.length +
      projects.length +
      sectionExams.length;

    return { blocks, materials, videos, assignments, projects, sectionExams, totalCount };
  };

  const toggleSectionCollapse = (key: string) => {
    setCollapsedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const setAllSectionsCollapsed = (collapsed: boolean) => {
    const next: Record<string, boolean> = { general: collapsed };
    sortedTopics.forEach((t) => {
      next[t.id] = collapsed;
    });
    setCollapsedSections(next);
  };

  const scrollToSection = (key: string) => {
    setCollapsedSections((prev) => ({ ...prev, [key]: false }));
    setTimeout(() => {
      const el = document.getElementById(`moodle-section-${key}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 60);
  };

  // =========================================================================
  // MODAL OPENERS WITH TOPIC PREFILL
  // =========================================================================
  const openCreateTopicModal = () => {
    const nextMeeting =
      sortedTopics.length > 0
        ? Math.max(...sortedTopics.map((t) => t.meetingNumber)) + 1
        : 1;
    setEditingTopic(null);
    setTopicMeetingNumber(nextMeeting);
    setTopicTitle('');
    setTopicSummary('');
    setTopicError('');
    setIsTopicModalOpen(true);
  };

  const openEditTopicModal = (topic: CourseTopic) => {
    setEditingTopic(topic);
    setTopicMeetingNumber(topic.meetingNumber);
    setTopicTitle(topic.title);
    setTopicSummary(topic.summary || '');
    setTopicError('');
    setIsTopicModalOpen(true);
  };

  const openAddBlockModal = (targetTopicId?: string) => {
    setEditingBlock(null);
    setBlockTopicId(targetTopicId || '');
    setBlockTitle('');
    setBlockText('');
    setBlockImageFile(null);
    if (blockImagePreviewUrl) URL.revokeObjectURL(blockImagePreviewUrl);
    setBlockImagePreviewUrl(null);
    setBlockRemoveExistingImg(false);
    setBlockImageCaption('');
    setBlockUploadProgress(0);
    setBlockError('');
    setIsBlockModalOpen(true);
  };

  const openEditBlockModal = (blk: CourseContentBlock) => {
    setEditingBlock(blk);
    setBlockTopicId(blk.topicId || '');
    setBlockTitle(blk.title || '');
    setBlockText(blk.textContent || '');
    setBlockImageFile(null);
    if (blockImagePreviewUrl) URL.revokeObjectURL(blockImagePreviewUrl);
    setBlockImagePreviewUrl(null);
    setBlockRemoveExistingImg(false);
    setBlockImageCaption(blk.imageCaption || '');
    setBlockUploadProgress(0);
    setBlockError('');
    setIsBlockModalOpen(true);
  };

  const openAddMaterialModal = (targetTopicId?: string) => {
    setMatTopicId(targetTopicId || '');
    setMatTitle('');
    setMatDescription('');
    setMatSelectedFile(null);
    setMatExternalUrl('');
    setMatFormError('');
    setMatUploadProgress(0);
    setIsAddMaterialOpen(true);
  };

  const openCreateAssignmentModal = (targetTopicId?: string) => {
    setEditingAssignment(null);
    setAssTopicId(targetTopicId || '');
    setAssTitle('');
    setAssInstructions('');
    setAssOpenDate(toLocalDateTimeInput(new Date()));
    setAssDueDate(toLocalDateTimeInput(new Date(Date.now() + 7 * 86400000)));
    setAssLockAfterDeadline(true);
    setAssMaxPoints(100);
    setAssGradingComponentId('');
    setAssAttachmentFile(null);
    setAssUploadProgress(0);
    setAssFormError('');
    setIsAddAssignmentOpen(true);
  };

  const openEditAssignmentModal = (ass: CourseAssignment) => {
    setEditingAssignment(ass);
    setAssTopicId(ass.topicId || '');
    setAssTitle(ass.title);
    setAssInstructions(ass.instructions);
    setAssOpenDate(toLocalDateTimeInput(ass.openDate || ass.createdAt));
    setAssDueDate(toLocalDateTimeInput(ass.dueDate));
    setAssLockAfterDeadline(ass.lockAfterDeadline !== false);
    setAssMaxPoints(ass.maxPoints);
    setAssGradingComponentId(ass.gradingComponentId || '');
    setAssAttachmentFile(null);
    setAssUploadProgress(0);
    setAssFormError('');
    setIsAddAssignmentOpen(true);
  };

  const openAddVideoModal = (targetTopicId?: string) => {
    setVidTopicId(targetTopicId || '');
    setVidTitle('');
    setVidUrl('');
    setVidDescription('');
    setVidFormError('');
    setIsAddVideoOpen(true);
  };

  const openCreatePeerProjectModal = (targetTopicId?: string) => {
    setEditingPeerProject(null);
    setPeerModalTopicId(targetTopicId || '');
    setIsPeerModalOpen(true);
  };

  const openEditPeerProjectModal = (proj: PeerProjectAssignment) => {
    setEditingPeerProject(proj);
    setPeerModalTopicId(proj.topicId || '');
    setIsPeerModalOpen(true);
  };

  const openCreateExamModal = (targetTopicId?: string) => {
    setExamToEdit(null);
    setExamModalDefaultTopicId(targetTopicId || '');
    setIsExamModalOpen(true);
  };

  const openEditExamModal = (exam: Exam) => {
    setExamToEdit(exam);
    setExamModalDefaultTopicId(exam.topicId || '');
    setIsExamModalOpen(true);
  };

  const openPlaceExamModal = (targetTopicId?: string) => {
    setPlaceExamModalTopicId(targetTopicId || undefined);
    setPlaceExamSearch('');
    setPlaceExamShowAllSystem(false);
    setIsPlaceExamModalOpen(true);
  };

  const handleMoveExamToTopic = async (exam: Exam, targetTopicId?: string) => {
    setPlacingExamId(exam.id);
    try {
      const normalizedTopicId = targetTopicId?.trim() ? targetTopicId.trim() : undefined;
      await assignExamToTopic(exam.id, {
        courseId: course.id,
        courseCode: course.code,
        courseName: course.name,
        topicId: normalizedTopicId,
      });
      const targetTopic = normalizedTopicId
        ? sortedTopics.find((t) => t.id === normalizedTopicId)
        : undefined;
      showToast(
        'success',
        targetTopic
          ? `"${exam.title}" ditempatkan pada Pertemuan ${targetTopic.meetingNumber}: ${targetTopic.title}.`
          : `"${exam.title}" dipindahkan ke bagian Umum & Pengantar.`
      );
    } catch (err: any) {
      showToast('error', err?.message || 'Gagal memperbarui penempatan ujian ke pertemuan.');
    } finally {
      setPlacingExamId(null);
    }
  };

  // =========================================================================
  // SUBMIT HANDLERS
  // =========================================================================
  const handleTopicSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTopicError('');
    if (!topicTitle.trim()) {
      setTopicError('Judul pertemuan atau topik bahasan wajib diisi.');
      return;
    }

    setTopicSaving(true);
    try {
      const meetNum = Math.max(1, Number(topicMeetingNumber) || 1);
      if (editingTopic) {
        await updateCourseTopic(course.id, {
          ...editingTopic,
          meetingNumber: meetNum,
          order: meetNum,
          title: topicTitle.trim(),
          summary: topicSummary.trim(),
        });
        showToast('success', `Pertemuan ${meetNum} ("${topicTitle.trim()}") berhasil diperbarui.`);
      } else {
        await addCourseTopic(course.id, {
          meetingNumber: meetNum,
          order: meetNum,
          title: topicTitle.trim(),
          summary: topicSummary.trim(),
        });
        showToast('success', `Pertemuan ${meetNum} ("${topicTitle.trim()}") berhasil ditambahkan.`);
      }
      setIsTopicModalOpen(false);
    } catch (err: any) {
      setTopicError(err?.message || 'Gagal menyimpan topik pertemuan.');
    } finally {
      setTopicSaving(false);
    }
  };

  const handleBlockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBlockError('');

    const hasExistingImg = Boolean(editingBlock?.imageFileId || editingBlock?.imageUrl) && !blockRemoveExistingImg;
    const willHaveImage = Boolean(blockImageFile) || hasExistingImg;

    if (!blockTitle.trim() && !blockText.trim() && !willHaveImage) {
      setBlockError('Isi minimal judul, teks materi, atau unggah satu gambar.');
      return;
    }

    if (blockImageFile && blockImageFile.size > MAX_UPLOAD_FILE_BYTES) {
      setBlockError('Ukuran gambar melebihi batas maksimum 10 MB.');
      return;
    }

    setBlockUploading(true);
    setBlockUploadProgress(0);

    try {
      let imageFields: Partial<CourseContentBlock> = {};

      if (blockImageFile) {
        const uploaded = await uploadFileToFirestore(
          blockImageFile,
          {
            scope: 'course_material',
            scopeId: course.id,
            uploadedBy: currentUser?.name || 'Dosen Pengampu',
          },
          (pct) => setBlockUploadProgress(pct)
        );
        imageFields = {
          imageFileId: uploaded.fileId,
          imageUrl: uploaded.fileUrl,
          imageFileName: uploaded.fileName,
          imageMimeType: uploaded.mimeType,
          imageCaption: blockImageCaption.trim() || undefined,
        };
      } else if (hasExistingImg && editingBlock) {
        imageFields = {
          imageFileId: editingBlock.imageFileId,
          imageUrl: editingBlock.imageUrl,
          imageFileName: editingBlock.imageFileName,
          imageMimeType: editingBlock.imageMimeType,
          imageCaption: blockImageCaption.trim() || undefined,
        };
      }

      const targetTopicId = blockTopicId || undefined;

      if (editingBlock) {
        await updateTopicBlock(course.id, {
          ...editingBlock,
          topicId: targetTopicId,
          title: blockTitle.trim() || undefined,
          textContent: blockText.trim() || undefined,
          imageFileId: imageFields.imageFileId,
          imageUrl: imageFields.imageUrl,
          imageFileName: imageFields.imageFileName,
          imageMimeType: imageFields.imageMimeType,
          imageCaption: imageFields.imageCaption,
        });
        showToast('success', 'Konten teks & gambar berhasil diperbarui.');
      } else {
        await addTopicBlock(course.id, {
          topicId: targetTopicId,
          title: blockTitle.trim() || undefined,
          textContent: blockText.trim() || undefined,
          ...imageFields,
          createdBy: currentUser?.name || 'Dosen Pengampu',
        });
        showToast('success', 'Konten teks / gambar berhasil ditambahkan ke halaman kuliah.');
      }

      setIsBlockModalOpen(false);
    } catch (err: any) {
      setBlockError(err?.message || 'Gagal menyimpan konten teks / gambar.');
    } finally {
      setBlockUploading(false);
    }
  };

  const handleAddMaterialSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMatFormError('');

    if (!matTitle.trim()) {
      setMatFormError('Judul materi wajib diisi.');
      return;
    }

    const targetTopicId = matTopicId || undefined;

    if (matUploadMode === 'file') {
      if (!matSelectedFile) {
        setMatFormError('Silakan pilih berkas file (PDF, PPT, DOC, XLS, ZIP, atau Gambar) dari perangkat Anda.');
        return;
      }
      if (matSelectedFile.size > MAX_UPLOAD_FILE_BYTES) {
        setMatFormError(
          `Ukuran file (${formatFileSize(matSelectedFile.size)}) melebihi batas maksimum 10 MB.`
        );
        return;
      }

      setMatUploading(true);
      setMatUploadProgress(5);
      try {
        const uploaded = await uploadFileToFirestore(
          matSelectedFile,
          {
            scope: 'course_material',
            scopeId: course.id,
            uploadedBy: currentUser?.name || 'Dosen Pengampu',
          },
          (pct) => setMatUploadProgress(pct)
        );

        await addMaterial(course.id, {
          topicId: targetTopicId,
          title: matTitle.trim(),
          description: matDescription.trim(),
          fileType: uploaded.fileType,
          fileName: uploaded.fileName,
          fileId: uploaded.fileId,
          fileUrl: uploaded.fileUrl,
          mimeType: uploaded.mimeType,
          fileSize: uploaded.fileSizeLabel,
          sizeBytes: uploaded.sizeBytes,
          uploadedBy: currentUser?.name || 'Dosen Pengampu',
        });

        setIsAddMaterialOpen(false);
        showToast('success', `Berkas "${uploaded.fileName}" berhasil diunggah ke Firebase.`);
      } catch (err: any) {
        setMatFormError(err?.message || 'Gagal mengunggah file materi.');
      } finally {
        setMatUploading(false);
      }
    } else {
      const cleanUrl = matExternalUrl.trim();
      if (!cleanUrl || (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://'))) {
        setMatFormError('Masukkan tautan URL yang valid diawali https:// atau http://');
        return;
      }

      setMatUploading(true);
      try {
        await addMaterial(course.id, {
          topicId: targetTopicId,
          title: matTitle.trim(),
          description: matDescription.trim(),
          fileType: 'link',
          fileName: matTitle.trim(),
          fileUrl: cleanUrl,
          fileSize: 'Tautan Cloud',
          uploadedBy: currentUser?.name || 'Dosen Pengampu',
        });

        setIsAddMaterialOpen(false);
        showToast('success', 'Tautan materi kuliah berhasil disimpan ke Firebase.');
      } catch (err: any) {
        setMatFormError(err?.message || 'Gagal menyimpan tautan materi.');
      } finally {
        setMatUploading(false);
      }
    }
  };

  const handleDownloadFile = async (params: {
    id: string;
    fileId?: string;
    fileUrl?: string;
    fileName: string;
    mimeType?: string;
  }) => {
    setDownloadingId(params.id);
    try {
      await downloadFileResource({
        fileId: params.fileId,
        fileUrl: params.fileUrl,
        fileName: params.fileName,
        mimeType: params.mimeType,
      });
      showToast('success', `Berhasil mengunduh "${params.fileName}".`);
    } catch (err: any) {
      showToast('error', err?.message || 'Gagal mengunduh file.');
    } finally {
      setDownloadingId(null);
    }
  };

  const handlePreviewMaterial = async (mat: CourseMaterial) => {
    if (!mat.fileId) return;
    setPreviewLoadingId(mat.id);
    try {
      const { blob, fileName, mimeType } = await fetchStoredFileBlob(
        mat.fileId,
        mat.fileName,
        mat.mimeType
      );
      const objectUrl = URL.createObjectURL(blob);
      setPreviewFile({
        title: mat.title,
        fileName,
        mimeType,
        objectUrl,
      });
    } catch (err: any) {
      showToast('error', err?.message || 'Gagal membuka pratinjau file.');
    } finally {
      setPreviewLoadingId(null);
    }
  };

  const getAssignmentAccessState = (ass: CourseAssignment) => {
    const openMs = ass.openDate ? new Date(ass.openDate).getTime() : 0;
    const dueMs = new Date(ass.dueDate).getTime();
    const lockAfter = ass.lockAfterDeadline !== false;
    const hasNotOpened = Boolean(ass.openDate && nowMs < openMs);
    const isPastDeadline = nowMs > dueMs;
    const isLocked = hasNotOpened || (isPastDeadline && lockAfter);
    const remainingMs = dueMs - nowMs;
    const untilOpenMs = openMs - nowMs;

    return {
      openMs,
      dueMs,
      lockAfter,
      hasNotOpened,
      isPastDeadline,
      isLocked,
      remainingMs,
      untilOpenMs,
    };
  };

  const handleAddAssignmentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAssFormError('');
    if (!assGradingComponentId || !selectedAssGradingComp) {
      setAssFormError(
        'Anda harus memilih Komponen & Grup Penilaian terlebih dahulu sebelum menerbitkan tugas.'
      );
      return;
    }
    if (!assTitle.trim()) {
      setAssFormError('Judul tugas wajib diisi.');
      return;
    }

    const parsedDue = new Date(assDueDate);
    if (Number.isNaN(parsedDue.getTime())) {
      setAssFormError('Tenggat waktu pengumpulan wajib diisi dengan benar.');
      return;
    }

    const parsedOpen = assOpenDate ? new Date(assOpenDate) : new Date();
    if (!Number.isNaN(parsedOpen.getTime()) && parsedDue.getTime() <= parsedOpen.getTime()) {
      setAssFormError('Tenggat akhir pengumpulan harus lebih lambat dari jadwal mulai dibuka.');
      return;
    }

    if (assAttachmentFile && assAttachmentFile.size > MAX_UPLOAD_FILE_BYTES) {
      setAssFormError('Ukuran lampiran tugas melebihi batas maksimum 10 MB.');
      return;
    }

    setAssUploading(true);
    setAssUploadProgress(0);

    try {
      let attachmentFields: Partial<CourseAssignment> = editingAssignment
        ? {
            attachmentFileId: editingAssignment.attachmentFileId,
            attachmentFileName: editingAssignment.attachmentFileName,
            attachmentFileSize: editingAssignment.attachmentFileSize,
            attachmentMimeType: editingAssignment.attachmentMimeType,
            attachmentFileUrl: editingAssignment.attachmentFileUrl,
          }
        : {};

      if (assAttachmentFile) {
        const uploaded = await uploadFileToFirestore(
          assAttachmentFile,
          {
            scope: 'assignment_attachment',
            scopeId: course.id,
            uploadedBy: currentUser?.name || 'Dosen Pengampu',
          },
          (pct) => setAssUploadProgress(pct)
        );
        attachmentFields = {
          attachmentFileId: uploaded.fileId,
          attachmentFileName: uploaded.fileName,
          attachmentFileSize: uploaded.fileSizeLabel,
          attachmentMimeType: uploaded.mimeType,
          attachmentFileUrl: uploaded.fileUrl,
        };
      }

      const targetTopicId = assTopicId || undefined;

      if (editingAssignment) {
        await updateAssignment(course.id, {
          ...editingAssignment,
          topicId: targetTopicId,
          title: assTitle.trim(),
          instructions: assInstructions.trim(),
          openDate: parsedOpen.toISOString(),
          dueDate: parsedDue.toISOString(),
          lockAfterDeadline: assLockAfterDeadline,
          maxPoints: Number(assMaxPoints) || 100,
          gradingGroupId: selectedAssGradingComp.groupId,
          gradingComponentId: selectedAssGradingComp.id,
          gradingComponentName: selectedAssGradingComp.name,
          ...attachmentFields,
        });
        showToast('success', 'Pengaturan slot tugas & tenggat waktu berhasil diperbarui.');
      } else {
        await addAssignment(course.id, {
          topicId: targetTopicId,
          title: assTitle.trim(),
          instructions: assInstructions.trim(),
          openDate: parsedOpen.toISOString(),
          dueDate: parsedDue.toISOString(),
          lockAfterDeadline: assLockAfterDeadline,
          maxPoints: Number(assMaxPoints) || 100,
          gradingGroupId: selectedAssGradingComp.groupId,
          gradingComponentId: selectedAssGradingComp.id,
          gradingComponentName: selectedAssGradingComp.name,
          ...attachmentFields,
        });
        showToast('success', 'Slot tugas kuliah berhasil diterbitkan.');
      }

      setEditingAssignment(null);
      setIsAddAssignmentOpen(false);
    } catch (err: any) {
      setAssFormError(err?.message || 'Gagal menyimpan slot tugas.');
    } finally {
      setAssUploading(false);
    }
  };

  const handleAddVideoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setVidFormError('');
    const id = extractYouTubeId(vidUrl);
    if (!vidTitle.trim() || !id) {
      setVidFormError('Masukkan link YouTube yang valid (contoh: https://www.youtube.com/watch?v=...)');
      return;
    }

    try {
      await addVideo(course.id, {
        topicId: vidTopicId || undefined,
        title: vidTitle.trim(),
        youtubeUrl: vidUrl.trim(),
        youtubeVideoId: id,
        description: vidDescription.trim(),
      });

      setIsAddVideoOpen(false);
      showToast('success', 'Video pembelajaran berhasil ditambahkan.');
    } catch (err: any) {
      setVidFormError(err?.message || 'Gagal menambahkan video.');
    }
  };

  const updateDraft = (
    assignmentId: string,
    patch: Partial<{
      fileObj: File | null;
      notes: string;
      error: string;
      uploading: boolean;
      progress: number;
    }>
  ) => {
    setSubmissionDrafts((prev) => {
      const current = prev[assignmentId] || {
        fileObj: null,
        notes: '',
        error: '',
        uploading: false,
        progress: 0,
      };
      return {
        ...prev,
        [assignmentId]: { ...current, ...patch },
      };
    });
  };

  const handleInlineStudentSubmit = async (e: React.FormEvent, ass: CourseAssignment) => {
    e.preventDefault();
    if (!currentUser) return;

    const draft = submissionDrafts[ass.id] || {
      fileObj: null,
      notes: '',
      error: '',
      uploading: false,
      progress: 0,
    };

    updateDraft(ass.id, { error: '' });

    const liveNow = Date.now();
    if (ass.openDate && liveNow < new Date(ass.openDate).getTime()) {
      updateDraft(ass.id, {
        error: 'Slot pengumpulan tugas ini belum dibuka sesuai jadwal yang ditentukan dosen.',
      });
      return;
    }
    if (ass.lockAfterDeadline !== false && liveNow > new Date(ass.dueDate).getTime()) {
      updateDraft(ass.id, {
        error: 'Tenggat waktu telah berakhir. Slot pengumpulan tugas sudah terkunci otomatis.',
      });
      return;
    }

    const existingSub = ass.submissions.find((s) => s.studentId === currentUser.id);
    if (!draft.fileObj && !existingSub?.fileId) {
      updateDraft(ass.id, {
        error: 'Silakan pilih berkas file tugas dari perangkat Anda terlebih dahulu.',
      });
      return;
    }

    if (draft.fileObj && draft.fileObj.size > MAX_UPLOAD_FILE_BYTES) {
      updateDraft(ass.id, {
        error: `Ukuran file (${formatFileSize(draft.fileObj.size)}) melebihi batas maksimum 10 MB.`,
      });
      return;
    }

    updateDraft(ass.id, { uploading: true, progress: 5 });

    try {
      let fileId = existingSub?.fileId;
      let fileUrl = existingSub?.fileUrl;
      let mimeType = existingSub?.mimeType;
      let fileSize = existingSub?.fileSize;
      let sizeBytes = existingSub?.sizeBytes;
      let finalFileName = draft.fileObj?.name || existingSub?.fileName || 'Tugas.pdf';

      if (draft.fileObj) {
        const uploaded = await uploadFileToFirestore(
          draft.fileObj,
          {
            scope: 'assignment_submission',
            scopeId: `${course.id}_${ass.id}_${currentUser.id}`,
            uploadedBy: currentUser.name,
          },
          (pct) => updateDraft(ass.id, { progress: pct })
        );
        fileId = uploaded.fileId;
        fileUrl = uploaded.fileUrl;
        mimeType = uploaded.mimeType;
        fileSize = uploaded.fileSizeLabel;
        sizeBytes = uploaded.sizeBytes;
        finalFileName = uploaded.fileName;
      }

      await submitAssignment(course.id, ass.id, {
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
        notes: draft.notes.trim(),
      });

      updateDraft(ass.id, {
        fileObj: null,
        notes: '',
        error: '',
        uploading: false,
        progress: 0,
      });
      showToast('success', `Berkas tugas "${finalFileName}" berhasil dikumpulkan.`);
    } catch (err: any) {
      updateDraft(ass.id, {
        uploading: false,
        progress: 0,
        error: err?.message || 'Gagal mengunggah berkas tugas.',
      });
    }
  };

  const handleGradeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!liveAssignmentForGrading || !gradingSubmission) return;

    try {
      await gradeAssignmentSubmission(
        course.id,
        liveAssignmentForGrading.id,
        gradingSubmission.id,
        Number(gradeInput),
        feedbackInput.trim()
      );
      setGradingSubmission(null);
      showToast('success', `Nilai untuk ${gradingSubmission.studentName} berhasil disimpan.`);
    } catch (err: any) {
      showToast('error', err?.message || 'Gagal menyimpan nilai tugas.');
    }
  };

  const handleExecuteDelete = async () => {
    if (!deleteConfirm) return;
    setIsDeleting(true);
    try {
      if (deleteConfirm.type === 'material') {
        await deleteMaterial(course.id, deleteConfirm.id);
      } else if (deleteConfirm.type === 'assignment') {
        await deleteAssignment(course.id, deleteConfirm.id);
      } else if (deleteConfirm.type === 'video') {
        await deleteVideo(course.id, deleteConfirm.id);
      } else if (deleteConfirm.type === 'topic') {
        await deleteCourseTopic(course.id, deleteConfirm.id);
      } else if (deleteConfirm.type === 'block') {
        await deleteTopicBlock(course.id, deleteConfirm.id);
      } else if (deleteConfirm.type === 'peer_project') {
        await deletePeerProject(course.id, deleteConfirm.id);
      } else if (deleteConfirm.type === 'exam') {
        await deleteExam(deleteConfirm.id);
      }
      showToast('success', `"${deleteConfirm.title}" berhasil dihapus.`);
      setDeleteConfirm(null);
    } catch (err: any) {
      showToast('error', err?.message || 'Gagal menghapus data.');
    } finally {
      setIsDeleting(false);
    }
  };

  const getFileBadgeMeta = (fileType: StoredFileType) => {
    switch (fileType) {
      case 'pdf':
        return { label: 'PDF', cls: 'bg-rose-50 text-rose-600 border-rose-200' };
      case 'ppt':
      case 'pptx':
        return { label: 'PPT', cls: 'bg-amber-50 text-amber-700 border-amber-200' };
      case 'doc':
      case 'docx':
        return { label: 'DOC', cls: 'bg-blue-50 text-blue-700 border-blue-200' };
      case 'xls':
      case 'xlsx':
        return { label: 'XLS', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
      case 'zip':
        return { label: 'ZIP', cls: 'bg-purple-50 text-purple-700 border-purple-200' };
      case 'image':
        return { label: 'IMG', cls: 'bg-cyan-50 text-cyan-700 border-cyan-200' };
      case 'link':
        return { label: 'URL', cls: 'bg-indigo-50 text-indigo-700 border-indigo-200' };
      default:
        return { label: 'FILE', cls: 'bg-slate-100 text-slate-700 border-slate-200' };
    }
  };

  const canPreviewInApp = (mat: CourseMaterial) => {
    if (!mat.fileId) return false;
    return mat.fileType === 'pdf' || mat.fileType === 'image';
  };

  const hasValidDownload = (mat: CourseMaterial) => {
    if (mat.fileId) return true;
    if (mat.fileUrl && mat.fileUrl !== '#') return true;
    return false;
  };

  // =========================================================================
  // RENDER HELPERS FOR MOODLE TOPIC ITEMS
  // =========================================================================
  const renderAssignmentWorkspace = (ass: CourseAssignment) => {
    const {
      hasNotOpened,
      isPastDeadline,
      lockAfter,
      isLocked,
      remainingMs,
      untilOpenMs,
    } = getAssignmentAccessState(ass);

    const isClosingSoon = !isLocked && !isPastDeadline && remainingMs <= 24 * 3600 * 1000;
    const studentSubmission = ass.submissions.find((s) => s.studentId === currentUser?.id);
    const draft = submissionDrafts[ass.id] || {
      fileObj: null,
      notes: '',
      error: '',
      uploading: false,
      progress: 0,
    };

    const gradedCount = ass.submissions.filter((s) => s.grade !== undefined).length;
    const pendingCount = ass.submissions.length - gradedCount;

    return (
      <div
        key={ass.id}
        className="w-full bg-white rounded-xl border border-slate-200 overflow-hidden"
      >
        {/* Full-Width Slot Header */}
        <div className="px-5 py-4 bg-slate-50/70 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="space-y-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-1.5 font-bold text-indigo-700">
                <ClipboardList className="w-3.5 h-3.5" />
                <span>Tugas Kuliah</span>
              </span>
              <span aria-hidden="true" className="text-slate-300">·</span>
              {hasNotOpened ? (
                <span className="inline-flex items-center gap-1 font-bold text-amber-700">
                  <Lock className="w-3 h-3" />
                  <span>Belum Dibuka</span>
                </span>
              ) : isLocked ? (
                <span className="inline-flex items-center gap-1 font-bold text-rose-700">
                  <Lock className="w-3 h-3" />
                  <span>Terkunci Otomatis</span>
                </span>
              ) : isPastDeadline ? (
                <span className="inline-flex items-center gap-1 font-bold text-amber-700">
                  <AlertTriangle className="w-3 h-3" />
                  <span>Terlambat (Masih Dibuka)</span>
                </span>
              ) : isClosingSoon ? (
                <span className="inline-flex items-center gap-1 font-bold text-amber-700">
                  <Clock className="w-3 h-3" />
                  <span>Segera Berakhir</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 font-bold text-emerald-700">
                  <Unlock className="w-3 h-3" />
                  <span>Terbuka</span>
                </span>
              )}
              <span aria-hidden="true" className="text-slate-300">·</span>
              <span className="font-mono tabular-nums text-slate-600">
                Maks {ass.maxPoints} Poin
              </span>
              <span aria-hidden="true" className="text-slate-300">·</span>
              <span className="font-mono tabular-nums text-slate-600">
                {ass.submissions.length} Terkumpul
              </span>
              {ass.gradingComponentName && (
                <>
                  <span aria-hidden="true" className="text-slate-300">·</span>
                  <span className="font-semibold text-indigo-700">
                    Komponen: {ass.gradingComponentName}
                  </span>
                </>
              )}
            </div>

            <h4 className="text-base font-bold text-slate-900 leading-snug">{ass.title}</h4>
          </div>

          {isTeacherOrAdmin && (
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => openEditAssignmentModal(ass)}
                className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>Edit</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  setDeleteConfirm({
                    type: 'assignment',
                    id: ass.id,
                    title: ass.title,
                  })
                }
                className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-rose-600 hover:border-rose-200 hover:bg-rose-50 transition-colors"
                title="Hapus Slot Tugas"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* 4-Column Deadline Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-200 border-b border-slate-200 bg-white text-xs">
          <div className="p-3.5 space-y-0.5">
            <div className="text-[11px] font-semibold text-slate-500 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>Dibuka</span>
            </div>
            <div className="font-mono tabular-nums font-bold text-slate-800">
              {formatFullIndonesianDateTime(ass.openDate || ass.createdAt)}
            </div>
          </div>

          <div className="p-3.5 space-y-0.5">
            <div className="text-[11px] font-semibold text-slate-500 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>Tenggat Akhir</span>
            </div>
            <div
              className={`font-mono tabular-nums font-bold ${
                isPastDeadline ? 'text-rose-700' : 'text-slate-900'
              }`}
            >
              {formatFullIndonesianDateTime(ass.dueDate)}
            </div>
          </div>

          <div className="p-3.5 space-y-0.5">
            <div className="text-[11px] font-semibold text-slate-500 flex items-center gap-1.5">
              {isLocked ? (
                <Lock className="w-3.5 h-3.5 text-rose-600" />
              ) : (
                <Clock className="w-3.5 h-3.5 text-emerald-600" />
              )}
              <span>Sisa Waktu</span>
            </div>
            <div
              className={`font-mono tabular-nums font-bold ${
                hasNotOpened
                  ? 'text-amber-700'
                  : isLocked
                  ? 'text-rose-700'
                  : isClosingSoon
                  ? 'text-amber-700'
                  : 'text-emerald-700'
              }`}
            >
              {hasNotOpened
                ? `Dibuka dalam ${formatDurationHuman(untilOpenMs)}`
                : isPastDeadline
                ? `Lewat ${formatDurationHuman(nowMs - new Date(ass.dueDate).getTime())}`
                : `Tersisa ${formatDurationHuman(remainingMs)}`}
            </div>
          </div>

          <div className="p-3.5 space-y-0.5">
            <div className="text-[11px] font-semibold text-slate-500 flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-slate-400" />
              <span>Kebijakan Akses</span>
            </div>
            <div className="font-semibold text-slate-800">
              {lockAfter ? 'Kunci otomatis saat tenggat' : 'Terima terlambat'}
            </div>
          </div>
        </div>

        {/* Workspace Body */}
        <div className="grid grid-cols-1 xl:grid-cols-12 items-stretch">
          <div className="xl:col-span-7 p-5 space-y-4 xl:border-r border-slate-200 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                Keterangan &amp; Instruksi Tugas
              </div>
              <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-line bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/80">
                {ass.instructions || 'Tidak ada catatan tambahan untuk tugas ini.'}
              </div>
            </div>

            {ass.attachmentFileId && ass.attachmentFileName && (
              <div className="pt-3 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center shrink-0">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-900">Lampiran Soal / Template</div>
                    <div className="text-[11px] font-mono text-slate-500 truncate">
                      {ass.attachmentFileName}
                      {ass.attachmentFileSize ? ` · ${ass.attachmentFileSize}` : ''}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={downloadingId === ass.id}
                  onClick={() =>
                    handleDownloadFile({
                      id: ass.id,
                      fileId: ass.attachmentFileId,
                      fileUrl: ass.attachmentFileUrl,
                      fileName: ass.attachmentFileName || 'lampiran_tugas',
                      mimeType: ass.attachmentMimeType,
                    })
                  }
                  className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs transition-colors disabled:opacity-60 whitespace-nowrap shrink-0"
                >
                  {downloadingId === ass.id ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Download className="w-3.5 h-3.5" />
                  )}
                  <span>Unduh Lampiran</span>
                </button>
              </div>
            )}
          </div>

          <div className="xl:col-span-5 p-5 bg-slate-50/70 flex flex-col justify-between space-y-4">
            {!isTeacherOrAdmin ? (
              <div className="space-y-3 flex-1 flex flex-col justify-between">
                {studentSubmission && (
                  <div className="bg-white p-3.5 rounded-xl border border-emerald-200 space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 text-emerald-800 font-bold text-xs">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>Sudah Terkumpul</span>
                      </div>
                      <span className="font-mono text-[11px] text-slate-500">
                        {studentSubmission.submissionStatus === 'terlambat'
                          ? 'Terlambat'
                          : 'Tepat Waktu'}
                      </span>
                    </div>

                    <div className="text-xs text-slate-600 space-y-1">
                      <div className="font-mono font-semibold text-slate-900 break-all">
                        {studentSubmission.fileName}
                        {studentSubmission.fileSize ? ` (${studentSubmission.fileSize})` : ''}
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono tabular-nums">
                        {formatFullIndonesianDateTime(studentSubmission.submittedAt)}
                      </div>
                    </div>

                    {studentSubmission.grade !== undefined && (
                      <div className="p-2.5 rounded-lg bg-blue-50 border border-blue-200 text-xs text-blue-900 space-y-0.5">
                        <div className="font-bold flex items-center gap-1.5">
                          <Award className="w-4 h-4 text-blue-700" />
                          <span className="font-mono tabular-nums">
                            Nilai: {studentSubmission.grade} / {ass.maxPoints}
                          </span>
                        </div>
                        {studentSubmission.feedback && (
                          <div className="text-[11px] text-blue-800">
                            Masukan Dosen: &ldquo;{studentSubmission.feedback}&rdquo;
                          </div>
                        )}
                      </div>
                    )}

                    {(studentSubmission.fileId ||
                      (studentSubmission.fileUrl && studentSubmission.fileUrl !== '#')) && (
                      <button
                        type="button"
                        disabled={downloadingId === studentSubmission.id}
                        onClick={() =>
                          handleDownloadFile({
                            id: studentSubmission.id,
                            fileId: studentSubmission.fileId,
                            fileUrl: studentSubmission.fileUrl,
                            fileName: studentSubmission.fileName,
                            mimeType: studentSubmission.mimeType,
                          })
                        }
                        className="w-full py-1.5 px-3 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Unduh Berkas Saya</span>
                      </button>
                    )}
                  </div>
                )}

                {isLocked ? (
                  <div className="bg-white p-4 rounded-xl border border-rose-200 space-y-2.5 my-auto">
                    <div className="flex items-center gap-2.5 text-rose-700">
                      <Lock className="w-4 h-4 shrink-0" />
                      <div className="font-bold text-xs text-rose-900">
                        {hasNotOpened
                          ? 'Slot Belum Dibuka'
                          : 'Slot Pengumpulan Terkunci Otomatis'}
                      </div>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      {hasNotOpened
                        ? `Pengumpulan baru dibuka pada ${formatFullIndonesianDateTime(ass.openDate)}.`
                        : 'Tenggat waktu telah berakhir sehingga unggah/ubah file dikunci otomatis.'}
                    </p>
                  </div>
                ) : (
                  <form
                    onSubmit={(e) => handleInlineStudentSubmit(e, ass)}
                    className="bg-white p-4 rounded-xl border border-slate-200 space-y-3 text-xs"
                  >
                    <div className="font-bold text-slate-900 flex items-center gap-2">
                      <Upload className="w-4 h-4 text-indigo-600 shrink-0" />
                      <span>{studentSubmission ? 'Perbarui Berkas Tugas' : 'Unggah Berkas Tugas'}</span>
                    </div>

                    {draft.error && (
                      <div className="p-2 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                        <span>{draft.error}</span>
                      </div>
                    )}

                    <label className="block border-2 border-dashed border-slate-300 hover:border-indigo-400 bg-slate-50 rounded-xl p-3 text-center cursor-pointer transition-colors">
                      <input
                        type="file"
                        disabled={draft.uploading}
                        accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.zip,.rar,.txt,.png,.jpg,.jpeg"
                        onChange={(e) => {
                          const file = e.target.files?.[0] || null;
                          updateDraft(ass.id, { fileObj: file, error: '' });
                        }}
                        className="hidden"
                      />
                      {draft.fileObj ? (
                        <div className="space-y-0.5">
                          <div className="font-bold text-indigo-700 break-all">{draft.fileObj.name}</div>
                          <div className="text-[11px] text-slate-500 font-mono">
                            {formatFileSize(draft.fileObj.size)}
                          </div>
                        </div>
                      ) : (
                        <div className="text-slate-600">
                          <span className="font-semibold">Pilih berkas (Maks. 10 MB)</span>
                        </div>
                      )}
                    </label>

                    <input
                      type="text"
                      disabled={draft.uploading}
                      placeholder="Catatan singkat (opsional)..."
                      value={draft.notes}
                      onChange={(e) => updateDraft(ass.id, { notes: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />

                    {draft.uploading && (
                      <div className="text-[11px] font-mono text-indigo-700 font-semibold">
                        Mengunggah... {draft.progress}%
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={draft.uploading || !draft.fileObj}
                      className="w-full py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>{studentSubmission ? 'Perbarui Tugas' : 'Kumpulkan Tugas'}</span>
                    </button>
                  </form>
                )}
              </div>
            ) : (
              <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3 flex-1 flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="font-bold text-slate-900 text-xs uppercase tracking-wide">
                    Ringkasan Pengumpulan
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                      <div className="text-base font-extrabold text-slate-900 font-mono tabular-nums">
                        {ass.submissions.length}
                      </div>
                      <div className="text-[11px] text-slate-500">Masuk</div>
                    </div>
                    <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200">
                      <div className="text-base font-extrabold text-emerald-700 font-mono tabular-nums">
                        {gradedCount}
                      </div>
                      <div className="text-[11px] text-emerald-700">Dinilai</div>
                    </div>
                    <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200">
                      <div className="text-base font-extrabold text-amber-700 font-mono tabular-nums">
                        {pendingCount}
                      </div>
                      <div className="text-[11px] text-amber-700">Belum</div>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveAssignmentToGrade(ass)}
                  className="w-full py-2 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors"
                >
                  <FileCheck className="w-4 h-4" />
                  <span>Lihat &amp; Nilai ({ass.submissions.length})</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderTopicStreamContent = (sectionTopicId?: string) => {
    const { blocks, materials, videos, assignments, projects, sectionExams } =
      getItemsForSection(sectionTopicId);

    const showBlocks =
      contentFilter === 'all' || contentFilter === 'materials_text';
    const showMaterials =
      contentFilter === 'all' || contentFilter === 'materials_text';
    const showTasksAndPeer =
      contentFilter === 'all' || contentFilter === 'tasks_peer';
    const showVideosAndExams =
      contentFilter === 'all' || contentFilter === 'videos_exams';

    const visibleBlocks = showBlocks ? blocks : [];
    const visibleMaterials = showMaterials ? materials : [];
    const visibleAssignments = showTasksAndPeer ? assignments : [];
    const visibleProjects = showTasksAndPeer ? projects : [];
    const visibleVideos = showVideosAndExams ? videos : [];
    const visibleExams = showVideosAndExams ? sectionExams : [];

    const visibleTotal =
      visibleBlocks.length +
      visibleMaterials.length +
      visibleAssignments.length +
      visibleProjects.length +
      visibleVideos.length +
      visibleExams.length;

    if (visibleTotal === 0) {
      return (
        <div className="py-6 px-4 text-center text-xs text-slate-400 italic">
          {contentFilter === 'all'
            ? 'Belum ada materi, teks/gambar, tugas, atau aktivitas pada bagian ini.'
            : 'Tidak ada item yang cocok dengan filter aktif pada bagian ini.'}
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {/* 1. Text & Image Blocks (Add Text / Gambar) */}
        {visibleBlocks.map((blk) => {
          const hasImage = Boolean(blk.imageFileId || blk.imageUrl);
          return (
            <article
              key={blk.id}
              className="bg-white rounded-xl border border-slate-200 p-5 space-y-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-slate-100 border border-slate-200 text-slate-600 flex items-center justify-center shrink-0">
                    {hasImage ? (
                      <ImageIcon className="w-3.5 h-3.5" />
                    ) : (
                      <TypeIcon className="w-3.5 h-3.5" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-bold text-slate-900 text-sm">
                      {blk.title || (hasImage ? 'Ilustrasi & Catatan Kuliah' : 'Catatan Pertemuan')}
                    </h4>
                  </div>
                </div>

                {isTeacherOrAdmin && (
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => openEditBlockModal(blk)}
                      className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg transition-colors"
                      title="Edit Teks / Gambar"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setDeleteConfirm({
                          type: 'block',
                          id: blk.id,
                          title: blk.title || 'Blok Teks / Gambar',
                        })
                      }
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg transition-colors"
                      title="Hapus Blok"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              {blk.textContent && (
                <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">
                  {blk.textContent}
                </div>
              )}

              {hasImage && (
                <figure className="space-y-1.5 pt-1">
                  <FirestoreImage
                    fileId={blk.imageFileId}
                    imageUrl={blk.imageUrl}
                    fileName={blk.imageFileName}
                    mimeType={blk.imageMimeType}
                    alt={blk.imageCaption || blk.title || 'Gambar Materi Kuliah'}
                    className="w-full max-h-[460px] object-contain rounded-xl bg-slate-50 border border-slate-200"
                  />
                  {blk.imageCaption && (
                    <figcaption className="text-xs text-slate-500 text-center italic">
                      {blk.imageCaption}
                    </figcaption>
                  )}
                </figure>
              )}
            </article>
          );
        })}

        {/* 2. Course Materials (Moodle File Resources List) */}
        {visibleMaterials.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-200 overflow-hidden">
            {visibleMaterials.map((mat) => {
              const badge = getFileBadgeMeta(mat.fileType);
              const downloadable = hasValidDownload(mat);
              const isDownloadingThis = downloadingId === mat.id;
              const isPreviewingThis = previewLoadingId === mat.id;

              return (
                <div
                  key={mat.id}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/70 transition-colors"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div
                      className={`w-10 h-10 rounded-lg flex items-center justify-center font-extrabold text-[11px] shrink-0 border ${badge.cls}`}
                    >
                      {badge.label}
                    </div>
                    <div className="min-w-0 space-y-0.5">
                      <div className="font-bold text-slate-900 text-sm">{mat.title}</div>
                      <div className="text-[11px] font-mono text-slate-500 truncate">
                        {mat.fileName}
                        {mat.fileSize ? ` · ${mat.fileSize}` : ''} · Oleh {mat.uploadedBy}
                      </div>
                      {mat.description && (
                        <p className="text-xs text-slate-600 pt-0.5">{mat.description}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                    {canPreviewInApp(mat) && (
                      <button
                        type="button"
                        onClick={() => handlePreviewMaterial(mat)}
                        disabled={isPreviewingThis}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 font-semibold text-xs transition-colors"
                      >
                        {isPreviewingThis ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Eye className="w-3.5 h-3.5" />
                        )}
                        <span>Lihat</span>
                      </button>
                    )}

                    {downloadable && (
                      <button
                        type="button"
                        onClick={() =>
                          handleDownloadFile({
                            id: mat.id,
                            fileId: mat.fileId,
                            fileUrl: mat.fileUrl,
                            fileName: mat.fileName,
                            mimeType: mat.mimeType,
                          })
                        }
                        disabled={isDownloadingThis}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 font-bold text-xs transition-colors disabled:opacity-60"
                      >
                        {isDownloadingThis ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : mat.fileType === 'link' ? (
                          <ExternalLink className="w-3.5 h-3.5" />
                        ) : (
                          <Download className="w-3.5 h-3.5" />
                        )}
                        <span>{mat.fileType === 'link' ? 'Buka' : 'Unduh'}</span>
                      </button>
                    )}

                    {isTeacherOrAdmin && (
                      <button
                        type="button"
                        onClick={() =>
                          setDeleteConfirm({
                            type: 'material',
                            id: mat.id,
                            title: mat.title,
                          })
                        }
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg transition-colors"
                        title="Hapus Materi"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* 3. Videos (Expandable / Inline YouTube Player) */}
        {visibleVideos.map((vid) => {
          const isPlayerOpen = expandedVideoIds[vid.id] !== false;
          return (
            <div
              key={vid.id}
              className="bg-white rounded-xl border border-slate-200 overflow-hidden"
            >
              <div className="px-4 py-3 bg-slate-50/70 border-b border-slate-200 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <Film className="w-4 h-4 text-rose-600 shrink-0" />
                  <div className="min-w-0">
                    <div className="font-bold text-slate-900 text-sm truncate">{vid.title}</div>
                    {vid.description && (
                      <div className="text-xs text-slate-500 truncate">{vid.description}</div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedVideoIds((prev) => ({
                        ...prev,
                        [vid.id]: !isPlayerOpen,
                      }))
                    }
                    className="px-2.5 py-1 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-xs font-semibold text-slate-700"
                  >
                    {isPlayerOpen ? 'Sembunyikan Player' : 'Putar Video'}
                  </button>
                  <a
                    href={vid.youtubeUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-rose-600 hover:underline font-semibold inline-flex items-center gap-1"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                  {isTeacherOrAdmin && (
                    <button
                      type="button"
                      onClick={() =>
                        setDeleteConfirm({
                          type: 'video',
                          id: vid.id,
                          title: vid.title,
                        })
                      }
                      className="p-1 text-slate-400 hover:text-rose-600 rounded-lg"
                      title="Hapus Video"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {isPlayerOpen && (
                <div className="relative aspect-video w-full max-w-3xl mx-auto bg-black my-3 rounded-lg overflow-hidden">
                  <iframe
                    src={`https://www.youtube.com/embed/${vid.youtubeVideoId}?rel=0&modestbranding=1`}
                    title={vid.title}
                    className="absolute inset-0 w-full h-full border-0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                  ></iframe>
                </div>
              )}
            </div>
          );
        })}

        {/* 4. Regular Assignments (Tugas Kuliah) */}
        {visibleAssignments.map((ass) => renderAssignmentWorkspace(ass))}

        {/* 5. Tugas Projek Mahasiswa (Peer Assessment) */}
        {visibleProjects.map((proj) => (
          <PeerProjectSection
            key={proj.id}
            course={course}
            project={proj}
            isTeacherOrAdmin={isTeacherOrAdmin}
            nowMs={nowMs}
            onEditProject={openEditPeerProjectModal}
            onDeleteProject={(p) =>
              setDeleteConfirm({
                type: 'peer_project',
                id: p.id,
                title: p.title,
              })
            }
            onToast={showToast}
          />
        ))}

        {/* 6. Linked Exams (Jadwal Ujian & Evaluasi Terhubung) */}
        {visibleExams.map((exam) => {
          const timeStatus = getExamTimeStatus(exam);
          const isOngoing = timeStatus.status === 'ongoing';
          const categoryLabel = getExamCategoryLabel(exam.examCategory);
          const studentAttempt = currentUser
            ? attempts.find((a) => a.examId === exam.id && a.studentId === currentUser.id)
            : undefined;
          const canSeeScore = Boolean(exam.showScoreImmediately || exam.isScorePublished);

          return (
            <div
              key={exam.id}
              className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:border-emerald-300 transition-colors"
            >
              <div className="space-y-1.5 min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-bold text-emerald-700 inline-flex items-center gap-1">
                    <GraduationCap className="w-3.5 h-3.5" />
                    {categoryLabel}
                  </span>
                  <span aria-hidden="true" className="text-slate-300">·</span>
                  <span
                    className={`font-bold ${
                      isOngoing
                        ? 'text-emerald-700'
                        : timeStatus.status === 'upcoming'
                        ? 'text-amber-700'
                        : 'text-slate-600'
                    }`}
                  >
                    {timeStatus.label}
                  </span>
                  <span aria-hidden="true" className="text-slate-300">·</span>
                  <span className="font-semibold text-blue-700">
                    {exam.scoringMethod === 'irt' ? `IRT ${exam.irtModel || '3PL'}` : 'Klasik'}
                  </span>
                  {exam.gradingComponentName && (
                    <>
                      <span aria-hidden="true" className="text-slate-300">·</span>
                      <span className="text-indigo-700 font-medium">{exam.gradingComponentName}</span>
                    </>
                  )}
                  <span aria-hidden="true" className="text-slate-300">·</span>
                  <span className="font-mono tabular-nums text-slate-600">
                    {exam.durationMinutes} Menit
                  </span>
                  <span aria-hidden="true" className="text-slate-300">·</span>
                  <span className="font-mono tabular-nums text-slate-600">
                    {exam.questions.length} Soal
                  </span>
                </div>
                <h4 className="text-base font-bold text-slate-900">{exam.title}</h4>
                <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 font-mono tabular-nums">
                  <span>Mulai: {new Date(exam.schedule.startTime).toLocaleString('id-ID')}</span>
                  <span>Selesai: {new Date(exam.schedule.endTime).toLocaleString('id-ID')}</span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                {currentUser?.role === 'mahasiswa' ? (
                  studentAttempt?.isCompleted ? (
                    <div className="px-3.5 py-2 rounded-xl bg-slate-100 border border-slate-200 text-xs font-bold text-slate-700 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      {canSeeScore ? (
                        <span className="font-mono tabular-nums">
                          Selesai · Nilai {Math.round(studentAttempt.percentage ?? studentAttempt.score ?? 0)}/100 (Terkunci)
                        </span>
                      ) : (
                        <span>Sudah Dikerjakan · Jawaban Terkunci</span>
                      )}
                    </div>
                  ) : isOngoing ? (
                    <div className="px-3.5 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800 flex items-center gap-2">
                      <Lock className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                      <span>Jadwal Aktif · Akses via Menu Dashboard &amp; Ujian</span>
                    </div>
                  ) : (
                    <div className="text-xs text-slate-500 font-medium">{timeStatus.message}</div>
                  )
                ) : (
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1">
                      <ArrowRightLeft className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <select
                        aria-label={`Pindah pertemuan untuk ${exam.title}`}
                        value={exam.topicId && validTopicIds.has(exam.topicId) ? exam.topicId : ''}
                        disabled={placingExamId === exam.id}
                        onChange={(e) =>
                          handleMoveExamToTopic(exam, e.target.value ? e.target.value : undefined)
                        }
                        className="bg-transparent text-xs font-semibold text-slate-700 focus:outline-none max-w-[190px] disabled:opacity-60"
                      >
                        <option value="">Umum / Pengantar</option>
                        {sortedTopics.map((t) => (
                          <option key={t.id} value={t.id}>
                            Pertemuan {t.meetingNumber}: {t.title}
                          </option>
                        ))}
                      </select>
                    </div>
                    <button
                      type="button"
                      onClick={() => openEditExamModal(exam)}
                      className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
                      title="Edit pengaturan ujian, jenis ujian, jadwal, IRT, atau pertemuan"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span>Edit Ujian</span>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setDeleteConfirm({
                          type: 'exam',
                          id: exam.id,
                          title: exam.title,
                        })
                      }
                      className="p-1.5 rounded-lg border border-slate-200 text-slate-400 hover:text-rose-600 hover:bg-rose-50 hover:border-rose-200 transition-colors"
                      title="Hapus Ujian"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderTopicAddToolbar = (targetTopicId?: string, labelSuffix?: string) => {
    if (!isTeacherOrAdmin) return null;
    return (
      <div className="px-5 py-3 bg-slate-50/90 border-t border-slate-200 flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-bold text-slate-500 mr-1">
          + Tambah{labelSuffix ? ` ke ${labelSuffix}` : ''}:
        </span>
        <button
          type="button"
          onClick={() => openAddBlockModal(targetTopicId)}
          className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
        >
          <ImageIcon className="w-3.5 h-3.5 text-slate-600" />
          <span>Teks / Gambar</span>
        </button>
        <button
          type="button"
          onClick={() => openAddMaterialModal(targetTopicId)}
          className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
        >
          <FileText className="w-3.5 h-3.5 text-blue-600" />
          <span>Materi File</span>
        </button>
        <button
          type="button"
          onClick={() => openCreateAssignmentModal(targetTopicId)}
          className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
        >
          <ClipboardList className="w-3.5 h-3.5 text-indigo-600" />
          <span>Tugas Kuliah</span>
        </button>
        <button
          type="button"
          onClick={() => openCreatePeerProjectModal(targetTopicId)}
          className="px-2.5 py-1.5 rounded-lg border border-indigo-300 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 text-xs font-bold inline-flex items-center gap-1.5 transition-colors"
        >
          <Users className="w-3.5 h-3.5 text-indigo-700" />
          <span>Tugas Projek Mahasiswa</span>
        </button>
        <button
          type="button"
          onClick={() => openAddVideoModal(targetTopicId)}
          className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
        >
          <Film className="w-3.5 h-3.5 text-rose-600" />
          <span>Video YouTube</span>
        </button>
        <button
          type="button"
          onClick={() => openCreateExamModal(targetTopicId)}
          className="px-2.5 py-1.5 rounded-lg border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold inline-flex items-center gap-1.5 transition-colors"
        >
          <GraduationCap className="w-3.5 h-3.5 text-emerald-700" />
          <span>Ujian Baru</span>
        </button>
        <button
          type="button"
          onClick={() => openPlaceExamModal(targetTopicId)}
          className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
        >
          <ArrowRightLeft className="w-3.5 h-3.5 text-emerald-600" />
          <span>Pilih / Atur Ujian</span>
        </button>
      </div>
    );
  };

  const generalItems = getItemsForSection(undefined);

  return (
    <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-10 py-6 space-y-6">
      {/* Toast Notification Banner */}
      {toast && (
        <div
          className={`p-3.5 rounded-xl border text-xs font-semibold flex items-center justify-between gap-3 ${
            toast.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {toast.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{toast.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="text-current opacity-60 hover:opacity-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Top Breadcrumb */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Kembali ke Daftar Mata Kuliah</span>
        </button>

        <div className="flex items-center gap-2 text-xs font-mono text-slate-600">
          <span className="font-bold text-blue-700">{course.code}</span>
          <span aria-hidden="true" className="text-slate-300">·</span>
          <span>{course.credits} SKS</span>
          <span aria-hidden="true" className="text-slate-300">·</span>
          <span>{course.semester}</span>
        </div>
      </div>

      {/* Moodle Course Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-900 to-indigo-900 rounded-2xl p-6 sm:p-7 text-white space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5 max-w-3xl">
            <div className="text-xs font-semibold text-blue-200 flex items-center gap-2">
              <BookOpen className="w-4 h-4" />
              <span>Halaman Mata Kuliah · {course.code}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              {course.name}
            </h1>
            <p className="text-xs sm:text-sm text-blue-100/90 leading-relaxed">
              {course.description ||
                'Ruang perkuliahan terpadu berisi pertemuan/topik, materi ajar, teks & gambar, tugas kuliah, tugas projek mahasiswa (penilaian antarmahasiswa), serta evaluasi.'}
            </p>
          </div>

          <div className="bg-white/10 rounded-xl p-4 border border-white/15 min-w-[240px] text-xs space-y-2.5 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center font-bold text-white">
                <User className="w-4 h-4" />
              </div>
              <div>
                <div className="font-semibold text-white">{course.lecturerName}</div>
                <div className="text-[11px] text-blue-200">Dosen Pengampu</div>
              </div>
            </div>
            <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[11px] text-blue-100">
              <span>Jadwal:</span>
              <span className="font-semibold">{course.schedule}</span>
            </div>
            {isTeacherOrAdmin && (
              <button
                type="button"
                id="btn-course-manage-users"
                onClick={() => setIsCourseUsersModalOpen(true)}
                className="w-full py-1.5 px-3 rounded-lg bg-white/15 hover:bg-white/25 border border-white/20 text-white text-[11px] font-bold flex items-center justify-center gap-1.5 transition-colors"
              >
                <Users className="w-3.5 h-3.5" />
                <span>
                  Kelola Pengguna ({(course.enrolledUserIds || []).length})
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Primary Course Navigation Tabs */}
        <div className="pt-4 border-t border-white/15 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('course_page')}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
              activeTab === 'course_page'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'bg-white/10 text-white hover:bg-white/20'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Halaman Kuliah (Pertemuan &amp; Aktivitas)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('attendance')}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
              activeTab === 'attendance'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'bg-white/10 text-white hover:bg-white/20'
            }`}
          >
            <QrCode className="w-4 h-4" />
            <span>Absensi Kuliah (QR)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('gradebook')}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
              activeTab === 'gradebook'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'bg-white/10 text-white hover:bg-white/20'
            }`}
          >
            <Award className="w-4 h-4" />
            <span>Daftar Nilai (Moodle)</span>
          </button>
        </div>
      </div>

      {/* TAB 1: SINGLE-PAGE MOODLE COURSE LAYOUT */}
      {activeTab === 'course_page' && (
        <div className="space-y-5">
          {/* Moodle Action & Filter Bar */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5">
              {(
                [
                  { id: 'all', label: 'Semua Konten' },
                  { id: 'materials_text', label: 'Teks, Gambar & Materi' },
                  { id: 'tasks_peer', label: 'Tugas & Projek Mahasiswa' },
                  { id: 'videos_exams', label: 'Video & Ujian' },
                ] as { id: MoodleContentFilter; label: string }[]
              ).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setContentFilter(f.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                    contentFilter === f.id
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {isTeacherOrAdmin && (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  id="btn-add-course-topic"
                  onClick={openCreateTopicModal}
                  className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold inline-flex items-center gap-1.5 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span>Tambah Pertemuan / Topik</span>
                </button>
                <button
                  type="button"
                  id="btn-add-peer-project"
                  onClick={() => openCreatePeerProjectModal()}
                  className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold inline-flex items-center gap-1.5 transition-colors"
                >
                  <Users className="w-4 h-4" />
                  <span>+ Tugas Projek Mahasiswa</span>
                </button>
                <button
                  type="button"
                  id="btn-add-course-exam"
                  onClick={() => openCreateExamModal(sortedTopics[0]?.id)}
                  className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold inline-flex items-center gap-1.5 transition-colors"
                >
                  <GraduationCap className="w-4 h-4" />
                  <span>+ Buat Ujian</span>
                </button>
              </div>
            )}
          </div>

          {/* 2-Zone Moodle Layout: Sticky Course Index + Single-Page Topic Stream */}
          <div className="lg:flex items-start gap-6 space-y-5 lg:space-y-0">
            {/* Left Sticky Course Index */}
            <aside className="w-full lg:w-64 shrink-0 lg:sticky lg:top-6 bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between gap-2">
                <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <ListTree className="w-4 h-4 text-blue-600" />
                  <span>Indeks Pertemuan</span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setAllSectionsCollapsed(false)}
                    className="p-1 text-slate-500 hover:text-slate-900 rounded"
                    title="Buka Semua Pertemuan"
                  >
                    <ChevronsUpDown className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setAllSectionsCollapsed(true)}
                    className="p-1 text-slate-500 hover:text-slate-900 rounded"
                    title="Ciutkan Semua Pertemuan"
                  >
                    <ChevronsDownUp className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <nav className="p-2 space-y-0.5 max-h-[65vh] overflow-y-auto text-xs">
                <button
                  type="button"
                  onClick={() => scrollToSection('general')}
                  className="w-full px-3 py-2 rounded-lg text-left hover:bg-slate-100 flex items-center justify-between gap-2 transition-colors"
                >
                  <span className="font-semibold text-slate-800 truncate">
                    Umum &amp; Pengantar
                  </span>
                  <span className="font-mono text-[11px] text-slate-500 tabular-nums">
                    {generalItems.totalCount}
                  </span>
                </button>

                {sortedTopics.map((topic) => {
                  const topicItems = getItemsForSection(topic.id);
                  return (
                    <button
                      key={topic.id}
                      type="button"
                      onClick={() => scrollToSection(topic.id)}
                      className="w-full px-3 py-2 rounded-lg text-left hover:bg-slate-100 flex items-center justify-between gap-2 transition-colors"
                    >
                      <div className="min-w-0">
                        <div className="text-[10px] font-mono font-bold text-blue-700 uppercase">
                          Pertemuan {topic.meetingNumber}
                        </div>
                        <div className="font-medium text-slate-800 truncate">{topic.title}</div>
                      </div>
                      <span className="font-mono text-[11px] text-slate-500 tabular-nums shrink-0">
                        {topicItems.totalCount}
                      </span>
                    </button>
                  );
                })}
              </nav>
            </aside>

            {/* Right Main Moodle Single-Page Content Stream */}
            <div className="flex-1 min-w-0 space-y-5">
              {/* SECTION 0: GENERAL / PENGANTAR */}
              <section
                id="moodle-section-general"
                className="bg-slate-50/70 rounded-2xl border border-slate-200 overflow-hidden"
              >
                <div className="px-5 py-4 bg-white border-b border-slate-200 flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => toggleSectionCollapse('general')}
                    className="flex items-center gap-2.5 text-left min-w-0"
                  >
                    {collapsedSections['general'] ? (
                      <ChevronRight className="w-5 h-5 text-slate-400 shrink-0" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-slate-600 shrink-0" />
                    )}
                    <div className="min-w-0">
                      <h2 className="text-base sm:text-lg font-extrabold text-slate-900">
                        Umum &amp; Pengantar Perkuliahan
                      </h2>
                      <p className="text-xs text-slate-500">
                        Informasi pengantar, dokumen silabus, serta aktivitas &amp; ujian umum mata kuliah.
                      </p>
                    </div>
                  </button>

                  <span className="text-xs font-mono text-slate-500 tabular-nums shrink-0">
                    {generalItems.totalCount} item
                  </span>
                </div>

                {!collapsedSections['general'] && (
                  <>
                    <div className="p-4 sm:p-5">{renderTopicStreamContent(undefined)}</div>
                    {renderTopicAddToolbar(undefined, 'Umum')}
                  </>
                )}
              </section>

              {/* TOPIC SECTIONS (PERTEMUAN 1, 2, dst.) */}
              {sortedTopics.length === 0 && isTeacherOrAdmin && (
                <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-8 text-center space-y-3">
                  <Layers className="w-10 h-10 text-slate-300 mx-auto" />
                  <div className="font-bold text-slate-800 text-sm">
                    Belum Ada Bagian Pertemuan / Topik
                  </div>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    Tambahkan bagian Pertemuan atau Topik agar materi, teks/gambar, tugas kuliah,
                    video, dan Tugas Projek Mahasiswa tersusun rapi layaknya Moodle pada satu halaman.
                  </p>
                  <button
                    type="button"
                    onClick={openCreateTopicModal}
                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold inline-flex items-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Buat Pertemuan 1</span>
                  </button>
                </div>
              )}

              {sortedTopics.map((topic) => {
                const isCollapsed = Boolean(collapsedSections[topic.id]);
                const topicStats = getItemsForSection(topic.id);

                return (
                  <section
                    key={topic.id}
                    id={`moodle-section-${topic.id}`}
                    className="bg-slate-50/70 rounded-2xl border border-slate-200 overflow-hidden"
                  >
                    {/* Topic Header */}
                    <div className="px-5 py-4 bg-white border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => toggleSectionCollapse(topic.id)}
                        className="flex items-start gap-2.5 text-left min-w-0"
                      >
                        {isCollapsed ? (
                          <ChevronRight className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-slate-600 shrink-0 mt-0.5" />
                        )}
                        <div className="space-y-0.5 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 text-xs">
                            <span className="font-mono font-extrabold text-blue-700">
                              Pertemuan {topic.meetingNumber}
                            </span>
                            <span aria-hidden="true" className="text-slate-300">·</span>
                            <span className="font-mono text-slate-500 tabular-nums">
                              {topicStats.totalCount} aktivitas/materi
                            </span>
                          </div>
                          <h3 className="text-base sm:text-lg font-extrabold text-slate-900">
                            {topic.title}
                          </h3>
                        </div>
                      </button>

                      {isTeacherOrAdmin && (
                        <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                          <button
                            type="button"
                            onClick={() => openEditTopicModal(topic)}
                            className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold inline-flex items-center gap-1"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                            <span>Edit Topik</span>
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setDeleteConfirm({
                                type: 'topic',
                                id: topic.id,
                                title: `Pertemuan ${topic.meetingNumber}: ${topic.title}`,
                              })
                            }
                            className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-rose-600 hover:border-rose-200 hover:bg-rose-50"
                            title="Hapus Pertemuan / Topik"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>

                    {!isCollapsed && (
                      <>
                        {topic.summary && (
                          <div className="px-5 py-3.5 bg-white border-b border-slate-200 text-sm text-slate-700 leading-relaxed whitespace-pre-line">
                            {topic.summary}
                          </div>
                        )}

                        <div className="p-4 sm:p-5">{renderTopicStreamContent(topic.id)}</div>

                        {renderTopicAddToolbar(topic.id, `Pertemuan ${topic.meetingNumber}`)}
                      </>
                    )}
                  </section>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: ABSENSI KULIAH QR DINAMIS */}
      {activeTab === 'attendance' && (
        <div className="-mx-4 sm:-mx-6 lg:-mx-10 -mt-6">
          <AttendanceView lockedCourseId={course.id} />
        </div>
      )}

      {/* TAB 3: DAFTAR NILAI MATA KULIAH */}
      {activeTab === 'gradebook' && (
        <div className="-mx-4 sm:-mx-6 lg:-mx-10 -mt-6">
          <GradebookView lockedCourseId={course.id} />
        </div>
      )}

      {/* MODAL: Tambah / Edit Pertemuan & Topik */}
      {isTopicModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Layers className="w-4 h-4 text-blue-600" />
                <span>
                  {editingTopic
                    ? 'Edit Pertemuan & Judul Topik'
                    : 'Tambah Pertemuan / Topik Baru'}
                </span>
              </h3>
              <button
                type="button"
                disabled={topicSaving}
                onClick={() => setIsTopicModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleTopicSubmit} className="p-6 space-y-4 text-xs">
              {topicError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{topicError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Pertemuan Ke- *
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={64}
                    required
                    value={topicMeetingNumber}
                    onChange={(e) => setTopicMeetingNumber(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">
                    Judul Topik / Pokok Bahasan *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Arsitektur Sistem & Pemodelan Basis Data"
                    value={topicTitle}
                    onChange={(e) => setTopicTitle(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Keterangan Pertemuan / Ringkasan Topik
                </label>
                <textarea
                  rows={3}
                  placeholder="Tuliskan tujuan pembelajaran, agenda perkuliahan, dan arahan untuk mahasiswa pada pertemuan ini..."
                  value={topicSummary}
                  onChange={(e) => setTopicSummary(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  disabled={topicSaving}
                  onClick={() => setIsTopicModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={topicSaving}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold disabled:opacity-60"
                >
                  {topicSaving ? 'Menyimpan...' : editingTopic ? 'Simpan Topik' : 'Tambahkan Topik'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Add Text & Gambar */}
      {isBlockModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-xl overflow-hidden my-4">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-blue-600" />
                <span>
                  {editingBlock ? 'Edit Konten Teks / Gambar' : 'Tambah Teks atau Gambar (Moodle Label/Page)'}
                </span>
              </h3>
              <button
                type="button"
                disabled={blockUploading}
                onClick={() => setIsBlockModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleBlockSubmit} className="p-6 space-y-4 text-xs">
              {blockError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{blockError}</span>
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Letakkan di Pertemuan / Topik
                </label>
                <select
                  value={blockTopicId}
                  onChange={(e) => setBlockTopicId(e.target.value)}
                  disabled={blockUploading}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Umum &amp; Pengantar Perkuliahan</option>
                  {sortedTopics.map((t) => (
                    <option key={t.id} value={t.id}>
                      Pertemuan {t.meetingNumber}: {t.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Judul Sub-bagian (Opsional)
                </label>
                <input
                  type="text"
                  disabled={blockUploading}
                  placeholder="Contoh: Diagram Alur Sistem & Penjelasan"
                  value={blockTitle}
                  onChange={(e) => setBlockTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Teks Penjelasan / Catatan Perkuliahan
                </label>
                <textarea
                  rows={4}
                  disabled={blockUploading}
                  placeholder="Tuliskan penjelasan materi, poin-poin penting, atau instruksi bacaan bagi mahasiswa..."
                  value={blockText}
                  onChange={(e) => setBlockText(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="space-y-2">
                <label className="block font-bold text-slate-700">
                  Sisipkan Gambar (PNG / JPG / WEBP, Maks. 10 MB)
                </label>

                {editingBlock?.imageFileId && !blockRemoveExistingImg && !blockImageFile && (
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-mono text-slate-700 truncate">
                        Gambar saat ini: {editingBlock.imageFileName || 'gambar'}
                      </span>
                      <button
                        type="button"
                        onClick={() => setBlockRemoveExistingImg(true)}
                        className="text-rose-600 font-semibold hover:underline"
                      >
                        Hapus Gambar
                      </button>
                    </div>
                  </div>
                )}

                <label className="block border-2 border-dashed border-slate-300 hover:border-blue-400 bg-slate-50 rounded-xl p-4 text-center cursor-pointer transition-colors">
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    disabled={blockUploading}
                    onChange={(e) => {
                      const f = e.target.files?.[0] || null;
                      setBlockImageFile(f);
                      if (blockImagePreviewUrl) URL.revokeObjectURL(blockImagePreviewUrl);
                      setBlockImagePreviewUrl(f ? URL.createObjectURL(f) : null);
                      if (f) setBlockRemoveExistingImg(false);
                    }}
                    className="hidden"
                  />
                  {blockImagePreviewUrl ? (
                    <div className="space-y-2">
                      <img
                        src={blockImagePreviewUrl}
                        alt="Pratinjau Gambar"
                        className="max-h-40 mx-auto rounded-lg border border-slate-200 object-contain"
                      />
                      <div className="font-bold text-blue-700">{blockImageFile?.name}</div>
                    </div>
                  ) : (
                    <div className="space-y-1 text-slate-600">
                      <ImageIcon className="w-6 h-6 mx-auto text-slate-400" />
                      <div className="font-semibold">Klik untuk memilih gambar dari perangkat</div>
                      <div className="text-[11px] text-slate-400">PNG, JPG, WEBP, GIF</div>
                    </div>
                  )}
                </label>

                {(blockImageFile || (editingBlock?.imageFileId && !blockRemoveExistingImg)) && (
                  <input
                    type="text"
                    disabled={blockUploading}
                    placeholder="Keterangan / Caption di bawah gambar (opsional)"
                    value={blockImageCaption}
                    onChange={(e) => setBlockImageCaption(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                )}
              </div>

              {blockUploading && blockImageFile && (
                <div className="text-[11px] font-mono text-blue-700 font-bold">
                  Mengunggah gambar ke Firebase... {blockUploadProgress}%
                </div>
              )}

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  disabled={blockUploading}
                  onClick={() => setIsBlockModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={blockUploading}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold disabled:opacity-60"
                >
                  {blockUploading ? 'Menyimpan...' : 'Simpan Konten'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Upload Materi Baru */}
      {isAddMaterialOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden my-4">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Upload className="w-4 h-4 text-blue-600" />
                <span>Upload Materi Perkuliahan</span>
              </h3>
              <button
                type="button"
                disabled={matUploading}
                onClick={() => setIsAddMaterialOpen(false)}
                className="text-slate-400 hover:text-slate-600 disabled:opacity-50"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddMaterialSubmit} className="p-6 space-y-4 text-xs">
              {matFormError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{matFormError}</span>
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Letakkan di Pertemuan / Topik
                </label>
                <select
                  value={matTopicId}
                  onChange={(e) => setMatTopicId(e.target.value)}
                  disabled={matUploading}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Umum &amp; Pengantar Perkuliahan</option>
                  {sortedTopics.map((t) => (
                    <option key={t.id} value={t.id}>
                      Pertemuan {t.meetingNumber}: {t.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl">
                <button
                  type="button"
                  disabled={matUploading}
                  onClick={() => setMatUploadMode('file')}
                  className={`py-2 px-3 rounded-lg font-bold flex items-center justify-center gap-1.5 transition-all ${
                    matUploadMode === 'file'
                      ? 'bg-white text-blue-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Unggah File (Maks 10 MB)</span>
                </button>
                <button
                  type="button"
                  disabled={matUploading}
                  onClick={() => setMatUploadMode('link')}
                  className={`py-2 px-3 rounded-lg font-bold flex items-center justify-center gap-1.5 transition-all ${
                    matUploadMode === 'link'
                      ? 'bg-white text-blue-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Link2 className="w-3.5 h-3.5" />
                  <span>Tautan URL Eksternal</span>
                </button>
              </div>

              {matUploadMode === 'file' ? (
                <div>
                  <label className="block font-bold text-slate-700 mb-1.5">
                    Pilih Berkas File dari Perangkat *
                  </label>
                  <label className="block border-2 border-dashed border-slate-300 hover:border-blue-400 bg-slate-50 rounded-xl p-4 text-center cursor-pointer transition-colors">
                    <input
                      type="file"
                      accept=".pdf,.ppt,.pptx,.doc,.docx,.xls,.xlsx,.zip,.txt,.png,.jpg,.jpeg"
                      disabled={matUploading}
                      onChange={(e) => {
                        const file = e.target.files?.[0] || null;
                        setMatSelectedFile(file);
                        setMatFormError('');
                        if (file && !matTitle.trim()) {
                          setMatTitle(file.name.replace(/\.[^/.]+$/, ''));
                        }
                      }}
                      className="hidden"
                    />
                    {matSelectedFile ? (
                      <div className="space-y-1">
                        <div className="font-bold text-blue-700 text-xs break-all">
                          {matSelectedFile.name}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono">
                          Ukuran: {formatFileSize(matSelectedFile.size)} ·{' '}
                          {inferStoredFileType(matSelectedFile.name, matSelectedFile.type).toUpperCase()}
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-1.5 py-2">
                        <Upload className="w-7 h-7 text-slate-400 mx-auto" />
                        <div className="font-semibold text-slate-700">Klik untuk memilih file materi</div>
                        <div className="text-[11px] text-slate-400">
                          PDF, PPTX, DOCX, XLSX, ZIP, TXT, atau Gambar (Maks. 10 MB)
                        </div>
                      </div>
                    )}
                  </label>
                </div>
              ) : (
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    URL Tautan Materi *
                  </label>
                  <input
                    type="url"
                    required
                    disabled={matUploading}
                    placeholder="https://drive.google.com/file/d/..."
                    value={matExternalUrl}
                    onChange={(e) => setMatExternalUrl(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-700 mb-1">Judul Materi *</label>
                <input
                  type="text"
                  required
                  disabled={matUploading}
                  placeholder="Contoh: Modul 01 - Pengantar Arsitektur"
                  value={matTitle}
                  onChange={(e) => setMatTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Deskripsi Materi</label>
                <textarea
                  rows={2}
                  disabled={matUploading}
                  placeholder="Ringkasan isi materi perkuliahan..."
                  value={matDescription}
                  onChange={(e) => setMatDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {matUploading && matUploadMode === 'file' && (
                <div className="text-[11px] font-mono text-blue-700 font-bold">
                  Mengunggah berkas ke Firebase... {matUploadProgress}%
                </div>
              )}

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  disabled={matUploading}
                  onClick={() => setIsAddMaterialOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  id="btn-submit-upload-material"
                  disabled={matUploading}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold flex items-center gap-1.5 disabled:opacity-60"
                >
                  {matUploading ? 'Mengunggah...' : 'Upload & Simpan Materi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Buat / Edit Slot Tugas Kuliah */}
      {isAddAssignmentOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-2xl overflow-hidden my-4">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-indigo-600" />
                <span>
                  {editingAssignment
                    ? 'Edit Slot Tugas & Tenggat Akses'
                    : 'Buat Slot Penugasan Mahasiswa'}
                </span>
              </h3>
              <button
                type="button"
                disabled={assUploading}
                onClick={() => {
                  setIsAddAssignmentOpen(false);
                  setEditingAssignment(null);
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddAssignmentSubmit} className="p-6 space-y-4 text-xs">
              {assFormError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{assFormError}</span>
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Letakkan di Pertemuan / Topik
                </label>
                <select
                  value={assTopicId}
                  onChange={(e) => setAssTopicId(e.target.value)}
                  disabled={assUploading}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Umum &amp; Pengantar Perkuliahan</option>
                  {sortedTopics.map((t) => (
                    <option key={t.id} value={t.id}>
                      Pertemuan {t.meetingNumber}: {t.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className="p-3.5 rounded-xl border border-indigo-200 bg-indigo-50/50 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <label className="font-bold text-indigo-950 flex items-center gap-1.5">
                    <Award className="w-4 h-4 text-indigo-600" />
                    <span>
                      Langkah Wajib: Masuk ke Komponen Penilaian <span className="text-rose-600">*</span>
                    </span>
                  </label>
                  {selectedAssGradingComp && (
                    <span className="text-[11px] font-mono font-bold text-indigo-700">
                      Kontribusi: {selectedAssGradingComp.effectiveWeight}%
                    </span>
                  )}
                </div>
                <select
                  id="select-assignment-grading-component"
                  required
                  disabled={assUploading}
                  value={assGradingComponentId}
                  onChange={(e) => setAssGradingComponentId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-indigo-300 bg-white text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">-- Pilih Grup &amp; Komponen Penilaian di Buku Nilai --</option>
                  {selectableAssGroups.map((entry) => (
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

              <div>
                <label className="block font-bold text-slate-700 mb-1">Judul Tugas *</label>
                <input
                  type="text"
                  required
                  disabled={assUploading}
                  placeholder="Contoh: Tugas 1 - Analisis Kebutuhan Sistem"
                  value={assTitle}
                  onChange={(e) => setAssTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Keterangan, Petunjuk &amp; Rubrik Pengumpulan *
                </label>
                <textarea
                  rows={4}
                  required
                  disabled={assUploading}
                  placeholder="Jelaskan rincian tugas, format berkas, serta kriteria penilaian..."
                  value={assInstructions}
                  onChange={(e) => setAssInstructions(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Jadwal Mulai Dibuka *</label>
                  <input
                    type="datetime-local"
                    required
                    disabled={assUploading}
                    value={assOpenDate}
                    onChange={(e) => setAssOpenDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Tenggat Akhir Pengumpulan *
                  </label>
                  <input
                    type="datetime-local"
                    required
                    disabled={assUploading}
                    value={assDueDate}
                    onChange={(e) => setAssDueDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Nilai Maksimal</label>
                  <input
                    type="number"
                    min="10"
                    max="1000"
                    disabled={assUploading}
                    value={assMaxPoints}
                    onChange={(e) => setAssMaxPoints(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <label className="flex items-start gap-2.5 p-3 rounded-xl border border-slate-200 bg-slate-50 cursor-pointer">
                  <input
                    type="checkbox"
                    disabled={assUploading}
                    checked={assLockAfterDeadline}
                    onChange={(e) => setAssLockAfterDeadline(e.target.checked)}
                    className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <div className="space-y-0.5">
                    <div className="font-bold text-slate-800">
                      Kunci Otomatis Setelah Lewat Tenggat
                    </div>
                    <div className="text-[11px] text-slate-500 leading-snug">
                      Mahasiswa tidak dapat mengunggah setelah melewati batas waktu.
                    </div>
                  </div>
                </label>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {editingAssignment?.attachmentFileName
                    ? `Ganti Lampiran Soal/Template (Saat ini: ${editingAssignment.attachmentFileName})`
                    : 'Lampirkan File Soal / Template Tugas (Opsional, Maks 10 MB)'}
                </label>
                <input
                  type="file"
                  disabled={assUploading}
                  accept=".pdf,.ppt,.pptx,.doc,.docx,.xls,.xlsx,.zip,.txt"
                  onChange={(e) => setAssAttachmentFile(e.target.files?.[0] || null)}
                  className="w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                />
                {assAttachmentFile && (
                  <div className="mt-1 text-[11px] font-mono text-indigo-700">
                    Terpilih: {assAttachmentFile.name} ({formatFileSize(assAttachmentFile.size)})
                  </div>
                )}
              </div>

              {assUploading && assAttachmentFile && (
                <div className="text-[11px] font-mono text-indigo-700 font-bold">
                  Mengunggah lampiran tugas... {assUploadProgress}%
                </div>
              )}

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  disabled={assUploading}
                  onClick={() => {
                    setIsAddAssignmentOpen(false);
                    setEditingAssignment(null);
                  }}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={assUploading}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold disabled:opacity-60"
                >
                  {assUploading
                    ? 'Menyimpan...'
                    : editingAssignment
                    ? 'Simpan Perubahan'
                    : 'Terbitkan Slot Tugas'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Tambah Video YouTube */}
      {isAddVideoOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Film className="w-4 h-4 text-rose-600" />
                <span>Selipkan Video Pembelajaran YouTube</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsAddVideoOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddVideoSubmit} className="p-6 space-y-4 text-xs">
              {vidFormError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{vidFormError}</span>
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Letakkan di Pertemuan / Topik
                </label>
                <select
                  value={vidTopicId}
                  onChange={(e) => setVidTopicId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                >
                  <option value="">Umum &amp; Pengantar Perkuliahan</option>
                  {sortedTopics.map((t) => (
                    <option key={t.id} value={t.id}>
                      Pertemuan {t.meetingNumber}: {t.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Judul Video *</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Video Penjelasan Algoritma"
                  value={vidTitle}
                  onChange={(e) => setVidTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Link URL YouTube *</label>
                <input
                  type="url"
                  required
                  placeholder="https://www.youtube.com/watch?v=... atau https://youtu.be/..."
                  value={vidUrl}
                  onChange={(e) => setVidUrl(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Keterangan Video</label>
                <textarea
                  rows={2}
                  placeholder="Ringkasan poin penting dalam video..."
                  value={vidDescription}
                  onChange={(e) => setVidDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddVideoOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold"
                >
                  Tambahkan Video
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Tugas Projek Mahasiswa (Create / Edit) */}
      <PeerProjectModal
        isOpen={isPeerModalOpen}
        courseId={course.id}
        topics={sortedTopics}
        defaultTopicId={peerModalTopicId}
        projectToEdit={editingPeerProject}
        onClose={() => {
          setIsPeerModalOpen(false);
          setEditingPeerProject(null);
        }}
        onSaved={(msg) => showToast('success', msg)}
      />

      {/* MODAL: Penilaian Tugas Reguler (Untuk Dosen) */}
      {liveAssignmentForGrading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">
                  Pengumpulan Mahasiswa: {liveAssignmentForGrading.title}
                </h3>
                <div className="text-[11px] text-slate-500">
                  Total {liveAssignmentForGrading.submissions.length} berkas terkumpul (Maksimal{' '}
                  {liveAssignmentForGrading.maxPoints} poin)
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setActiveAssignmentToGrade(null);
                  setGradingSubmission(null);
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 text-xs">
              {liveAssignmentForGrading.submissions.length === 0 ? (
                <div className="p-8 text-center text-slate-400 italic">
                  Belum ada mahasiswa yang mengumpulkan tugas ini.
                </div>
              ) : (
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                  {liveAssignmentForGrading.submissions.map((sub) => (
                    <div key={sub.id} className="p-4 bg-white hover:bg-slate-50 transition-colors space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <div className="font-bold text-slate-900 text-sm">{sub.studentName}</div>
                          <div className="text-slate-500 font-mono text-[11px]">
                            NIM: {sub.studentNim} · Kelas: {sub.studentClassName || 'Reguler'}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {sub.grade !== undefined ? (
                            <span className="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 font-bold font-mono">
                              Nilai: {sub.grade} / {liveAssignmentForGrading.maxPoints}
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-lg bg-amber-100 text-amber-800 font-semibold">
                              Belum Dinilai
                            </span>
                          )}

                          {(sub.fileId || (sub.fileUrl && sub.fileUrl !== '#')) && (
                            <button
                              type="button"
                              disabled={downloadingId === sub.id}
                              onClick={() =>
                                handleDownloadFile({
                                  id: sub.id,
                                  fileId: sub.fileId,
                                  fileUrl: sub.fileUrl,
                                  fileName: sub.fileName,
                                  mimeType: sub.mimeType,
                                })
                              }
                              className="px-3 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold rounded-lg transition-colors flex items-center gap-1"
                            >
                              {downloadingId === sub.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Download className="w-3.5 h-3.5" />
                              )}
                              <span>Unduh</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => {
                              setGradingSubmission(sub);
                              setGradeInput(sub.grade ?? 85);
                              setFeedbackInput(sub.feedback || '');
                            }}
                            className="px-3 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-lg transition-colors"
                          >
                            Beri Nilai
                          </button>
                        </div>
                      </div>

                      <div className="text-[11px] text-slate-600 flex flex-wrap items-center justify-between gap-2 pt-1">
                        <span className="font-mono text-slate-500">
                          Berkas: <strong>{sub.fileName}</strong>
                          {sub.fileSize ? ` (${sub.fileSize})` : ''} · Dikumpulkan:{' '}
                          {formatFullIndonesianDateTime(sub.submittedAt)} ·{' '}
                          <span
                            className={
                              sub.submissionStatus === 'terlambat'
                                ? 'text-amber-700 font-bold'
                                : 'text-emerald-700 font-bold'
                            }
                          >
                            {sub.submissionStatus === 'terlambat' ? 'Terlambat' : 'Tepat Waktu'}
                          </span>
                        </span>
                        {sub.notes && (
                          <span className="italic text-slate-500 max-w-xs truncate">
                            Catatan: &ldquo;{sub.notes}&rdquo;
                          </span>
                        )}
                      </div>

                      {gradingSubmission?.id === sub.id && (
                        <form
                          onSubmit={handleGradeSubmit}
                          className="mt-3 p-3.5 bg-indigo-50/50 rounded-xl border border-indigo-200 space-y-3"
                        >
                          <div className="font-bold text-indigo-900">
                            Formulir Penilaian Mahasiswa: {sub.studentName}
                          </div>
                          <div className="grid grid-cols-3 gap-3">
                            <div>
                              <label className="block font-bold text-slate-700 mb-1">
                                Nilai (0 - {liveAssignmentForGrading.maxPoints}) *
                              </label>
                              <input
                                type="number"
                                min="0"
                                max={liveAssignmentForGrading.maxPoints}
                                required
                                value={gradeInput}
                                onChange={(e) => setGradeInput(Number(e.target.value))}
                                className="w-full px-3 py-1.5 rounded-lg border border-slate-300 font-bold font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                              />
                            </div>
                            <div className="col-span-2">
                              <label className="block font-bold text-slate-700 mb-1">
                                Catatan / Masukan Evaluasi Dosen
                              </label>
                              <input
                                type="text"
                                placeholder="Analisis sangat rapi dan lengkap..."
                                value={feedbackInput}
                                onChange={(e) => setFeedbackInput(e.target.value)}
                                className="w-full px-3 py-1.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                              />
                            </div>
                          </div>
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setGradingSubmission(null)}
                              className="px-3 py-1 text-slate-600 hover:bg-slate-200 rounded-lg"
                            >
                              Batal
                            </button>
                            <button
                              type="submit"
                              className="px-3.5 py-1 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700"
                            >
                              Simpan Nilai
                            </button>
                          </div>
                        </form>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setActiveAssignmentToGrade(null);
                  setGradingSubmission(null);
                }}
                className="px-4 py-2 bg-slate-800 text-white rounded-xl font-semibold text-xs"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Pratinjau File (PDF / Gambar) */}
      {previewFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl h-[85vh] flex flex-col overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="min-w-0">
                <div className="font-bold text-slate-900 text-sm truncate">{previewFile.title}</div>
                <div className="text-[11px] font-mono text-slate-500 truncate">{previewFile.fileName}</div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={previewFile.objectUrl}
                  download={previewFile.fileName}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Unduh File</span>
                </a>
                <button
                  type="button"
                  onClick={() => {
                    URL.revokeObjectURL(previewFile.objectUrl);
                    setPreviewFile(null);
                  }}
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="flex-1 bg-slate-100 overflow-auto flex items-center justify-center p-2">
              {previewFile.mimeType.startsWith('image/') ? (
                <img
                  src={previewFile.objectUrl}
                  alt={previewFile.title}
                  className="max-w-full max-h-full object-contain rounded-lg shadow-sm"
                />
              ) : (
                <iframe
                  src={previewFile.objectUrl}
                  title={previewFile.title}
                  className="w-full h-full border-0 rounded-lg bg-white"
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Konfirmasi Hapus */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-900">Konfirmasi Hapus</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Apakah Anda yakin ingin menghapus <strong>{deleteConfirm.title}</strong>?
              {deleteConfirm.type === 'topic'
                ? ' Materi, tugas, atau video di dalam pertemuan ini akan dipindahkan ke bagian Umum agar tidak hilang.'
                : deleteConfirm.type === 'exam'
                ? ' Ujian beserta seluruh soal, lembar pengerjaan mahasiswa, dan catatan pengawasan terkait akan dihapus permanen.'
                : ' Data dan berkas terkait akan dihapus permanen.'}
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleExecuteDelete}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold disabled:opacity-60"
              >
                {isDeleting ? 'Menghapus...' : 'Ya, Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Kelola Pengguna Mata Kuliah */}
      {isTeacherOrAdmin && (
        <CourseUsersModal
          isOpen={isCourseUsersModalOpen}
          course={course}
          onClose={() => setIsCourseUsersModalOpen(false)}
        />
      )}

      {/* MODAL: Pilih / Tempatkan Ujian ke Slot Pertemuan */}
      {isTeacherOrAdmin && isPlaceExamModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-2xl max-h-[88vh] flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Pilih &amp; Tempatkan Ujian ke Pertemuan
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Target slot:{' '}
                  <strong className="text-slate-800">
                    {placeExamModalTopicId
                      ? (() => {
                          const target = sortedTopics.find((t) => t.id === placeExamModalTopicId);
                          return target
                            ? `Pertemuan ${target.meetingNumber}: ${target.title}`
                            : 'Pertemuan Terpilih';
                        })()
                      : 'Umum & Pengantar Perkuliahan'}
                  </strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsPlaceExamModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={placeExamSearch}
                    onChange={(e) => setPlaceExamSearch(e.target.value)}
                    placeholder="Cari judul ujian, jenis (UTS/UAS/Kuis), atau kode MK..."
                    className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const target = placeExamModalTopicId;
                    setIsPlaceExamModalOpen(false);
                    openCreateExamModal(target);
                  }}
                  className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 shrink-0 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span>Buat Ujian Baru di Sini</span>
                </button>
              </div>

              <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={placeExamShowAllSystem}
                  onChange={(e) => setPlaceExamShowAllSystem(e.target.checked)}
                  className="w-4 h-4 rounded text-blue-600"
                />
                <span>
                  Tampilkan seluruh ujian di sistem (jika ingin memindahkan/menautkan ujian dari daftar umum ke mata kuliah &amp; pertemuan ini)
                </span>
              </label>

              <div className="space-y-2.5">
                {(() => {
                  const baseList = placeExamShowAllSystem ? exams : linkedExams;
                  const q = placeExamSearch.trim().toLowerCase();
                  const filtered = baseList.filter((ex) => {
                    if (!q) return true;
                    const cat = getExamCategoryLabel(ex.examCategory).toLowerCase();
                    return (
                      ex.title.toLowerCase().includes(q) ||
                      ex.courseCode.toLowerCase().includes(q) ||
                      ex.courseName.toLowerCase().includes(q) ||
                      cat.includes(q)
                    );
                  });

                  if (filtered.length === 0) {
                    return (
                      <div className="border border-dashed border-slate-300 rounded-xl p-6 text-center space-y-2">
                        <GraduationCap className="w-8 h-8 text-slate-300 mx-auto" />
                        <p className="text-xs font-semibold text-slate-700">
                          Tidak ada ujian yang cocok ditemukan.
                        </p>
                        <p className="text-[11px] text-slate-500">
                          Anda dapat mencentang opsi &quot;Tampilkan seluruh ujian di sistem&quot; atau klik &quot;Buat Ujian Baru di Sini&quot;.
                        </p>
                      </div>
                    );
                  }

                  return filtered.map((ex) => {
                    const currentTopic = ex.topicId
                      ? sortedTopics.find((t) => t.id === ex.topicId)
                      : undefined;
                    const isSameCourse = doesExamMatchCourse(ex, course);
                    const isAlreadyInTarget =
                      isSameCourse &&
                      (placeExamModalTopicId
                        ? ex.topicId === placeExamModalTopicId
                        : !ex.topicId || !validTopicIds.has(ex.topicId));

                    return (
                      <div
                        key={ex.id}
                        className="p-3.5 rounded-xl border border-slate-200 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="space-y-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 text-[11px]">
                            <span className="font-bold text-emerald-700">
                              {getExamCategoryLabel(ex.examCategory)}
                            </span>
                            <span aria-hidden="true" className="text-slate-300">·</span>
                            <span className="font-mono text-slate-600">{ex.courseCode}</span>
                            <span aria-hidden="true" className="text-slate-300">·</span>
                            <span className="text-blue-700 font-semibold">
                              {ex.scoringMethod === 'irt' ? `IRT ${ex.irtModel || '3PL'}` : 'Klasik'}
                            </span>
                            <span aria-hidden="true" className="text-slate-300">·</span>
                            <span className="text-slate-500 font-mono tabular-nums">
                              {ex.questions.length} Soal
                            </span>
                          </div>
                          <div className="font-bold text-sm text-slate-900 truncate">{ex.title}</div>
                          <div className="text-[11px] text-slate-500">
                            Penempatan saat ini:{' '}
                            <strong className="text-slate-700">
                              {!isSameCourse
                                ? `Mata Kuliah Lain (${ex.courseName})`
                                : currentTopic
                                ? `Pertemuan ${currentTopic.meetingNumber}: ${currentTopic.title}`
                                : 'Umum / Pengantar Perkuliahan'}
                            </strong>
                          </div>
                        </div>

                        <button
                          type="button"
                          disabled={isAlreadyInTarget || placingExamId === ex.id}
                          onClick={async () => {
                            await handleMoveExamToTopic(ex, placeExamModalTopicId);
                          }}
                          className={`px-3.5 py-2 rounded-xl text-xs font-bold shrink-0 transition-colors ${
                            isAlreadyInTarget
                              ? 'bg-slate-100 text-slate-500 cursor-default'
                              : 'bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-60'
                          }`}
                        >
                          {placingExamId === ex.id
                            ? 'Menyimpan...'
                            : isAlreadyInTarget
                            ? 'Sudah di Slot Ini'
                            : placeExamModalTopicId
                            ? 'Tempatkan di Pertemuan Ini'
                            : 'Tempatkan di Umum'}
                        </button>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Buat / Edit Ujian (Terhubung ke Pertemuan Mata Kuliah) */}
      {isTeacherOrAdmin && (
        <ExamFormModal
          isOpen={isExamModalOpen}
          onClose={() => {
            setIsExamModalOpen(false);
            setExamToEdit(null);
          }}
          examToEdit={examToEdit}
          defaultCourse={course}
          defaultTopicId={examModalDefaultTopicId || undefined}
        />
      )}
    </div>
  );
};
