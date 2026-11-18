/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { ExamProvider, useExam } from './context/ExamContext';
import { Sidebar, NavigationTab } from './components/Sidebar';
import { LoginView } from './components/LoginView';
import { LecturerDashboard } from './components/lecturer/LecturerDashboard';
import { StudentDashboard } from './components/student/StudentDashboard';
import { ExamProctorRoom } from './components/student/ExamProctorRoom';
import { ExamResultView } from './components/student/ExamResultView';
import { ViolationNotificationsModal } from './components/lecturer/ViolationNotificationsModal';
import { ClassManagementModal } from './components/lecturer/ClassManagementModal';
import { UserManagementModal } from './components/lecturer/UserManagementModal';
import { PublicCheatingBoardView } from './components/cheating/PublicCheatingBoardView';
import { CourseListView } from './components/courses/CourseListView';
import { IRTAnalyticsView } from './components/irt/IRTAnalyticsView';
import { AttendanceView } from './components/attendance/AttendanceView';
import { GradebookView } from './components/grades/GradebookView';
import { CourseFormModal } from './components/courses/CourseFormModal';
import { Exam, ExamAttempt } from './types';

const AppContent: React.FC = () => {
  const {
    currentUser,
    exams,
    attempts,
    getAttempt,
    getExamTimeStatus,
    getExamAttemptRemainingSeconds,
    submitAttempt,
  } = useExam();

  // Navigation state for student
  const [takingExam, setTakingExam] = useState<Exam | null>(null);
  const [viewingResult, setViewingResult] = useState<{
    exam: Exam;
    attempt: ExamAttempt;
  } | null>(null);

  // Global Left Sidebar Navigation Tab
  const [currentTab, setCurrentTab] = useState<NavigationTab>('exams');

  // Global modals triggered from Left Sidebar
  const [isViolationModalOpen, setIsViolationModalOpen] = useState(false);
  const [isClassModalOpen, setIsClassModalOpen] = useState(false);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [isCreateCourseModalOpen, setIsCreateCourseModalOpen] = useState(false);

  // Detect any active ongoing exam session for the student (even after browser reload/new tab)
  const activeInProgressExam = useMemo(() => {
    if (!currentUser || currentUser.role !== 'mahasiswa') return null;
    for (const att of attempts) {
      if (att.studentId !== currentUser.id || att.isCompleted) continue;
      if (att.status === 'submitted' || att.status === 'timed_out') continue;
      const ex = exams.find((e) => e.id === att.examId);
      if (!ex) continue;
      const win = getExamTimeStatus(ex);
      const remaining = getExamAttemptRemainingSeconds(ex, att);
      if (win.status === 'ongoing' && remaining > 0) {
        return ex;
      }
    }
    return null;
  }, [currentUser, attempts, exams, getExamTimeStatus, getExamAttemptRemainingSeconds]);

  // Auto-finalize any stale in_progress attempt whose duration or exam window has expired
  useEffect(() => {
    if (!currentUser || currentUser.role !== 'mahasiswa') return;
    for (const att of attempts) {
      if (att.studentId !== currentUser.id || att.isCompleted) continue;
      const ex = exams.find((e) => e.id === att.examId);
      if (!ex) continue;
      const win = getExamTimeStatus(ex);
      const remaining = getExamAttemptRemainingSeconds(ex, att);
      if (win.status === 'completed' || remaining <= 0) {
        submitAttempt(att.id, true);
      }
    }
  }, [currentUser, attempts, exams, getExamTimeStatus, getExamAttemptRemainingSeconds, submitAttempt]);

  // Guard handler: never start/re-open an exam whose attempt is already completed (1x access)
  const handleStartExamForStudent = (exam: Exam) => {
    if (!currentUser) return;
    const existing = getAttempt(exam.id, currentUser.id);
    if (existing?.isCompleted) {
      setTakingExam(null);
      setViewingResult({ exam, attempt: existing });
      return;
    }
    setViewingResult(null);
    setTakingExam(exam);
  };

  // If not logged in, show login page
  if (!currentUser) {
    return <LoginView />;
  }

  const isStaff = currentUser.role === 'admin' || currentUser.role === 'dosen';

  // Effective restricted exam session: either explicitly started OR active in_progress attempt
  const liveTakingExam =
    currentUser.role === 'mahasiswa'
      ? takingExam && !getAttempt(takingExam.id, currentUser.id)?.isCompleted
        ? takingExam
        : activeInProgressExam
      : null;

  // Active exam taking mode: restricted access (hide sidebar, courses, materials, and all other menus)
  if (currentUser.role === 'mahasiswa' && liveTakingExam) {
    return (
      <ExamProctorRoom
        exam={liveTakingExam}
        onExit={() => setTakingExam(null)}
        onFinished={(completedAttempt) => {
          setTakingExam(null);
          if (completedAttempt) {
            setViewingResult({ exam: liveTakingExam, attempt: completedAttempt });
          }
        }}
      />
    );
  }

  // Viewing exam result & score announcement (read-only)
  if (currentUser.role === 'mahasiswa' && viewingResult) {
    return (
      <ExamResultView
        exam={viewingResult.exam}
        attempt={viewingResult.attempt}
        onBackToDashboard={() => setViewingResult(null)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col lg:flex-row">
      {/* Left Sidebar Navigation (Stacked Top to Bottom) */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        onOpenNotifications={isStaff ? () => setIsViolationModalOpen(true) : undefined}
        onOpenClassModal={isStaff ? () => setIsClassModalOpen(true) : undefined}
        onOpenUserModal={isStaff ? () => setIsUserModalOpen(true) : undefined}
        onOpenCreateCourseModal={isStaff ? () => setIsCreateCourseModalOpen(true) : undefined}
      />

      {/* Right Main Workspace Viewport */}
      <div className="flex-1 min-w-0 flex flex-col justify-between">
        <main className="flex-1">
          {currentTab === 'cheating_board' ? (
            <PublicCheatingBoardView onBack={() => setCurrentTab('exams')} />
          ) : currentTab === 'irt_analytics' ? (
            <IRTAnalyticsView />
          ) : currentTab === 'courses' ? (
            <CourseListView />
          ) : currentTab === 'attendance' ? (
            <AttendanceView />
          ) : currentTab === 'gradebook' ? (
            <GradebookView />
          ) : isStaff ? (
            <LecturerDashboard />
          ) : (
            <StudentDashboard
              onStartExam={handleStartExamForStudent}
              onViewResults={(exam, attempt) => {
                setViewingResult({ exam, attempt });
              }}
              onOpenCheatingBoard={() => setCurrentTab('cheating_board')}
            />
          )}
        </main>

        {/* Quiet Footer */}
        <footer className="bg-white border-t border-slate-200 py-4 px-6 text-xs text-slate-500">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
            <span>
              <strong>Sistem Manajemen Ujian (SMU)</strong> · Penilaian IRT &amp; Pengawasan Ujian
            </span>
            <span className="text-slate-400">
              Format Soal Aiken LMS · Kalibrasi Butir Soal IRT 1PL/2PL/3PL
            </span>
          </div>
        </footer>
      </div>

      {/* Global Modals */}
      <ViolationNotificationsModal
        isOpen={isViolationModalOpen}
        onClose={() => setIsViolationModalOpen(false)}
      />
      <ClassManagementModal
        isOpen={isClassModalOpen}
        onClose={() => setIsClassModalOpen(false)}
      />
      <UserManagementModal
        isOpen={isUserModalOpen}
        onClose={() => setIsUserModalOpen(false)}
        onOpenClassModal={() => {
          setIsUserModalOpen(false);
          setIsClassModalOpen(true);
        }}
      />
      <CourseFormModal
        isOpen={isCreateCourseModalOpen}
        onClose={() => setIsCreateCourseModalOpen(false)}
        onSaved={() => setCurrentTab('courses')}
      />
    </div>
  );
};

export default function App() {
  return (
    <ExamProvider>
      <AppContent />
    </ExamProvider>
  );
}
