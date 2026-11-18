export type Role = 'mahasiswa' | 'dosen' | 'admin';

export type ScoringMethod = 'classical' | 'irt';
export type IRTModel = '1PL' | '2PL' | '3PL';
export type IRTDifficultyPreset = 'mudah' | 'sedang' | 'sulit';

export type StoredFileType =
  | 'pdf'
  | 'ppt'
  | 'pptx'
  | 'doc'
  | 'docx'
  | 'xls'
  | 'xlsx'
  | 'zip'
  | 'image'
  | 'other'
  | 'link';

export interface ClassFile {
  id: string;
  classId: string;
  title: string;
  description?: string;
  fileType: StoredFileType;
  fileName: string;
  fileId?: string;
  fileUrl?: string;
  mimeType?: string;
  fileSize?: string;
  sizeBytes?: number;
  uploadedAt: string;
  uploadedBy: string;
}

export interface ClassGroup {
  id: string;
  name: string;          // e.g. "TI-3A"
  code: string;          // e.g. "TI3A"
  academicYear?: string; // e.g. "2024/2025 Genap"
  description?: string;
  files?: ClassFile[];
  createdAt?: string;
}

export interface User {
  id: string;
  name: string;
  nimOrNip: string;
  role: Role;
  avatar?: string;
  email: string;
  department: string;
  classId?: string;      // ID rombel / kelas mahasiswa
  className?: string;    // Nama kelas mahasiswa (e.g. "TI-3A")
}

export interface CheatingPenaltyTier {
  id: string;
  minViolations: number;      // e.g. 1
  maxViolations: number;      // e.g. 10
  pointDeduction: number;     // e.g. 10
  actionDescription?: string; // e.g. "Pengurangan 10 poin"
  description?: string;       // Alias for description
}

export interface QuestionOption {
  id: string; // 'A', 'B', 'C', 'D', 'E'
  text: string;
}

export interface Question {
  id: string;
  text: string;
  options: QuestionOption[];
  correctAnswer: string; // e.g. 'A'
  points: number;
  difficultyPreset?: IRTDifficultyPreset; // Prior kesulitan awal sebelum/bersama kalibrasi empiris
}

export interface IRTItemAnalysis {
  questionId: string;
  questionNumber: number;
  questionText: string;
  correctAnswer: string;
  optionsCount: number;
  totalRespondents: number;
  correctCount: number;
  proportionCorrect: number; // p-value (0..1)
  difficultyB: number;       // parameter b (-3.0 s/d +3.0)
  discriminationA: number;   // parameter a (0.4 s/d 2.5)
  guessingC: number;         // parameter c (0 s/d 0.35)
  difficultyCategory: 'Mudah' | 'Sedang' | 'Sulit';
  qualityStatus: 'Sangat Baik' | 'Baik' | 'Cukup' | 'Perlu Evaluasi';
  irtWeight: number;         // Bobot poin dinamis IRT pada skala 100
}

export interface ExamSchedule {
  startTime: string; // ISO string
  endTime: string;   // ISO string
}

export type ExamStatus = 'upcoming' | 'ongoing' | 'completed';

export type ExamCategory =
  | 'kuis'
  | 'ujian_harian'
  | 'uts'
  | 'uas'
  | 'praktikum'
  | 'remedial';

export interface Exam {
  id: string;
  title: string;
  courseId?: string;             // Opsional: tautan langsung ke ID Mata Kuliah
  courseCode: string;
  courseName: string;
  lecturerId: string;
  lecturerName: string;
  durationMinutes: number; // e.g. 60
  schedule: ExamSchedule;
  questions: Question[];
  totalPoints: number;
  passingGrade: number; // e.g. 70

  // Sistem & Komponen Penilaian (Moodle Gradebook Integration)
  examCategory?: ExamCategory;   // Jenis ujian: Kuis, Ujian Harian, UTS, UAS, Praktikum, Remedial
  scoringMethod?: ScoringMethod; // 'classical' | 'irt'
  irtModel?: IRTModel;           // '1PL' | '2PL' | '3PL'
  topicId?: string;              // Opsional: keterkaitan dengan Pertemuan/Topik Moodle
  gradingGroupId?: string;       // ID grup kelompok penilaian
  gradingComponentId?: string;   // ID komponen penilaian wajib dipilih saat membuat ujian
  gradingComponentName?: string; // Label nama komponen penilaian untuk tampilan cepat

