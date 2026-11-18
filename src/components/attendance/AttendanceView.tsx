import React, { useState, useEffect, useRef, useMemo } from 'react';
import QRCode from 'qrcode';
import jsQR from 'jsqr';
import { useExam } from '../../context/ExamContext';
import {
  AttendanceSession,
  AttendanceStatus,
  User,
} from '../../types';
import { isUserEnrolledInCourse } from '../../utils/gradebook';
import {
  QrCode,
  Camera,
  Upload,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Plus,
  Edit2,
  Trash2,
  RefreshCw,
  Maximize2,
  X,
  Users,
  BookOpen,
  Layers,
  ShieldCheck,
  Calendar,
  KeyRound,
  Save,
  Lock,
  Unlock,
  Info,
  Copy,
  Check,
} from 'lucide-react';

interface AttendanceViewProps {
  lockedCourseId?: string;
  lockedClassId?: string;
}

const ALL_STATUS_OPTIONS: Array<{
  value: AttendanceStatus;
  label: string;
  description: string;
}> = [
  { value: 'hadir', label: 'Hadir', description: 'Hadir mengikuti kelas tepat waktu' },
  { value: 'izin', label: 'Izin', description: 'Tidak hadir dengan izin resmi' },
  { value: 'sakit', label: 'Sakit', description: 'Berhalangan hadir karena kondisi kesehatan' },
  { value: 'terlambat', label: 'Terlambat', description: 'Hadir melewati batas awal perkuliahan' },
  { value: 'alfa', label: 'Alfa', description: 'Tanpa keterangan' },
];

const STUDENT_SELECTABLE_STATUSES = ALL_STATUS_OPTIONS.filter((s) => s.value !== 'alfa');

