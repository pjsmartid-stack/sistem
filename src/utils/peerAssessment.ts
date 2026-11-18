import {
  PeerProjectAssignment,
  PeerProjectSubmission,
  PeerRubricCriterion,
  User,
} from '../types';

export function createDefaultPeerRubricCriteria(): PeerRubricCriterion[] {
  return [
    {
      id: 'crit-kualitas',
      title: 'Kualitas & Ketepatan Solusi Projek',
      description: 'Kesesuaian hasil karya/laporan dengan tujuan proyek dan kelengkapan solusi.',
      options: [
        { id: 'opt-k-4', label: 'Sangat Baik & Lengkap', points: 40 },
        { id: 'opt-k-3', label: 'Baik & Sesuai', points: 30 },
        { id: 'opt-k-2', label: 'Cukup (Perlu Perbaikan)', points: 20 },
        { id: 'opt-k-1', label: 'Kurang Memadai', points: 10 },
      ],
    },
    {
      id: 'crit-inovasi',
      title: 'Kreativitas & Analisis Teknis',
      description: 'Kedalaman analisis, kerapian kode/rancangan, serta nilai tambah inovasi.',
      options: [
        { id: 'opt-i-4', label: 'Sangat Kreatif & Mendalam', points: 35 },
        { id: 'opt-i-3', label: 'Cukup Inovatif', points: 25 },
        { id: 'opt-i-2', label: 'Standar', points: 15 },
        { id: 'opt-i-1', label: 'Minim Analisis', points: 5 },
      ],
    },
    {
      id: 'crit-presentasi',
      title: 'Sistematika Dokumen & Penyajian',
      description: 'Kejelasan struktur laporan, visualisasi, serta tata bahasa penulisan.',
      options: [
        { id: 'opt-p-4', label: 'Sangat Rapi & Jelas', points: 25 },
        { id: 'opt-p-3', label: 'Rapi', points: 18 },
        { id: 'opt-p-2', label: 'Cukup Terbaca', points: 12 },
        { id: 'opt-p-1', label: 'Kurang Terstruktur', points: 5 },
      ],
    },
  ];
}

export function computeRubricMaxPoints(criteria?: PeerRubricCriterion[]): number {
  if (!criteria || criteria.length === 0) return 100;
  return criteria.reduce((total, crit) => {
    const maxOpt = crit.options.reduce((m, o) => Math.max(m, Number(o.points) || 0), 0);
    return total + maxOpt;
  }, 0);
}

export function calculateRubricSelectionTotal(
  criteria: PeerRubricCriterion[],
  selectedOptions: Record<string, string>
): { totalScore: number; criterionPoints: Record<string, number>; isComplete: boolean } {
  let totalScore = 0;
  const criterionPoints: Record<string, number> = {};
  let isComplete = criteria.length > 0;

  criteria.forEach((crit) => {
    const selectedOptId = selectedOptions[crit.id];
    const opt = crit.options.find((o) => o.id === selectedOptId);
    if (opt) {
      const pts = Number(opt.points) || 0;
      criterionPoints[crit.id] = pts;
      totalScore += pts;
    } else {
      isComplete = false;
    }
  });

  return {
    totalScore: Number(totalScore.toFixed(2)),
    criterionPoints,
    isComplete,
  };
}

export function computePeerSubmissionMetrics(
  submission: PeerProjectSubmission,
  maxPoints: number
): {
  studentReviewsCount: number;
  assignedCount: number;
  peerAverageScore: number | null;
  finalScore: number | null;
  hasLecturerOverride: boolean;
} {
  const studentReviews = (submission.peerReviews || []).filter(
    (r) => r.reviewerRole === 'mahasiswa'
  );
  const studentScores = studentReviews.map((r) => Math.max(0, Math.min(maxPoints, r.totalScore)));

  const peerAverageScore =
    studentScores.length > 0
      ? Number((studentScores.reduce((s, v) => s + v, 0) / studentScores.length).toFixed(2))
      : null;

  const hasLecturerScore =
    submission.lecturerScore !== undefined && submission.lecturerScore !== null;

  let finalScore: number | null = peerAverageScore;
  if (hasLecturerScore) {
    const lecScore = Math.max(0, Math.min(maxPoints, Number(submission.lecturerScore)));
    if (submission.lecturerMode === 'include_in_average') {
      const allScores = [...studentScores, lecScore];
      finalScore = Number((allScores.reduce((s, v) => s + v, 0) / allScores.length).toFixed(2));
    } else {
      finalScore = Number(lecScore.toFixed(2));
    }
  }

  return {
    studentReviewsCount: studentReviews.length,
    assignedCount: (submission.assignedReviewerIds || []).length,
    peerAverageScore,
    finalScore,
    hasLecturerOverride: hasLecturerScore,
  };
}

