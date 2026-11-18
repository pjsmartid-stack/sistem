import {
  AttendanceSession,
  AttendanceStatus,
  AttendanceStatusScores,
  Course,
  Exam,
  ExamAttempt,
  ExamCategory,
  GradeCategory,
  GradeConfig,
  GradingComponent,
  GradingGroup,
  User,
} from '../types';
import { computePeerSubmissionMetrics } from './peerAssessment';

export const DEFAULT_ATTENDANCE_STATUS_SCORES: AttendanceStatusScores = {
  hadir: 100,
  izin: 75,
  sakit: 75,
  terlambat: 70,
  alfa: 0,
};

export const DEFAULT_GRADE_CATEGORIES: GradeCategory[] = [
  { id: 'cat-a', letter: 'A', minScore: 85, maxScore: 100, predicate: 'Istimewa', isPassed: true },
  { id: 'cat-am', letter: 'A-', minScore: 80, maxScore: 84.99, predicate: 'Sangat Baik', isPassed: true },
  { id: 'cat-bp', letter: 'B+', minScore: 75, maxScore: 79.99, predicate: 'Lebih dari Baik', isPassed: true },
  { id: 'cat-b', letter: 'B', minScore: 70, maxScore: 74.99, predicate: 'Baik', isPassed: true },
  { id: 'cat-cp', letter: 'C+', minScore: 65, maxScore: 69.99, predicate: 'Lebih dari Cukup', isPassed: true },
  { id: 'cat-c', letter: 'C', minScore: 60, maxScore: 64.99, predicate: 'Cukup', isPassed: true },
  { id: 'cat-d', letter: 'D', minScore: 50, maxScore: 59.99, predicate: 'Kurang', isPassed: false },
  { id: 'cat-e', letter: 'E', minScore: 0, maxScore: 49.99, predicate: 'Gagal', isPassed: false },
];

export function createDefaultGradingStructure(weights?: {
  examWeight?: number;
  assignmentWeight?: number;
  attendanceWeight?: number;
}): { gradingGroups: GradingGroup[]; gradingComponents: GradingComponent[] } {
  const examW = weights?.examWeight ?? 45;
  const assW = weights?.assignmentWeight ?? 35;
  const attW = weights?.attendanceWeight ?? 20;

  const gradingGroups: GradingGroup[] = [
    {
      id: 'grp-ujian',
      name: 'Kelompok Evaluasi Ujian & Kuis',
      description: 'Kumpulan evaluasi berbasis ujian tertulis/CBT dan kuis harian',
      weight: examW,
      aggregation: 'weighted_mean',
      order: 1,
    },
    {
      id: 'grp-tugas',
      name: 'Kelompok Tugas & Praktikum',
      description: 'Penugasan mandiri, laporan praktikum, dan proyek kelas',
      weight: assW,
      aggregation: 'weighted_mean',
      order: 2,
    },
    {
      id: 'grp-absensi',
      name: 'Kelompok Kehadiran & Partisipasi',
      description: 'Presensi perkuliahan berbasis QR Code dinamis',
      weight: attW,
      aggregation: 'weighted_mean',
      order: 3,
    },
  ];

  const gradingComponents: GradingComponent[] = [
    {
      id: 'cmp-kuis',
      groupId: 'grp-ujian',
      name: 'Kuis / Evaluasi Harian',
      sourceType: 'exam',
      weight: 20,
      maxScore: 100,
      order: 1,
    },
    {
      id: 'cmp-uts',
      groupId: 'grp-ujian',
      name: 'Ujian Tengah Semester (UTS)',
      sourceType: 'exam',
      weight: 40,
      maxScore: 100,
      order: 2,
    },
    {
      id: 'cmp-uas',
      groupId: 'grp-ujian',
      name: 'Ujian Akhir Semester (UAS)',
      sourceType: 'exam',
      weight: 40,
      maxScore: 100,
      order: 3,
    },
    {
      id: 'cmp-tugas-mandiri',
      groupId: 'grp-tugas',
      name: 'Tugas Mandiri / Terstruktur',
      sourceType: 'assignment',
      weight: 50,
      maxScore: 100,
      order: 1,
    },
    {
      id: 'cmp-tugas-proyek',
      groupId: 'grp-tugas',
      name: 'Proyek / Laporan Praktikum',
      sourceType: 'assignment',
      weight: 50,
      maxScore: 100,
      order: 2,
    },
    {
      id: 'cmp-absensi',
      groupId: 'grp-absensi',
      name: 'Absensi Perkuliahan',
      sourceType: 'attendance',
      weight: 100,
      maxScore: 100,
      order: 1,
    },
  ];

  return { gradingGroups, gradingComponents };
}