function toLocalDateTimeInput(dateInput?: string | Date): string {
  const d = dateInput ? new Date(dateInput) : new Date();
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

function formatDateTimeID(iso?: string): string {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getStatusBadge(status: AttendanceStatus | 'belum_absen') {
  switch (status) {
    case 'hadir':
      return {
        label: 'Hadir',
        cls: 'bg-emerald-50 text-emerald-800 border-emerald-200',
        Icon: CheckCircle2,
      };
    case 'izin':
      return {
        label: 'Izin',
        cls: 'bg-blue-50 text-blue-800 border-blue-200',
        Icon: Info,
      };
    case 'sakit':
      return {
        label: 'Sakit',
        cls: 'bg-amber-50 text-amber-800 border-amber-200',
        Icon: AlertTriangle,
      };
    case 'terlambat':
      return {
        label: 'Terlambat',
        cls: 'bg-orange-50 text-orange-800 border-orange-200',
        Icon: Clock,
      };
    case 'alfa':
      return {
        label: 'Alfa',
        cls: 'bg-rose-50 text-rose-800 border-rose-200',
        Icon: XCircle,
      };
    default:
      return {
        label: 'Belum Absen',
        cls: 'bg-slate-100 text-slate-600 border-slate-200',
        Icon: Clock,
      };
  }
}

export const AttendanceView: React.FC<AttendanceViewProps> = ({
  lockedCourseId,
  lockedClassId,
}) => {
  const {
    currentUser,
    users,
    classes,
    courses,
    attendanceSessions,
    createAttendanceSession,
    updateAttendanceSession,
    deleteAttendanceSession,
    rotateAttendanceQrToken,
    submitStudentAttendance,
    editAttendanceRecord,
  } = useExam();

  const isStaff = currentUser?.role === 'admin' || currentUser?.role === 'dosen';

  // Live clock for countdown & time window checks
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Toast feedback
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => {
      setToast((prev) => (prev?.message === message ? null : prev));
    }, 5000);
  };

  // Filters
  const [scopeFilter, setScopeFilter] = useState<'all' | 'class' | 'course'>(() =>
    lockedCourseId ? 'course' : lockedClassId ? 'class' : 'all'
  );
  const [selectedClassFilter, setSelectedClassFilter] = useState<string>(lockedClassId || 'all');
  const [selectedCourseFilter, setSelectedCourseFilter] = useState<string>(lockedCourseId || 'all');

  // Visible sessions filtered by role & props
  const visibleSessions = useMemo(() => {
    return attendanceSessions.filter((ses) => {
      if (lockedCourseId && (ses.scope !== 'course' || ses.courseId !== lockedCourseId)) {
        return false;
      }
      if (lockedClassId && (ses.scope !== 'class' || ses.classId !== lockedClassId)) {
        return false;
      }
      if (!lockedCourseId && !lockedClassId) {
        if (scopeFilter !== 'all' && ses.scope !== scopeFilter) return false;
        if (selectedClassFilter !== 'all' && ses.scope === 'class' && ses.classId !== selectedClassFilter) {
          return false;
        }
        if (selectedCourseFilter !== 'all' && ses.scope === 'course' && ses.courseId !== selectedCourseFilter) {
          return false;
        }
      }

      // If student, filter to sessions relevant to student's class or enrolled courses
      if (!isStaff && currentUser) {
        if (ses.scope === 'class') {
          if (ses.classId && currentUser.classId && ses.classId !== currentUser.classId) {
            return false;
          }
        } else if (ses.scope === 'course' && ses.courseId) {
          const course = courses.find((c) => c.id === ses.courseId);
          if (course && !isUserEnrolledInCourse(currentUser, course, users)) {
            return false;
          }
        }
      }

      return true;
    });
  }, [
    attendanceSessions,
    lockedCourseId,
    lockedClassId,
    scopeFilter,
    selectedClassFilter,
    selectedCourseFilter,
    isStaff,
    currentUser,
    courses,
    users,
  ]);

  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const activeSession = useMemo(() => {
    if (selectedSessionId) {
      const found = visibleSessions.find((s) => s.id === selectedSessionId);
      if (found) return found;
    }
    return visibleSessions[0] || null;
  }, [visibleSessions, selectedSessionId]);

  // =========================================================
  // STAFF: QR GENERATOR + AUTO ROTATION
  // =========================================================
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [isProjectorOpen, setIsProjectorOpen] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);
  const rotatingRef = useRef(false);

  // Build QR DataURL whenever activeSession token changes (STAFF ONLY)
  useEffect(() => {
    if (!isStaff || !activeSession) {
      setQrDataUrl('');
      return;
    }
    const payload = JSON.stringify({
      type: 'SMU_ATTENDANCE',
      sessionId: activeSession.id,
      token: activeSession.currentQrToken,
    });
    QRCode.toDataURL(payload, {
      width: 340,
      margin: 2,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
    })
      .then((url) => setQrDataUrl(url))
      .catch(() => setQrDataUrl(''));
  }, [isStaff, activeSession?.id, activeSession?.currentQrToken]);

  // Countdown remaining until next auto QR rotation
  const qrCountdown = useMemo(() => {
    if (!activeSession || !activeSession.isActive) return 0;
    const intervalSec = Math.max(5, activeSession.qrRefreshSeconds || 20);
    const updatedMs = new Date(activeSession.qrUpdatedAt).getTime();
    if (Number.isNaN(updatedMs)) return intervalSec;
    const elapsedSec = Math.floor((nowMs - updatedMs) / 1000);
    return Math.max(0, intervalSec - elapsedSec);
  }, [activeSession, nowMs]);

  // Auto-rotate QR code when countdown hits 0 (STAFF ONLY, while session is active and open)
  useEffect(() => {
    if (!isStaff || !activeSession || !activeSession.isActive) return;
    const endMs = new Date(activeSession.endTime).getTime();
    if (!Number.isNaN(endMs) && nowMs > endMs) return;

    if (qrCountdown <= 0 && !rotatingRef.current) {
      rotatingRef.current = true;
      rotateAttendanceQrToken(activeSession.id)
        .catch((err) => console.warn('Auto rotate QR notice:', err))
        .finally(() => {
          setTimeout(() => {
            rotatingRef.current = false;
          }, 800);
        });
    }
  }, [isStaff, activeSession, qrCountdown, nowMs, rotateAttendanceQrToken]);

  // =========================================================
  // STAFF: CREATE / EDIT / DELETE SESSION MODAL
  // =========================================================
  const [isSessionModalOpen, setIsSessionModalOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<AttendanceSession | null>(null);
  const [sesScope, setSesScope] = useState<'class' | 'course'>(
    lockedCourseId ? 'course' : 'class'
  );
  const [sesClassId, setSesClassId] = useState<string>(lockedClassId || classes[0]?.id || '');
  const [sesCourseId, setSesCourseId] = useState<string>(lockedCourseId || courses[0]?.id || '');
  const [sesTitle, setSesTitle] = useState('');
  const [sesMeetingNumber, setSesMeetingNumber] = useState<number>(1);
  const [sesDescription, setSesDescription] = useState('');
  const [sesStartTime, setSesStartTime] = useState(() => toLocalDateTimeInput(new Date()));
  const [sesEndTime, setSesEndTime] = useState(() =>
    toLocalDateTimeInput(new Date(Date.now() + 90 * 60000))
  );
  const [sesQrRefreshSeconds, setSesQrRefreshSeconds] = useState<number>(20);
  const [sesAllowedStatuses, setSesAllowedStatuses] = useState<AttendanceStatus[]>([
    'hadir',
    'izin',
    'sakit',
    'terlambat',
  ]);
  const [sesRequireNoteForPermit, setSesRequireNoteForPermit] = useState(true);
  const [sesMinNoteLength, setSesMinNoteLength] = useState(10);
  const [sesNoteFormatHint, setSesNoteFormatHint] = useState(
    'Untuk Izin/Sakit wajib isi format: [Alasan Singkat] - [Keterangan Pendukung]'
  );
  const [sesError, setSesError] = useState('');
  const [sesSaving, setSesSaving] = useState(false);
  const [deleteSessionTarget, setDeleteSessionTarget] = useState<AttendanceSession | null>(null);

  const openCreateSessionModal = () => {
    setEditingSession(null);
    const defaultScope = lockedCourseId ? 'course' : lockedClassId ? 'class' : courses.length > 0 ? 'course' : 'class';
    setSesScope(defaultScope);
    setSesClassId(lockedClassId || classes[0]?.id || '');
    setSesCourseId(lockedCourseId || courses[0]?.id || '');
    setSesTitle('');
    setSesMeetingNumber(visibleSessions.length + 1);
    setSesDescription('');
    setSesStartTime(toLocalDateTimeInput(new Date()));
    setSesEndTime(toLocalDateTimeInput(new Date(Date.now() + 90 * 60000)));
    setSesQrRefreshSeconds(20);
    setSesAllowedStatuses(['hadir', 'izin', 'sakit', 'terlambat']);
    setSesRequireNoteForPermit(true);
    setSesMinNoteLength(10);
    setSesNoteFormatHint('Untuk Izin/Sakit wajib isi format: [Alasan Singkat] - [Keterangan Pendukung]');
    setSesError('');
    setIsSessionModalOpen(true);
  };

  const openEditSessionModal = (ses: AttendanceSession) => {
    setEditingSession(ses);
    setSesScope(ses.scope);
    setSesClassId(ses.classId || classes[0]?.id || '');
    setSesCourseId(ses.courseId || courses[0]?.id || '');
    setSesTitle(ses.title);
    setSesMeetingNumber(ses.meetingNumber || 1);
    setSesDescription(ses.description || '');
    setSesStartTime(toLocalDateTimeInput(ses.startTime));
    setSesEndTime(toLocalDateTimeInput(ses.endTime));
    setSesQrRefreshSeconds(ses.qrRefreshSeconds || 20);
    setSesAllowedStatuses(ses.allowedStatuses);
    setSesRequireNoteForPermit(ses.requireNoteForPermit);
    setSesMinNoteLength(ses.minNoteLength || 10);
    setSesNoteFormatHint(ses.noteFormatHint || '');
    setSesError('');
    setIsSessionModalOpen(true);
  };

  const handleToggleAllowedStatus = (st: AttendanceStatus) => {
    setSesAllowedStatuses((prev) => {
      if (prev.includes(st)) {
        if (prev.length === 1) return prev; // minimal 1 opsi
        return prev.filter((x) => x !== st);
      }
      return [...prev, st];
    });
  };

  const handleSaveSessionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSesError('');

    if (!sesTitle.trim()) {
      setSesError('Judul sesi absensi wajib diisi.');
      return;
    }
    if (sesScope === 'class' && !sesClassId) {
      setSesError('Pilih kelas (rombel) tujuan absensi terlebih dahulu.');
      return;
    }
    if (sesScope === 'course' && !sesCourseId) {
      setSesError('Pilih mata kuliah tujuan absensi terlebih dahulu.');
      return;
    }

    const startD = new Date(sesStartTime);
    const endD = new Date(sesEndTime);
    if (Number.isNaN(startD.getTime()) || Number.isNaN(endD.getTime())) {
      setSesError('Waktu mulai dan batas akhir absensi wajib diisi dengan benar.');
      return;
    }
    if (endD.getTime() <= startD.getTime()) {
      setSesError('Batas akhir waktu absensi harus lebih lambat daripada waktu mulai.');
      return;
    }

    setSesSaving(true);
    try {
      if (editingSession) {
        await updateAttendanceSession({
          ...editingSession,
          scope: sesScope,
          classId: sesScope === 'class' ? sesClassId : undefined,
          courseId: sesScope === 'course' ? sesCourseId : undefined,
          title: sesTitle.trim(),
          meetingNumber: Number(sesMeetingNumber) || 1,
          description: sesDescription.trim(),
          startTime: startD.toISOString(),
          endTime: endD.toISOString(),
          qrRefreshSeconds: Number(sesQrRefreshSeconds) || 20,
          allowedStatuses: sesAllowedStatuses,
          requireNoteForPermit: sesRequireNoteForPermit,
          minNoteLength: Number(sesMinNoteLength) || 0,
          noteFormatHint: sesNoteFormatHint.trim(),
        });
        showToast('success', `Sesi absensi "${sesTitle.trim()}" berhasil diperbarui.`);
      } else {
        const created = await createAttendanceSession({
          scope: sesScope,
          classId: sesScope === 'class' ? sesClassId : undefined,
          courseId: sesScope === 'course' ? sesCourseId : undefined,
          title: sesTitle.trim(),
          meetingNumber: Number(sesMeetingNumber) || 1,
          description: sesDescription.trim(),
          lecturerId: currentUser?.id || 'admin',
          lecturerName: currentUser?.name || 'Dosen Pengampu',
          startTime: startD.toISOString(),
          endTime: endD.toISOString(),
          qrRefreshSeconds: Number(sesQrRefreshSeconds) || 20,
          allowedStatuses: sesAllowedStatuses,
          requireNoteForPermit: sesRequireNoteForPermit,
          minNoteLength: Number(sesMinNoteLength) || 0,
          noteFormatHint: sesNoteFormatHint.trim(),
          isActive: true,
        });
        setSelectedSessionId(created.id);
        showToast('success', `Sesi absensi QR dinamis "${created.title}" berhasil diterbitkan.`);
      }
      setIsSessionModalOpen(false);
    } catch (err: any) {
      setSesError(err?.message || 'Gagal menyimpan sesi absensi.');
    } finally {
      setSesSaving(false);
    }
  };

  // =========================================================
  // STAFF: MANUAL EDIT STUDENT RECORD IN ACTIVE SESSION
  // =========================================================
  const targetStudentsForActiveSession = useMemo(() => {
    if (!activeSession) return [];
    const allStudents = users.filter((u) => u.role === 'mahasiswa');
    if (activeSession.scope === 'class' && activeSession.classId) {
      return allStudents.filter((u) => u.classId === activeSession.classId);
    }
    if (activeSession.scope === 'course' && activeSession.courseId) {
      const course = courses.find((c) => c.id === activeSession.courseId);
      if (course) {
        const enrolledIds = course.enrolledUserIds || [];
        const assignedClasses = course.assignedClassIds || [];
        const hasEnrolledStudents = enrolledIds.some((uid) =>
          allStudents.some((s) => s.id === uid)
        );
        if (assignedClasses.length > 0 || hasEnrolledStudents) {
          return allStudents.filter(
            (u) =>
              enrolledIds.includes(u.id) ||
              (u.classId && assignedClasses.includes(u.classId))
          );
        }
      }
    }
    return allStudents;
  }, [activeSession, users, courses]);

  const [recordEdits, setRecordEdits] = useState<
    Record<string, { status: AttendanceStatus; note: string; saving?: boolean }>
  >({});

  const getStudentDraftRow = (student: User) => {
    if (!activeSession) return { status: 'alfa' as AttendanceStatus, note: '' };
    const localEdit = recordEdits[`${activeSession.id}_${student.id}`];
    if (localEdit) return localEdit;
    const rec = activeSession.records.find((r) => r.studentId === student.id);
    if (rec) return { status: rec.status, note: rec.note || '' };
    return { status: 'alfa' as AttendanceStatus, note: '' };
  };

  const handleSaveStudentRecordEdit = async (student: User) => {
    if (!activeSession) return;
    const key = `${activeSession.id}_${student.id}`;
    const draft = getStudentDraftRow(student);
    setRecordEdits((prev) => ({
      ...prev,
      [key]: { ...draft, saving: true },
    }));
    try {
      await editAttendanceRecord(activeSession.id, student, draft.status, draft.note);
      showToast(
        'success',
        `Absensi ${student.name} berhasil diperbarui menjadi ${draft.status.toUpperCase()}.`
      );
    } catch (err: any) {
      showToast('error', err?.message || 'Gagal mengedit absensi mahasiswa.');
    } finally {
      setRecordEdits((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  };

  // =========================================================
  // STUDENT: QR SCANNER (CAMERA + IMAGE UPLOAD + MANUAL FALLBACK) & SUBMIT
  // =========================================================
  const [scanModalOpen, setScanModalOpen] = useState(false);
  const [scanStep, setScanStep] = useState<'scan' | 'select_option'>('scan');
  const [scanMode, setScanMode] = useState<'camera' | 'image' | 'manual'>('camera');
  const [cameraError, setCameraError] = useState('');
  const [scanError, setScanError] = useState('');
  const [manualInputCode, setManualInputCode] = useState('');
  const [verifiedPayload, setVerifiedPayload] = useState<{
    sessionId: string;
    token: string;
  } | null>(null);
  const [chosenStatus, setChosenStatus] = useState<AttendanceStatus | ''>('');
  const [studentNote, setStudentNote] = useState('');
  const [submittingAttendance, setSubmittingAttendance] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);

  const stopCamera = () => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  };

  const handleDecodedQrText = (rawText: string, expectedSessionId?: string) => {
    setScanError('');
    const trimmed = rawText.trim();
    if (!trimmed) {
      setScanError('Kode QR kosong atau tidak terbaca.');
      return;
    }

    let parsedSessionId = expectedSessionId || activeSession?.id || '';
    let parsedToken = trimmed;

    if (trimmed.startsWith('{')) {
      try {
        const obj = JSON.parse(trimmed);
        if (obj.sessionId && obj.token) {
          parsedSessionId = obj.sessionId;
          parsedToken = obj.token;
        }
      } catch {
        // treat as plain token
      }
    }

    const matchedSession = attendanceSessions.find((s) => s.id === parsedSessionId);
    if (!matchedSession) {
      setScanError('Sesi absensi dari QR Code tidak ditemukan atau tidak sesuai.');
      return;
    }

    stopCamera();
    setSelectedSessionId(matchedSession.id);
    setVerifiedPayload({ sessionId: matchedSession.id, token: parsedToken });
    setChosenStatus('');
    setStudentNote('');
    setScanStep('select_option');
  };

  useEffect(() => {
    if (!scanModalOpen || scanStep !== 'scan' || scanMode !== 'camera') {
      stopCamera();
      return;
    }

    let cancelled = false;
    setCameraError('');

    const startCamera = async () => {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError(
          'Browser atau perangkat tidak mendukung akses kamera langsung. Gunakan tab Upload Gambar QR atau Input Kode.'
        );
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.setAttribute('playsinline', 'true');
          await videoRef.current.play();
        }

        const tick = () => {
          if (cancelled) return;
          const video = videoRef.current;
          const canvas = canvasRef.current;
          if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
              const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
              const decoded = jsQR(imageData.data, imageData.width, imageData.height, {
                inversionAttempts: 'dontInvert',
              });
              if (decoded && decoded.data) {
                handleDecodedQrText(decoded.data);
                return;
              }
            }
          }
          rafRef.current = requestAnimationFrame(tick);
        };

        rafRef.current = requestAnimationFrame(tick);
      } catch (err: any) {
        setCameraError(
          err?.name === 'NotAllowedError'
            ? 'Izin kamera ditolak. Berikan izin kamera atau gunakan tab Upload Foto QR.'
            : 'Kamera tidak tersedia pada perangkat ini. Gunakan tab Upload Foto QR atau Input Kode.'
        );
      }
    };

    startCamera();
    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [scanModalOpen, scanStep, scanMode]);

  const handleUploadQrImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    setScanError('');
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          setScanError('Gagal memproses gambar QR.');
          return;
        }
        ctx.drawImage(img, 0, 0);
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const decoded = jsQR(imgData.data, imgData.width, imgData.height);
        if (!decoded || !decoded.data) {
          setScanError(
            'QR Code tidak terdeteksi di gambar tersebut. Pastikan gambar QR dari dosen terlihat jelas.'
          );
          return;
        }
        handleDecodedQrText(decoded.data);
      };
      img.onerror = () => setScanError('File gambar tidak valid.');
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };

  const openStudentScanModal = (session?: AttendanceSession) => {
    if (session) setSelectedSessionId(session.id);
    setScanStep('scan');
    setScanMode('camera');
    setScanError('');
    setCameraError('');
    setManualInputCode('');
    setVerifiedPayload(null);
    setChosenStatus('');
    setStudentNote('');
    setScanModalOpen(true);
  };

  const verifiedSession = verifiedPayload
    ? attendanceSessions.find((s) => s.id === verifiedPayload.sessionId) || null
    : null;

  const handleStudentSubmitAttendance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifiedPayload || !verifiedSession) return;
    setScanError('');

    if (!chosenStatus) {
      setScanError('Anda wajib memilih salah satu opsi absensi yang tersedia.');
      return;
    }

    setSubmittingAttendance(true);
    try {
      await submitStudentAttendance({
        sessionId: verifiedPayload.sessionId,
        scannedToken: verifiedPayload.token,
        status: chosenStatus,
        note: studentNote,
      });
      setScanModalOpen(false);
      stopCamera();
      showToast(
        'success',
        `Absensi (${chosenStatus.toUpperCase()}) untuk "${verifiedSession.title}" berhasil tercatat.`
      );
    } catch (err: any) {
      setScanError(err?.message || 'Gagal mencatat absensi.');
    } finally {
      setSubmittingAttendance(false);
    }
  };

  const getSessionTargetLabel = (ses: AttendanceSession) => {
    if (ses.scope === 'class') {
      const cls = classes.find((c) => c.id === ses.classId);
      return cls ? `Kelas ${cls.name} (${cls.code})` : 'Kelas / Rombel';
    }
    const course = courses.find((c) => c.id === ses.courseId);
    return course ? `${course.code} · ${course.name}` : 'Mata Kuliah';
  };

  const getSessionTimeState = (ses: AttendanceSession) => {
    const startMs = new Date(ses.startTime).getTime();
    const endMs = new Date(ses.endTime).getTime();
    if (!ses.isActive) {
      return { state: 'closed' as const, label: 'Ditutup Dosen', cls: 'bg-slate-100 text-slate-700 border-slate-200' };
    }
    if (nowMs < startMs) {
      return { state: 'upcoming' as const, label: 'Belum Dibuka', cls: 'bg-amber-50 text-amber-800 border-amber-200' };
    }
    if (nowMs > endMs) {
      return { state: 'ended' as const, label: 'Waktu Habis', cls: 'bg-rose-50 text-rose-800 border-rose-200' };
    }
    return { state: 'open' as const, label: 'Absensi Dibuka', cls: 'bg-emerald-50 text-emerald-800 border-emerald-200' };
  };

  return (
    <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-10 py-6 space-y-6">
      {/* Toast Notification */}
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
          <button type="button" onClick={() => setToast(null)} className="opacity-60 hover:opacity-100">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-semibold text-blue-700">
            <QrCode className="w-4 h-4" />
            <span>Presensi QR Code Dinamis · Terintegrasi Nilai Akhir</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
            {lockedCourseId
              ? 'Absensi Kuliah Berbasis QR Dinamis'
              : 'Absensi Kelas & Mata Kuliah'}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 max-w-2xl">
            {isStaff
              ? 'QR Code hanya dimiliki dosen dan diperbarui otomatis secara berkala. Anda dapat mengatur ketentuan waktu, format pengisian, serta mengedit status kehadiran setiap mahasiswa.'
              : 'Lakukan absensi sesuai ketentuan waktu dan format dari dosen dengan memindai QR Code dosen, lalu pilih opsi kehadiran Anda.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {!isStaff && (
            <button
              type="button"
              id="btn-student-open-scanner"
              onClick={() => openStudentScanModal(activeSession || undefined)}
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-colors"
            >
              <Camera className="w-4 h-4" />
              <span>Scan Barcode / QR Absensi</span>
            </button>
          )}

          {isStaff && (
            <button
              type="button"
              id="btn-create-attendance-session"
              onClick={openCreateSessionModal}
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Buat Sesi Absensi QR</span>
            </button>
          )}
        </div>
      </div>

      {/* Filters (when standalone) */}
      {!lockedCourseId && !lockedClassId && (
        <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl">
            {(
              [
                { id: 'all', label: 'Semua Sesi' },
                { id: 'class', label: 'Absensi Kelas' },
                { id: 'course', label: 'Absensi Mata Kuliah' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setScopeFilter(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                  scopeFilter === tab.id
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            {(scopeFilter === 'all' || scopeFilter === 'class') && (
              <select
                value={selectedClassFilter}
                onChange={(e) => setSelectedClassFilter(e.target.value)}
                className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-700 font-semibold"
              >
                <option value="all">Semua Kelas / Rombel</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.code})
                  </option>
                ))}
              </select>
            )}

            {(scopeFilter === 'all' || scopeFilter === 'course') && (
              <select
                value={selectedCourseFilter}
                onChange={(e) => setSelectedCourseFilter(e.target.value)}
                className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-700 font-semibold"
              >
                <option value="all">Semua Mata Kuliah</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} · {c.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
      )}

      {/* Main Content Layout */}
      {visibleSessions.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center space-y-3">
          <QrCode className="w-12 h-12 text-slate-300 mx-auto" />
          <div className="font-bold text-slate-800 text-sm">
            Belum Ada Sesi Absensi Dibuka
          </div>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            {isStaff
              ? 'Klik tombol "Buat Sesi Absensi QR" untuk membuka presensi kelas atau mata kuliah dengan QR Code yang diperbarui otomatis.'
              : 'Belum ada jadwal absensi aktif untuk kelas maupun mata kuliah Anda saat ini.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          {/* Left Column: Session List */}
          <div className="xl:col-span-4 space-y-3">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider px-1">
              Daftar Sesi Absensi ({visibleSessions.length})
            </div>
            <div className="space-y-2.5">
              {visibleSessions.map((ses) => {
                const isSelected = activeSession?.id === ses.id;
                const timeInfo = getSessionTimeState(ses);
                const myRecord = !isStaff && currentUser
                  ? ses.records.find((r) => r.studentId === currentUser.id)
                  : undefined;

                return (
                  <div
                    key={ses.id}
                    onClick={() => setSelectedSessionId(ses.id)}
                    className={`p-4 rounded-2xl border cursor-pointer transition-all space-y-2.5 ${
                      isSelected
                        ? 'bg-blue-50/70 border-blue-400 ring-1 ring-blue-300'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
                          {ses.scope === 'class' ? (
                            <Layers className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                          ) : (
                            <BookOpen className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                          )}
                          <span className="truncate">{getSessionTargetLabel(ses)}</span>
                          {ses.meetingNumber && (
                            <>
                              <span>·</span>
                              <span className="font-mono">Pertemuan {ses.meetingNumber}</span>
                            </>
                          )}
                        </div>
                        <h3 className="font-bold text-slate-900 text-sm truncate">
                          {ses.title}
                        </h3>
                      </div>

                      <span
                        className={`px-2 py-0.5 rounded-md border text-[10px] font-bold shrink-0 ${timeInfo.cls}`}
                      >
                        {timeInfo.label}
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-500 font-mono tabular-nums space-y-0.5">
                      <div>Mulai: {formatDateTimeID(ses.startTime)}</div>
                      <div>Batas: {formatDateTimeID(ses.endTime)}</div>
                    </div>

                    <div className="pt-2 border-t border-slate-200/70 flex items-center justify-between text-[11px]">
                      {isStaff ? (
                        <span className="text-slate-600 font-semibold font-mono tabular-nums">
                          {ses.records.length} tercatat · QR {ses.qrRefreshSeconds}d
                        </span>
                      ) : myRecord ? (
                        <span className="inline-flex items-center gap-1 font-bold text-emerald-700">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Status Anda: {myRecord.status.toUpperCase()}
                        </span>
                      ) : (
                        <span className="text-slate-500 font-medium">
                          Belum mengisi absensi
                        </span>
                      )}

                      {!isStaff && timeInfo.state === 'open' && !myRecord && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openStudentScanModal(ses);
                          }}
                          className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-[11px]"
                        >
                          Scan QR
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column: Active Session Detail */}
          {activeSession && (
            <div className="xl:col-span-8 space-y-6">
              {/* Session Summary Card */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 font-semibold">
                      <span>{getSessionTargetLabel(activeSession)}</span>
                      <span>·</span>
                      <span className="font-mono">Pertemuan {activeSession.meetingNumber || 1}</span>
                      <span>·</span>
                      <span>Pengampu: {activeSession.lecturerName}</span>
                    </div>
                    <h2 className="text-lg sm:text-xl font-extrabold text-slate-900">
                      {activeSession.title}
                    </h2>
                    {activeSession.description && (
                      <p className="text-xs text-slate-600">{activeSession.description}</p>
                    )}
                  </div>

                  {isStaff && (
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() =>
                          updateAttendanceSession({
                            ...activeSession,
                            isActive: !activeSession.isActive,
                          })
                        }
                        className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-colors ${
                          activeSession.isActive
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100'
                            : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        {activeSession.isActive ? (
                          <>
                            <Unlock className="w-3.5 h-3.5" />
                            <span>Sesi Aktif</span>
                          </>
                        ) : (
                          <>
                            <Lock className="w-3.5 h-3.5" />
                            <span>Buka Sesi</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => openEditSessionModal(activeSession)}
                        className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center gap-1.5"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        <span>Edit Sesi</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setDeleteSessionTarget(activeSession)}
                        className="px-3 py-1.5 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold flex items-center gap-1.5"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Hapus</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Ketentuan Waktu & Format Rules Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5 text-xs">
                    <div className="font-bold text-slate-800 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-blue-600" />
                      <span>Ketentuan Waktu Absensi</span>
                    </div>
                    <div className="text-slate-600 font-mono tabular-nums space-y-0.5 text-[11px]">
                      <div>Dibuka: {formatDateTimeID(activeSession.startTime)}</div>
                      <div>Ditutup: {formatDateTimeID(activeSession.endTime)}</div>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5 text-xs">
                    <div className="font-bold text-slate-800 flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Format &amp; Opsi Diizinkan Dosen</span>
                    </div>
                    <div className="text-[11px] text-slate-600 space-y-1">
                      <div>
                        Opsi tersedia:{' '}
                        <span className="font-bold text-slate-900">
                          {activeSession.allowedStatuses.map((s) => s.toUpperCase()).join(', ')}
                        </span>
                      </div>
                      {activeSession.noteFormatHint && (
                        <div className="text-slate-500">{activeSession.noteFormatHint}</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* STAFF ONLY: LECTURER DYNAMIC AUTO-ROTATING QR PRESENTER */}
              {isStaff && (
                <div className="bg-slate-900 text-white rounded-2xl p-6 space-y-5 border border-slate-800">
                  <div className="flex flex-col md:flex-row items-center gap-6">
                    {/* QR Image Box */}
                    <div className="bg-white p-3.5 rounded-2xl shrink-0 shadow-lg">
                      {qrDataUrl ? (
                        <img
                          src={qrDataUrl}
                          alt="QR Absensi Dosen"
                          className="w-48 h-48 sm:w-52 sm:h-52 object-contain"
                        />
                      ) : (
                        <div className="w-48 h-48 flex items-center justify-center text-slate-400 text-xs">
                          Memuat QR...
                        </div>
                      )}
                    </div>

                    {/* QR Metadata & Controls */}
                    <div className="flex-1 space-y-4 w-full">
                      <div className="space-y-1">
                        <div className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-400">
                          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                          <span>QR CODE EKSKLUSIF DOSEN · DIPERBARUI OTOMATIS</span>
                        </div>
                        <h3 className="text-lg font-extrabold">
                          Tampilkan QR Ini untuk Di-scan Mahasiswa
                        </h3>
                        <p className="text-xs text-slate-300 leading-relaxed">
                          QR Code ini hanya tampil di layar dosen/admin dan otomatis berganti setiap{' '}
                          <strong className="text-white">{activeSession.qrRefreshSeconds} detik</strong>{' '}
                          untuk mencegah kecurangan titip absen.
                        </p>
                      </div>

                      {/* Countdown Progress */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-300">Pembaruan QR otomatis berikutnya:</span>
                          <span className="font-mono tabular-nums font-bold text-amber-300">
                            {activeSession.isActive ? `${qrCountdown} detik` : 'Sesi Dijeda'}
                          </span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                          <div
                            className="h-2 bg-emerald-400 transition-all duration-500"
                            style={{
                              width: activeSession.isActive
                                ? `${Math.min(
                                    100,
                                    Math.max(
                                      0,
                                      (qrCountdown /
                                        Math.max(5, activeSession.qrRefreshSeconds || 20)) *
                                        100
                                    )
                                  )}%`
                                : '0%',
                            }}
                          />
                        </div>
                      </div>

                      {/* Token & Actions */}
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <div className="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 font-mono text-xs text-slate-200">
                          Token Aktif: <strong>{activeSession.currentQrToken}</strong>
                        </div>

                        <button
                          type="button"
                          onClick={() => rotateAttendanceQrToken(activeSession.id)}
                          className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 transition-colors"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>Perbarui QR Sekarang</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setIsProjectorOpen(true)}
                          className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold flex items-center gap-1.5 transition-colors"
                        >
                          <Maximize2 className="w-3.5 h-3.5" />
                          <span>Layar Proyektor</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            const payload = JSON.stringify({
                              type: 'SMU_ATTENDANCE',
                              sessionId: activeSession.id,
                              token: activeSession.currentQrToken,
                            });
                            navigator.clipboard?.writeText(payload).catch(() => {});
                            setCopiedToken(true);
                            setTimeout(() => setCopiedToken(false), 2000);
                          }}
                          className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-1.5"
                          title="Salin payload QR aktif"
                        >
                          {copiedToken ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                          <span>{copiedToken ? 'Tersalin' : 'Salin Payload QR'}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* STUDENT VIEW: OWN STATUS & SCAN TRIGGER (NEVER SHOW QR CODE) */}
              {!isStaff && currentUser && (
                <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
                  {(() => {
                    const myRec = activeSession.records.find(
                      (r) => r.studentId === currentUser.id
                    );
                    const timeState = getSessionTimeState(activeSession);
                    const badge = getStatusBadge(myRec ? myRec.status : 'belum_absen');
                    const StatusIcon = badge.Icon;

                    return (
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="space-y-2">
                          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                            Status Kehadiran Anda
                          </div>
                          <div className="flex items-center gap-2.5">
                            <span
                              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border text-xs font-bold ${badge.cls}`}
                            >
                              <StatusIcon className="w-4 h-4" />
                              <span>{badge.label}</span>
                            </span>
                            {myRec && (
                              <span className="text-xs text-slate-500 font-mono">
                                Tercatat: {formatDateTimeID(myRec.submittedAt)}
                              </span>
                            )}
                          </div>
                          {myRec?.note && (
                            <div className="text-xs text-slate-600 bg-slate-50 px-3 py-2 rounded-lg border border-slate-200">
                              Keterangan: <strong>{myRec.note}</strong>
                            </div>
                          )}
                          {myRec?.editedByLecturer && (
                            <div className="text-[11px] text-indigo-700 font-medium">
                              Diperbarui oleh {myRec.editedByName || 'Dosen'} pada{' '}
                              {formatDateTimeID(myRec.editedAt)}
                            </div>
                          )}
                        </div>

                        <div className="shrink-0">
                          {timeState.state === 'open' ? (
                            <button
                              type="button"
                              onClick={() => openStudentScanModal(activeSession)}
                              className="px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-colors"
                            >
                              <Camera className="w-4 h-4" />
                              <span>
                                {myRec
                                  ? 'Scan Ulang QR & Ubah Absen'
                                  : 'Scan QR Dosen & Pilih Opsi Absen'}
                              </span>
                            </button>
                          ) : (
                            <div className="px-4 py-2.5 rounded-xl bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-600 flex items-center gap-2">
                              <Lock className="w-4 h-4 text-slate-400" />
                              <span>{timeState.label}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* STAFF ONLY: ATTENDANCE REKAP & INLINE EDITOR TABLE */}
              {isStaff && (
                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                  <div className="px-5 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50">
                    <div>
                      <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                        <Users className="w-4 h-4 text-blue-600" />
                        <span>Daftar Kehadiran Mahasiswa &amp; Editor Dosen</span>
                      </h3>
                      <p className="text-[11px] text-slate-500">
                        Dosen dapat mengubah status kehadiran dan keterangan mahasiswa kapan saja secara langsung.
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono tabular-nums">
                      {(['hadir', 'izin', 'sakit', 'terlambat'] as AttendanceStatus[]).map(
                        (st) => {
                          const count = activeSession.records.filter(
                            (r) => r.status === st
                          ).length;
                          return (
                            <span
                              key={st}
                              className="px-2 py-1 rounded-md bg-white border border-slate-200 text-slate-700 font-semibold"
                            >
                              {st.toUpperCase()}: {count}
                            </span>
                          );
                        }
                      )}
                    </div>
                  </div>

                  {targetStudentsForActiveSession.length === 0 ? (
                    <div className="p-8 text-center text-xs text-slate-500">
                      Belum ada mahasiswa terdaftar pada target kelas/mata kuliah sesi ini.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                            <th className="py-3 px-4">Mahasiswa</th>
                            <th className="py-3 px-3">Kelas</th>
                            <th className="py-3 px-3">Status Saat Ini</th>
                            <th className="py-3 px-3">Ubah Status (Dosen)</th>
                            <th className="py-3 px-3">Keterangan / Catatan</th>
                            <th className="py-3 px-4 text-right">Aksi</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {targetStudentsForActiveSession.map((student) => {
                            const existingRec = activeSession.records.find(
                              (r) => r.studentId === student.id
                            );
                            const badge = getStatusBadge(
                              existingRec ? existingRec.status : 'belum_absen'
                            );
                            const BadgeIcon = badge.Icon;
                            const key = `${activeSession.id}_${student.id}`;
                            const draft = getStudentDraftRow(student);
                            const isDirty = Boolean(recordEdits[key]);

                            return (
                              <tr key={student.id} className="hover:bg-slate-50/80">
                                <td className="py-3 px-4">
                                  <div className="font-bold text-slate-900">
                                    {student.name}
                                  </div>
                                  <div className="text-[11px] font-mono text-slate-500">
                                    NIM: {student.nimOrNip}
                                  </div>
                                </td>
                                <td className="py-3 px-3 text-slate-600 font-medium">
                                  {student.className || 'Reguler'}
                                </td>
                                <td className="py-3 px-3">
                                  <span
                                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-bold ${badge.cls}`}
                                  >
                                    <BadgeIcon className="w-3 h-3" />
                                    <span>{badge.label}</span>
                                  </span>
                                  {existingRec?.editedByLecturer && (
                                    <div className="text-[10px] text-indigo-600 mt-0.5">
                                      Diedit dosen
                                    </div>
                                  )}
                                </td>
                                <td className="py-3 px-3">
                                  <select
                                    value={draft.status}
                                    onChange={(e) =>
                                      setRecordEdits((prev) => ({
                                        ...prev,
                                        [key]: {
                                          status: e.target.value as AttendanceStatus,
                                          note: draft.note,
                                        },
                                      }))
                                    }
                                    className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-800 font-semibold text-xs"
                                  >
                                    {ALL_STATUS_OPTIONS.map((opt) => (
                                      <option key={opt.value} value={opt.value}>
                                        {opt.label}
                                      </option>
                                    ))}
                                  </select>
                                </td>
                                <td className="py-3 px-3 min-w-[200px]">
                                  <input
                                    type="text"
                                    placeholder="Catatan kehadiran..."
                                    value={draft.note}
                                    onChange={(e) =>
                                      setRecordEdits((prev) => ({
                                        ...prev,
                                        [key]: {
                                          status: draft.status,
                                          note: e.target.value,
                                        },
                                      }))
                                    }
                                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs"
                                  />
                                </td>
                                <td className="py-3 px-4 text-right">
                                  <button
                                    type="button"
                                    disabled={recordEdits[key]?.saving}
                                    onClick={() => handleSaveStudentRecordEdit(student)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1 transition-colors ${
                                      isDirty
                                        ? 'bg-blue-600 hover:bg-blue-700 text-white'
                                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                                    }`}
                                  >
                                    <Save className="w-3.5 h-3.5" />
                                    <span>Simpan</span>
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
        </div>
      )}

      {/* STAFF PROJECTOR FULLSCREEN QR MODAL */}
      {isStaff && isProjectorOpen && activeSession && (
        <div className="fixed inset-0 z-50 bg-slate-950/95 flex flex-col items-center justify-center p-6 text-white">
          <button
            type="button"
            onClick={() => setIsProjectorOpen(false)}
            className="absolute top-6 right-6 p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="max-w-lg w-full text-center space-y-6">
            <div className="space-y-1">
              <div className="text-xs font-bold text-emerald-400 tracking-wider uppercase">
                QR Absensi Resmi · Auto-Refresh {activeSession.qrRefreshSeconds} Detik
              </div>
              <h2 className="text-2xl font-extrabold">{activeSession.title}</h2>
              <p className="text-sm text-slate-300">{getSessionTargetLabel(activeSession)}</p>
            </div>

            <div className="bg-white p-6 rounded-3xl inline-block shadow-2xl">
              {qrDataUrl && (
                <img
                  src={qrDataUrl}
                  alt="QR Proyektor"
                  className="w-72 h-72 sm:w-80 sm:h-80 object-contain"
                />
              )}
            </div>

            <div className="space-y-2">
              <div className="text-lg font-mono tabular-nums font-bold text-amber-300">
                QR diperbarui otomatis dalam {qrCountdown} detik
              </div>
              <div className="text-xs font-mono text-slate-400">
                Token Aktif: {activeSession.currentQrToken}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STAFF CREATE / EDIT SESSION MODAL */}
      {isSessionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-2xl overflow-hidden my-auto">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <QrCode className="w-4 h-4 text-blue-600" />
                <span>
                  {editingSession ? 'Edit Pengaturan Sesi Absensi' : 'Buat Sesi Absensi QR Dinamis'}
                </span>
              </h3>
              <button
                type="button"
                onClick={() => setIsSessionModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveSessionSubmit} className="p-6 space-y-4 text-xs max-h-[80vh] overflow-y-auto">
              {sesError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{sesError}</span>
                </div>
              )}

              {/* Scope Picker */}
              {!lockedCourseId && !lockedClassId && (
                <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setSesScope('course')}
                    className={`py-2 px-3 rounded-lg font-bold transition-colors ${
                      sesScope === 'course' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600'
                    }`}
                  >
                    Absensi Mata Kuliah
                  </button>
                  <button
                    type="button"
                    onClick={() => setSesScope('class')}
                    className={`py-2 px-3 rounded-lg font-bold transition-colors ${
                      sesScope === 'class' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600'
                    }`}
                  >
                    Absensi Kelas (Rombel)
                  </button>
                </div>
              )}

              {sesScope === 'class' && !lockedClassId && (
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Pilih Kelas / Rombel *
                  </label>
                  <select
                    value={sesClassId}
                    onChange={(e) => setSesClassId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300"
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

              {sesScope === 'course' && !lockedCourseId && (
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Pilih Mata Kuliah *
                  </label>
                  <select
                    value={sesCourseId}
                    onChange={(e) => setSesCourseId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300"
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

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">
                    Judul / Topik Pertemuan *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Pertemuan 5 - Normalisasi Basis Data"
                    value={sesTitle}
                    onChange={(e) => setSesTitle(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Pertemuan Ke-
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="32"
                    value={sesMeetingNumber}
                    onChange={(e) => setSesMeetingNumber(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono"
                  />
                </div>
              </div>

              {/* Time Window & QR Refresh Interval */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Waktu Mulai Absensi *
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={sesStartTime}
                    onChange={(e) => setSesStartTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Batas Waktu Berakhir *
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={sesEndTime}
                    onChange={(e) => setSesEndTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Auto-Refresh QR Code
                  </label>
                  <select
                    value={sesQrRefreshSeconds}
                    onChange={(e) => setSesQrRefreshSeconds(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono font-bold"
                  >
                    <option value={10}>Setiap 10 detik</option>
                    <option value={15}>Setiap 15 detik</option>
                    <option value={20}>Setiap 20 detik</option>
                    <option value={30}>Setiap 30 detik</option>
                    <option value={60}>Setiap 60 detik</option>
                  </select>
                </div>
              </div>

              {/* Allowed Options */}
              <div className="space-y-2">
                <label className="block font-bold text-slate-700">
                  Opsi Status Absen yang Dapat Dipilih Mahasiswa Setelah Scan QR
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {STUDENT_SELECTABLE_STATUSES.map((opt) => {
                    const checked = sesAllowedStatuses.includes(opt.value);
                    return (
                      <label
                        key={opt.value}
                        className={`p-2.5 rounded-xl border cursor-pointer flex items-center gap-2 transition-colors ${
                          checked
                            ? 'bg-blue-50 border-blue-300 text-blue-900 font-bold'
                            : 'bg-white border-slate-200 text-slate-600'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => handleToggleAllowedStatus(opt.value)}
                          className="rounded border-slate-300 text-blue-600"
                        />
                        <span>{opt.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Format Rules */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="font-bold text-slate-800">
                  Ketentuan Format Pengisian Mahasiswa
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={sesRequireNoteForPermit}
                    onChange={(e) => setSesRequireNoteForPermit(e.target.checked)}
                    className="rounded border-slate-300 text-blue-600"
                  />
                  <span className="font-semibold text-slate-700">
                    Wajib mengisi keterangan format dosen saat memilih opsi Izin atau Sakit
                  </span>
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-600 mb-1">
                      Minimal Karakter Catatan
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="200"
                      value={sesMinNoteLength}
                      onChange={(e) => setSesMinNoteLength(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-mono"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block font-semibold text-slate-600 mb-1">
                      Petunjuk Format Catatan dari Dosen
                    </label>
                    <input
                      type="text"
                      value={sesNoteFormatHint}
                      onChange={(e) => setSesNoteFormatHint(e.target.value)}
                      placeholder="Mis. Format: [Alasan] - [Nama Orang Tua/Surat Dokter]"
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsSessionModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={sesSaving}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold disabled:opacity-60"
                >
                  {sesSaving ? 'Menyimpan...' : editingSession ? 'Simpan Perubahan' : 'Terbitkan Sesi QR'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE SESSION CONFIRM MODAL */}
      {deleteSessionTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="font-bold text-slate-900 text-sm">Hapus Sesi Absensi?</h3>
                <p className="text-xs text-slate-600">
                  Anda akan menghapus sesi <strong>{deleteSessionTarget.title}</strong> beserta seluruh catatan kehadiran di dalamnya.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteSessionTarget(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={async () => {
                  const id = deleteSessionTarget.id;
                  setDeleteSessionTarget(null);
                  await deleteAttendanceSession(id);
                  showToast('success', 'Sesi absensi berhasil dihapus.');
                }}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-xs font-bold text-white"
              >
                Hapus Permanen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STUDENT SCAN QR & CHOOSE OPTION MODAL */}
      {scanModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-xl overflow-hidden my-auto">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <QrCode className="w-4 h-4 text-blue-600" />
                <span>
                  {scanStep === 'scan'
                    ? 'Langkah 1: Scan Barcode / QR Code Dosen'
                    : 'Langkah 2: Pilih Opsi Absensi & Isi Format'}
                </span>
              </h3>
              <button
                type="button"
                onClick={() => {
                  stopCamera();
                  setScanModalOpen(false);
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              {scanError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{scanError}</span>
                </div>
              )}

              {scanStep === 'scan' ? (
                <div className="space-y-4">
                  {/* Scan Mode Switcher */}
                  <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 rounded-xl">
                    <button
                      type="button"
                      onClick={() => {
                        setScanError('');
                        setScanMode('camera');
                      }}
                      className={`py-2 px-2 rounded-lg font-bold flex items-center justify-center gap-1.5 ${
                        scanMode === 'camera' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600'
                      }`}
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span>Kamera Live</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setScanError('');
                        setScanMode('image');
                      }}
                      className={`py-2 px-2 rounded-lg font-bold flex items-center justify-center gap-1.5 ${
                        scanMode === 'image' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600'
                      }`}
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>Upload Foto QR</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setScanError('');
                        setScanMode('manual');
                      }}
                      className={`py-2 px-2 rounded-lg font-bold flex items-center justify-center gap-1.5 ${
                        scanMode === 'manual' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600'
                      }`}
                    >
                      <KeyRound className="w-3.5 h-3.5" />
                      <span>Input Kode QR</span>
                    </button>
                  </div>

                  {scanMode === 'camera' && (
                    <div className="space-y-3">
                      {cameraError ? (
                        <div className="p-6 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-center space-y-2">
                          <AlertTriangle className="w-7 h-7 mx-auto text-amber-600" />
                          <div className="font-bold">{cameraError}</div>
                        </div>
                      ) : (
                        <div className="relative rounded-2xl overflow-hidden bg-slate-900 aspect-video border border-slate-200">
                          <video
                            ref={videoRef}
                            className="w-full h-full object-cover"
                            muted
                            playsInline
                          />
                          <canvas ref={canvasRef} className="hidden" />
                          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                            <div className="w-44 h-44 border-2 border-emerald-400 rounded-2xl shadow-[0_0_0_9999px_rgba(15,23,42,0.45)]" />
                          </div>
                          <div className="absolute bottom-3 left-0 right-0 text-center text-[11px] font-semibold text-white">
                            Arahkan kamera tepat ke QR Code yang ditampilkan dosen
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {scanMode === 'image' && (
                    <label className="block border-2 border-dashed border-slate-300 hover:border-blue-400 bg-slate-50 rounded-2xl p-8 text-center cursor-pointer space-y-2">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleUploadQrImage}
                        className="hidden"
                      />
                      <Upload className="w-8 h-8 text-blue-600 mx-auto" />
                      <div className="font-bold text-slate-800">
                        Pilih atau Tangkap Foto QR Code Dosen
                      </div>
                      <p className="text-[11px] text-slate-500">
                        Sistem akan membaca barcode/QR Code dari gambar yang diunggah dan memverifikasi keaktifannya.
                      </p>
                    </label>
                  )}

                  {scanMode === 'manual' && (
                    <div className="space-y-3">
                      <label className="block font-bold text-slate-700">
                        Tempel Kode Hasil Scan QR / Token Sesi Dosen
                      </label>
                      <input
                        type="text"
                        placeholder='Contoh: QR-XXXXX-XXXXXX atau JSON payload QR'
                        value={manualInputCode}
                        onChange={(e) => setManualInputCode(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl border border-slate-300 font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => handleDecodedQrText(manualInputCode)}
                        className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold"
                      >
                        Verifikasi Kode QR
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                /* STEP 2: SELECT ATTENDANCE OPTION & FORMAT NOTE */
                verifiedSession && (
                  <form onSubmit={handleStudentSubmitAttendance} className="space-y-4">
                    <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-start gap-2.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <div className="space-y-0.5">
                        <div className="font-bold text-emerald-900">
                          QR Code Terverifikasi: {verifiedSession.title}
                        </div>
                        <div className="text-[11px] text-emerald-700">
                          {getSessionTargetLabel(verifiedSession)} · Batas waktu:{' '}
                          {formatDateTimeID(verifiedSession.endTime)}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="block font-bold text-slate-800">
                        Pilih Opsi Kehadiran Anda *
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {STUDENT_SELECTABLE_STATUSES.filter((opt) =>
                          verifiedSession.allowedStatuses.includes(opt.value)
                        ).map((opt) => {
                          const isSelected = chosenStatus === opt.value;
                          return (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => setChosenStatus(opt.value)}
                              className={`p-3 rounded-xl border text-left transition-all ${
                                isSelected
                                  ? 'bg-blue-50 border-blue-500 ring-1 ring-blue-400'
                                  : 'bg-white border-slate-200 hover:border-slate-300'
                              }`}
                            >
                              <div className="font-bold text-slate-900">{opt.label}</div>
                              <div className="text-[11px] text-slate-500 mt-0.5">
                                {opt.description}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="font-bold text-slate-800">
                          Keterangan / Format Catatan
                          {verifiedSession.requireNoteForPermit &&
                          (chosenStatus === 'izin' || chosenStatus === 'sakit') ? (
                            <span className="text-rose-600"> * (Wajib sesuai format)</span>
                          ) : (
                            <span className="text-slate-400 font-normal"> (Opsional)</span>
                          )}
                        </label>
                        {verifiedSession.minNoteLength ? (
                          <span className="text-[11px] font-mono text-slate-500">
                            {studentNote.trim().length}/{verifiedSession.minNoteLength} min
                          </span>
                        ) : null}
                      </div>

                      {verifiedSession.noteFormatHint && (
                        <div className="text-[11px] text-slate-500 bg-slate-50 px-3 py-2 rounded-lg border border-slate-200">
                          Ketentuan Dosen: {verifiedSession.noteFormatHint}
                        </div>
                      )}

                      <textarea
                        rows={3}
                        placeholder="Tuliskan keterangan kehadiran sesuai ketentuan dosen..."
                        value={studentNote}
                        onChange={(e) => setStudentNote(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300"
                      />
                    </div>

                    <div className="pt-2 flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setScanStep('scan');
                          setVerifiedPayload(null);
                          setScanError('');
                        }}
                        className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-semibold"
                      >
                        Scan Ulang QR
                      </button>

                      <button
                        type="submit"
                        disabled={submittingAttendance || !chosenStatus}
                        className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold disabled:opacity-50"
                      >
                        {submittingAttendance ? 'Mengirim Absensi...' : 'Kirim Absensi Sekarang'}
                      </button>
                    </div>
                  </form>
                )
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