  // Settings requested by user
  showScoreImmediately: boolean; // Dosen option: nilai muncul langsung atau tidak
  isScorePublished: boolean;     // Status apakah dosen sudah merilis nilai secara umum
  aiProctoringEnabled: boolean;  // AI Proctoring switch
  allowLateSubmission: boolean;
  shuffleQuestions?: boolean;     // Acak urutan butir nomor soal per mahasiswa
  shuffleOptions?: boolean;       // Acak opsi jawaban (A, B, C, D) per mahasiswa
  assignedClassIds?: string[];    // Filter kelas peserta ujian yang ditugaskan
  targetClassIds?: string[];      // Filter kelas peserta ujian (kosong / ['all'] = semua kelas)
  penaltyRules?: CheatingPenaltyTier[]; // Aturan pengurangan poin kecurangan
  createdAt: string;
}

export type ViolationType =
  | 'tab_switch'           // Pindah tab / window blur
  | 'fullscreen_exit'      // Keluar fullscreen / percobaan keluar layar
  | 'face_absence'         // Wajah hilang dari kamera
  | 'no_face'              // Alias wajah tidak terdeteksi
  | 'multiple_faces'       // Terdeteksi lebih dari 1 orang
  | 'looking_away'         // Menoleh mencurigakan / pandangan hilang
  | 'gadget_detected'      // Ponsel / gawai terdeteksi
  | 'right_click_attempt'  // Percobaan copy / inspect
  | 'suspicious_audio'     // Suara mencurigakan
  | 'audio_noise'          // Alias kebisingan mencurigakan
  | 'cursor_exit';         // Kursor keluar dari area jendela ujian

export interface ViolationLog {
  id: string;
  examId: string;
  examTitle: string;
  studentId: string;
  studentName: string;
  studentNim: string;
  studentClassName?: string; // Kelas mahasiswa pelanggar (bisa dilihat mahasiswa lain)
  timestamp: string;
  violationType: ViolationType;
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
  snapshotUrl?: string; // base64 thumbnail
  aiConfidence?: number;
  reviewedByLecturer?: boolean;
}

export interface StudentAnswer {
  questionId: string;
  selectedOption: string; // 'A', 'B', etc. (original option ID)
  isFlagged: boolean;     // Ragu-ragu
}

export interface ExamAttempt {
  id: string;
  examId: string;
  studentId: string;
  studentName: string;
  studentNim: string;
  studentClassName?: string;
  startedAt: string;
  submittedAt?: string;
  isCompleted: boolean;
  answers: Record<string, StudentAnswer>;
  correctCount?: number;      // Jumlah butir dijawab benar
  rawScore?: number;          // Nilai murni sebelum penalti
  penaltyDeduction?: number;  // Pemotongan poin akibat kecurangan
  score?: number;             // Nilai akhir setelah pemotongan poin
  maxScore?: number;
  percentage?: number;
  isPassed?: boolean;
  // IRT Psychometric Scoring Metrics
  scoringMethodUsed?: ScoringMethod;
  irtModelUsed?: IRTModel;
  irtTheta?: number;          // Estimasi kemampuan laten Theta (-3.5 s/d +3.5)
  irtStandardError?: number;  // Standard Error of Estimate SE(Theta)
  irtScaledScore?: number;    // Skor standar IRT skala UTBK (200 - 850, rerata 500)
  irtItemWeights?: Record<string, number>; // Bobot poin dinamis per questionId
  violationsCount: number;
  violationLogs: ViolationLog[];
  status: 'in_progress' | 'submitted' | 'timed_out';
  integrityPledgeAccepted?: boolean; // Pakta integritas dicentang
  pledgedAt?: string;
  // Persistent randomized order per student
  shuffledQuestionIds?: string[];
  shuffledOptionMap?: Record<string, string[]>; // questionId -> array of option IDs e.g. ['B', 'D', 'A', 'C']
}

export interface CourseMaterial {
  id: string;
  courseId: string;
  topicId?: string;
  title: string;
  description?: string;
  fileType: StoredFileType;
  fileName: string;
  fileId?: string;
  fileUrl?: string; // firestore://fileId or external URL
  mimeType?: string;
  fileSize?: string;
  sizeBytes?: number;
  uploadedAt: string;
  uploadedBy: string;
}

export interface CourseAssignmentSubmission {
  id: string;
  assignmentId: string;
  courseId: string;
  studentId: string;
  studentName: string;
  studentNim: string;
  studentClassName?: string;
  submittedAt: string;
  submissionStatus?: 'tepat_waktu' | 'terlambat';
  fileName: string;
  fileId?: string;
  fileUrl?: string;
  mimeType?: string;
  fileSize?: string;
  sizeBytes?: number;
  notes?: string;
  grade?: number;
  feedback?: string;
}