export function ensureMoodleStructure(config: GradeConfig): {
  groups: GradingGroup[];
  components: GradingComponent[];
} {
  if (
    config.gradingGroups &&
    config.gradingGroups.length > 0 &&
    config.gradingComponents
  ) {
    return {
      groups: [...config.gradingGroups].sort((a, b) => a.order - b.order),
      components: [...config.gradingComponents].sort((a, b) => a.order - b.order),
    };
  }
  const def = createDefaultGradingStructure({
    examWeight: config.examWeight,
    assignmentWeight: config.assignmentWeight,
    attendanceWeight: config.attendanceWeight,
  });
  return {
    groups: def.gradingGroups,
    components: def.gradingComponents,
  };
}

export function syncLegacyWeightsFromStructure(
  groups: GradingGroup[],
  components: GradingComponent[]
): { examWeight: number; assignmentWeight: number; attendanceWeight: number } {
  let examWeight = 0;
  let assignmentWeight = 0;
  let attendanceWeight = 0;

  groups.forEach((grp) => {
    const childComps = components.filter((c) => c.groupId === grp.id);
    if (childComps.length === 0) {
      examWeight += grp.weight;
      return;
    }
    const totalChildW =
      grp.aggregation === 'simple_mean'
        ? childComps.length
        : childComps.reduce((s, c) => s + (c.weight || 0), 0);

    childComps.forEach((c) => {
      const share =
        totalChildW > 0
          ? (grp.aggregation === 'simple_mean' ? 1 : c.weight || 0) / totalChildW
          : 1 / childComps.length;
      const contrib = grp.weight * share;
      if (c.sourceType === 'attendance') attendanceWeight += contrib;
      else if (c.sourceType === 'assignment') assignmentWeight += contrib;
      else examWeight += contrib;
    });
  });

  return {
    examWeight: Math.round(examWeight),
    assignmentWeight: Math.round(assignmentWeight),
    attendanceWeight: Math.round(attendanceWeight),
  };
}

export function getComponentEffectiveWeight(
  component: GradingComponent,
  group: GradingGroup,
  allGroupComponents: GradingComponent[]
): number {
  if (allGroupComponents.length === 0) return 0;
  if (group.aggregation === 'simple_mean') {
    return Number((group.weight / allGroupComponents.length).toFixed(2));
  }
  const totalCompWeight = allGroupComponents.reduce((s, c) => s + (c.weight || 0), 0);
  if (totalCompWeight <= 0) {
    return Number((group.weight / allGroupComponents.length).toFixed(2));
  }
  return Number(((group.weight * (component.weight || 0)) / totalCompWeight).toFixed(2));
}

export function getSelectableComponentsForActivity(
  config: GradeConfig,
  activityKind: 'exam' | 'assignment'
): Array<{ group: GradingGroup; components: Array<GradingComponent & { effectiveWeight: number }> }> {
  const { groups, components } = ensureMoodleStructure(config);
  return groups
    .map((group) => {
      const groupComps = components.filter((c) => c.groupId === group.id);
      const matchingComps = groupComps
        .filter((c) => c.sourceType === activityKind || c.sourceType === 'any')
        .map((c) => ({
          ...c,
          effectiveWeight: getComponentEffectiveWeight(c, group, groupComps),
        }));
      return {
        group,
        components: matchingComps,
      };
    })
    .filter((entry) => entry.components.length > 0);
}

