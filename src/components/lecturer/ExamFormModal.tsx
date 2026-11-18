import React, { useState } from 'react';
import {
  Course,
  Exam,
  ExamCategory,
  Question,
  CheatingPenaltyTier,
  ScoringMethod,
  IRTModel,
  IRTDifficultyPreset,
} from '../../types';
import { useExam } from '../../context/ExamContext';
import {
  getSelectableComponentsForActivity,
  resolveGradeConfig,
  getExamCategoryLabel,
} from '../../utils/gradebook';
import { AikenImportModal } from './AikenImportModal';
import {
  X,
  Calendar,
  Clock,
  BookOpen,
  Award,
  ShieldCheck,
  FileText,
  AlertTriangle,
  CheckCircle,
  ToggleLeft,
  ToggleRight,
  Shuffle,
  Layers,
  Plus,
  Trash2,
  BarChart3,
} from 'lucide-react';

interface ExamFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  examToEdit?: Exam | null;
  defaultCourse?: Course | null;
  defaultTopicId?: string;
}

const EXAM_CATEGORY_OPTIONS: { value: ExamCategory; label: string }[] = [
  { value: 'kuis', label: 'Kuis' },
  { value: 'ujian_harian', label: 'Ujian Harian' },
  { value: 'uts', label: 'UTS' },
  { value: 'uas', label: 'UAS' },
  { value: 'praktikum', label: 'Praktikum' },
  { value: 'remedial', label: 'Remedial' },
];