export interface CourseAssignment {
  id: string;
  courseId: string;
  topicId?: string;
  title: string;
  instructions: string;
  openDate?: string;           // ISO date string when submission opens
  dueDate: string;             // ISO date string deadline
  lockAfterDeadline?: boolean; // Automatically lock submission slot after dueDate (default true)
  maxPoints: number;
  gradingGroupId?: string;     // ID grup kelompok penilaian
  gradingComponentId?: string; // ID komponen penilaian wajib dipilih saat membuat tugas
  gradingComponentName?: string;
  attachmentFileId?: string;
  attachmentFileName?: string;
  attachmentFileSize?: string;
  attachmentMimeType?: string;
  attachmentFileUrl?: string;
  createdAt: string;
  submissions: CourseAssignmentSubmission[];
}

export interface CourseVideo {
  id: string;
  courseId: string;
  topicId?: string;
  title: string;
  youtubeUrl: string;
  youtubeVideoId: string; // 11-char YouTube ID
  description?: string;
  addedAt: string;
}

export interface CourseTopic {
  id: string;
  courseId: string;
  meetingNumber: number; // e.g., 1, 2, 3
  title: string;         // Judul Topik / Pertemuan
  summary?: string;      // Keterangan pertemuan / capaian materi
  order: number;
  createdAt: string;
}

export interface CourseContentBlock {
  id: string;
  courseId: string;
  topicId?: string;
  title?: string;
  textContent?: string;  // Konten teks / pengantar / instruksi
  imageFileId?: string;  // File ID gambar di stored_files
  imageFileName?: string;
  imageMimeType?: string;
  imageUrl?: string;
  imageCaption?: string;
  createdBy: string;
  createdAt: string;
}

export type PeerAssessmentScoringType = 'direct_score' | 'rubric_options';
export type LecturerPeerOverrideMode = 'replace' | 'include_in_average';

export interface PeerRubricOption {
  id: string;
  label: string;   // e.g. "Sangat Baik / Lengkap"
  points: number;  // e.g. 25
}

export interface PeerRubricCriterion {
  id: string;
  title: string;         // e.g. "Kreativitas & Arsitektur Sistem"
  description?: string;
  options: PeerRubricOption[];
}

export interface PeerReviewEntry {
  id: string;
  reviewerId: string;
  reviewerName: string;
  reviewerNim: string;
  reviewerRole: 'mahasiswa' | 'dosen';
  scoringType: PeerAssessmentScoringType;
  directScore?: number;
  selectedOptions?: Record<string, string>; // criterionId -> optionId
  criterionPoints?: Record<string, number>; // criterionId -> points
  totalScore: number;
  comment?: string;
  submittedAt: string;
}

export interface PeerProjectSubmission {
  id: string;
  projectId: string;
  courseId: string;
  studentId: string;
  studentName: string;
  studentNim: string;
  studentClassName?: string;
  submittedAt: string;
  submissionStatus?: 'tepat_waktu' | 'terlambat';
  fileName: string;
  fileId?: string;
  fileUrl?: string;
  mimeType?: string;
  fileSize?: string;
  sizeBytes?: number;
  notes?: string;
  assignedReviewerIds: string[];
  peerReviews: PeerReviewEntry[];
  lecturerScore?: number;
  lecturerFeedback?: string;
  lecturerMode?: LecturerPeerOverrideMode;
  lecturerGradedBy?: string;
  lecturerGradedAt?: string;
  finalScore?: number; // Computed average of peer reviews (or adjusted/overridden by lecturer)
}

export interface PeerProjectAssignment {
  id: string;
  courseId: string;
  topicId?: string;
  title: string;
  instructions: string;
  openDate?: string;
  dueDate: string;
  lockAfterDeadline?: boolean;
  maxPoints: number;
  scoringType: PeerAssessmentScoringType;
  rubricCriteria?: PeerRubricCriterion[];
  reviewersPerSubmission: number; // Berapa orang mahasiswa yang menilai setiap satu tugas
  anonymousPeerReview?: boolean;
  gradingGroupId?: string;
  gradingComponentId?: string;
  gradingComponentName?: string;
  attachmentFileId?: string;
  attachmentFileName?: string;
  attachmentFileSize?: string;
  attachmentMimeType?: string;
  attachmentFileUrl?: string;
  createdAt: string;
  submissions: PeerProjectSubmission[];
}