export function createDefaultGradeConfig(params: {
  scope: 'global' | 'class' | 'course';
  classId?: string;
  courseId?: string;
  updatedBy?: string;
}): GradeConfig {
  const id =
    params.scope === 'course' && params.courseId
      ? `course_${params.courseId}`
      : params.scope === 'class' && params.classId
      ? `class_${params.classId}`
      : 'global_default';

  const { gradingGroups, gradingComponents } = createDefaultGradingStructure();

  return {
    id,
    scope: params.scope,
    classId: params.classId,
    courseId: params.courseId,
    examWeight: 45,
    assignmentWeight: 35,
    attendanceWeight: 20,
    gradingGroups,
    gradingComponents,
    statusScores: { ...DEFAULT_ATTENDANCE_STATUS_SCORES },
    categories: DEFAULT_GRADE_CATEGORIES.map((c) => ({ ...c })),
    updatedAt: new Date().toISOString(),
    updatedBy: params.updatedBy || 'Sistem Akademik',
  };
}

export function resolveGradeConfig(
  gradeConfigs: GradeConfig[],
  context: { classId?: string; courseId?: string }
): GradeConfig {
  let found: GradeConfig | undefined;

  if (context.courseId) {
    found = gradeConfigs.find(
      (g) => g.scope === 'course' && g.courseId === context.courseId
    );
  }

  if (!found && context.classId) {
    found = gradeConfigs.find(
      (g) => g.scope === 'class' && g.classId === context.classId
    );
  }

  if (!found) {
    found = gradeConfigs.find((g) => g.scope === 'global' || g.id === 'global_default');
  }

  if (!found) {
    return createDefaultGradeConfig({ scope: 'global' });
  }

  const { groups, components } = ensureMoodleStructure(found);
  return {
    ...found,
    gradingGroups: groups,
    gradingComponents: components,
  };
}

export function classifyScoreCategory(
  score: number,
  categories: GradeCategory[]
): GradeCategory | null {
  if (!categories || categories.length === 0) return null;
  const clamped = Math.max(0, Math.min(100, Number(score.toFixed(2))));
  const sorted = [...categories].sort((a, b) => b.minScore - a.minScore);
  const matched = sorted.find((c) => clamped >= c.minScore && clamped <= c.maxScore);
  if (matched) return matched;
  const fallback = sorted.find((c) => clamped >= c.minScore);
  return fallback || sorted[sorted.length - 1] || null;
}

export interface MoodleActivityItem {
  id: string;
  kind: 'exam' | 'assignment' | 'attendance';
  title: string;
  subtitle: string;
  score: number | null;
  maxScore: number;
  percentage: number | null;
  statusLabel: string;
}

export interface MoodleComponentBreakdown {
  component: GradingComponent;
  effectiveWeight: number;
  score: number | null;
  category: GradeCategory | null;
  items: MoodleActivityItem[];
}

export interface MoodleGroupBreakdown {
  group: GradingGroup;
  groupScore: number | null;
  category: GradeCategory | null;
  components: MoodleComponentBreakdown[];
}

export interface StudentGradeBreakdown {
  student: User;
  examScore: number | null;
  examTakenCount: number;
  examTotalCount: number;
  examDetails: Array<{
    examId: string;
    title: string;
    courseCode: string;
    componentName: string;
    score: number;
    percentage: number;
    scoringMethod: string;
  }>;
  assignmentScore: number | null;
  assignmentGradedCount: number;
  assignmentSubmittedCount: number;
  assignmentTotalCount: number;
  assignmentDetails: Array<{
    assignmentId: string;
    courseName: string;
    title: string;
    componentName: string;
    grade: number | null;
    maxPoints: number;
    percentage: number | null;
    status: 'dinilai' | 'menunggu_nilai' | 'belum_kumpul';
  }>;
  attendanceScore: number | null;
  attendanceCounts: Record<AttendanceStatus, number>;
  attendanceSessionCount: number;
  attendanceDetails: Array<{
    sessionId: string;
    title: string;
    date: string;
    status: AttendanceStatus | 'belum_absen';
    points: number | null;
  }>;
  groupBreakdowns: MoodleGroupBreakdown[];
  finalScore: number | null;
  category: GradeCategory | null;
  isNormalized: boolean;
}

