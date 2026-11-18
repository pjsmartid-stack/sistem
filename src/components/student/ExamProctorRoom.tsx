import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useExam } from '../../context/ExamContext';
import { Exam, ExamAttempt, Question, ViolationType } from '../../types';
import { WebcamProctorCanvas } from '../proctor/WebcamProctorCanvas';
import { generateCheatingScreenshotProof } from '../../utils/screenshotCapture';
import {
  Clock,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  Maximize,
  Minimize,
  ArrowLeft,
  ArrowRight,
  Bookmark,
  Send,
  Lock,
  Eye,
  Check,
  Volume2,
  Shuffle,
} from 'lucide-react';

interface ExamProctorRoomProps {
  exam: Exam;
  onExit: () => void;
  onFinished: (completedAttempt?: ExamAttempt) => void;
}

export const ExamProctorRoom: React.FC<ExamProctorRoomProps> = ({
  exam,
  onExit,
  onFinished,
}) => {
  const {
    currentUser,
    startAttempt,
    getAttempt,
    syncAttemptFromServer,
    getExamAttemptRemainingSeconds,
    saveAnswer,
    toggleFlagAnswer,
    submitAttempt,
    recordViolation,
    getExamTimeStatus,
  } = useExam();

  if (!currentUser) return null;

  // Initialize or retrieve existing single attempt
  const attempt = getAttempt(exam.id, currentUser.id) || startAttempt(exam.id, currentUser);

  // Time status check
  const timeWindow = getExamTimeStatus(exam);

  // Randomized questions order and option order for this student
  const orderedQuestions: Question[] = useMemo(() => {
    if (attempt.shuffledQuestionIds && attempt.shuffledQuestionIds.length > 0) {
      const qMap = new Map(exam.questions.map((q) => [q.id, q]));
      const list: Question[] = [];
      for (const qId of attempt.shuffledQuestionIds) {
        const found = qMap.get(qId);
        if (found) {
          if (attempt.shuffledOptionMap && attempt.shuffledOptionMap[found.id]) {
            const optOrder = attempt.shuffledOptionMap[found.id];
            const optMap = new Map(found.options.map((o) => [o.id, o]));
            const reorderedOptions = optOrder.map((oid) => optMap.get(oid)!).filter(Boolean);
            list.push({
              ...found,
              options: reorderedOptions.length > 0 ? reorderedOptions : found.options,
            });
          } else {
            list.push(found);
          }
        }
      }
      return list.length > 0 ? list : exam.questions;
    }
    return exam.questions;
  }, [exam.questions, attempt.shuffledQuestionIds, attempt.shuffledOptionMap]);

  // State
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showConfirmSubmit, setShowConfirmSubmit] = useState(false);
  const [isTimeOutLocked, setIsTimeOutLocked] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [violationAlertMessage, setViolationAlertMessage] = useState<string | null>(null);

  // Strict Screen Lock state
  const [isScreenLockModalOpen, setIsScreenLockModalOpen] = useState(false);
  const [lockBreachCount, setLockBreachCount] = useState(0);

  const isAttemptTerminal = Boolean(
    attempt.isCompleted || attempt.status === 'submitted' || attempt.status === 'timed_out'
  );
  const isSessionLocked = isAttemptTerminal || isTimeOutLocked || isSubmitting;

  // High-volume notification sound with voice: "percobaan keluar dari halaman"
  const triggerScreenLockAlarm = useCallback((triggerReason: string = 'percobaan keluar dari halaman') => {
    // 1. Text-to-Speech high volume
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance('percobaan keluar dari halaman');
      utterance.lang = 'id-ID';
      utterance.volume = 1.0; // 100% Volume Tinggi
      utterance.rate = 1.0;
      utterance.pitch = 1.05;

      const voices = window.speechSynthesis.getVoices();
      const idVoice = voices.find(
        (v) =>
          v.lang.startsWith('id') ||
          v.lang.toLowerCase().includes('indonesia') ||
          v.name.toLowerCase().includes('indonesia')
      );
      if (idVoice) {
        utterance.voice = idVoice;
      }
      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.warn('Speech synthesis error:', err);
    }

    // 2. High-volume dual siren buzzer using Web Audio API
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        if (ctx.state === 'suspended') {
          ctx.resume();
        }
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(920, ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(460, ctx.currentTime + 0.35);
        osc.frequency.linearRampToValueAtTime(920, ctx.currentTime + 0.7);

        gain.gain.setValueAtTime(1.0, ctx.currentTime); // Volume tinggi
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.9);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start();
        osc.stop(ctx.currentTime + 0.9);
      }
    } catch (e) {
      console.warn('Web audio siren error:', e);
    }
  }, []);

  // Sync latest attempt state from Firestore on mount to enforce single-access across tabs/devices
  useEffect(() => {
    syncAttemptFromServer(exam.id, currentUser.id);
  }, [exam.id, currentUser.id, syncAttemptFromServer]);

  // Timer Calculation (bounded by both exam duration and exam schedule closing time)
  const [secondsRemaining, setSecondsRemaining] = useState<number>(() =>
    getExamAttemptRemainingSeconds(exam, attempt)
  );

  const currentQuestion: Question | undefined = orderedQuestions[currentQuestionIndex];
  const currentAnswer = currentQuestion ? attempt.answers[currentQuestion.id] : undefined;

  // Enforce screen lock into fullscreen
  const enforceScreenLock = () => {
    try {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
      setIsFullscreen(true);
      setIsScreenLockModalOpen(false);
    } catch (e) {}
  };

  // Handle Fullscreen toggle
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
      setIsScreenLockModalOpen(false);
    } else {
      // Exiting is considered a breach
      triggerScreenLockAlarm('percobaan keluar dari halaman');
      setIsScreenLockModalOpen(true);
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
      setIsFullscreen(false);
    }
  };

  // Auto-submit trigger when time runs out
  const handleAutoSubmitTimeout = useCallback(() => {
    if (attempt.isCompleted || isTimeOutLocked) return;
    setIsTimeOutLocked(true);
    setShowConfirmSubmit(false);
    const result = submitAttempt(attempt.id, true);
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
    setTimeout(() => {
      onFinished(result);
    }, 2200);
  }, [attempt.id, attempt.isCompleted, isTimeOutLocked, submitAttempt, onFinished]);

  // On mount: if active session & valid window, require screen lock; if already expired, auto-lock
  useEffect(() => {
    if (isAttemptTerminal) {
      setIsScreenLockModalOpen(false);
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
      return;
    }
    if (secondsRemaining <= 0) {
      handleAutoSubmitTimeout();
      return;
    }
    if (timeWindow.canAccess && !document.fullscreenElement) {
      setIsScreenLockModalOpen(true);
    }
  }, [isAttemptTerminal, timeWindow.canAccess, secondsRemaining, handleAutoSubmitTimeout]);

  // Timer interval countdown
  useEffect(() => {
    if (isAttemptTerminal || isTimeOutLocked) return;

    const timer = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleAutoSubmitTimeout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isAttemptTerminal, isTimeOutLocked, handleAutoSubmitTimeout]);

  // Anti-Cheat Sensor: Tab Switch, Visibility Change, and Window Blur
  useEffect(() => {
    if (attempt.isCompleted || isTimeOutLocked) return;

    let tabSwitchTimer: any = null;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Tab switched or minimized
        triggerScreenLockAlarm('percobaan keluar dari halaman');
        setIsScreenLockModalOpen(true);
        setLockBreachCount((c) => c + 1);

        const currentQ = orderedQuestions[currentQuestionIndex];
        const screenshotProof = generateCheatingScreenshotProof({
          studentName: currentUser.name,
          studentNim: currentUser.nimOrNip,
          studentClassName: currentUser.className,
          examTitle: exam.title,
          courseName: exam.courseName,
          violationType: 'tab_switch',
          violationTitle: 'Buka Tab Baru / Beralih Layar (Tab Switch)',
          currentQuestionNumber: currentQuestionIndex + 1,
          totalQuestions: orderedQuestions.length,
          currentQuestionText: currentQ?.text,
        });

        const desc =
          'Peserta terdeteksi beralih tab atau meminimalkan browser ujian (visibility hidden). Tangkapan layar otomatis telah direkam sebagai bukti.';
        recordViolation({
          examId: exam.id,
          examTitle: exam.title,
          studentId: currentUser.id,
          studentName: currentUser.name,
          studentNim: currentUser.nimOrNip,
          studentClassName: currentUser.className,
          violationType: 'tab_switch',
          title: 'Percobaan Keluar dari Halaman Ujian (Tab Switch)',
          description: desc,
          severity: 'high',
          aiConfidence: 0.99,
          snapshotUrl: screenshotProof,
        });

        setViolationAlertMessage(
          '🚨 PERINGATAN KERAS: Percobaan keluar dari halaman ujian terdeteksi! Tangkapan layar bukti kecurangan telah direkam dan dilaporkan.'
        );
      }
    };

    const handleWindowBlur = () => {
      tabSwitchTimer = setTimeout(() => {
        if (!document.hasFocus()) {
          triggerScreenLockAlarm('percobaan keluar dari halaman');
          setIsScreenLockModalOpen(true);
          setLockBreachCount((c) => c + 1);

          const currentQ = orderedQuestions[currentQuestionIndex];
          const screenshotProof = generateCheatingScreenshotProof({
            studentName: currentUser.name,
            studentNim: currentUser.nimOrNip,
            studentClassName: currentUser.className,
            examTitle: exam.title,
            courseName: exam.courseName,
            violationType: 'tab_switch',
            violationTitle: 'Kehilangan Fokus Jendela (Window Blur)',
            currentQuestionNumber: currentQuestionIndex + 1,
            totalQuestions: orderedQuestions.length,
            currentQuestionText: currentQ?.text,
          });

          recordViolation({
            examId: exam.id,
            examTitle: exam.title,
            studentId: currentUser.id,
            studentName: currentUser.name,
            studentNim: currentUser.nimOrNip,
            studentClassName: currentUser.className,
            violationType: 'tab_switch',
            title: 'Kehilangan Fokus Jendela (Window Blur)',
            description: 'Peserta mengklik atau beralih ke aplikasi luar browser ujian saat layar terkunci. Tangkapan layar berhasil direkam.',
            severity: 'high',
            aiConfidence: 0.96,
            snapshotUrl: screenshotProof,
          });
        }
      }, 500);
    };

    const handleFullscreenChange = () => {
      const inFullscreen = !!document.fullscreenElement;
      setIsFullscreen(inFullscreen);
      if (!inFullscreen && !attempt.isCompleted) {
        triggerScreenLockAlarm('percobaan keluar dari halaman');
        setIsScreenLockModalOpen(true);
        setLockBreachCount((c) => c + 1);

        const currentQ = orderedQuestions[currentQuestionIndex];
        const screenshotProof = generateCheatingScreenshotProof({
          studentName: currentUser.name,
          studentNim: currentUser.nimOrNip,
          studentClassName: currentUser.className,
          examTitle: exam.title,
          courseName: exam.courseName,
          violationType: 'fullscreen_exit',
          violationTitle: 'Keluar Dari Mode Layar Penuh (Fullscreen Exit)',
          currentQuestionNumber: currentQuestionIndex + 1,
          totalQuestions: orderedQuestions.length,
          currentQuestionText: currentQ?.text,
        });

        recordViolation({
          examId: exam.id,
          examTitle: exam.title,
          studentId: currentUser.id,
          studentName: currentUser.name,
          studentNim: currentUser.nimOrNip,
          studentClassName: currentUser.className,
          violationType: 'fullscreen_exit',
          title: 'Percobaan Keluar dari Penguncian Layar Penuh',
          description: 'Peserta mencoba keluar dari mode layar penuh penguncian ujian. Tangkapan layar otomatis telah direkam.',
          severity: 'high',
          aiConfidence: 0.98,
          snapshotUrl: screenshotProof,
        });
      }
    };

    const handleMouseLeave = (e: MouseEvent) => {
      // If cursor leaves the page to top/browser chrome
      if (e.clientY <= 0) {
        triggerScreenLockAlarm('percobaan keluar dari halaman');
        setViolationAlertMessage('Kursor terdeteksi meninggalkan area ujian. Harap tetap berada di dalam halaman ujian.');
      }
    };

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      triggerScreenLockAlarm('percobaan keluar dari halaman');
      e.preventDefault();
      e.returnValue = 'Ujian sedang berlangsung! Keluar akan membatalkan sesi ujian Anda.';
      return e.returnValue;
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      triggerScreenLockAlarm('percobaan keluar dari halaman');
      recordViolation({
        examId: exam.id,
        examTitle: exam.title,
        studentId: currentUser.id,
        studentName: currentUser.name,
        studentNim: currentUser.nimOrNip,
        studentClassName: currentUser.className,
        violationType: 'right_click_attempt',
        title: 'Percobaan Klik Kanan / Context Menu',
        description: 'Peserta mencoba membuka menu konteks (diduga mencari inspect element atau copy).',
        severity: 'low',
        aiConfidence: 0.9,
      });
      setViolationAlertMessage('Klik kanan dinonaktifkan demi keamanan integritas ujian.');
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape or F11 attempt
      if (e.key === 'Escape' || e.key === 'F11' || e.key === 'F12') {
        e.preventDefault();
        triggerScreenLockAlarm('percobaan keluar dari halaman');
        setIsScreenLockModalOpen(true);
        setLockBreachCount((c) => c + 1);
        recordViolation({
          examId: exam.id,
          examTitle: exam.title,
          studentId: currentUser.id,
          studentName: currentUser.name,
          studentNim: currentUser.nimOrNip,
          studentClassName: currentUser.className,
          violationType: 'fullscreen_exit',
          title: `Percobaan Menekan Tombol Pembatal Kunci Layar (${e.key})`,
          description: `Peserta menekan tombol ${e.key} yang berpotensi mematikan penguncian layar.`,
          severity: 'high',
          aiConfidence: 0.99,
        });
        return;
      }

      if ((e.ctrlKey || e.metaKey) && ['c', 'v', 'u', 'p', 's', 'w', 'r', 'tab'].includes(e.key.toLowerCase())) {
        e.preventDefault();
        triggerScreenLockAlarm('percobaan keluar dari halaman');
        recordViolation({
          examId: exam.id,
          examTitle: exam.title,
          studentId: currentUser.id,
          studentName: currentUser.name,
          studentNim: currentUser.nimOrNip,
          studentClassName: currentUser.className,
          violationType: 'right_click_attempt',
          title: `Kombinasi Keyboard Dilarang (${e.key.toUpperCase()})`,
          description: 'Upaya navigasi atau menyalin/menutup halaman diblokir sistem penguncian.',
          severity: 'medium',
          aiConfidence: 0.95,
        });
        setViolationAlertMessage('Kombinasi tombol dilarang demi keamanan penguncian ujian.');
      }
    };

    const handleClipboardOrSelect = (e: Event) => {
      e.preventDefault();
      setViolationAlertMessage(
        'Akses terbatas: menyalin, menempel, atau menyeleksi teks soal dinonaktifkan selama sesi ujian.'
      );
    };

    const handlePopState = () => {
      window.history.pushState(null, '', window.location.href);
      setViolationAlertMessage(
        'Navigasi kembali dinonaktifkan selama sesi ujian berlangsung. Silakan selesaikan dan kumpulkan ujian.'
      );
    };

    window.history.pushState(null, '', window.location.href);

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('mouseleave', handleMouseLeave);
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('contextmenu', handleContextMenu);
    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('copy', handleClipboardOrSelect);
    document.addEventListener('cut', handleClipboardOrSelect);
    document.addEventListener('paste', handleClipboardOrSelect);
    window.addEventListener('popstate', handlePopState);

    return () => {
      clearTimeout(tabSwitchTimer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('mouseleave', handleMouseLeave);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('contextmenu', handleContextMenu);
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('copy', handleClipboardOrSelect);
      document.removeEventListener('cut', handleClipboardOrSelect);
      document.removeEventListener('paste', handleClipboardOrSelect);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [attempt.isCompleted, isTimeOutLocked, exam, currentUser, recordViolation, triggerScreenLockAlarm]);

  // Format timer MM:SS
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const answeredCount = Object.keys(attempt.answers).length;
  const totalQuestions = orderedQuestions.length;
  const isLastQuestion = currentQuestionIndex === totalQuestions - 1;

  const handleManualSubmit = () => {
    if (isSessionLocked) return;
    setIsSubmitting(true);
    setShowConfirmSubmit(false);
    const completed = submitAttempt(attempt.id, false);
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
    onFinished(completed);
  };

  // Hard Lock Screen: Attempt is already completed (Single-Access & Immutable Answers)
  if (isAttemptTerminal) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center space-y-4 shadow-xl border border-slate-200">
          <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
            <Lock className="w-7 h-7" />
          </div>
          <div className="text-xs font-semibold text-slate-500">
            Akses Terkunci · Maksimal 1 Kali Akses
          </div>
          <h2 className="text-xl font-bold text-slate-900">Ujian Sudah Diselesaikan</h2>
          <p className="text-xs text-slate-600 leading-relaxed">
            Anda sudah mengumpulkan jawaban untuk <strong>{exam.title}</strong>
            {attempt.submittedAt
              ? ` pada ${new Date(attempt.submittedAt).toLocaleString('id-ID')}`
              : ''}
            . Seluruh jawaban bersifat permanen dan tidak dapat diubah kembali.
          </p>
          <div className="flex flex-col gap-2 pt-2">
            <button
              type="button"
              onClick={() => onFinished(attempt)}
              className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-colors"
            >
              Lihat Ringkasan &amp; Pengumuman Nilai
            </button>
            <button
              type="button"
              onClick={onExit}
              className="w-full py-2 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors"
            >
              Kembali ke Dashboard Mahasiswa
            </button>
          </div>
        </div>
      </div>
    );
  }

  // If time window is outside or expired
  if (!timeWindow.canAccess && !attempt.isCompleted) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center space-y-4 shadow-xl border border-slate-200">
          <div className="w-14 h-14 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
            <Lock className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">{timeWindow.label}</h2>
          <p className="text-xs text-slate-600 leading-relaxed">{timeWindow.message}</p>
          <button
            type="button"
            onClick={onExit}
            className="w-full py-2 px-4 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg transition-colors"
          >
            Kembali ke Dashboard Mahasiswa
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col select-none">
      {/* Top Floating Exam Navigation Bar */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-xs px-4 sm:px-6 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
            SMU
          </div>
          <div className="min-w-0">
            <h1 className="text-sm font-bold text-slate-900 truncate max-w-[200px] sm:max-w-md">
              {exam.title}
            </h1>
            <p className="text-[11px] text-slate-500 truncate">
              {exam.courseName} · {currentUser.name} ({currentUser.nimOrNip}) ·{' '}
              <span className="font-semibold text-rose-700">
                Akses Terbatas (1x Akses)
              </span>
            </p>
          </div>
        </div>

        {/* Real-time Countdown Timer */}
        <div className="flex items-center gap-4">
          <div
            className={`px-3 py-1.5 rounded-xl border flex items-center gap-2 transition-all ${
              secondsRemaining < 300
                ? 'bg-rose-50 border-rose-300 text-rose-700 animate-pulse'
                : 'bg-slate-50 border-slate-200 text-slate-800'
            }`}
          >
            <Clock className="w-4 h-4 text-rose-500" />
            <div className="text-right">
              <span className="text-xs font-medium text-slate-400 mr-1 hidden sm:inline">
                Sisa Waktu:
              </span>
              <span className="font-mono font-extrabold text-sm sm:text-base">
                {formatTime(secondsRemaining)}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={toggleFullscreen}
            className="p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors hidden sm:block"
            title={isFullscreen ? 'Keluar Fullscreen' : 'Layar Penuh (Disarankan)'}
          >
            {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Violation Alert Banner if triggered */}
      {violationAlertMessage && (
        <div className="bg-rose-600 text-white px-4 py-2 text-xs font-semibold flex items-center justify-between shadow-md">
          <div className="flex items-center gap-2 max-w-4xl mx-auto">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{violationAlertMessage}</span>
          </div>
          <button
            onClick={() => setViolationAlertMessage(null)}
            className="text-white/80 hover:text-white text-xs underline ml-2"
          >
            Tutup
          </button>
        </div>
      )}

      {/* Timeout Auto-Submit Blocking Overlay */}
      {isTimeOutLocked && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center space-y-4 shadow-2xl">
            <div className="w-16 h-16 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto animate-bounce">
              <Clock className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-extrabold text-slate-900">WAKTU UJIAN TELAH HABIS!</h2>
            <p className="text-xs text-slate-600 leading-relaxed">
              Waktu pengerjaan telah berakhir. Anda tidak dapat lagi mengisi atau mengubah jawaban.
              Sistem sedang mengumpulkan lembar ujian Anda ke server dosen secara otomatis...
            </p>
            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
              <div className="bg-blue-600 h-full animate-pulse w-full" />
            </div>
          </div>
        </div>
      )}

      {/* Main Content Layout */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 flex-1 w-full grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Column: Active Question & Answer Options */}
        <div className="lg:col-span-3 space-y-6">
          {currentQuestion && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-6">
              {/* Question Header */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 rounded-lg bg-blue-600 text-white font-bold text-xs">
                    Soal No. {currentQuestionIndex + 1}
                  </span>
                  <span className="text-xs text-slate-400">dari {totalQuestions} soal</span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-1 rounded">
                    Bobot: {currentQuestion.points} Poin
                  </span>
                  <button
                    type="button"
                    disabled={isSessionLocked}
                    onClick={() => toggleFlagAnswer(attempt.id, currentQuestion.id)}
                    className={`px-3 py-1 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors border disabled:opacity-50 ${
                      currentAnswer?.isFlagged
                        ? 'bg-amber-100 text-amber-900 border-amber-300 font-bold'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <Bookmark className="w-3.5 h-3.5" />
                    {currentAnswer?.isFlagged ? 'Ditandai Ragu-ragu' : 'Ragu-ragu'}
                  </button>
                </div>
              </div>

              {/* Question Text */}
              <div className="text-base sm:text-lg font-medium text-slate-900 leading-relaxed">
                {currentQuestion.text}
              </div>

              {/* Options List */}
              <div className="space-y-3 pt-2">
                {currentQuestion.options.map((opt, optIdx) => {
                  const isSelected = currentAnswer?.selectedOption === opt.id;
                  const displayLetter = String.fromCharCode(65 + optIdx); // A, B, C, D...

                  return (
                    <button
                      key={opt.id}
                      type="button"
                      disabled={isSessionLocked}
                      onClick={() => {
                        if (isSessionLocked) return;
                        saveAnswer(
                          attempt.id,
                          currentQuestion.id,
                          opt.id,
                          currentAnswer?.isFlagged || false
                        );
                      }}
                      className={`w-full p-4 rounded-xl text-left text-sm flex items-start gap-3.5 border-2 transition-all group disabled:opacity-60 disabled:cursor-not-allowed ${
                        isSelected
                          ? 'border-blue-600 bg-blue-50/50 shadow-xs'
                          : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50'
                      }`}
                    >
                      <span
                        className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs shrink-0 transition-colors ${
                          isSelected
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-100 text-slate-700 group-hover:bg-slate-200'
                        }`}
                      >
                        {displayLetter}
                      </span>
                      <span
                        className={`flex-1 text-sm pt-0.5 leading-normal ${
                          isSelected ? 'font-semibold text-blue-950' : 'text-slate-800'
                        }`}
                      >
                        {opt.text}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Navigation Bar (Prev / Next / Submit) */}
              <div className="pt-6 border-t border-slate-100 flex items-center justify-between">
                <button
                  type="button"
                  disabled={currentQuestionIndex === 0}
                  onClick={() => setCurrentQuestionIndex((prev) => prev - 1)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Sebelumnya
                </button>

                <div className="flex items-center gap-2">
                  {isLastQuestion ? (
                    <button
                      type="button"
                      id="btn-finish-exam-last-step"
                      onClick={() => setShowConfirmSubmit(true)}
                      className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm flex items-center gap-1.5 transition-colors"
                    >
                      <Send className="w-4 h-4" />
                      Selesaikan Ujian
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setCurrentQuestionIndex((prev) => prev + 1)}
                      className="px-5 py-2 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 shadow-xs flex items-center gap-1.5 transition-colors"
                    >
                      Selanjutnya
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: AI Proctor Floating Widget & Question Palette */}
        <div className="space-y-6">
          {/* AI Proctoring Webcam Feed */}
          {exam.aiProctoringEnabled && (
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-3">
              <div className="flex items-center justify-between text-xs">
                <div className="font-bold text-slate-800 flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 text-blue-600" />
                  Kamera Pengawas AI
                </div>
                <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.5 rounded">
                  AKTIF
                </span>
              </div>

              <div className="flex justify-center">
                <WebcamProctorCanvas
                  examId={exam.id}
                  examTitle={exam.title}
                  studentId={currentUser.id}
                  studentName={currentUser.name}
                  studentNim={currentUser.nimOrNip}
                  onViolationTriggered={(type, desc) => {
                    setViolationAlertMessage(`Peringatan AI: ${desc}`);
                  }}
                />
              </div>

              <p className="text-[10px] text-slate-400 text-center leading-tight">
                AI mengawasi pandangan, ketiadaan wajah, dan gawai secara otomatis.
              </p>
            </div>
          )}

          {/* Question Grid Palette */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-900">Navigasi Nomor Soal</span>
              <span className="text-slate-500 font-medium">
                {answeredCount}/{totalQuestions} Terjawab
              </span>
            </div>

            <div className="grid grid-cols-5 gap-2">
              {orderedQuestions.map((q, idx) => {
                const ans = attempt.answers[q.id];
                const isAnswered = !!ans?.selectedOption;
                const isFlagged = !!ans?.isFlagged;
                const isCurrent = idx === currentQuestionIndex;

                let btnStyle = 'bg-slate-100 text-slate-700 border-slate-200';
                if (isAnswered) {
                  btnStyle = 'bg-blue-600 text-white border-blue-600';
                }
                if (isFlagged) {
                  btnStyle = 'bg-amber-400 text-amber-950 border-amber-500 font-extrabold';
                }
                if (isCurrent) {
                  btnStyle += ' ring-2 ring-offset-2 ring-blue-500';
                }

                return (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => setCurrentQuestionIndex(idx)}
                    className={`h-9 rounded-lg text-xs font-bold border transition-all flex items-center justify-center relative ${btnStyle}`}
                  >
                    {idx + 1}
                    {isAnswered && !isFlagged && (
                      <span className="absolute -top-1 -right-1 w-2 h-2 bg-emerald-400 rounded-full" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Legend */}
            <div className="pt-3 border-t border-slate-100 space-y-1.5 text-[11px] text-slate-500">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded bg-blue-600" />
                <span>Sudah Dijawab</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded bg-amber-400" />
                <span>Ragu-ragu</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded bg-slate-200" />
                <span>Belum Dijawab</span>
              </div>
            </div>

            {/* Final Submit Button */}
            <button
              type="button"
              id="btn-confirm-submit-dialog"
              onClick={() => setShowConfirmSubmit(true)}
              className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2"
            >
              <Send className="w-4 h-4" />
              Kumpulkan Ujian Sekarang
            </button>
          </div>
        </div>
      </div>

      {/* Confirmation Modal Before Final Submit */}
      {showConfirmSubmit && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full space-y-5 shadow-2xl border border-slate-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
                <HelpCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">Konfirmasi Selesai Ujian</h3>
                <p className="text-xs text-slate-500">Periksa kembali ringkasan jawaban Anda</p>
              </div>
            </div>

            <div className="p-4 bg-slate-50 rounded-xl space-y-2 text-xs text-slate-700">
              <div className="flex justify-between">
                <span>Total Butir Soal:</span>
                <span className="font-bold">{totalQuestions}</span>
              </div>
              <div className="flex justify-between text-blue-700 font-semibold">
                <span>Soal Terjawab:</span>
                <span>{answeredCount}</span>
              </div>
              <div className="flex justify-between text-rose-600">
                <span>Soal Belum Terjawab:</span>
                <span className="font-bold">{totalQuestions - answeredCount}</span>
              </div>
              <div className="flex justify-between text-amber-700">
                <span>Soal Ditandai Ragu-ragu:</span>
                <span>
                  {Object.values(attempt.answers).filter((a) => a.isFlagged).length}
                </span>
              </div>
            </div>

            {totalQuestions - answeredCount > 0 && (
              <p className="text-xs text-amber-700 bg-amber-50 p-2.5 rounded-lg border border-amber-200">
                Peringatan: Masih terdapat{' '}
                <strong>{totalQuestions - answeredCount} butir soal</strong> yang belum Anda jawab.
              </p>
            )}

            <p className="text-[11px] text-rose-700 bg-rose-50 p-2.5 rounded-lg border border-rose-200 leading-relaxed">
              <strong>Ketentuan 1 Kali Akses:</strong> Setelah dikumpulkan, seluruh jawaban Anda akan terkunci permanen, tidak dapat diubah kembali, dan Anda tidak dapat masuk ulang ke sesi soal ujian ini.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={isSessionLocked}
                onClick={() => setShowConfirmSubmit(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-50"
              >
                Kembali Mengerjakan
              </button>
              <button
                type="button"
                id="btn-final-submit"
                disabled={isSessionLocked}
                onClick={handleManualSubmit}
                className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition-colors disabled:opacity-50"
              >
                {isSubmitting ? 'Mengunci Jawaban...' : 'Kumpulkan & Kunci Permanen'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Strict Screen Lock Overlay Modal */}
      {isScreenLockModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/92 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-8 max-w-lg w-full text-center space-y-6 shadow-2xl border-4 border-rose-500 animate-in fade-in zoom-in duration-200">
            <div className="w-20 h-20 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto ring-8 ring-rose-50">
              <Lock className="w-10 h-10 animate-pulse" />
            </div>

            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-black bg-rose-100 text-rose-800 tracking-wider uppercase">
                🚨 Layar Mahasiswa Terkunci
              </div>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                {lockBreachCount > 0 ? 'PERCOBAAN KELUAR DARI HALAMAN!' : 'PENGUNCIAN LAYAR UJIAN WAJIB'}
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed">
                {lockBreachCount > 0
                  ? 'Sistem mendeteksi Anda mencoba meninggalkan halaman ujian atau keluar dari mode layar penuh.'
                  : 'Untuk menjaga integritas ujian, layar komputer Anda akan dikunci dalam mode layar penuh (fullscreen).'}
              </p>
            </div>

            <div className="p-4 bg-rose-50 rounded-2xl border border-rose-200 text-left space-y-2 text-xs text-rose-950">
              <div className="flex items-center gap-2 font-bold text-rose-800">
                <Volume2 className="w-4 h-4 text-rose-600 shrink-0" />
                <span>Notifikasi Suara Volume Tinggi Otomatis Aktif</span>
              </div>
              <p className="text-slate-600 pl-6 leading-relaxed">
                Suara peringatan berbunyi otomatis: <strong>&ldquo;percobaan keluar dari halaman&rdquo;</strong> dengan volume maksimal jika terdeteksi meninggalkan halaman.
              </p>
              {lockBreachCount > 0 && (
                <div className="flex items-center justify-between pt-2 border-t border-rose-200/60 font-semibold text-rose-900">
                  <span>Pelanggaran Keluar Terdeteksi:</span>
                  <span className="px-2.5 py-0.5 bg-rose-600 text-white rounded-full font-black text-xs">
                    {lockBreachCount}x Tercatat
                  </span>
                </div>
              )}
            </div>

            <div className="space-y-3 pt-2">
              <button
                type="button"
                id="btn-enforce-screen-lock"
                onClick={() => {
                  enforceScreenLock();
                }}
                className="w-full py-3.5 px-6 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-sm rounded-xl shadow-lg hover:shadow-rose-600/30 transition-all flex items-center justify-center gap-2"
              >
                <Lock className="w-4 h-4" />
                {lockBreachCount > 0 ? 'Kunci Kembali Layar & Lanjutkan Ujian' : 'Kunci Layar Penuh & Mulai Ujian'}
              </button>
              <p className="text-[11px] text-slate-400">
                Ujian diawasi oleh AI Proctoring ketat. Membuka tab atau jendela lain akan dilaporkan ke pengawas.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
