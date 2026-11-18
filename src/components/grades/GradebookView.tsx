import React, { useState, useMemo, useEffect } from 'react';
import { useExam } from '../../context/ExamContext';
import {
  AttendanceStatusScores,
  GradeCategory,
  GradeConfig,
  GradingComponent,
  GradingComponentSource,
  GradingGroup,
  GradingGroupAggregation,
} from '../../types';
import {
  DEFAULT_ATTENDANCE_STATUS_SCORES,
  DEFAULT_GRADE_CATEGORIES,
  StudentGradeBreakdown,
  classifyScoreCategory,
  computeStudentGradeBreakdown,
  createDefaultGradingStructure,
  ensureMoodleStructure,
  getComponentEffectiveWeight,
  resolveGradeConfig,
  syncLegacyWeightsFromStructure,
} from '../../utils/gradebook';
import {
  AlertTriangle,
  Award,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Edit3,
  Eye,
  FileSpreadsheet,
  Folder,
  FolderPlus,
  GraduationCap,
  Layers,
  ListChecks,
  Plus,
  QrCode,
  RotateCcw,
  Save,
  Search,
  Settings2,
  ShieldCheck,
  Table2,
  Trash2,
  UserCheck,
  X,
  XCircle,
} from 'lucide-react';

interface GradebookViewProps {
  lockedCourseId?: string;
}

type GradebookViewMode = 'grader' | 'user' | 'setup';

const SOURCE_LABELS: Record<GradingComponentSource, string> = {
  exam: 'Ujian CBT',
  assignment: 'Tugas / Proyek',
  attendance: 'Absensi QR',
  any: 'Ujian & Tugas',
};

const SOURCE_SHORT_LABELS: Record<GradingComponentSource, string> = {
  exam: 'Ujian',
  assignment: 'Tugas',
  attendance: 'Absensi',
  any: 'Umum',
};