export interface Course {
  id: string;
  code: string;         // e.g. "TI-301"
  name: string;         // e.g. "Pemrograman Web Lanjut"
  description: string;
  credits: number;      // e.g. 3
  lecturerId: string;
  lecturerName: string;
  semester?: string;
  schedule?: string;
  assignedClassIds?: string[]; // IDs rombel e.g. ['class-ti-3a']
  enrolledUserIds?: string[];  // IDs semua pengguna (Mahasiswa, Dosen, Admin) yang terdaftar di mata kuliah
  topics?: CourseTopic[];
  contentBlocks?: CourseContentBlock[];
  materials: CourseMaterial[];
  assignments: CourseAssignment[];
  peerProjects?: PeerProjectAssignment[];
  videos: CourseVideo[];
  createdAt: string;
}

export interface AikenParseError {
  line: number;
  message: string;
  rawText: string;
}

export interface AikenParseResult {
  success: boolean;
  questions: Question[];
  errors: AikenParseError[];
  totalQuestions: number;
}

export type AttendanceStatus = 'hadir' | 'izin' | 'sakit' | 'terlambat' | 'alfa';

export interface AttendanceRecord {
  id: string;
  sessionId: string;
  studentId: string;
  studentName: string;
  studentNim: string;
  studentClassId?: string;
  studentClassName?: string;
  status: AttendanceStatus;
  submittedAt: string;
  note?: string;
  scannedToken?: string;
  editedByLecturer?: boolean;
  editedByName?: string;
  editedAt?: string;
}

export interface AttendanceSession {
  id: string;
  scope: 'class' | 'course';
  classId?: string;
  courseId?: string;
  title: string;
  meetingNumber?: number;
  description?: string;
  lecturerId: string;
  lecturerName: string;
  startTime: string;           // ISO string: waktu mulai absen
  endTime: string;             // ISO string: batas akhir waktu absen
  qrRefreshSeconds: number;    // Interval auto-refresh QR (detik), mis. 15, 20, 30
  currentQrToken: string;      // Token QR aktif milik dosen
  previousQrToken?: string;    // Token sebelumnya (grace window singkat 8 detik untuk latensi)
  qrUpdatedAt: string;         // ISO timestamp pembaruan QR terakhir
  allowedStatuses: AttendanceStatus[]; // Opsi absen yang dapat dipilih mahasiswa setelah scan QR
  requireNoteForPermit: boolean;       // Format: wajib isi keterangan jika memilih Izin/Sakit
  minNoteLength?: number;              // Panjang minimal keterangan jika diwajibkan
  noteFormatHint?: string;             // Petunjuk format pengisian absensi dari dosen
  isActive: boolean;
  records: AttendanceRecord[];
  createdAt: string;
}

export interface GradeCategory {
  id: string;
  letter: string;      // e.g. 'A', 'A-', 'B+', 'B', 'C', 'D', 'E'
  minScore: number;    // inclusive lower bound (0..100)
  maxScore: number;    // inclusive upper bound (0..100)
  predicate: string;   // e.g. 'Sangat Baik (Istimewa)', 'Baik', 'Cukup', 'Kurang', 'Tidak Lulus'
  isPassed: boolean;
}

export interface AttendanceStatusScores {
  hadir: number;
  izin: number;
  sakit: number;
  terlambat: number;
  alfa: number;
}

export type GradingGroupAggregation = 'weighted_mean' | 'simple_mean';
export type GradingComponentSource = 'exam' | 'assignment' | 'attendance' | 'any';

export interface GradingGroup {
  id: string;
  name: string;
  description?: string;
  weight: number; // Bobot grup terhadap nilai akhir (0..100)
  aggregation: GradingGroupAggregation;
  order: number;
}

export interface GradingComponent {
  id: string;
  groupId: string;
  name: string;
  sourceType: GradingComponentSource;
  weight: number; // Bobot komponen di dalam grupnya (0..100)
  maxScore?: number;
  order: number;
}

export interface GradeConfig {
  id: string; // e.g. 'global_default' | 'class_{classId}' | 'course_{courseId}'
  scope: 'global' | 'class' | 'course';
  classId?: string;
  courseId?: string;
  examWeight: number;       // Persentase bobot ujian (0..100)
  assignmentWeight: number; // Persentase bobot tugas (0..100)
  attendanceWeight: number; // Persentase bobot absensi (0..100)
  gradingGroups?: GradingGroup[];
  gradingComponents?: GradingComponent[];
  statusScores: AttendanceStatusScores;
  categories: GradeCategory[];
  updatedAt: string;
  updatedBy: string;
}