/**
 * Secara otomatis dan adil membagikan penilai sesama mahasiswa untuk setiap tugas projek.
 * - Penilai tidak pernah menilai tugasnya sendiri.
 * - Beban penilai diseimbangkan agar setiap mahasiswa menilai jumlah tugas yang merata.
 * - Penilai yang sudah mengirim review tetap dipertahankan kecuali forceReassign = true (itupun hanya untuk slot yang belum dinilai).
 */
export function allocateBalancedPeerReviewers(params: {
  submissions: PeerProjectSubmission[];
  candidateStudents: User[];
  reviewersPerSubmission: number;
  forceReassign?: boolean;
}): PeerProjectSubmission[] {
  const { submissions, candidateStudents, reviewersPerSubmission, forceReassign = false } = params;
  const targetCount = Math.max(1, Math.floor(reviewersPerSubmission || 1));

  if (submissions.length === 0) return submissions;

  // Build candidate pool: enrolled students in course/class; if empty, fallback to submitters themselves
  const poolMap = new Map<string, User>();
  candidateStudents.forEach((u) => {
    if (u.role === 'mahasiswa') poolMap.set(u.id, u);
  });
  submissions.forEach((sub) => {
    if (!poolMap.has(sub.studentId)) {
      poolMap.set(sub.studentId, {
        id: sub.studentId,
        name: sub.studentName,
        nimOrNip: sub.studentNim,
        role: 'mahasiswa',
        email: '',
        department: '',
        className: sub.studentClassName,
      });
    }
  });
  const pool = Array.from(poolMap.values());

  // Track how many tasks each candidate is assigned to review so load stays balanced
  const loadCount = new Map<string, number>();
  pool.forEach((u) => loadCount.set(u.id, 0));

  // Pre-seed load count with locked/retained reviewers
  const initialAssignedBySub = new Map<string, string[]>();
  submissions.forEach((sub) => {
    const reviewedIds = new Set((sub.peerReviews || []).map((r) => r.reviewerId));
    const retained = forceReassign
      ? (sub.assignedReviewerIds || []).filter((rid) => reviewedIds.has(rid))
      : [...(sub.assignedReviewerIds || [])];
    const validRetained = retained.filter((rid) => rid !== sub.studentId && poolMap.has(rid));
    const uniqueRetained = Array.from(new Set(validRetained));
    initialAssignedBySub.set(sub.id, uniqueRetained);
    uniqueRetained.forEach((rid) => {
      loadCount.set(rid, (loadCount.get(rid) || 0) + 1);
    });
  });

  // Deterministic slight shuffle seed per call when forceReassign, or stable order
  const poolIds = pool.map((u) => u.id);

  return submissions.map((sub, subIdx) => {
    const current = [...(initialAssignedBySub.get(sub.id) || [])];
    const eligible = poolIds.filter(
      (cid) => cid !== sub.studentId && !current.includes(cid)
    );

    // Sort eligible candidates by lowest current load first, rotating tie-break by submission index
    const needed = Math.max(0, targetCount - current.length);
    for (let k = 0; k < needed; k++) {
      const remaining = eligible.filter((cid) => !current.includes(cid));
      if (remaining.length === 0) break;

      remaining.sort((a, b) => {
        const loadDiff = (loadCount.get(a) || 0) - (loadCount.get(b) || 0);
        if (loadDiff !== 0) return loadDiff;
        if (forceReassign) {
          return Math.random() - 0.5;
        }
        // Fair cyclic offset
        const idxA = (poolIds.indexOf(a) - subIdx + poolIds.length) % poolIds.length;
        const idxB = (poolIds.indexOf(b) - subIdx + poolIds.length) % poolIds.length;
        return idxA - idxB;
      });

      const chosen = remaining[0];
      current.push(chosen);
      loadCount.set(chosen, (loadCount.get(chosen) || 0) + 1);
    }

    return {
      ...sub,
      assignedReviewerIds: current,
    };
  });
}

export function getPeerProjectSummaryLabel(project: PeerProjectAssignment): string {
  const modeLabel =
    project.scoringType === 'rubric_options' ? 'Opsi Pilihan Poin' : 'Skor Langsung';
  return `${project.reviewersPerSubmission} Penilai Mahasiswa/Tugas · ${modeLabel}`;
}