export const GradebookView: React.FC<GradebookViewProps> = ({ lockedCourseId }) => {
  const {
    currentUser,
    users,
    classes,
    courses,
    exams,
    attempts,
    attendanceSessions,
    gradeConfigs,
    saveGradeConfig,
  } = useExam();

  const isStaff = currentUser?.role === 'admin' || currentUser?.role === 'dosen';

  // Filters
  const [selectedClassId, setSelectedClassId] = useState<string>(() => {
    if (!isStaff && currentUser?.classId) return currentUser.classId;
    return 'all';
  });
  const [selectedCourseId, setSelectedCourseId] = useState<string>(lockedCourseId || 'all');
  const [searchQuery, setSearchQuery] = useState('');

  // Moodle-style navigation tabs
  const [viewMode, setViewMode] = useState<GradebookViewMode>(() =>
    isStaff ? 'grader' : 'user'
  );
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [collapsedGroupIds, setCollapsedGroupIds] = useState<Record<string, boolean>>({});

  // Toast feedback
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => {
      setToast((prev) => (prev?.message === message ? null : prev));
    }, 5000);
  };

  // Sync lockedCourseId if passed
  useEffect(() => {
    if (lockedCourseId) {
      setSelectedCourseId(lockedCourseId);
    }
  }, [lockedCourseId]);

  const effectiveCourseId =
    lockedCourseId || (selectedCourseId !== 'all' ? selectedCourseId : undefined);
  const effectiveClassId = selectedClassId !== 'all' ? selectedClassId : undefined;

  // Active GradeConfig resolved for current scope
  const activeConfig = useMemo(() => {
    return resolveGradeConfig(gradeConfigs, {
      classId: effectiveClassId,
      courseId: effectiveCourseId,
    });
  }, [gradeConfigs, effectiveClassId, effectiveCourseId]);

  const activeStructure = useMemo(() => ensureMoodleStructure(activeConfig), [activeConfig]);

  // Visible students (STRICT: student ONLY sees themselves)
  const targetStudents = useMemo(() => {
    if (!currentUser) return [];
    if (!isStaff) {
      return [currentUser];
    }

    let list = users.filter((u) => u.role === 'mahasiswa');
    if (selectedClassId !== 'all') {
      list = list.filter((u) => u.classId === selectedClassId);
    }

    if (effectiveCourseId) {
      const course = courses.find((c) => c.id === effectiveCourseId);
      if (course) {
        const enrolledIds = course.enrolledUserIds || [];
        const assignedClasses = course.assignedClassIds || [];
        const hasEnrolledStudents = enrolledIds.some((uid) =>
          users.some((u) => u.id === uid && u.role === 'mahasiswa')
        );
        if (assignedClasses.length > 0 || hasEnrolledStudents) {
          list = list.filter(
            (u) =>
              enrolledIds.includes(u.id) ||
              (u.classId && assignedClasses.includes(u.classId))
          );
        }
      }
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (u) =>
          u.name.toLowerCase().includes(q) ||
          u.nimOrNip.toLowerCase().includes(q) ||
          (u.className || '').toLowerCase().includes(q)
      );
    }

    return list.sort((a, b) => a.name.localeCompare(b.name));
  }, [
    currentUser,
    isStaff,
    users,
    selectedClassId,
    effectiveCourseId,
    courses,
    searchQuery,
  ]);

  // Compute Hierarchical Moodle Breakdown for visible students
  const gradeRows = useMemo(() => {
    return targetStudents.map((student) =>
      computeStudentGradeBreakdown({
        student,
        config: activeConfig,
        exams,
        attempts,
        courses,
        attendanceSessions,
        filterClassId: effectiveClassId,
        filterCourseId: effectiveCourseId,
      })
    );
  }, [
    targetStudents,
    activeConfig,
    exams,
    attempts,
    courses,
    attendanceSessions,
    effectiveClassId,
    effectiveCourseId,
  ]);

  // Ensure selectedUserId points to a valid student in User Report
  useEffect(() => {
    if (!isStaff) {
      if (currentUser) setSelectedUserId(currentUser.id);
      return;
    }
    if (gradeRows.length > 0) {
      const stillExists = gradeRows.some((r) => r.student.id === selectedUserId);
      if (!stillExists) {
        setSelectedUserId(gradeRows[0].student.id);
      }
    } else {
      setSelectedUserId('');
    }
  }, [isStaff, currentUser, gradeRows, selectedUserId]);

  const activeUserReportRow: StudentGradeBreakdown | null = useMemo(() => {
    if (gradeRows.length === 0) return null;
    if (!isStaff) return gradeRows[0];
    return gradeRows.find((r) => r.student.id === selectedUserId) || gradeRows[0];
  }, [gradeRows, isStaff, selectedUserId]);

  // Class Summary Stats (Staff)
  const classSummary = useMemo(() => {
    const scored = gradeRows.filter((r) => r.finalScore !== null);
    if (scored.length === 0) {
      return { avg: 0, highest: 0, passRate: 0, scoredCount: 0 };
    }
    const sum = scored.reduce((acc, r) => acc + (r.finalScore || 0), 0);
    const highest = Math.max(...scored.map((r) => r.finalScore || 0));
    const passed = scored.filter((r) => r.category?.isPassed).length;
    return {
      avg: Number((sum / scored.length).toFixed(2)),
      highest: Number(highest.toFixed(2)),
      passRate: Math.round((passed / scored.length) * 100),
      scoredCount: scored.length,
    };
  }, [gradeRows]);

  // Column averages for Grader Report footer
  const columnAverages = useMemo(() => {
    const compAvgMap = new Map<string, number | null>();
    const groupAvgMap = new Map<string, number | null>();

    activeStructure.groups.forEach((grp) => {
      const grpScores = gradeRows
        .map((r) => r.groupBreakdowns.find((gb) => gb.group.id === grp.id)?.groupScore)
        .filter((v): v is number => v !== null && v !== undefined);
      groupAvgMap.set(
        grp.id,
        grpScores.length > 0
          ? Number((grpScores.reduce((a, b) => a + b, 0) / grpScores.length).toFixed(2))
          : null
      );

      activeStructure.components
        .filter((c) => c.groupId === grp.id)
        .forEach((comp) => {
          const compScores = gradeRows
            .map(
              (r) =>
                r.groupBreakdowns
                  .find((gb) => gb.group.id === grp.id)
                  ?.components.find((cb) => cb.component.id === comp.id)?.score
            )
            .filter((v): v is number => v !== null && v !== undefined);
          compAvgMap.set(
            comp.id,
            compScores.length > 0
              ? Number((compScores.reduce((a, b) => a + b, 0) / compScores.length).toFixed(2))
              : null
          );
        });
    });

    const finalScores = gradeRows
      .map((r) => r.finalScore)
      .filter((v): v is number => v !== null && v !== undefined);
    const finalAvg =
      finalScores.length > 0
        ? Number((finalScores.reduce((a, b) => a + b, 0) / finalScores.length).toFixed(2))
        : null;

    return { compAvgMap, groupAvgMap, finalAvg };
  }, [activeStructure, gradeRows]);

  // Count how many exams/assignments link to each grading component (for Setup visibility)
  const linkedActivityCountMap = useMemo(() => {
    const counts = new Map<string, { exams: number; assignments: number }>();
    exams.forEach((ex) => {
      if (ex.gradingComponentId) {
        const cur = counts.get(ex.gradingComponentId) || { exams: 0, assignments: 0 };
        cur.exams += 1;
        counts.set(ex.gradingComponentId, cur);
      }
    });
    courses.forEach((c) => {
      c.assignments.forEach((ass) => {
        if (ass.gradingComponentId) {
          const cur = counts.get(ass.gradingComponentId) || { exams: 0, assignments: 0 };
          cur.assignments += 1;
          counts.set(ass.gradingComponentId, cur);
        }
      });
    });
    return counts;
  }, [exams, courses]);

  // =========================================================================
  // MOODLE GRADEBOOK SETUP STATE (STAFF)
  // =========================================================================
  const [setupScope, setSetupScope] = useState<'global' | 'class' | 'course'>('global');
  const [setupClassId, setSetupClassId] = useState<string>('');
  const [setupCourseId, setSetupCourseId] = useState<string>('');
  const [setupGroups, setSetupGroups] = useState<GradingGroup[]>([]);
  const [setupComponents, setSetupComponents] = useState<GradingComponent[]>([]);
  const [setupStatusScores, setSetupStatusScores] = useState<AttendanceStatusScores>({
    ...DEFAULT_ATTENDANCE_STATUS_SCORES,
  });
  const [setupCategories, setSetupCategories] = useState<GradeCategory[]>(
    DEFAULT_GRADE_CATEGORIES.map((c) => ({ ...c }))
  );
  const [setupDirty, setSetupDirty] = useState(false);
  const [setupError, setSetupError] = useState('');
  const [setupSaving, setSetupSaving] = useState(false);

  // Add/Edit Group Modal
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [grpName, setGrpName] = useState('');
  const [grpDesc, setGrpDesc] = useState('');
  const [grpWeight, setGrpWeight] = useState<number>(25);
  const [grpAggregation, setGrpAggregation] = useState<GradingGroupAggregation>('weighted_mean');
  const [grpFormError, setGrpFormError] = useState('');

  // Add/Edit Component Modal
  const [compModalOpen, setCompModalOpen] = useState(false);
  const [editingCompId, setEditingCompId] = useState<string | null>(null);
  const [cmpGroupId, setCmpGroupId] = useState('');
  const [cmpName, setCmpName] = useState('');
  const [cmpSourceType, setCmpSourceType] = useState<GradingComponentSource>('exam');
  const [cmpWeight, setCmpWeight] = useState<number>(50);
  const [cmpMaxScore, setCmpMaxScore] = useState<number>(100);
  const [cmpFormError, setCmpFormError] = useState('');

  // Delete confirmation modal state (no window.confirm)
  const [pendingDeleteTarget, setPendingDeleteTarget] = useState<{
    type: 'group' | 'component';
    id: string;
    name: string;
    childCount?: number;
  } | null>(null);

  const loadSetupFromScope = (
    targetScope: 'global' | 'class' | 'course',
    targetClassId: string,
    targetCourseId: string
  ) => {
    const resolved = resolveGradeConfig(gradeConfigs, {
      classId: targetScope === 'class' ? targetClassId : undefined,
      courseId: targetScope === 'course' ? targetCourseId : undefined,
    });
    const { groups, components } = ensureMoodleStructure(resolved);
    setSetupGroups(groups.map((g) => ({ ...g })));
    setSetupComponents(components.map((c) => ({ ...c })));
    setSetupStatusScores({ ...resolved.statusScores });
    setSetupCategories(resolved.categories.map((c) => ({ ...c })));
    setSetupDirty(false);
    setSetupError('');
  };

  const openGradebookSetup = () => {
    const defaultScope: 'global' | 'class' | 'course' = lockedCourseId
      ? 'course'
      : selectedCourseId !== 'all'
      ? 'course'
      : selectedClassId !== 'all'
      ? 'class'
      : 'global';

    const initClassId = selectedClassId !== 'all' ? selectedClassId : classes[0]?.id || '';
    const initCourseId =
      lockedCourseId || (selectedCourseId !== 'all' ? selectedCourseId : courses[0]?.id || '');

    setSetupScope(defaultScope);
    setSetupClassId(initClassId);
    setSetupCourseId(initCourseId);
    loadSetupFromScope(defaultScope, initClassId, initCourseId);
    setViewMode('setup');
  };

  // Sync setup draft when switching to setup via tab if empty
  useEffect(() => {
    if (viewMode === 'setup' && setupGroups.length === 0) {
      const defaultScope: 'global' | 'class' | 'course' = lockedCourseId
        ? 'course'
        : selectedCourseId !== 'all'
        ? 'course'
        : selectedClassId !== 'all'
        ? 'class'
        : 'global';
      const initClassId = selectedClassId !== 'all' ? selectedClassId : classes[0]?.id || '';
      const initCourseId =
        lockedCourseId || (selectedCourseId !== 'all' ? selectedCourseId : courses[0]?.id || '');
      setSetupScope(defaultScope);
      setSetupClassId(initClassId);
      setSetupCourseId(initCourseId);
      loadSetupFromScope(defaultScope, initClassId, initCourseId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode]);

  const totalSetupGroupWeight = useMemo(
    () => Number(setupGroups.reduce((sum, g) => sum + (Number(g.weight) || 0), 0).toFixed(2)),
    [setupGroups]
  );

  // Open Group Modal
  const handleOpenGroupModal = (group?: GradingGroup) => {
    setGrpFormError('');
    if (group) {
      setEditingGroupId(group.id);
      setGrpName(group.name);
      setGrpDesc(group.description || '');
      setGrpWeight(group.weight);
      setGrpAggregation(group.aggregation);
    } else {
      const remaining = Math.max(0, 100 - totalSetupGroupWeight);
      setEditingGroupId(null);
      setGrpName('');
      setGrpDesc('');
      setGrpWeight(remaining > 0 ? remaining : 20);
      setGrpAggregation('weighted_mean');
    }
    setGroupModalOpen(true);
  };

  const handleSaveGroupModal = (e: React.FormEvent) => {
    e.preventDefault();
    setGrpFormError('');
    if (!grpName.trim()) {
      setGrpFormError('Nama grup kelompok penilaian wajib diisi.');
      return;
    }
    if (grpWeight < 0 || grpWeight > 100) {
      setGrpFormError('Bobot grup harus berada di rentang 0% hingga 100%.');
      return;
    }

    if (editingGroupId) {
      setSetupGroups((prev) =>
        prev.map((g) =>
          g.id === editingGroupId
            ? {
                ...g,
                name: grpName.trim(),
                description: grpDesc.trim() || undefined,
                weight: Number(grpWeight),
                aggregation: grpAggregation,
              }
            : g
        )
      );
    } else {
      const maxOrder = setupGroups.reduce((m, g) => Math.max(m, g.order), 0);
      const newGroup: GradingGroup = {
        id: `grp-${Date.now().toString(36)}`,
        name: grpName.trim(),
        description: grpDesc.trim() || undefined,
        weight: Number(grpWeight),
        aggregation: grpAggregation,
        order: maxOrder + 1,
      };
      setSetupGroups((prev) => [...prev, newGroup]);
    }
    setSetupDirty(true);
    setGroupModalOpen(false);
  };

  // Open Component Modal
  const handleOpenComponentModal = (defaultGroupId?: string, component?: GradingComponent) => {
    setCmpFormError('');
    if (component) {
      setEditingCompId(component.id);
      setCmpGroupId(component.groupId);
      setCmpName(component.name);
      setCmpSourceType(component.sourceType);
      setCmpWeight(component.weight);
      setCmpMaxScore(component.maxScore || 100);
    } else {
      setEditingCompId(null);
      setCmpGroupId(defaultGroupId || setupGroups[0]?.id || '');
      setCmpName('');
      setCmpSourceType('exam');
      setCmpWeight(50);
      setCmpMaxScore(100);
    }
    setCompModalOpen(true);
  };

  const handleSaveComponentModal = (e: React.FormEvent) => {
    e.preventDefault();
    setCmpFormError('');
    if (!cmpGroupId) {
      setCmpFormError('Pilih grup kelompok penilaian induk terlebih dahulu.');
      return;
    }
    if (!cmpName.trim()) {
      setCmpFormError('Nama komponen penilaian wajib diisi.');
      return;
    }
    if (cmpWeight < 0 || cmpWeight > 100) {
      setCmpFormError('Bobot komponen harus di antara 0% sampai 100%.');
      return;
    }

    if (editingCompId) {
      setSetupComponents((prev) =>
        prev.map((c) =>
          c.id === editingCompId
            ? {
                ...c,
                groupId: cmpGroupId,
                name: cmpName.trim(),
                sourceType: cmpSourceType,
                weight: Number(cmpWeight),
                maxScore: Number(cmpMaxScore) || 100,
              }
            : c
        )
      );
    } else {
      const siblingMaxOrder = setupComponents
        .filter((c) => c.groupId === cmpGroupId)
        .reduce((m, c) => Math.max(m, c.order), 0);
      const newComp: GradingComponent = {
        id: `cmp-${Date.now().toString(36)}`,
        groupId: cmpGroupId,
        name: cmpName.trim(),
        sourceType: cmpSourceType,
        weight: Number(cmpWeight),
        maxScore: Number(cmpMaxScore) || 100,
        order: siblingMaxOrder + 1,
      };
      setSetupComponents((prev) => [...prev, newComp]);
    }
    setSetupDirty(true);
    setCompModalOpen(false);
  };

  const handleConfirmDeleteTarget = () => {
    if (!pendingDeleteTarget) return;
    if (pendingDeleteTarget.type === 'group') {
      setSetupGroups((prev) => prev.filter((g) => g.id !== pendingDeleteTarget.id));
      setSetupComponents((prev) => prev.filter((c) => c.groupId !== pendingDeleteTarget.id));
    } else {
      setSetupComponents((prev) => prev.filter((c) => c.id !== pendingDeleteTarget.id));
    }
    setSetupDirty(true);
    setPendingDeleteTarget(null);
  };

  const handleSaveGradebookSetup = async () => {
    setSetupError('');

    if (setupGroups.length === 0) {
      setSetupError('Minimal harus terdapat 1 grup kelompok penilaian.');
      return;
    }
    if (Math.abs(totalSetupGroupWeight - 100) > 0.01) {
      setSetupError(
        `Total bobot seluruh grup kelompok penilaian saat ini ${totalSetupGroupWeight}%. Total bobot grup harus tepat 100%.`
      );
      return;
    }
    if (setupScope === 'class' && !setupClassId) {
      setSetupError('Pilih kelas target untuk pengaturan buku nilai ini.');
      return;
    }
    if (setupScope === 'course' && !setupCourseId) {
      setSetupError('Pilih mata kuliah target untuk pengaturan buku nilai ini.');
      return;
    }
    if (setupCategories.length === 0) {
      setSetupError('Minimal harus ada 1 kategori huruf mutu.');
      return;
    }
    for (const cat of setupCategories) {
      if (!cat.letter.trim()) {
        setSetupError('Huruf kategori nilai tidak boleh kosong.');
        return;
      }
      if (cat.minScore > cat.maxScore) {
        setSetupError(
          `Rentang nilai kategori "${cat.letter}" tidak valid (Min lebih besar dari Max).`
        );
        return;
      }
    }

    const legacyWeights = syncLegacyWeightsFromStructure(setupGroups, setupComponents);
    const configId =
      setupScope === 'course'
        ? `course_${setupCourseId}`
        : setupScope === 'class'
        ? `class_${setupClassId}`
        : 'global_default';

    const nextConfig: GradeConfig = {
      id: configId,
      scope: setupScope,
      classId: setupScope === 'class' ? setupClassId : undefined,
      courseId: setupScope === 'course' ? setupCourseId : undefined,
      examWeight: legacyWeights.examWeight,
      assignmentWeight: legacyWeights.assignmentWeight,
      attendanceWeight: legacyWeights.attendanceWeight,
      gradingGroups: setupGroups.map((g, idx) => ({ ...g, order: idx + 1 })),
      gradingComponents: setupComponents.map((c, idx) => ({ ...c, order: idx + 1 })),
      statusScores: { ...setupStatusScores },
      categories: [...setupCategories].sort((a, b) => b.minScore - a.minScore),
      updatedAt: new Date().toISOString(),
      updatedBy: currentUser?.name || 'Dosen Pengampu',
    };

    setSetupSaving(true);
    try {
      await saveGradeConfig(nextConfig);
      setSetupDirty(false);
      showToast(
        'success',
        'Struktur grup kelompok, komponen penilaian, dan kategori nilai Moodle berhasil disimpan ke Firebase.'
      );
    } catch (err: any) {
      setSetupError(err?.message || 'Gagal menyimpan pengaturan buku nilai.');
    } finally {
      setSetupSaving(false);
    }
  };

  // CSV Export (Staff) - exports Moodle component columns + group totals
  const handleExportCsv = () => {
    const dynamicHeaders: string[] = [];
    activeStructure.groups.forEach((grp) => {
      const grpComps = activeStructure.components.filter((c) => c.groupId === grp.id);
      grpComps.forEach((comp) => {
        const effW = getComponentEffectiveWeight(comp, grp, grpComps);
        dynamicHeaders.push(`"${comp.name.replace(/"/g, '""')} (${effW}%)"`);
      });
      dynamicHeaders.push(`"Total ${grp.name.replace(/"/g, '""')} (${grp.weight}%)"`);
    });

    const header = [
      'NIM',
      'Nama Mahasiswa',
      'Kelas',
      ...dynamicHeaders,
      'Nilai Akhir',
      'Huruf Mutu',
      'Predikat',
      'Status Kelulusan',
    ];

    const lines = gradeRows.map((r) => {
      const dynamicCells: Array<string | number> = [];
      activeStructure.groups.forEach((grp) => {
        const gb = r.groupBreakdowns.find((g) => g.group.id === grp.id);
        const grpComps = activeStructure.components.filter((c) => c.groupId === grp.id);
        grpComps.forEach((comp) => {
          const cb = gb?.components.find((c) => c.component.id === comp.id);
          dynamicCells.push(cb && cb.score !== null ? cb.score : '-');
        });
        dynamicCells.push(gb && gb.groupScore !== null ? gb.groupScore : '-');
      });

      return [
        r.student.nimOrNip,
        `"${r.student.name.replace(/"/g, '""')}"`,
        `"${(r.student.className || 'Reguler').replace(/"/g, '""')}"`,
        ...dynamicCells,
        r.finalScore !== null ? r.finalScore : '-',
        r.category ? r.category.letter : '-',
        r.category ? `"${r.category.predicate}"` : '-',
        r.category ? (r.category.isPassed ? 'Lulus' : 'Tidak Lulus') : 'Belum Dinilai',
      ];
    });

    const csv = [header.join(','), ...lines.map((l) => l.join(','))].join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `buku-nilai-moodle-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Helper: Toggle collapse in Moodle User Report
  const toggleGroupCollapse = (groupId: string) => {
    setCollapsedGroupIds((prev) => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  // =========================================================================
  // RENDER: MOODLE USER REPORT (LAPORAN PENGGUNA HIERARKIS)
  // =========================================================================
  const renderMoodleUserReport = (row: StudentGradeBreakdown) => {
    const courseLabel = effectiveCourseId
      ? courses.find((c) => c.id === effectiveCourseId)?.name || 'Mata Kuliah'
      : 'Rekapitulasi Total Mata Kuliah & Kelas';

    return (
      <div className="space-y-5">
        {/* Moodle User Identity & Final Grade Summary Bar */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-semibold text-blue-700">
              <ShieldCheck className="w-4 h-4" />
              <span>
                {isStaff
                  ? 'Laporan Pengguna (User Report)'
                  : 'Transkrip Nilai Pribadi Mahasiswa (Privat)'}
              </span>
            </div>
            <h2 className="text-lg sm:text-xl font-extrabold text-slate-900">
              {row.student.name}
            </h2>
            <div className="text-xs text-slate-500 font-mono">
              NIM: {row.student.nimOrNip} · Kelas: {row.student.className || 'Reguler'} ·{' '}
              {courseLabel}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-right">
              <div className="text-[11px] font-semibold text-slate-500">Total Mata Kuliah</div>
              <div className="text-2xl font-extrabold text-slate-900 font-mono tabular-nums">
                {row.finalScore !== null ? row.finalScore.toFixed(2) : '-'}
              </div>
            </div>

            <div
              className={`px-4 py-2.5 rounded-xl border text-center min-w-[110px] ${
                row.category
                  ? row.category.isPassed
                    ? 'bg-emerald-50 border-emerald-200'
                    : 'bg-rose-50 border-rose-200'
                  : 'bg-slate-50 border-slate-200'
              }`}
            >
              <div className="text-[11px] font-semibold text-slate-500">Huruf Mutu</div>
              <div
                className={`text-2xl font-extrabold font-mono ${
                  row.category
                    ? row.category.isPassed
                      ? 'text-emerald-800'
                      : 'text-rose-800'
                    : 'text-slate-400'
                }`}
              >
                {row.category ? row.category.letter : '-'}
              </div>
              <div className="text-[11px] font-semibold text-slate-600">
                {row.category ? row.category.predicate : 'Belum Ada Data'}
              </div>
            </div>
          </div>
        </div>

        {row.isNormalized && (
          <div className="px-4 py-3 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-800 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-blue-600" />
            <span>
              Beberapa grup kelompok penilaian belum memiliki nilai. Nilai akhir saat ini
              dinormalisasi secara proporsional terhadap grup yang sudah memiliki aktivitas dinilai.
            </span>
          </div>
        )}

        {/* Moodle User Report Hierarchical Tree Table */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                  <th className="py-3 px-4 min-w-[280px]">Item Penilaian (Struktur Buku Nilai)</th>
                  <th className="py-3 px-3 text-right whitespace-nowrap">Bobot Terhitung</th>
                  <th className="py-3 px-3 text-right whitespace-nowrap">Nilai</th>
                  <th className="py-3 px-3 text-center whitespace-nowrap">Rentang</th>
                  <th className="py-3 px-3 text-right whitespace-nowrap">Persentase</th>
                  <th className="py-3 px-3 text-center whitespace-nowrap">Huruf</th>
                  <th className="py-3 px-4 whitespace-nowrap">Status / Keterangan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {/* Root Category Header Row (Moodle style) */}
                <tr className="bg-blue-50/60 font-bold text-slate-900">
                  <td className="py-3 px-4 flex items-center gap-2">
                    <Folder className="w-4 h-4 text-blue-700 shrink-0" />
                    <span>{courseLabel}</span>
                  </td>
                  <td className="py-3 px-3 text-right font-mono tabular-nums">100.00%</td>
                  <td className="py-3 px-3 text-right font-mono tabular-nums font-extrabold text-blue-800">
                    {row.finalScore !== null ? row.finalScore.toFixed(2) : '-'}
                  </td>
                  <td className="py-3 px-3 text-center font-mono text-slate-500">0–100</td>
                  <td className="py-3 px-3 text-right font-mono tabular-nums font-bold">
                    {row.finalScore !== null ? `${row.finalScore.toFixed(2)}%` : '-'}
                  </td>
                  <td className="py-3 px-3 text-center font-mono font-extrabold">
                    {row.category ? row.category.letter : '-'}
                  </td>
                  <td className="py-3 px-4 text-slate-600">
                    {row.category
                      ? `${row.category.isPassed ? 'Lulus' : 'Tidak Lulus'} · ${row.category.predicate}`
                      : 'Menunggu Nilai'}
                  </td>
                </tr>

                {/* Groups -> Components -> Activities */}
                {row.groupBreakdowns.map((gb) => {
                  const isCollapsed = Boolean(collapsedGroupIds[gb.group.id]);

                  return (
                    <React.Fragment key={gb.group.id}>
                      {/* Group Folder Row */}
                      <tr className="bg-slate-50 hover:bg-slate-100/80 font-bold text-slate-900">
                        <td className="py-2.5 px-4 pl-6">
                          <button
                            type="button"
                            onClick={() => toggleGroupCollapse(gb.group.id)}
                            className="flex items-center gap-2 text-left w-full"
                          >
                            {isCollapsed ? (
                              <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-slate-500 shrink-0" />
                            )}
                            <Folder className="w-4 h-4 text-amber-600 shrink-0" />
                            <span>{gb.group.name}</span>
                            <span className="text-[11px] font-normal text-slate-500 ml-1">
                              ({gb.group.aggregation === 'simple_mean' ? 'Rata-rata' : 'Terbobot'})
                            </span>
                          </button>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-700">
                          {gb.group.weight.toFixed(2)}%
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums font-extrabold">
                          {gb.groupScore !== null ? gb.groupScore.toFixed(2) : '-'}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono text-slate-500">0–100</td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                          {gb.groupScore !== null ? `${gb.groupScore.toFixed(2)}%` : '-'}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono font-bold">
                          {gb.category ? gb.category.letter : '-'}
                        </td>
                        <td className="py-2.5 px-4 font-normal text-slate-500">
                          {gb.components.length} komponen penilaian
                        </td>
                      </tr>

                      {!isCollapsed &&
                        gb.components.map((cb) => {
                          const SourceIcon =
                            cb.component.sourceType === 'attendance'
                              ? QrCode
                              : cb.component.sourceType === 'assignment'
                              ? ClipboardList
                              : GraduationCap;

                          return (
                            <React.Fragment key={cb.component.id}>
                              {/* Component Row */}
                              <tr className="bg-white hover:bg-slate-50/70">
                                <td className="py-2.5 px-4 pl-12">
                                  <div className="flex items-center gap-2 font-semibold text-slate-800">
                                    <SourceIcon className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                                    <span>{cb.component.name}</span>
                                    <span className="text-[11px] font-normal text-slate-400">
                                      · {SOURCE_LABELS[cb.component.sourceType]}
                                    </span>
                                  </div>
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-600">
                                  {cb.effectiveWeight.toFixed(2)}%
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono tabular-nums font-bold text-slate-900">
                                  {cb.score !== null ? cb.score.toFixed(2) : '-'}
                                </td>
                                <td className="py-2.5 px-3 text-center font-mono text-slate-500">
                                  0–{cb.component.maxScore || 100}
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-800">
                                  {cb.score !== null ? `${cb.score.toFixed(2)}%` : '-'}
                                </td>
                                <td className="py-2.5 px-3 text-center font-mono font-semibold text-slate-700">
                                  {cb.category ? cb.category.letter : '-'}
                                </td>
                                <td className="py-2.5 px-4 text-slate-500">
                                  {cb.items.length === 0
                                    ? 'Belum ada aktivitas pada komponen ini'
                                    : `${cb.items.filter((i) => i.percentage !== null).length} dari ${cb.items.length} aktivitas dinilai`}
                                </td>
                              </tr>

                              {/* Individual Activity Rows (Exams, Assignments, Attendance Sessions) */}
                              {cb.items.map((item) => (
                                <tr
                                  key={`${cb.component.id}-${item.id}`}
                                  className="bg-slate-50/40 hover:bg-slate-50 text-[11px] text-slate-600"
                                >
                                  <td className="py-2 px-4 pl-20">
                                    <div className="flex items-center gap-2">
                                      <span className="text-slate-300 font-mono">└─</span>
                                      <span className="font-medium text-slate-700">
                                        {item.title}
                                      </span>
                                      <span className="text-slate-400">· {item.subtitle}</span>
                                    </div>
                                  </td>
                                  <td className="py-2 px-3 text-right font-mono text-slate-400">
                                    (Item)
                                  </td>
                                  <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-800">
                                    {item.score !== null ? item.score : '-'}
                                  </td>
                                  <td className="py-2 px-3 text-center font-mono text-slate-400">
                                    0–{item.maxScore}
                                  </td>
                                  <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-700">
                                    {item.percentage !== null ? `${item.percentage.toFixed(2)}%` : '-'}
                                  </td>
                                  <td className="py-2 px-3 text-center font-mono text-slate-400">
                                    {item.percentage !== null
                                      ? classifyScoreCategory(
                                          item.percentage,
                                          activeConfig.categories
                                        )?.letter || '-'
                                      : '-'}
                                  </td>
                                  <td className="py-2 px-4 text-slate-500">{item.statusLabel}</td>
                                </tr>
                              ))}
                            </React.Fragment>
                          );
                        })}

                      {/* Group Subtotal Footer Row (authentic Moodle User Report style) */}
                      {!isCollapsed && (
                        <tr className="bg-slate-100/70 text-[11px] font-bold text-slate-700">
                          <td className="py-2 px-4 pl-10">
                            Total {gb.group.name}
                          </td>
                          <td className="py-2 px-3 text-right font-mono tabular-nums">
                            {gb.group.weight.toFixed(2)}%
                          </td>
                          <td className="py-2 px-3 text-right font-mono tabular-nums">
                            {gb.groupScore !== null ? gb.groupScore.toFixed(2) : '-'}
                          </td>
                          <td className="py-2 px-3 text-center font-mono text-slate-500">0–100</td>
                          <td className="py-2 px-3 text-right font-mono tabular-nums">
                            {gb.groupScore !== null ? `${gb.groupScore.toFixed(2)}%` : '-'}
                          </td>
                          <td className="py-2 px-3 text-center font-mono">
                            {gb.category ? gb.category.letter : '-'}
                          </td>
                          <td className="py-2 px-4 font-normal text-slate-500">
                            Agregasi:{' '}
                            {gb.group.aggregation === 'simple_mean'
                              ? 'Rata-rata Sederhana'
                              : 'Rata-rata Terbobot'}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}

                {/* Course Grand Total Footer Row */}
                <tr className="bg-slate-900 text-white font-bold">
                  <td className="py-3 px-4">Total Keseluruhan Nilai Akhir</td>
                  <td className="py-3 px-3 text-right font-mono tabular-nums">100.00%</td>
                  <td className="py-3 px-3 text-right font-mono tabular-nums text-sm">
                    {row.finalScore !== null ? row.finalScore.toFixed(2) : '-'}
                  </td>
                  <td className="py-3 px-3 text-center font-mono text-slate-300">0–100</td>
                  <td className="py-3 px-3 text-right font-mono tabular-nums">
                    {row.finalScore !== null ? `${row.finalScore.toFixed(2)}%` : '-'}
                  </td>
                  <td className="py-3 px-3 text-center font-mono text-amber-300 text-sm">
                    {row.category ? row.category.letter : '-'}
                  </td>
                  <td className="py-3 px-4 text-slate-200">
                    {row.category
                      ? `${row.category.isPassed ? 'Lulus' : 'Tidak Lulus'} · ${row.category.predicate}`
                      : 'Belum Ada Penilaian'}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-10 py-6 space-y-5">
      {/* Toast Feedback */}
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
          <button type="button" onClick={() => setToast(null)}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Moodle-Style Gradebook Header & Navigation Tabs */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-semibold text-blue-700">
              <Award className="w-4 h-4" />
              <span>
                Buku Nilai Akademik · Lingkup{' '}
                {activeConfig.scope === 'course'
                  ? 'Mata Kuliah'
                  : activeConfig.scope === 'class'
                  ? 'Kelas'
                  : 'Global'}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              {isStaff ? 'Buku Nilai & Struktur Komponen (Moodle View)' : 'Buku Nilai Pribadi Saya'}
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 max-w-2xl">
              {isStaff
                ? 'Kelola grup kelompok penilaian, komponen bobot ujian/tugas/absensi, kategori huruf mutu, serta pantau laporan penilai hierarkis.'
                : 'Rincian nilai pribadi Anda disusun berdasarkan grup kelompok penilaian dan komponen bobot yang ditetapkan oleh dosen.'}
            </p>
          </div>

          {isStaff && (
            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              <button
                type="button"
                id="btn-configure-grade-weights"
                onClick={openGradebookSetup}
                className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-colors"
              >
                <Settings2 className="w-4 h-4" />
                <span>Pengaturan Buku Nilai</span>
              </button>

              <button
                type="button"
                onClick={handleExportCsv}
                className="px-4 py-2.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                <span>Ekspor CSV</span>
              </button>
            </div>
          )}
        </div>

        {/* Moodle Sub-Navigation Tabs (Staff) */}
        {isStaff && (
          <div className="px-5 bg-slate-50/80 flex flex-wrap items-center gap-1 border-b border-slate-200">
            <button
              type="button"
              id="tab-gradebook-grader"
              onClick={() => setViewMode('grader')}
              className={`px-4 py-3 text-xs font-bold flex items-center gap-2 border-b-2 transition-colors ${
                viewMode === 'grader'
                  ? 'border-blue-700 text-blue-800 bg-white'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <Table2 className="w-4 h-4" />
              <span>Laporan Penilai (Grader Report)</span>
            </button>

            <button
              type="button"
              id="tab-gradebook-user"
              onClick={() => setViewMode('user')}
              className={`px-4 py-3 text-xs font-bold flex items-center gap-2 border-b-2 transition-colors ${
                viewMode === 'user'
                  ? 'border-blue-700 text-blue-800 bg-white'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <UserCheck className="w-4 h-4" />
              <span>Laporan Pengguna (User Report)</span>
            </button>

            <button
              type="button"
              id="tab-gradebook-setup"
              onClick={openGradebookSetup}
              className={`px-4 py-3 text-xs font-bold flex items-center gap-2 border-b-2 transition-colors ${
                viewMode === 'setup'
                  ? 'border-blue-700 text-blue-800 bg-white'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <Settings2 className="w-4 h-4" />
              <span>Pengaturan Buku Nilai (Setup)</span>
              {setupDirty && (
                <span className="text-[10px] font-bold text-amber-700">(Belum Disimpan)</span>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Filter Bar (Hidden when in Setup tab; shown on Grader Report, User Report, and Student View) */}
      {viewMode !== 'setup' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2.5 text-xs">
            {isStaff && (
              <div className="flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-slate-400" />
                <select
                  value={selectedClassId}
                  onChange={(e) => setSelectedClassId(e.target.value)}
                  className="px-3 py-2 rounded-lg border border-slate-200 bg-white font-semibold text-slate-700"
                >
                  <option value="all">Semua Kelas (Keseluruhan)</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      Kelas {c.name} ({c.code})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {!lockedCourseId && (
              <div className="flex items-center gap-1.5">
                <BookOpen className="w-4 h-4 text-slate-400" />
                <select
                  value={selectedCourseId}
                  onChange={(e) => setSelectedCourseId(e.target.value)}
                  className="px-3 py-2 rounded-lg border border-slate-200 bg-white font-semibold text-slate-700"
                >
                  <option value="all">Semua Mata Kuliah (Keseluruhan)</option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} · {c.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {isStaff && (
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Cari NIM atau nama mahasiswa..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 pr-3 py-2 rounded-lg border border-slate-200 text-xs w-56"
                />
              </div>
            )}
          </div>

          {/* Active Groups Weight Summary (Zero Pill Text Line) */}
          <div className="text-xs text-slate-600 flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-bold text-slate-800">Grup Bobot Aktif:</span>
            {activeStructure.groups.map((grp, idx) => (
              <span key={grp.id} className="font-mono text-slate-700">
                {idx > 0 && <span className="text-slate-300 mr-2">·</span>}
                {grp.name} (<strong className="text-slate-900">{grp.weight}%</strong>)
              </span>
            ))}
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* STUDENT PRIVATE VIEW (ONLY USER REPORT + GRADE SCALE)               */}
      {/* =================================================================== */}
      {!isStaff && (
        <div className="space-y-6">
          {activeUserReportRow ? (
            renderMoodleUserReport(activeUserReportRow)
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-xs text-slate-500">
              Data nilai Anda belum tersedia.
            </div>
          )}

          {/* Read-only Grade Categories Scale */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
            <h3 className="font-bold text-slate-900 text-sm">
              Skala Kategori Nilai yang Berlaku
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 text-xs">
              {activeConfig.categories.map((cat) => (
                <div
                  key={cat.id}
                  className={`p-2.5 rounded-xl border text-center space-y-0.5 ${
                    cat.isPassed
                      ? 'bg-slate-50 border-slate-200'
                      : 'bg-rose-50/70 border-rose-200'
                  }`}
                >
                  <div className="font-extrabold text-base text-slate-900 font-mono">
                    {cat.letter}
                  </div>
                  <div className="text-[11px] font-mono text-slate-600 tabular-nums">
                    {cat.minScore} – {cat.maxScore}
                  </div>
                  <div className="text-[10px] text-slate-500 truncate">{cat.predicate}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* STAFF TAB 1: GRADER REPORT (LAPORAN PENILAI MATRIX HIERARKIS)       */}
      {/* =================================================================== */}
      {isStaff && viewMode === 'grader' && (
        <div className="space-y-5">
          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-2xl border border-slate-200 p-4">
              <div className="text-xs text-slate-500 font-medium">Total Mahasiswa</div>
              <div className="text-2xl font-extrabold text-slate-900 font-mono tabular-nums mt-1">
                {gradeRows.length}
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 p-4">
              <div className="text-xs text-slate-500 font-medium">Rata-Rata Nilai Akhir</div>
              <div className="text-2xl font-extrabold text-blue-700 font-mono tabular-nums mt-1">
                {classSummary.avg}
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 p-4">
              <div className="text-xs text-slate-500 font-medium">Nilai Tertinggi</div>
              <div className="text-2xl font-extrabold text-emerald-700 font-mono tabular-nums mt-1">
                {classSummary.highest}
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 p-4">
              <div className="text-xs text-slate-500 font-medium">Tingkat Kelulusan</div>
              <div className="text-2xl font-extrabold text-indigo-700 font-mono tabular-nums mt-1">
                {classSummary.passRate}%
              </div>
            </div>
          </div>

          {/* Moodle 2-Row Grouped Matrix Table */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            {gradeRows.length === 0 ? (
              <div className="p-12 text-center text-xs text-slate-500">
                Tidak ada mahasiswa yang cocok dengan filter kelas/pencarian saat ini.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    {/* Header Row 1: Groups spanning components + total */}
                    <tr className="bg-slate-100 border-b border-slate-200 text-[11px] font-bold text-slate-700">
                      <th
                        rowSpan={2}
                        className="py-3 px-4 sticky left-0 z-20 bg-slate-100 border-r border-slate-200 min-w-[200px]"
                      >
                        Mahasiswa
                      </th>
                      <th
                        rowSpan={2}
                        className="py-3 px-3 border-r border-slate-200 whitespace-nowrap"
                      >
                        Kelas
                      </th>

                      {activeStructure.groups.map((grp) => {
                        const grpComps = activeStructure.components.filter(
                          (c) => c.groupId === grp.id
                        );
                        return (
                          <th
                            key={grp.id}
                            colSpan={grpComps.length + 1}
                            className="py-2 px-3 text-center border-r border-slate-300 bg-slate-100"
                          >
                            <div className="flex items-center justify-center gap-1.5 text-slate-900">
                              <Folder className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                              <span className="truncate max-w-[220px]">{grp.name}</span>
                              <span className="font-mono text-blue-700">({grp.weight}%)</span>
                            </div>
                          </th>
                        );
                      })}

                      <th
                        rowSpan={2}
                        className="py-3 px-3 text-right border-r border-slate-200 whitespace-nowrap bg-blue-50 text-blue-900"
                      >
                        Nilai Akhir
                      </th>
                      <th
                        rowSpan={2}
                        className="py-3 px-3 text-center border-r border-slate-200 whitespace-nowrap"
                      >
                        Huruf
                      </th>
                      <th
                        rowSpan={2}
                        className="py-3 px-3 border-r border-slate-200 whitespace-nowrap"
                      >
                        Status
                      </th>
                      <th rowSpan={2} className="py-3 px-4 text-right whitespace-nowrap">
                        Laporan
                      </th>
                    </tr>

                    {/* Header Row 2: Individual Components + Group Total */}
                    <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-600">
                      {activeStructure.groups.map((grp) => {
                        const grpComps = activeStructure.components.filter(
                          (c) => c.groupId === grp.id
                        );
                        return (
                          <React.Fragment key={`${grp.id}-sub`}>
                            {grpComps.map((comp) => {
                              const effW = getComponentEffectiveWeight(comp, grp, grpComps);
                              return (
                                <th
                                  key={comp.id}
                                  className="py-2.5 px-3 text-right border-r border-slate-200 min-w-[110px]"
                                  title={`${comp.name} (${SOURCE_LABELS[comp.sourceType]})`}
                                >
                                  <div className="truncate max-w-[130px] ml-auto text-slate-800">
                                    {comp.name}
                                  </div>
                                  <div className="text-[10px] font-mono text-slate-400">
                                    {SOURCE_SHORT_LABELS[comp.sourceType]} · {effW}%
                                  </div>
                                </th>
                              );
                            })}
                            <th className="py-2.5 px-3 text-right border-r border-slate-300 bg-slate-100/80 text-slate-900 font-bold min-w-[95px]">
                              <div>Total Grup</div>
                              <div className="text-[10px] font-mono text-blue-700">
                                {grp.weight}%
                              </div>
                            </th>
                          </React.Fragment>
                        );
                      })}
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {gradeRows.map((row) => (
                      <tr key={row.student.id} className="hover:bg-blue-50/30 group">
                        <td className="py-3 px-4 sticky left-0 z-10 bg-white group-hover:bg-blue-50/30 border-r border-slate-200">
                          <div className="font-bold text-slate-900">{row.student.name}</div>
                          <div className="text-[11px] font-mono text-slate-500">
                            {row.student.nimOrNip}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-slate-600 font-medium border-r border-slate-200 whitespace-nowrap">
                          {row.student.className || 'Reguler'}
                        </td>

                        {activeStructure.groups.map((grp) => {
                          const gb = row.groupBreakdowns.find((g) => g.group.id === grp.id);
                          const grpComps = activeStructure.components.filter(
                            (c) => c.groupId === grp.id
                          );
                          return (
                            <React.Fragment key={`${row.student.id}-${grp.id}`}>
                              {grpComps.map((comp) => {
                                const cb = gb?.components.find(
                                  (c) => c.component.id === comp.id
                                );
                                return (
                                  <td
                                    key={comp.id}
                                    className="py-3 px-3 text-right font-mono tabular-nums text-slate-700 border-r border-slate-100"
                                  >
                                    {cb && cb.score !== null ? cb.score.toFixed(2) : '-'}
                                  </td>
                                );
                              })}
                              <td className="py-3 px-3 text-right font-mono tabular-nums font-bold text-slate-900 bg-slate-50/80 border-r border-slate-300">
                                {gb && gb.groupScore !== null ? gb.groupScore.toFixed(2) : '-'}
                              </td>
                            </React.Fragment>
                          );
                        })}

                        <td className="py-3 px-3 text-right font-mono tabular-nums font-extrabold text-sm text-blue-900 bg-blue-50/40 border-r border-slate-200">
                          {row.finalScore !== null ? row.finalScore.toFixed(2) : '-'}
                        </td>
                        <td className="py-3 px-3 text-center border-r border-slate-200">
                          {row.category ? (
                            <span
                              className={`inline-block px-2 py-0.5 rounded font-mono font-extrabold text-xs border ${
                                row.category.isPassed
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                  : 'bg-rose-50 text-rose-800 border-rose-200'
                              }`}
                            >
                              {row.category.letter}
                            </span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="py-3 px-3 border-r border-slate-200 whitespace-nowrap">
                          {row.category ? (
                            <span
                              className={`inline-flex items-center gap-1 text-[11px] font-bold ${
                                row.category.isPassed ? 'text-emerald-700' : 'text-rose-700'
                              }`}
                            >
                              {row.category.isPassed ? (
                                <CheckCircle2 className="w-3.5 h-3.5" />
                              ) : (
                                <XCircle className="w-3.5 h-3.5" />
                              )}
                              <span>
                                {row.category.isPassed ? 'Lulus' : 'Tidak Lulus'} ·{' '}
                                {row.category.predicate}
                              </span>
                            </span>
                          ) : (
                            <span className="text-slate-400">Belum Dinilai</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedUserId(row.student.id);
                              setViewMode('user');
                            }}
                            className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold inline-flex items-center gap-1"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Laporan</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>

                  {/* Footer Summary Row: Class Averages */}
                  <tfoot>
                    <tr className="bg-slate-100 border-t-2 border-slate-300 font-bold text-slate-900">
                      <td className="py-3 px-4 sticky left-0 z-10 bg-slate-100 border-r border-slate-200">
                        Rata-Rata Keseluruhan
                      </td>
                      <td className="py-3 px-3 border-r border-slate-200 text-slate-500">
                        {gradeRows.length} Mhs
                      </td>
                      {activeStructure.groups.map((grp) => {
                        const grpComps = activeStructure.components.filter(
                          (c) => c.groupId === grp.id
                        );
                        const grpAvg = columnAverages.groupAvgMap.get(grp.id);
                        return (
                          <React.Fragment key={`avg-${grp.id}`}>
                            {grpComps.map((comp) => {
                              const compAvg = columnAverages.compAvgMap.get(comp.id);
                              return (
                                <td
                                  key={`avg-${comp.id}`}
                                  className="py-3 px-3 text-right font-mono tabular-nums border-r border-slate-200"
                                >
                                  {compAvg !== null && compAvg !== undefined
                                    ? compAvg.toFixed(2)
                                    : '-'}
                                </td>
                              );
                            })}
                            <td className="py-3 px-3 text-right font-mono tabular-nums bg-slate-200/70 border-r border-slate-300">
                              {grpAvg !== null && grpAvg !== undefined ? grpAvg.toFixed(2) : '-'}
                            </td>
                          </React.Fragment>
                        );
                      })}
                      <td className="py-3 px-3 text-right font-mono tabular-nums text-blue-900 bg-blue-100/70 border-r border-slate-200">
                        {columnAverages.finalAvg !== null
                          ? columnAverages.finalAvg.toFixed(2)
                          : '-'}
                      </td>
                      <td colSpan={3} className="py-3 px-4 text-slate-500 font-normal">
                        Rata-rata dihitung dari mahasiswa yang memiliki skor terisi
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

          {/* Active Category Legend */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-sm">
                Skala Kategori Nilai Aktif ({activeConfig.scope.toUpperCase()})
              </h3>
              <button
                type="button"
                onClick={openGradebookSetup}
                className="text-xs font-bold text-blue-700 hover:underline"
              >
                Kelola Grup, Komponen &amp; Kategori di Setup →
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 text-xs">
              {activeConfig.categories.map((cat) => (
                <div
                  key={cat.id}
                  className={`p-2.5 rounded-xl border text-center space-y-0.5 ${
                    cat.isPassed
                      ? 'bg-slate-50 border-slate-200'
                      : 'bg-rose-50/70 border-rose-200'
                  }`}
                >
                  <div className="font-extrabold text-base text-slate-900 font-mono">
                    {cat.letter}
                  </div>
                  <div className="text-[11px] font-mono text-slate-600 tabular-nums">
                    {cat.minScore} – {cat.maxScore}
                  </div>
                  <div className="text-[10px] text-slate-500 truncate">{cat.predicate}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* STAFF TAB 2: USER REPORT (LAPORAN PENGGUNA PER MAHASISWA)           */}
      {/* =================================================================== */}
      {isStaff && viewMode === 'user' && (
        <div className="space-y-5">
          <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <button
                type="button"
                onClick={() => setViewMode('grader')}
                className="px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 font-bold text-slate-700"
              >
                ← Kembali ke Laporan Penilai
              </button>
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-700">Pilih Mahasiswa:</span>
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  className="px-3 py-2 rounded-lg border border-slate-300 bg-white font-semibold text-slate-800 min-w-[260px]"
                >
                  {gradeRows.map((r) => (
                    <option key={r.student.id} value={r.student.id}>
                      {r.student.name} ({r.student.nimOrNip}) ·{' '}
                      {r.student.className || 'Reguler'}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="text-xs text-slate-500">
              Menampilkan pohon hierarki Grup → Komponen → Ujian / Tugas / Absensi
            </div>
          </div>

          {activeUserReportRow ? (
            renderMoodleUserReport(activeUserReportRow)
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-xs text-slate-500">
              Tidak ada mahasiswa yang dipilih atau sesuai dengan filter saat ini.
            </div>
          )}
        </div>
      )}

      {/* =================================================================== */}
      {/* STAFF TAB 3: GRADEBOOK SETUP (GRUP, KOMPONEN, KATEGORI, ABSENSI)    */}
      {/* =================================================================== */}
      {isStaff && viewMode === 'setup' && (
        <div className="space-y-6">
          {/* Scope & Actions Card */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-base font-extrabold text-slate-900">
                  Pengaturan Buku Nilai (Gradebook Setup)
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Buat grup kelompok penilaian baru, atur komponen di dalamnya (Ujian, Tugas,
                  Absensi), dan tentukan bobotnya agar dapat dipilih saat membuat ujian atau tugas.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  id="btn-add-grading-group"
                  onClick={() => handleOpenGroupModal()}
                  className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold flex items-center gap-1.5"
                >
                  <FolderPlus className="w-4 h-4" />
                  <span>Tambah Grup Kelompok</span>
                </button>

                <button
                  type="button"
                  id="btn-add-grading-component"
                  onClick={() => handleOpenComponentModal()}
                  disabled={setupGroups.length === 0}
                  className="px-3.5 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>Tambah Komponen Penilaian</span>
                </button>

                <button
                  type="button"
                  id="btn-save-gradebook-setup"
                  disabled={setupSaving}
                  onClick={handleSaveGradebookSetup}
                  className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white text-xs font-bold flex items-center gap-1.5"
                >
                  <Save className="w-4 h-4" />
                  <span>{setupSaving ? 'Menyimpan...' : 'Simpan Pengaturan'}</span>
                </button>
              </div>
            </div>

            {setupError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-semibold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{setupError}</span>
              </div>
            )}

            {/* Target Scope Selector */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-end text-xs">
              <div className="space-y-1.5">
                <label className="block font-bold text-slate-700">
                  Lingkup Penerapan Pengaturan Buku Nilai
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      { id: 'global', label: 'Standar Global' },
                      { id: 'class', label: 'Per Kelas' },
                      { id: 'course', label: 'Per Mata Kuliah' },
                    ] as const
                  ).map((sc) => (
                    <button
                      key={sc.id}
                      type="button"
                      onClick={() => {
                        setSetupScope(sc.id);
                        loadSetupFromScope(sc.id, setupClassId, setupCourseId);
                      }}
                      className={`py-2 px-3 rounded-xl border font-bold transition-colors ${
                        setupScope === sc.id
                          ? 'bg-blue-50 border-blue-500 text-blue-800'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {sc.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                {setupScope === 'class' && (
                  <div className="space-y-1.5">
                    <label className="block font-bold text-slate-700">Kelas Target</label>
                    <select
                      value={setupClassId}
                      onChange={(e) => {
                        setSetupClassId(e.target.value);
                        loadSetupFromScope('class', e.target.value, setupCourseId);
                      }}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-semibold"
                    >
                      <option value="">-- Pilih Kelas --</option>
                      {classes.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.code})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {setupScope === 'course' && (
                  <div className="space-y-1.5">
                    <label className="block font-bold text-slate-700">Mata Kuliah Target</label>
                    <select
                      value={setupCourseId}
                      onChange={(e) => {
                        setSetupCourseId(e.target.value);
                        loadSetupFromScope('course', setupClassId, e.target.value);
                      }}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-semibold"
                    >
                      <option value="">-- Pilih Mata Kuliah --</option>
                      {courses.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.code} · {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {setupScope === 'global' && (
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-600">
                    Berlaku sebagai standar bawaan seluruh kelas &amp; mata kuliah kecuali ada
                    pengaturan khusus per kelas/mata kuliah.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Moodle Gradebook Setup Tree Table */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                <ListChecks className="w-4 h-4 text-blue-700" />
                <span>Hierarki Grup Kelompok &amp; Komponen Penilaian</span>
              </div>

              <div className="flex items-center gap-3 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    const def = createDefaultGradingStructure();
                    setSetupGroups(def.gradingGroups);
                    setSetupComponents(def.gradingComponents);
                    setSetupDirty(true);
                  }}
                  className="text-slate-600 hover:text-slate-900 font-semibold flex items-center gap-1"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset Struktur Default</span>
                </button>
                <span
                  className={`font-mono font-extrabold px-2.5 py-1 rounded-lg border ${
                    Math.abs(totalSetupGroupWeight - 100) <= 0.01
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : 'bg-rose-50 border-rose-200 text-rose-800'
                  }`}
                >
                  Total Bobot Grup: {totalSetupGroupWeight}% / 100%
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                    <th className="py-3 px-4 min-w-[280px]">Nama Grup / Komponen Penilaian</th>
                    <th className="py-3 px-3 whitespace-nowrap">Jenis / Agregasi</th>
                    <th className="py-3 px-3 text-right whitespace-nowrap">Bobot (%)</th>
                    <th className="py-3 px-3 text-right whitespace-nowrap">Bobot Efektif</th>
                    <th className="py-3 px-3 text-center whitespace-nowrap">Aktivitas Terhubung</th>
                    <th className="py-3 px-4 text-right whitespace-nowrap">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {/* Root Course Total Row */}
                  <tr className="bg-blue-50/60 font-bold text-slate-900">
                    <td className="py-3 px-4 flex items-center gap-2">
                      <Folder className="w-4 h-4 text-blue-700 shrink-0" />
                      <span>Total Penilaian Keseluruhan</span>
                    </td>
                    <td className="py-3 px-3 text-slate-600 font-normal">
                      Penjumlahan Terbobot Antar Grup
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums">
                      {totalSetupGroupWeight}%
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums text-blue-800">
                      100.00%
                    </td>
                    <td className="py-3 px-3 text-center text-slate-500 font-normal">
                      {setupGroups.length} grup · {setupComponents.length} komponen
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => handleOpenGroupModal()}
                        className="text-blue-700 hover:underline font-bold"
                      >
                        + Grup Baru
                      </button>
                    </td>
                  </tr>

                  {setupGroups.map((grp) => {
                    const childComps = setupComponents.filter((c) => c.groupId === grp.id);
                    const totalChildWeights = childComps.reduce(
                      (sum, c) => sum + (Number(c.weight) || 0),
                      0
                    );

                    return (
                      <React.Fragment key={grp.id}>
                        {/* Group Row */}
                        <tr className="bg-slate-50 font-bold text-slate-900">
                          <td className="py-3 px-4 pl-7">
                            <div className="flex items-start gap-2">
                              <Folder className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                              <div>
                                <div>{grp.name}</div>
                                {grp.description && (
                                  <div className="text-[11px] font-normal text-slate-500">
                                    {grp.description}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            <select
                              value={grp.aggregation}
                              onChange={(e) => {
                                const val = e.target.value as GradingGroupAggregation;
                                setSetupGroups((prev) =>
                                  prev.map((g) =>
                                    g.id === grp.id ? { ...g, aggregation: val } : g
                                  )
                                );
                                setSetupDirty(true);
                              }}
                              className="px-2 py-1 rounded-lg border border-slate-300 bg-white text-[11px] font-semibold text-slate-700"
                            >
                              <option value="weighted_mean">Rata-rata Terbobot</option>
                              <option value="simple_mean">Rata-rata Sederhana (Setara)</option>
                            </select>
                          </td>
                          <td className="py-3 px-3 text-right">
                            <div className="inline-flex items-center gap-1">
                              <input
                                type="number"
                                min="0"
                                max="100"
                                step="0.5"
                                value={grp.weight}
                                onChange={(e) => {
                                  const nextW = Number(e.target.value);
                                  setSetupGroups((prev) =>
                                    prev.map((g) =>
                                      g.id === grp.id ? { ...g, weight: nextW } : g
                                    )
                                  );
                                  setSetupDirty(true);
                                }}
                                className="w-20 px-2 py-1 rounded-lg border border-slate-300 bg-white text-right font-mono font-bold"
                              />
                              <span className="font-mono text-slate-500">%</span>
                            </div>
                          </td>
                          <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-800">
                            {grp.weight.toFixed(2)}%
                          </td>
                          <td className="py-3 px-3 text-center text-[11px] font-normal text-slate-500">
                            {childComps.length} komponen
                            {grp.aggregation === 'weighted_mean' && childComps.length > 0 && (
                              <span className="block font-mono text-[10px]">
                                (Sub-bobot: {totalChildWeights}%)
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right whitespace-nowrap space-x-1.5">
                            <button
                              type="button"
                              onClick={() => handleOpenComponentModal(grp.id)}
                              className="px-2 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold"
                            >
                              + Komponen
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenGroupModal(grp)}
                              className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-600"
                              title="Edit Grup"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setPendingDeleteTarget({
                                  type: 'group',
                                  id: grp.id,
                                  name: grp.name,
                                  childCount: childComps.length,
                                })
                              }
                              className="p-1.5 rounded-lg hover:bg-rose-100 text-rose-600"
                              title="Hapus Grup"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>

                        {/* Component Rows under Group */}
                        {childComps.length === 0 ? (
                          <tr className="bg-white text-slate-400 italic">
                            <td colSpan={6} className="py-2.5 px-4 pl-14">
                              Belum ada komponen di grup ini. Klik &quot;+ Komponen&quot; untuk
                              menambahkan item ujian, tugas, atau absensi.
                            </td>
                          </tr>
                        ) : (
                          childComps.map((comp) => {
                            const effWeight = getComponentEffectiveWeight(comp, grp, childComps);
                            const linked = linkedActivityCountMap.get(comp.id);
                            return (
                              <tr key={comp.id} className="bg-white hover:bg-slate-50/80">
                                <td className="py-2.5 px-4 pl-14">
                                  <div className="flex items-center gap-2">
                                    <span className="text-slate-300 font-mono">└─</span>
                                    <span className="font-semibold text-slate-800">
                                      {comp.name}
                                    </span>
                                  </div>
                                </td>
                                <td className="py-2.5 px-3 text-slate-600">
                                  {SOURCE_LABELS[comp.sourceType]}
                                </td>
                                <td className="py-2.5 px-3 text-right">
                                  {grp.aggregation === 'simple_mean' ? (
                                    <span className="font-mono text-slate-400">
                                      Setara ({(100 / childComps.length).toFixed(1)}%)
                                    </span>
                                  ) : (
                                    <div className="inline-flex items-center gap-1">
                                      <input
                                        type="number"
                                        min="0"
                                        max="100"
                                        step="0.5"
                                        value={comp.weight}
                                        onChange={(e) => {
                                          const nextW = Number(e.target.value);
                                          setSetupComponents((prev) =>
                                            prev.map((c) =>
                                              c.id === comp.id ? { ...c, weight: nextW } : c
                                            )
                                          );
                                          setSetupDirty(true);
                                        }}
                                        className="w-20 px-2 py-1 rounded-lg border border-slate-300 bg-white text-right font-mono"
                                      />
                                      <span className="font-mono text-slate-400">%</span>
                                    </div>
                                  )}
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono tabular-nums font-bold text-indigo-700">
                                  {effWeight.toFixed(2)}%
                                </td>
                                <td className="py-2.5 px-3 text-center text-[11px] font-mono text-slate-500">
                                  {linked
                                    ? `${linked.exams} ujian · ${linked.assignments} tugas`
                                    : comp.sourceType === 'attendance'
                                    ? `${attendanceSessions.length} sesi QR`
                                    : '0 item'}
                                </td>
                                <td className="py-2.5 px-4 text-right whitespace-nowrap space-x-1">
                                  <button
                                    type="button"
                                    onClick={() => handleOpenComponentModal(grp.id, comp)}
                                    className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-600"
                                    title="Edit Komponen"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setPendingDeleteTarget({
                                        type: 'component',
                                        id: comp.id,
                                        name: comp.name,
                                      })
                                    }
                                    className="p-1.5 rounded-lg hover:bg-rose-100 text-rose-600"
                                    title="Hapus Komponen"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Attendance Status Scores & Grade Categories Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 text-xs">
            {/* Attendance Status Scores */}
            <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
              <h3 className="font-bold text-slate-900 text-sm">
                Pemetaan Skor Status Absensi (0–100)
              </h3>
              <p className="text-slate-500">
                Nilai numerik untuk setiap status kehadiran saat menghitung komponen absensi.
              </p>
              <div className="grid grid-cols-2 gap-3 pt-1">
                {(['hadir', 'izin', 'sakit', 'terlambat', 'alfa'] as const).map((statusKey) => (
                  <div key={statusKey}>
                    <label className="block capitalize font-semibold text-slate-700 mb-1">
                      {statusKey}
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={setupStatusScores[statusKey]}
                      onChange={(e) => {
                        setSetupStatusScores((prev) => ({
                          ...prev,
                          [statusKey]: Number(e.target.value),
                        }));
                        setSetupDirty(true);
                      }}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-300 font-mono"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Grade Categories (Huruf Mutu) */}
            <div className="lg:col-span-8 bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">
                    Kategori Nilai &amp; Skala Huruf Mutu
                  </h3>
                  <p className="text-slate-500">
                    Menentukan konversi Nilai Akhir (0–100) menjadi Huruf Mutu, Predikat, dan Status
                    Kelulusan.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSetupCategories(DEFAULT_GRADE_CATEGORIES.map((c) => ({ ...c })));
                      setSetupDirty(true);
                    }}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 font-semibold flex items-center gap-1"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Default</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSetupCategories((prev) => [
                        ...prev,
                        {
                          id: `cat-${Date.now()}`,
                          letter: 'X',
                          minScore: 0,
                          maxScore: 0,
                          predicate: 'Kategori Baru',
                          isPassed: false,
                        },
                      ]);
                      setSetupDirty(true);
                    }}
                    className="px-2.5 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Tambah Kategori</span>
                  </button>
                </div>
              </div>

              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                {setupCategories.map((cat, idx) => (
                  <div
                    key={cat.id}
                    className="grid grid-cols-12 gap-2 items-center p-2 rounded-xl bg-slate-50 border border-slate-200"
                  >
                    <div className="col-span-2">
                      <input
                        type="text"
                        placeholder="Huruf"
                        value={cat.letter}
                        onChange={(e) => {
                          setSetupCategories((prev) =>
                            prev.map((c, i) => (i === idx ? { ...c, letter: e.target.value } : c))
                          );
                          setSetupDirty(true);
                        }}
                        className="w-full px-2 py-1.5 rounded-lg border border-slate-300 bg-white font-mono font-bold text-center"
                      />
                    </div>
                    <div className="col-span-2">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        value={cat.minScore}
                        onChange={(e) => {
                          setSetupCategories((prev) =>
                            prev.map((c, i) =>
                              i === idx ? { ...c, minScore: Number(e.target.value) } : c
                            )
                          );
                          setSetupDirty(true);
                        }}
                        className="w-full px-2 py-1.5 rounded-lg border border-slate-300 bg-white font-mono text-right"
                      />
                    </div>
                    <div className="col-span-2">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        value={cat.maxScore}
                        onChange={(e) => {
                          setSetupCategories((prev) =>
                            prev.map((c, i) =>
                              i === idx ? { ...c, maxScore: Number(e.target.value) } : c
                            )
                          );
                          setSetupDirty(true);
                        }}
                        className="w-full px-2 py-1.5 rounded-lg border border-slate-300 bg-white font-mono text-right"
                      />
                    </div>
                    <div className="col-span-3">
                      <input
                        type="text"
                        placeholder="Predikat"
                        value={cat.predicate}
                        onChange={(e) => {
                          setSetupCategories((prev) =>
                            prev.map((c, i) =>
                              i === idx ? { ...c, predicate: e.target.value } : c
                            )
                          );
                          setSetupDirty(true);
                        }}
                        className="w-full px-2 py-1.5 rounded-lg border border-slate-300 bg-white"
                      />
                    </div>
                    <div className="col-span-2">
                      <select
                        value={cat.isPassed ? 'lulus' : 'gagal'}
                        onChange={(e) => {
                          setSetupCategories((prev) =>
                            prev.map((c, i) =>
                              i === idx ? { ...c, isPassed: e.target.value === 'lulus' } : c
                            )
                          );
                          setSetupDirty(true);
                        }}
                        className="w-full px-1.5 py-1.5 rounded-lg border border-slate-300 bg-white text-[11px] font-semibold"
                      >
                        <option value="lulus">Lulus</option>
                        <option value="gagal">Tidak Lulus</option>
                      </select>
                    </div>
                    <div className="col-span-1 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          setSetupCategories((prev) => prev.filter((_, i) => i !== idx));
                          setSetupDirty(true);
                        }}
                        className="p-1 text-rose-600 hover:bg-rose-50 rounded"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL: TAMBAH / EDIT GRUP KELOMPOK PENILAIAN                        */}
      {/* =================================================================== */}
      {isStaff && groupModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <FolderPlus className="w-4 h-4 text-amber-600" />
                <span>
                  {editingGroupId
                    ? 'Edit Grup Kelompok Penilaian'
                    : 'Buat Grup Kelompok Penilaian Baru'}
                </span>
              </h3>
              <button
                type="button"
                onClick={() => setGroupModalOpen(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveGroupModal} className="p-5 space-y-4 text-xs">
              {grpFormError && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg font-semibold">
                  {grpFormError}
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Nama Grup Kelompok Penilaian
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Kelompok Evaluasi Praktikum & Proyek"
                  value={grpName}
                  onChange={(e) => setGrpName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Deskripsi (Opsional)
                </label>
                <input
                  type="text"
                  placeholder="Keterangan singkat cakupan komponen di grup ini"
                  value={grpDesc}
                  onChange={(e) => setGrpDesc(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Bobot Grup (% Nilai Akhir)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    required
                    value={grpWeight}
                    onChange={(e) => setGrpWeight(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Mode Agregasi Komponen
                  </label>
                  <select
                    value={grpAggregation}
                    onChange={(e) => setGrpAggregation(e.target.value as GradingGroupAggregation)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-semibold"
                  >
                    <option value="weighted_mean">Rata-rata Terbobot</option>
                    <option value="simple_mean">Rata-rata Sederhana</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setGroupModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 font-bold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold"
                >
                  {editingGroupId ? 'Perbarui Grup' : 'Tambah Grup'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL: TAMBAH / EDIT KOMPONEN PENILAIAN                             */}
      {/* =================================================================== */}
      {isStaff && compModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Plus className="w-4 h-4 text-blue-700" />
                <span>
                  {editingCompId ? 'Edit Komponen Penilaian' : 'Tambah Komponen Penilaian Baru'}
                </span>
              </h3>
              <button
                type="button"
                onClick={() => setCompModalOpen(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveComponentModal} className="p-5 space-y-4 text-xs">
              {cmpFormError && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg font-semibold">
                  {cmpFormError}
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Masuk Ke Grup Kelompok Penilaian
                </label>
                <select
                  value={cmpGroupId}
                  onChange={(e) => setCmpGroupId(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-semibold"
                >
                  <option value="">-- Pilih Grup Kelompok --</option>
                  {setupGroups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name} (Bobot Grup {g.weight}%)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Nama Komponen Penilaian
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Kuis Bab 1-3, UTS Praktikum, Presentasi Akhir"
                  value={cmpName}
                  onChange={(e) => setCmpName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Jenis Aktivitas Sumber Nilai
                </label>
                <select
                  value={cmpSourceType}
                  onChange={(e) => setCmpSourceType(e.target.value as GradingComponentSource)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-semibold"
                >
                  <option value="exam">Ujian CBT (Muncul saat membuat Ujian)</option>
                  <option value="assignment">Tugas / Proyek (Muncul saat membuat Tugas)</option>
                  <option value="any">Umum: Ujian &amp; Tugas (Muncul di keduanya)</option>
                  <option value="attendance">Absensi Perkuliahan QR</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Bobot Di Dalam Grup (%)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    required
                    value={cmpWeight}
                    onChange={(e) => setCmpWeight(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Skor Maksimal</label>
                  <input
                    type="number"
                    min="1"
                    max="1000"
                    required
                    value={cmpMaxScore}
                    onChange={(e) => setCmpMaxScore(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setCompModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 font-bold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-blue-700 hover:bg-blue-800 text-white font-bold"
                >
                  {editingCompId ? 'Perbarui Komponen' : 'Tambah Komponen'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL: KONFIRMASI HAPUS GRUP / KOMPONEN                             */}
      {/* =================================================================== */}
      {isStaff && pendingDeleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-sm p-5 space-y-4 text-xs">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-rose-50 text-rose-600 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="font-bold text-slate-900 text-sm">
                  Hapus {pendingDeleteTarget.type === 'group' ? 'Grup Penilaian' : 'Komponen'}?
                </h3>
                <p className="text-slate-600 leading-relaxed">
                  Anda akan menghapus <strong>{pendingDeleteTarget.name}</strong>
                  {pendingDeleteTarget.type === 'group' && (pendingDeleteTarget.childCount || 0) > 0
                    ? ` beserta ${pendingDeleteTarget.childCount} komponen di dalamnya.`
                    : '.'}{' '}
                  Jangan lupa klik &quot;Simpan Pengaturan&quot; agar perubahan permanen.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingDeleteTarget(null)}
                className="px-3.5 py-2 rounded-lg border border-slate-200 font-bold text-slate-600"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteTarget}
                className="px-3.5 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold"
              >
                Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