export function getExamCategoryLabel(cat?: ExamCategory): string {
  switch (cat) {
    case 'kuis':
      return 'Kuis';
    case 'ujian_harian':
      return 'Ujian Harian';
    case 'uts':
      return 'UTS';
    case 'uas':
      return 'UAS';
    case 'praktikum':
      return 'Praktikum';
    case 'remedial':
      return 'Remedial';
    default:
      return 'Ujian';
  }
}

export function doesExamMatchCourse(exam: Exam, course: Course): boolean {
  if (exam.courseId && exam.courseId === course.id) return true;
  const ec = (exam.courseCode || '').toLowerCase();
  const en = (exam.courseName || '').toLowerCase();
  const cc = (course.code || '').toLowerCase();
  const cn = (course.name || '').toLowerCase();
  return Boolean(
    (cc && ec === cc) ||
    (cn && en === cn) ||
    (cn && (exam.title || '').toLowerCase().includes(cn)) ||
    (en && cn.includes(en))
  );
}

export function doesExamAllowClass(exam: Exam, classId: string): boolean {
  const assigned = exam.assignedClassIds || [];
  const targets = exam.targetClassIds || [];
  const matchAssigned = assigned.length === 0 || assigned.includes(classId);
  const matchTargets = targets.length === 0 || targets.includes('all') || targets.includes(classId);
  return matchAssigned && matchTargets;
}

export function doesCourseAllowClass(course: Course, classId: string): boolean {
  const assigned = course.assignedClassIds || [];
  return assigned.length === 0 || assigned.includes(classId);
}

export function isUserEnrolledInCourse(
  user: Pick<User, 'id' | 'classId' | 'role'>,
  course: Course,
  allUsers?: User[]
): boolean {
  if (user.role === 'admin') return true;
  if (course.lecturerId === user.id) return true;

  const enrolledIds = course.enrolledUserIds || [];
  if (enrolledIds.includes(user.id)) return true;

  const assignedClasses = course.assignedClassIds || [];
  if (user.role === 'dosen') {
    // Staff dapat mengakses semua mata kuliah; gunakan enrolledIds / lecturerId untuk menandai keterlibatan
    return true;
  }

  // Mahasiswa:
  if (user.classId && assignedClasses.includes(user.classId)) {
    return true;
  }

  // Jika kelas tidak dibatasi dan tidak ada mahasiswa yang dikunci secara individual, mata kuliah terbuka untuk semua mahasiswa
  const hasExplicitStudentSelection = allUsers
    ? enrolledIds.some((uid) => allUsers.find((u) => u.id === uid)?.role === 'mahasiswa')
    : enrolledIds.length > 0;

  if (assignedClasses.length === 0 && !hasExplicitStudentSelection) {
    return true;
  }

  return false;
}