export const ExamFormModal: React.FC<ExamFormModalProps> = ({
  isOpen,
  onClose,
  examToEdit,
  defaultCourse,
  defaultTopicId,
}) => {
  const { currentUser, exams, addExam, updateExam, classes, courses, gradeConfigs } = useExam();

  const now = new Date();
  const defaultStartTime = new Date(now.getTime() + 10 * 60 * 1000).toISOString().slice(0, 16);
  const defaultEndTime = new Date(now.getTime() + 130 * 60 * 1000).toISOString().slice(0, 16);

  const [title, setTitle] = useState(examToEdit?.title || '');
  const [courseId, setCourseId] = useState(examToEdit?.courseId || defaultCourse?.id || '');
  const [courseName, setCourseName] = useState(examToEdit?.courseName || defaultCourse?.name || '');
  const [courseCode, setCourseCode] = useState(examToEdit?.courseCode || defaultCourse?.code || 'IF3001');
  const [topicId, setTopicId] = useState(examToEdit?.topicId || defaultTopicId || '');
  const [examCategory, setExamCategory] = useState<ExamCategory>(
    examToEdit?.examCategory || 'ujian_harian'
  );
  const [durationMinutes, setDurationMinutes] = useState(examToEdit?.durationMinutes || 45);
  const [passingGrade, setPassingGrade] = useState(examToEdit?.passingGrade || 70);
  const [gradingComponentId, setGradingComponentId] = useState(
    examToEdit?.gradingComponentId || ''
  );

  // Sistem Penilaian: IRT vs Klasik
  const [scoringMethod, setScoringMethod] = useState<ScoringMethod>(
    examToEdit?.scoringMethod || 'irt'
  );
  const [irtModel, setIrtModel] = useState<IRTModel>(examToEdit?.irtModel || '3PL');
  const [showQuestionWeightsList, setShowQuestionWeightsList] = useState(false);
  const [startTime, setStartTime] = useState(
    examToEdit?.schedule.startTime
      ? new Date(examToEdit.schedule.startTime).toISOString().slice(0, 16)
      : defaultStartTime
  );
  const [endTime, setEndTime] = useState(
    examToEdit?.schedule.endTime
      ? new Date(examToEdit.schedule.endTime).toISOString().slice(0, 16)
      : defaultEndTime
  );

  // User requested option: Score announcement immediate or withheld
  const [showScoreImmediately, setShowScoreImmediately] = useState(
    examToEdit ? examToEdit.showScoreImmediately : false
  );
  const [aiProctoringEnabled, setAiProctoringEnabled] = useState(
    examToEdit ? examToEdit.aiProctoringEnabled : true
  );

  // Randomization features requested by user
  const [shuffleQuestions, setShuffleQuestions] = useState(
    examToEdit?.shuffleQuestions !== undefined ? examToEdit.shuffleQuestions : true
  );
  const [shuffleOptions, setShuffleOptions] = useState(
    examToEdit?.shuffleOptions !== undefined ? examToEdit.shuffleOptions : true
  );

  // Class group allocation
  const [assignedClassIds, setAssignedClassIds] = useState<string[]>(
    examToEdit?.assignedClassIds || []
  );

  // Dynamic penalty tiers requested by user (1-10 deduction, 11-30 deduction, etc.)
  const [penaltyRules, setPenaltyRules] = useState<CheatingPenaltyTier[]>(
    examToEdit?.penaltyRules && examToEdit.penaltyRules.length > 0
      ? examToEdit.penaltyRules
      : [
          { id: 'tier-1', minViolations: 1, maxViolations: 10, pointDeduction: 15, description: 'Pelanggaran 1 - 10 kali' },
          { id: 'tier-2', minViolations: 11, maxViolations: 30, pointDeduction: 35, description: 'Pelanggaran 11 - 30 kali' },
          { id: 'tier-3', minViolations: 31, maxViolations: 999, pointDeduction: 100, description: 'Pelanggaran > 30 kali (Gugur / 0 Poin)' },
        ]
  );

  // Questions managed
  const [questions, setQuestions] = useState<Question[]>(examToEdit?.questions || []);
  const [isAikenModalOpen, setIsAikenModalOpen] = useState(false);
  const [validationError, setValidationError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  React.useEffect(() => {
    if (!isOpen) return;
    setTitle(examToEdit?.title || '');
    setCourseId(examToEdit?.courseId || defaultCourse?.id || '');
    setCourseName(examToEdit?.courseName || defaultCourse?.name || '');
    setCourseCode(examToEdit?.courseCode || defaultCourse?.code || 'IF3001');
    setTopicId(examToEdit?.topicId || defaultTopicId || '');
    setExamCategory(examToEdit?.examCategory || 'ujian_harian');
    setDurationMinutes(examToEdit?.durationMinutes || 45);
    setPassingGrade(examToEdit?.passingGrade || 70);
    setGradingComponentId(examToEdit?.gradingComponentId || '');
    setScoringMethod(examToEdit?.scoringMethod || 'irt');
    setIrtModel(examToEdit?.irtModel || '3PL');
    setQuestions(examToEdit?.questions || []);
    setAssignedClassIds(
      examToEdit?.assignedClassIds ||
        (defaultCourse?.assignedClassIds ? [...defaultCourse.assignedClassIds] : [])
    );
    setShowScoreImmediately(examToEdit ? examToEdit.showScoreImmediately : false);
    setAiProctoringEnabled(examToEdit ? examToEdit.aiProctoringEnabled : true);
    setShuffleQuestions(examToEdit?.shuffleQuestions !== undefined ? examToEdit.shuffleQuestions : true);
    setShuffleOptions(examToEdit?.shuffleOptions !== undefined ? examToEdit.shuffleOptions : true);
    if (examToEdit?.schedule?.startTime) {
      setStartTime(new Date(examToEdit.schedule.startTime).toISOString().slice(0, 16));
    } else {
      const n = new Date();
      setStartTime(new Date(n.getTime() + 10 * 60 * 1000).toISOString().slice(0, 16));
    }
    if (examToEdit?.schedule?.endTime) {
      setEndTime(new Date(examToEdit.schedule.endTime).toISOString().slice(0, 16));
    } else {
      const n = new Date();
      setEndTime(new Date(n.getTime() + 130 * 60 * 1000).toISOString().slice(0, 16));
    }
    if (examToEdit?.penaltyRules && examToEdit.penaltyRules.length > 0) {
      setPenaltyRules(examToEdit.penaltyRules);
    }
    setValidationError('');
    setSaveError(null);
  }, [isOpen, examToEdit, defaultCourse, defaultTopicId]);

  if (!isOpen) return null;

  const matchedCourse =
    courses.find((c) => c.id === courseId) ||
    courses.find(
      (c) =>
        c.code.toLowerCase() === courseCode.toLowerCase() ||
        c.name.toLowerCase() === courseName.toLowerCase()
    ) ||
    defaultCourse ||
    undefined;

  const availableTopics = [...(matchedCourse?.topics || [])].sort((a, b) => {
    if (a.meetingNumber !== b.meetingNumber) return a.meetingNumber - b.meetingNumber;
    return a.order - b.order;
  });

  const activeGradeConfig = resolveGradeConfig(gradeConfigs, {
    courseId: matchedCourse?.id,
    classId: assignedClassIds.length === 1 ? assignedClassIds[0] : undefined,
  });
  const selectableGroups = getSelectableComponentsForActivity(activeGradeConfig, 'exam');
  const flatSelectableComponents = selectableGroups.flatMap((g) => g.components);
  const selectedGradingComp = flatSelectableComponents.find((c) => c.id === gradingComponentId);

  const totalPoints = questions.reduce((sum, q) => sum + (q.points || 10), 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError('');
    setSaveError(null);

    if (!gradingComponentId || !selectedGradingComp) {
      setValidationError(
        'Anda harus memilih Komponen & Grup Penilaian terlebih dahulu sebelum membuat atau menyimpan ujian.'
      );
      return;
    }

    if (!title.trim() || !courseName.trim()) {
      setValidationError('Judul ujian dan nama mata kuliah wajib diisi.');
      return;
    }

    if (questions.length === 0) {
      setValidationError('Ujian harus memiliki minimal 1 butir soal. Silakan impor soal format Aiken.');
      return;
    }

    const startMs = new Date(startTime).getTime();
    const endMs = new Date(endTime).getTime();

    if (isNaN(startMs) || isNaN(endMs) || endMs <= startMs) {
      setValidationError('Jadwal selesai harus lebih lambat dari jadwal mulai.');
      return;
    }

    const computedMaxPoints = scoringMethod === 'irt' ? 100 : totalPoints;
    const resolvedCourseId = matchedCourse?.id || courseId || undefined;
    const resolvedTopicId = topicId.trim() || undefined;
    const isExistingExam = Boolean(examToEdit && exams.some((ex) => ex.id === examToEdit.id));

    setIsSaving(true);
    try {
      if (isExistingExam && examToEdit) {
        await updateExam({
          ...examToEdit,
          title,
          courseId: resolvedCourseId,
          courseName,
          courseCode,
          topicId: resolvedTopicId,
          examCategory,
          durationMinutes: Number(durationMinutes),
          passingGrade: Number(passingGrade),
          scoringMethod,
          irtModel,
          gradingGroupId: selectedGradingComp.groupId,
          gradingComponentId: selectedGradingComp.id,
          gradingComponentName: selectedGradingComp.name,
          schedule: {
            startTime: new Date(startTime).toISOString(),
            endTime: new Date(endTime).toISOString(),
          },
          questions,
          totalPoints: computedMaxPoints,
          showScoreImmediately,
          aiProctoringEnabled,
          shuffleQuestions,
          shuffleOptions,
          assignedClassIds: assignedClassIds || [],
          penaltyRules: penaltyRules || [],
        });
      } else {
        await addExam({
          title,
          courseId: resolvedCourseId,
          courseName,
          courseCode,
          topicId: resolvedTopicId,
          examCategory,
          lecturerId: currentUser?.id || 'admin',
          lecturerName: currentUser?.name || 'Dosen Pengampu',
          durationMinutes: Number(durationMinutes),
          passingGrade: Number(passingGrade),
          scoringMethod,
          irtModel,
          gradingGroupId: selectedGradingComp.groupId,
          gradingComponentId: selectedGradingComp.id,
          gradingComponentName: selectedGradingComp.name,
          schedule: {
            startTime: new Date(startTime).toISOString(),
            endTime: new Date(endTime).toISOString(),
          },
          questions,
          totalPoints: computedMaxPoints,
          showScoreImmediately,
          isScorePublished: false,
          allowLateSubmission: false,
          aiProctoringEnabled,
          shuffleQuestions,
          shuffleOptions,
          assignedClassIds: assignedClassIds || [],
          penaltyRules: penaltyRules || [],
        });
      }

      onClose();
    } catch (err: any) {
      console.error('Gagal menyimpan ujian:', err);
      setSaveError(err?.message || 'Gagal menyimpan ujian ke Firebase Firestore. Pastikan jaringan terhubung.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
        <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
          {/* Header */}
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                <BookOpen className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  {examToEdit ? 'Ubah Pengaturan Ujian' : 'Buat Ujian Baru'}
                </h2>
                <p className="text-xs text-slate-500">
                  Atur jadwal akses, timer pengerjaan, AI pengawas, dan opsi rilis nilai
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

          {/* Form Content */}
          <form onSubmit={handleSubmit} className="flex-1 p-6 overflow-y-auto space-y-5 text-xs">
            {validationError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{validationError}</span>
              </div>
            )}

            {saveError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <div>
                  <div className="font-bold">Gagal Menyimpan ke Firebase Firestore</div>
                  <div className="text-[11px] text-red-600">{saveError}</div>
                </div>
              </div>
            )}

            {/* Wajib Pilih Komponen Penilaian Terlebih Dahulu (Moodle Gradebook Link) */}
            <div className="p-4 rounded-xl border border-indigo-200 bg-indigo-50/50 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <label className="font-bold text-indigo-950 flex items-center gap-1.5 text-xs">
                  <Award className="w-4 h-4 text-indigo-600" />
                  <span>
                    Langkah Wajib: Pilih Grup &amp; Komponen Penilaian <span className="text-rose-600">*</span>
                  </span>
                </label>
                {selectedGradingComp && (
                  <span className="text-[11px] font-mono font-bold text-indigo-700">
                    Kontribusi: {selectedGradingComp.effectiveWeight}% dari Nilai Akhir
                  </span>
                )}
              </div>
              <select
                id="select-exam-grading-component"
                required
                value={gradingComponentId}
                onChange={(e) => setGradingComponentId(e.target.value)}
                className="w-full px-3 py-2.5 border border-indigo-300 rounded-lg bg-white text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">-- Pilih Komponen Penilaian di Buku Nilai --</option>
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
              <p className="text-[11px] text-slate-600">
                Ujian akan otomatis masuk dan terhitung ke dalam grup serta komponen penilaian yang Anda pilih pada Buku Nilai (tampilan Moodle).
              </p>
            </div>

            {/* Jenis Ujian (Semua Jenis Evaluasi) */}
            <div className="space-y-1.5">
              <label className="block font-bold text-slate-700">
                Jenis Ujian / Evaluasi
              </label>
              <div className="flex flex-wrap gap-1.5">
                {EXAM_CATEGORY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setExamCategory(opt.value)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                      examCategory === opt.value
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Basic Info */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2">
                <label className="block font-bold text-slate-700 mb-1">
                  Judul {getExamCategoryLabel(examCategory)} <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Contoh: Ujian Tengah Semester Pemrograman Web"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Kode Matkul</label>
                <input
                  type="text"
                  value={courseCode}
                  onChange={(e) => setCourseCode(e.target.value)}
                  placeholder="Contoh: IF3201"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2">
                <label className="block font-bold text-slate-700 mb-1">
                  Nama Mata Kuliah <span className="text-rose-500">*</span>
                </label>
                {courses.length > 0 && (
                  <select
                    value={matchedCourse?.id || ''}
                    onChange={(e) => {
                      const found = courses.find((c) => c.id === e.target.value);
                      if (found) {
                        setCourseId(found.id);
                        setCourseCode(found.code);
                        setCourseName(found.name);
                        setTopicId('');
                      }
                    }}
                    className="w-full px-3 py-1.5 mb-1.5 border border-slate-300 rounded-lg bg-slate-50 text-slate-700"
                  >
                    <option value="">-- Pilih Cepat dari Daftar Mata Kuliah --</option>
                    {courses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.code} - {c.name}
                      </option>
                    ))}
                  </select>
                )}
                <input
                  type="text"
                  required
                  value={courseName}
                  onChange={(e) => setCourseName(e.target.value)}
                  placeholder="Contoh: Rekayasa Perangkat Lunak"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Batas Lulus KKM (0–100)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={passingGrade}
                  onChange={(e) => setPassingGrade(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 font-mono tabular-nums font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Penempatan Slot Pertemuan / Topik Mata Kuliah */}
            {matchedCourse && (
              <div className="p-3.5 rounded-xl border border-blue-200 bg-blue-50/40 space-y-1.5">
                <label className="block font-bold text-slate-900 flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-blue-600" />
                  <span>Penempatan Slot Pertemuan / Topik ({matchedCourse.code})</span>
                </label>
                <select
                  id="select-exam-topic-placement"
                  value={topicId}
                  onChange={(e) => setTopicId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">
                    Umum / Pengantar Perkuliahan (Bagian Atas Mata Kuliah)
                  </option>
                  {availableTopics.map((t) => (
                    <option key={t.id} value={t.id}>
                      Pertemuan {t.meetingNumber}: {t.title}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-500">
                  {availableTopics.length === 0
                    ? 'Mata kuliah ini belum memiliki Pertemuan khusus, sehingga ujian akan tampil di bagian Umum & Pengantar.'
                    : 'Pilih slot Pertemuan tempat ujian ini akan ditampilkan pada halaman mata kuliah.'}
                </p>
              </div>
            )}

            {/* Schedule & Timing Window (Waktu Mulai & Selesai) */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="font-bold text-slate-800 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-blue-600" />
                Jadwal Akses &amp; Timer Pengerjaan
              </div>
              <p className="text-[11px] text-slate-500">
                Sistem akan mengunci akses ujian sebelum jadwal mulai dan setelah jadwal berakhir.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Jadwal Mulai Akses
                  </label>
                  <input
                    type="datetime-local"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white text-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Jadwal Berakhir Akses
                  </label>
                  <input
                    type="datetime-local"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white text-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Durasi Timer (Menit)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="5"
                      max="300"
                      value={durationMinutes}
                      onChange={(e) => setDurationMinutes(Number(e.target.value))}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white text-slate-900 pl-8 font-bold"
                    />
                    <Clock className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5" />
                  </div>
                </div>
              </div>
            </div>

            {/* Questions Bank & Aiken Import */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="font-bold text-slate-900 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-blue-600" />
                  Bank Butir Soal Ujian ({questions.length} Butir)
                </div>
                <button
                  type="button"
                  id="btn-open-aiken-import"
                  onClick={() => setIsAikenModalOpen(true)}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <FileText className="w-3.5 h-3.5" />
                  {questions.length > 0 ? 'Kelola / Impor Ulang Soal Aiken' : 'Impor Soal Aiken'}
                </button>
              </div>

              {questions.length > 0 ? (
                <div className="space-y-2">
                  <div className="text-xs text-slate-800 bg-white p-3 rounded-lg border border-slate-200 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-emerald-600" />
                      <span>
                        Terpasang <strong>{questions.length} butir soal pilihan ganda</strong>.
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-slate-700 font-mono tabular-nums">
                        {scoringMethod === 'irt'
                          ? `Skala IRT (${irtModel}): 100 Poin`
                          : `Total Klasik: ${totalPoints} Poin`}
                      </span>
                      {scoringMethod === 'irt' && (
                        <button
                          type="button"
                          onClick={() => setShowQuestionWeightsList(!showQuestionWeightsList)}
                          className="text-blue-600 hover:text-blue-800 font-semibold underline"
                        >
                          {showQuestionWeightsList
                            ? 'Sembunyikan Prior Soal'
                            : 'Atur Prior Kesulitan Soal'}
                        </button>
                      )}
                    </div>
                  </div>

                  {scoringMethod === 'irt' && showQuestionWeightsList && (
                    <div className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-48 overflow-y-auto">
                      {questions.map((q, qIdx) => {
                        const preset: IRTDifficultyPreset = q.difficultyPreset || 'sedang';
                        return (
                          <div
                            key={q.id}
                            className="px-3 py-2 flex items-center justify-between gap-3 text-[11px]"
                          >
                            <span className="truncate text-slate-700 flex-1">
                              <strong className="font-mono mr-1.5">{qIdx + 1}.</strong>
                              {q.text}
                            </span>
                            <div className="flex items-center gap-1 shrink-0">
                              {(['mudah', 'sedang', 'sulit'] as IRTDifficultyPreset[]).map(
                                (lvl) => (
                                  <button
                                    key={lvl}
                                    type="button"
                                    onClick={() =>
                                      setQuestions((prev) =>
                                        prev.map((item, idx) =>
                                          idx === qIdx
                                            ? { ...item, difficultyPreset: lvl }
                                            : item
                                        )
                                      )
                                    }
                                    className={`px-2 py-0.5 rounded capitalize font-semibold border transition-colors ${
                                      preset === lvl
                                        ? 'bg-blue-600 text-white border-blue-600'
                                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                                    }`}
                                  >
                                    {lvl}
                                  </button>
                                )
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-xs text-slate-500 bg-white p-3 rounded-lg border border-dashed border-slate-300 text-center">
                  Belum ada soal. Klik tombol <strong>Impor Soal Aiken</strong> untuk memasukkan butir soal.
                </div>
              )}
            </div>

            {/* Sistem Penilaian Berbasis IRT vs Klasik */}
            <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/40 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <div className="font-bold text-slate-900 flex items-center gap-1.5 text-xs">
                    <BarChart3 className="w-4 h-4 text-blue-600" />
                    Sistem Penilaian Soal (IRT vs Klasik)
                  </div>
                  <p className="text-[11px] text-slate-600 mt-0.5">
                    Pilih metode perhitungan skor ujian. Mode IRT membobot setiap butir soal secara otomatis berdasarkan respons empiris seluruh peserta.
                  </p>
                </div>

                <div className="flex items-center gap-1 p-1 bg-white border border-slate-200 rounded-lg self-start">
                  <button
                    type="button"
                    onClick={() => setScoringMethod('irt')}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap ${
                      scoringMethod === 'irt'
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Berbasis IRT
                  </button>
                  <button
                    type="button"
                    onClick={() => setScoringMethod('classical')}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap ${
                      scoringMethod === 'classical'
                        ? 'bg-slate-900 text-white'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Klasik (Bobot Tetap)
                  </button>
                </div>
              </div>

              {scoringMethod === 'irt' && (
                <div className="pt-2 border-t border-blue-200/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="text-[11px] text-slate-700">
                    <strong>Model IRT Aktif:</strong>{' '}
                    {irtModel === '1PL'
                      ? '1PL (Rasch) — Bobot berdasarkan Tingkat Kesulitan Soal (b).'
                      : irtModel === '2PL'
                      ? '2PL — Mengukur Tingkat Kesulitan (b) & Daya Pembeda Soal (a).'
                      : '3PL (Standar UTBK) — Mengukur Kesulitan (b), Daya Pembeda (a), & Koreksi Tebakan Semu (c).'}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {(['1PL', '2PL', '3PL'] as IRTModel[]).map((mdl) => (
                      <button
                        key={mdl}
                        type="button"
                        onClick={() => setIrtModel(mdl)}
                        className={`px-2.5 py-1 rounded-md text-xs font-semibold border transition-colors ${
                          irtModel === mdl
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        {mdl}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* User Requested Options: Score Release & AI Proctoring */}
            <div className="space-y-3">
              <div className="font-bold text-slate-800">Konfigurasi Nilai &amp; Pengawas AI</div>

              {/* Score Announcement Option */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex items-start justify-between gap-4">
                <div className="space-y-0.5">
                  <div className="font-bold text-slate-900 flex items-center gap-1.5">
                    <Award className="w-4 h-4 text-emerald-600" />
                    Pengumuman Nilai: Tampilkan Langsung ke Mahasiswa?
                  </div>
                  <p className="text-[11px] text-slate-500">
                    {showScoreImmediately
                      ? '✓ Nilai langsung ditampilkan ke mahasiswa seketika setelah ujian selesai / submit.'
                      : '🔒 Nilai ditahan terlebih dahulu. Mahasiswa baru dapat melihat nilai setelah Anda menyetujui atau merilisnya secara manual.'}
                  </p>
                </div>
                <button
                  type="button"
                  id="toggle-show-score-immediately"
                  onClick={() => setShowScoreImmediately(!showScoreImmediately)}
                  className={`p-1 rounded-lg transition-colors ${
                    showScoreImmediately ? 'text-emerald-600' : 'text-slate-400'
                  }`}
                >
                  {showScoreImmediately ? (
                    <ToggleRight className="w-8 h-8" />
                  ) : (
                    <ToggleLeft className="w-8 h-8" />
                  )}
                </button>
              </div>

              {/* AI Proctoring Option */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex items-start justify-between gap-4">
                <div className="space-y-0.5">
                  <div className="font-bold text-slate-900 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-blue-600" />
                    Pengawasan AI Deteksi Kecurangan Real-Time
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Mewajibkan webcam aktif, merekam upaya tab switch, ketiadaan wajah, deteksi orang ganda, dan mengirim laporan notifikasi langsung ke dosen.
                  </p>
                </div>
                <button
                  type="button"
                  id="toggle-ai-proctoring"
                  onClick={() => setAiProctoringEnabled(!aiProctoringEnabled)}
                  className={`p-1 rounded-lg transition-colors ${
                    aiProctoringEnabled ? 'text-blue-600' : 'text-slate-400'
                  }`}
                >
                  {aiProctoringEnabled ? (
                    <ToggleRight className="w-8 h-8" />
                  ) : (
                    <ToggleLeft className="w-8 h-8" />
                  )}
                </button>
              </div>

              {/* Fitur Pengacakan Soal & Opsi (User Request) */}
              <div className="p-4 rounded-xl border border-indigo-200 bg-indigo-50/40 space-y-3">
                <div className="font-bold text-indigo-950 flex items-center gap-1.5 text-xs">
                  <Shuffle className="w-4 h-4 text-indigo-600" />
                  Fitur Pengacakan Soal &amp; Opsi Jawaban (Anti-Kecurangan)
                </div>

                {/* Acak Nomor Soal */}
                <div className="flex items-center justify-between pt-1">
                  <div>
                    <div className="font-semibold text-slate-900 text-xs">
                      Acak Nomor / Urutan Butir Soal
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Setiap mahasiswa yang mengerjakan tidak sama nomor urut soalnya.
                    </p>
                  </div>
                  <button
                    type="button"
                    id="toggle-shuffle-questions"
                    onClick={() => setShuffleQuestions(!shuffleQuestions)}
                    className={`p-1 rounded-lg transition-colors ${
                      shuffleQuestions ? 'text-indigo-600' : 'text-slate-400'
                    }`}
                  >
                    {shuffleQuestions ? (
                      <ToggleRight className="w-8 h-8" />
                    ) : (
                      <ToggleLeft className="w-8 h-8" />
                    )}
                  </button>
                </div>

                {/* Acak Opsi Jawaban */}
                <div className="flex items-center justify-between pt-2 border-t border-indigo-100">
                  <div>
                    <div className="font-semibold text-slate-900 text-xs">
                      Acak Opsi Pilihan Jawaban (A, B, C, D)
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Posisi opsi jawaban diacak berbeda untuk setiap mahasiswa.
                    </p>
                  </div>
                  <button
                    type="button"
                    id="toggle-shuffle-options"
                    onClick={() => setShuffleOptions(!shuffleOptions)}
                    className={`p-1 rounded-lg transition-colors ${
                      shuffleOptions ? 'text-indigo-600' : 'text-slate-400'
                    }`}
                  >
                    {shuffleOptions ? (
                      <ToggleRight className="w-8 h-8" />
                    ) : (
                      <ToggleLeft className="w-8 h-8" />
                    )}
                  </button>
                </div>
              </div>

              {/* Alokasi Pengelompokan Kelas */}
              {classes.length > 0 && (
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
                  <div className="font-bold text-slate-900 flex items-center gap-1.5 text-xs">
                    <Layers className="w-4 h-4 text-purple-600" />
                    Target Kelas / Rombel Peserta Ujian
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Pilih kelas mahasiswa yang diperbolehkan mengikuti ujian ini (kosongkan jika terbuka untuk semua kelas):
                  </p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {classes.map((cls) => {
                      const isSelected = assignedClassIds.includes(cls.id);
                      return (
                        <button
                          key={cls.id}
                          type="button"
                          onClick={() => {
                            if (isSelected) {
                              setAssignedClassIds(assignedClassIds.filter((id) => id !== cls.id));
                            } else {
                              setAssignedClassIds([...assignedClassIds, cls.id]);
                            }
                          }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                            isSelected
                              ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                              : 'bg-white text-slate-700 border-slate-300 hover:border-slate-400'
                          }`}
                        >
                          {cls.name} ({cls.code})
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Ketentuan Sanksi Pengurangan Poin Kecurangan (User Request) */}
              <div className="p-4 rounded-xl border border-rose-200 bg-rose-50/40 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="font-bold text-rose-950 flex items-center gap-1.5 text-xs">
                      <AlertTriangle className="w-4 h-4 text-rose-600" />
                      Ketentuan Pemotongan Poin Sanksi Kecurangan
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Tentukan ambang frekuensi kecurangan dan jumlah poin yang dikurangi otomatis dari nilai akhir.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      const lastTier = penaltyRules[penaltyRules.length - 1];
                      const nextMin = lastTier ? lastTier.maxViolations + 1 : 1;
                      setPenaltyRules([
                        ...penaltyRules,
                        {
                          id: 'tier-' + Date.now(),
                          minViolations: nextMin,
                          maxViolations: nextMin + 10,
                          pointDeduction: 20,
                          description: `Pelanggaran ${nextMin} - ${nextMin + 10} kali`,
                        },
                      ]);
                    }}
                    className="px-2.5 py-1 bg-white hover:bg-rose-50 text-rose-700 border border-rose-200 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Tambah Rentang</span>
                  </button>
                </div>

                <div className="space-y-2 pt-1">
                  {penaltyRules.map((rule, idx) => (
                    <div
                      key={idx}
                      className="p-3 bg-white rounded-xl border border-rose-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-slate-500 text-[11px]">Rentang:</span>
                        <input
                          type="number"
                          min="1"
                          value={rule.minViolations}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setPenaltyRules(
                              penaltyRules.map((r, i) => (i === idx ? { ...r, minViolations: val } : r))
                            );
                          }}
                          className="w-14 px-2 py-1 rounded border border-slate-300 text-center font-bold"
                        />
                        <span className="text-slate-400">s/d</span>
                        <input
                          type="number"
                          min={rule.minViolations}
                          value={rule.maxViolations}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setPenaltyRules(
                              penaltyRules.map((r, i) => (i === idx ? { ...r, maxViolations: val } : r))
                            );
                          }}
                          className="w-16 px-2 py-1 rounded border border-slate-300 text-center font-bold"
                        />
                        <span className="text-slate-500 text-[11px]">kali</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-slate-500 text-[11px]">Potong:</span>
                        <div className="relative">
                          <input
                            type="number"
                            min="0"
                            max="1000"
                            value={rule.pointDeduction}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              setPenaltyRules(
                                penaltyRules.map((r, i) => (i === idx ? { ...r, pointDeduction: val } : r))
                              );
                            }}
                            className="w-16 px-2 py-1 rounded border border-rose-300 text-center font-bold text-rose-700 bg-rose-50/50"
                          />
                        </div>
                        <span className="text-rose-700 font-bold text-[11px]">Poin</span>

                        {penaltyRules.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setPenaltyRules(penaltyRules.filter((_, i) => i !== idx))}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors ml-2"
                            title="Hapus Tingkatan Ini"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer buttons */}
            <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={isSaving}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="submit"
                id="btn-save-exam-form"
                disabled={isSaving}
                className="px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-75 disabled:cursor-wait rounded-lg shadow-sm transition-colors flex items-center gap-1.5"
              >
                {isSaving ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin shrink-0" />
                    <span>Menyimpan ke Firebase Firestore...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    <span>{examToEdit ? 'Simpan Perubahan Ujian' : 'Terbitkan Ujian Baru'}</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Embedded Aiken Importer Modal */}
      <AikenImportModal
        isOpen={isAikenModalOpen}
        onClose={() => setIsAikenModalOpen(false)}
        onImportQuestions={(imported) => {
          setQuestions(imported);
        }}
      />
    </>
  );
};