export function computeStudentGradeBreakdown(params: {
  student: User;
  config: GradeConfig;
  exams: Exam[];
  attempts: ExamAttempt[];
  courses: Course[];
  attendanceSessions: AttendanceSession[];
  filterClassId?: string;
  filterCourseId?: string;
  nowMs?: number;
}): StudentGradeBreakdown {
  const {
    student,
    config,
    exams,
    attempts,
    courses,
    attendanceSessions,
    filterClassId,
    filterCourseId,
    nowMs = Date.now(),
  } = params;

  const { groups, components } = ensureMoodleStructure(config);
  const effectiveClassId = filterClassId || student.classId || undefined;
  const selectedCourse = filterCourseId
    ? courses.find((c) => c.id === filterCourseId)
    : undefined;

  const fallbackExamComp =
    components.find((c) => c.sourceType === 'exam') ||
    components.find((c) => c.sourceType === 'any') ||
    components[0];
  const fallbackAssComp =
    components.find((c) => c.sourceType === 'assignment') ||
    components.find((c) => c.sourceType === 'any') ||
    components[0];

  const itemsByComponent = new Map<string, MoodleActivityItem[]>();
  components.forEach((c) => itemsByComponent.set(c.id, []));

  // 1. Matching Courses
  const relevantCourses = courses.filter((c) => {
    if (selectedCourse && c.id !== selectedCourse.id) return false;
    const explicitlyEnrolled = (c.enrolledUserIds || []).includes(student.id);
    if (explicitlyEnrolled) return true;
    if (effectiveClassId && !doesCourseAllowClass(c, effectiveClassId)) return false;
    return isUserEnrolledInCourse(student, c);
  });

  // 2. Matching Exams -> map to Components
  const relevantExams = exams.filter((ex) => {
    if (selectedCourse && !doesExamMatchCourse(ex, selectedCourse)) return false;
    if (effectiveClassId && !doesExamAllowClass(ex, effectiveClassId)) return false;
    return true;
  });

  const examDetails: StudentGradeBreakdown['examDetails'] = [];
  relevantExams.forEach((ex) => {
    const att = attempts.find(
      (a) => a.examId === ex.id && a.studentId === student.id && a.isCompleted
    );
    const targetCompId =
      ex.gradingComponentId && itemsByComponent.has(ex.gradingComponentId)
        ? ex.gradingComponentId
        : fallbackExamComp?.id;
    const targetComp = components.find((c) => c.id === targetCompId);

    if (att) {
      const pct =
        att.percentage !== undefined
          ? att.percentage
          : att.maxScore && att.maxScore > 0
          ? Math.round(((att.score || 0) / att.maxScore) * 100)
          : Math.round(att.score || 0);
      const clampedPct = Math.max(0, Math.min(100, pct));

      examDetails.push({
        examId: ex.id,
        title: ex.title,
        courseCode: ex.courseCode,
        componentName: targetComp?.name || ex.gradingComponentName || 'Ujian',
        score: att.score ?? clampedPct,
        percentage: clampedPct,
        scoringMethod: (att.scoringMethodUsed || ex.scoringMethod || 'classical').toUpperCase(),
      });

      if (targetCompId) {
        itemsByComponent.get(targetCompId)?.push({
          id: ex.id,
          kind: 'exam',
          title: ex.title,
          subtitle: `${ex.courseCode} · ${(att.scoringMethodUsed || ex.scoringMethod || 'classical').toUpperCase()}`,
          score: clampedPct,
          maxScore: 100,
          percentage: clampedPct,
          statusLabel: 'Selesai',
        });
      }
    } else if (targetCompId) {
      itemsByComponent.get(targetCompId)?.push({
        id: ex.id,
        kind: 'exam',
        title: ex.title,
        subtitle: ex.courseCode,
        score: null,
        maxScore: 100,
        percentage: null,
        statusLabel: 'Belum Dikerjakan',
      });
    }
  });

  const examScore =
    examDetails.length > 0
      ? Number(
          (
            examDetails.reduce((sum, item) => sum + item.percentage, 0) /
            examDetails.length
          ).toFixed(2)
        )
      : null;

  // 3. Matching Assignments -> map to Components
  const assignmentDetails: StudentGradeBreakdown['assignmentDetails'] = [];
  let assignmentSubmittedCount = 0;
  let assignmentGradedCount = 0;

  relevantCourses.forEach((course) => {
    course.assignments.forEach((ass) => {
      const sub = ass.submissions.find((s) => s.studentId === student.id);
      const targetCompId =
        ass.gradingComponentId && itemsByComponent.has(ass.gradingComponentId)
          ? ass.gradingComponentId
          : fallbackAssComp?.id;
      const targetComp = components.find((c) => c.id === targetCompId);
      const maxPts = ass.maxPoints > 0 ? ass.maxPoints : 100;

      if (sub) {
        assignmentSubmittedCount += 1;
        if (sub.grade !== undefined && sub.grade !== null) {
          assignmentGradedCount += 1;
          const pct = Number(Math.max(0, Math.min(100, (sub.grade / maxPts) * 100)).toFixed(2));
          assignmentDetails.push({
            assignmentId: ass.id,
            courseName: course.name,
            title: ass.title,
            componentName: targetComp?.name || ass.gradingComponentName || 'Tugas',
            grade: sub.grade,
            maxPoints: maxPts,
            percentage: pct,
            status: 'dinilai',
          });
          if (targetCompId) {
            itemsByComponent.get(targetCompId)?.push({
              id: ass.id,
              kind: 'assignment',
              title: ass.title,
              subtitle: course.name,
              score: sub.grade,
              maxScore: maxPts,
              percentage: pct,
              statusLabel: 'Dinilai',
            });
          }
        } else {
          assignmentDetails.push({
            assignmentId: ass.id,
            courseName: course.name,
            title: ass.title,
            componentName: targetComp?.name || ass.gradingComponentName || 'Tugas',
            grade: null,
            maxPoints: maxPts,
            percentage: null,
            status: 'menunggu_nilai',
          });
          if (targetCompId) {
            itemsByComponent.get(targetCompId)?.push({
              id: ass.id,
              kind: 'assignment',
              title: ass.title,
              subtitle: course.name,
              score: null,
              maxScore: maxPts,
              percentage: null,
              statusLabel: 'Menunggu Nilai',
            });
          }
        }
      } else {
        assignmentDetails.push({
          assignmentId: ass.id,
          courseName: course.name,
          title: ass.title,
          componentName: targetComp?.name || ass.gradingComponentName || 'Tugas',
          grade: null,
          maxPoints: maxPts,
          percentage: null,
          status: 'belum_kumpul',
        });
        if (targetCompId) {
          itemsByComponent.get(targetCompId)?.push({
            id: ass.id,
            kind: 'assignment',
            title: ass.title,
            subtitle: course.name,
            score: null,
            maxScore: maxPts,
            percentage: null,
            statusLabel: 'Belum Kumpul',
          });
        }
      }
    });

    // 3b. Matching Tugas Projek Mahasiswa (Peer Assessment) -> map to Components
    (course.peerProjects || []).forEach((proj) => {
      const sub = (proj.submissions || []).find((s) => s.studentId === student.id);
      const targetCompId =
        proj.gradingComponentId && itemsByComponent.has(proj.gradingComponentId)
          ? proj.gradingComponentId
          : fallbackAssComp?.id;
      const targetComp = components.find((c) => c.id === targetCompId);
      const maxPts = proj.maxPoints > 0 ? proj.maxPoints : 100;

      if (sub) {
        assignmentSubmittedCount += 1;
        const metrics = computePeerSubmissionMetrics(sub, maxPts);
        if (metrics.finalScore !== null) {
          assignmentGradedCount += 1;
          const pct = Number(Math.max(0, Math.min(100, (metrics.finalScore / maxPts) * 100)).toFixed(2));
          assignmentDetails.push({
            assignmentId: proj.id,
            courseName: course.name,
            title: `${proj.title} (Tugas Projek Mahasiswa)`,
            componentName: targetComp?.name || proj.gradingComponentName || 'Tugas Projek',
            grade: metrics.finalScore,
            maxPoints: maxPts,
            percentage: pct,
            status: 'dinilai',
          });
          if (targetCompId) {
            itemsByComponent.get(targetCompId)?.push({
              id: proj.id,
              kind: 'assignment',
              title: `${proj.title} (Tugas Projek Mahasiswa)`,
              subtitle: metrics.hasLecturerOverride
                ? `${course.name} · Nilai Dosen (${metrics.studentReviewsCount} Penilai Mhs)`
                : `${course.name} · Rata-rata ${metrics.studentReviewsCount} Penilai Mahasiswa`,
              score: metrics.finalScore,
              maxScore: maxPts,
              percentage: pct,
              statusLabel: metrics.hasLecturerOverride ? 'Dinilai (Dosen + Sejawat)' : 'Dinilai Sejawat',
            });
          }
        } else {
          assignmentDetails.push({
            assignmentId: proj.id,
            courseName: course.name,
            title: `${proj.title} (Tugas Projek Mahasiswa)`,
            componentName: targetComp?.name || proj.gradingComponentName || 'Tugas Projek',
            grade: null,
            maxPoints: maxPts,
            percentage: null,
            status: 'menunggu_nilai',
          });
          if (targetCompId) {
            itemsByComponent.get(targetCompId)?.push({
              id: proj.id,
              kind: 'assignment',
              title: `${proj.title} (Tugas Projek Mahasiswa)`,
              subtitle: `${course.name} · ${metrics.studentReviewsCount}/${proj.reviewersPerSubmission} penilai`,
              score: null,
              maxScore: maxPts,
              percentage: null,
              statusLabel: 'Menunggu Penilaian Sejawat',
            });
          }
        }
      } else {
        assignmentDetails.push({
          assignmentId: proj.id,
          courseName: course.name,
          title: `${proj.title} (Tugas Projek Mahasiswa)`,
          componentName: targetComp?.name || proj.gradingComponentName || 'Tugas Projek',
          grade: null,
          maxPoints: maxPts,
          percentage: null,
          status: 'belum_kumpul',
        });
        if (targetCompId) {
          itemsByComponent.get(targetCompId)?.push({
            id: proj.id,
            kind: 'assignment',
            title: `${proj.title} (Tugas Projek Mahasiswa)`,
            subtitle: course.name,
            score: null,
            maxScore: maxPts,
            percentage: null,
            statusLabel: 'Belum Kumpul',
          });
        }
      }
    });
  });

  const gradedAssItems = assignmentDetails.filter((d) => d.percentage !== null);
  const assignmentScore =
    gradedAssItems.length > 0
      ? Number(
          (
            gradedAssItems.reduce((sum, item) => sum + (item.percentage || 0), 0) /
            gradedAssItems.length
          ).toFixed(2)
        )
      : null;

  // 4. Matching Attendance Sessions -> map to Attendance Components
  const relevantCourseIds = new Set(relevantCourses.map((c) => c.id));
  const relevantSessions = attendanceSessions.filter((ses) => {
    if (selectedCourse) {
      return ses.scope === 'course' && ses.courseId === selectedCourse.id;
    }
    if (effectiveClassId) {
      if (ses.scope === 'class') return ses.classId === effectiveClassId;
      if (ses.scope === 'course' && ses.courseId) {
        return relevantCourseIds.has(ses.courseId);
      }
    }
    return true;
  });

  const attendanceCounts: Record<AttendanceStatus, number> = {
    hadir: 0,
    izin: 0,
    sakit: 0,
    terlambat: 0,
    alfa: 0,
  };
  const attendanceDetails: StudentGradeBreakdown['attendanceDetails'] = [];
  const countedSessionPoints: number[] = [];
  const attendanceActivityItems: MoodleActivityItem[] = [];

  relevantSessions.forEach((ses) => {
    const rec = ses.records.find((r) => r.studentId === student.id);
    const endMs = new Date(ses.endTime).getTime();
    const isEnded = !Number.isNaN(endMs) && nowMs > endMs;

    if (rec) {
      attendanceCounts[rec.status] += 1;
      const pts = config.statusScores[rec.status] ?? 0;
      countedSessionPoints.push(pts);
      attendanceDetails.push({
        sessionId: ses.id,
        title: ses.title,
        date: ses.startTime,
        status: rec.status,
        points: pts,
      });
      attendanceActivityItems.push({
        id: ses.id,
        kind: 'attendance',
        title: ses.title,
        subtitle: new Date(ses.startTime).toLocaleDateString('id-ID'),
        score: pts,
        maxScore: 100,
        percentage: pts,
        statusLabel: rec.status.toUpperCase(),
      });
    } else if (isEnded) {
      attendanceCounts.alfa += 1;
      const pts = config.statusScores.alfa ?? 0;
      countedSessionPoints.push(pts);
      attendanceDetails.push({
        sessionId: ses.id,
        title: ses.title,
        date: ses.startTime,
        status: 'alfa',
        points: pts,
      });
      attendanceActivityItems.push({
        id: ses.id,
        kind: 'attendance',
        title: ses.title,
        subtitle: new Date(ses.startTime).toLocaleDateString('id-ID'),
        score: pts,
        maxScore: 100,
        percentage: pts,
        statusLabel: 'ALFA',
      });
    } else {
      attendanceDetails.push({
        sessionId: ses.id,
        title: ses.title,
        date: ses.startTime,
        status: 'belum_absen',
        points: null,
      });
      attendanceActivityItems.push({
        id: ses.id,
        kind: 'attendance',
        title: ses.title,
        subtitle: new Date(ses.startTime).toLocaleDateString('id-ID'),
        score: null,
        maxScore: 100,
        percentage: null,
        statusLabel: 'Berlangsung',
      });
    }
  });

  const attendanceScore =
    countedSessionPoints.length > 0
      ? Number(
          (
            countedSessionPoints.reduce((sum, v) => sum + v, 0) /
            countedSessionPoints.length
          ).toFixed(2)
        )
      : null;

  components
    .filter((c) => c.sourceType === 'attendance')
    .forEach((c) => {
      itemsByComponent.set(c.id, attendanceActivityItems);
    });

  // 5. Hierarchical Moodle Group & Component Calculation
  const groupBreakdowns: MoodleGroupBreakdown[] = groups.map((group) => {
    const groupComps = components.filter((c) => c.groupId === group.id);
    const compBreakdowns: MoodleComponentBreakdown[] = groupComps.map((comp) => {
      const items = itemsByComponent.get(comp.id) || [];
      const scoredItems = items.filter((it) => it.percentage !== null);
      const compScore =
        scoredItems.length > 0
          ? Number(
              (
                scoredItems.reduce((sum, it) => sum + (it.percentage || 0), 0) /
                scoredItems.length
              ).toFixed(2)
            )
          : null;

      return {
        component: comp,
        effectiveWeight: getComponentEffectiveWeight(comp, group, groupComps),
        score: compScore,
        category: compScore !== null ? classifyScoreCategory(compScore, config.categories) : null,
        items,
      };
    });

    const activeComps = compBreakdowns.filter((cb) => cb.score !== null);
    let groupScore: number | null = null;

    if (activeComps.length > 0) {
      if (group.aggregation === 'simple_mean') {
        groupScore = Number(
          (
            activeComps.reduce((sum, cb) => sum + (cb.score || 0), 0) /
            activeComps.length
          ).toFixed(2)
        );
      } else {
        const totalActiveCompWeight = activeComps.reduce(
          (sum, cb) => sum + (cb.component.weight || 0),
          0
        );
        if (totalActiveCompWeight > 0) {
          groupScore = Number(
            activeComps
              .reduce(
                (sum, cb) =>
                  sum + (cb.score || 0) * ((cb.component.weight || 0) / totalActiveCompWeight),
                0
              )
              .toFixed(2)
          );
        } else {
          groupScore = Number(
            (
              activeComps.reduce((sum, cb) => sum + (cb.score || 0), 0) /
              activeComps.length
            ).toFixed(2)
          );
        }
      }
    }

    return {
      group,
      groupScore,
      category:
        groupScore !== null ? classifyScoreCategory(groupScore, config.categories) : null,
      components: compBreakdowns,
    };
  });

  // 6. Final Weighted Composite across Groups
  const activeGroups = groupBreakdowns.filter(
    (gb) => gb.groupScore !== null && gb.group.weight > 0
  );
  let finalScore: number | null = null;
  let isNormalized = false;

  if (activeGroups.length > 0) {
    const totalActiveGroupWeight = activeGroups.reduce(
      (sum, gb) => sum + gb.group.weight,
      0
    );
    const totalConfiguredWeight = groups.reduce((sum, g) => sum + g.weight, 0);
    isNormalized = totalActiveGroupWeight !== totalConfiguredWeight;

    finalScore = Number(
      activeGroups
        .reduce(
          (sum, gb) =>
            sum + (gb.groupScore || 0) * (gb.group.weight / totalActiveGroupWeight),
          0
        )
        .toFixed(2)
    );
  }

  const category =
    finalScore !== null ? classifyScoreCategory(finalScore, config.categories) : null;

  return {
    student,
    examScore,
    examTakenCount: examDetails.length,
    examTotalCount: relevantExams.length,
    examDetails,
    assignmentScore,
    assignmentGradedCount,
    assignmentSubmittedCount,
    assignmentTotalCount: assignmentDetails.length,
    assignmentDetails,
    attendanceScore,
    attendanceCounts,
    attendanceSessionCount: relevantSessions.length,
    attendanceDetails,
    groupBreakdowns,
    finalScore,
    category,
    isNormalized,
  };
}
