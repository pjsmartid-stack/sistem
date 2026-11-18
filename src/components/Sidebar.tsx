import React, { useState } from 'react';
import { useExam } from '../context/ExamContext';
import {
  ShieldAlert,
  LogOut,
  Bell,
  UserCheck,
  Eye,
  BookOpen,
  GraduationCap,
  BarChart3,
  Layers,
  Users,
  Menu,
  X,
  Database,
  QrCode,
  Award,
  Plus,
} from 'lucide-react';

export type NavigationTab =
  | 'exams'
  | 'irt_analytics'
  | 'courses'
  | 'attendance'
  | 'gradebook'
  | 'cheating_board';

interface SidebarProps {
  currentTab: NavigationTab;
  onSelectTab: (tab: NavigationTab) => void;
  onOpenNotifications?: () => void;
  onOpenClassModal?: () => void;
  onOpenUserModal?: () => void;
  onOpenCreateCourseModal?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  onOpenNotifications,
  onOpenClassModal,
  onOpenUserModal,
  onOpenCreateCourseModal,
}) => {
  const {
    currentUser,
    logout,
    unreadViolationsCount,
    violations,
    courses,
    exams,
    classes,
    users,
    attendanceSessions,
    firebaseStatus,
    isFirebaseSyncing,
  } = useExam();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  if (!currentUser) return null;

  const isStaff = currentUser.role === 'admin' || currentUser.role === 'dosen';
  const isAdmin = currentUser.role === 'admin';

  const roleLabel =
    currentUser.role === 'admin'
      ? 'Administrator'
      : currentUser.role === 'dosen'
      ? 'Dosen Pengampu'
      : 'Mahasiswa';

  const handleNavClick = (tab: NavigationTab) => {
    onSelectTab(tab);
    setMobileMenuOpen(false);
  };

  const renderNavContent = () => (
    <div className="flex flex-col h-full justify-between bg-white">
      {/* Top Section: Brand + Vertical Menu */}
      <div className="flex-1 overflow-y-auto">
        {/* Brand Identity */}
        <div
          onClick={() => handleNavClick('exams')}
          className="px-5 py-5 border-b border-slate-200 flex items-center gap-3 cursor-pointer"
        >
          <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center text-white shrink-0">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="font-bold text-slate-900 text-sm tracking-tight truncate">
              SMU Portal Akademik
            </div>
            <div className="text-[11px] text-slate-500 truncate">
              IRT Scoring · E-Learning · Proctor
            </div>
          </div>
        </div>

        {/* Navigation Menu Stacked Top-to-Bottom */}
        <div className="p-3 space-y-6">
          <div className="space-y-1">
            <div className="px-3 py-1.5 text-[11px] font-semibold text-slate-400">
              Menu Utama
            </div>

            {/* 1. Dashboard Ujian & Jadwal */}
            <button
              id="btn-nav-exams"
              type="button"
              onClick={() => handleNavClick('exams')}
              className={`w-full px-3 py-2.5 rounded-lg text-xs font-semibold flex items-center justify-between transition-colors ${
                currentTab === 'exams'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              <span className="flex items-center gap-2.5 truncate">
                <GraduationCap className="w-4 h-4 shrink-0" />
                <span className="truncate">Dashboard &amp; Ujian</span>
              </span>
              <span
                className={`text-[11px] font-mono tabular-nums ${
                  currentTab === 'exams' ? 'text-blue-100' : 'text-slate-400'
                }`}
              >
                {exams.length}
              </span>
            </button>

            {/* 2. Sistem Penilaian Berbasis IRT */}
            <button
              id="btn-nav-irt"
              type="button"
              onClick={() => handleNavClick('irt_analytics')}
              className={`w-full px-3 py-2.5 rounded-lg text-xs font-semibold flex items-center justify-between transition-colors ${
                currentTab === 'irt_analytics'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              <span className="flex items-center gap-2.5 truncate">
                <BarChart3 className="w-4 h-4 shrink-0" />
                <span className="truncate">Penilaian &amp; Analisis IRT</span>
              </span>
              <span
                className={`text-[10px] font-mono tabular-nums ${
                  currentTab === 'irt_analytics' ? 'text-blue-100' : 'text-slate-400'
                }`}
              >
                3PL
              </span>
            </button>

            {/* 3. Mata Kuliah & E-Learning */}
            <button
              id="btn-nav-courses"
              type="button"
              onClick={() => handleNavClick('courses')}
              className={`w-full px-3 py-2.5 rounded-lg text-xs font-semibold flex items-center justify-between transition-colors ${
                currentTab === 'courses'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              <span className="flex items-center gap-2.5 truncate">
                <BookOpen className="w-4 h-4 shrink-0" />
                <span className="truncate">Mata Kuliah &amp; Kelas</span>
              </span>
              <span
                className={`text-[11px] font-mono tabular-nums ${
                  currentTab === 'courses' ? 'text-blue-100' : 'text-slate-400'
                }`}
              >
                {courses.length}
              </span>
            </button>

            {/* 4. Absensi Kelas & Mata Kuliah (QR Dinamis) */}
            <button
              id="btn-nav-attendance"
              type="button"
              onClick={() => handleNavClick('attendance')}
              className={`w-full px-3 py-2.5 rounded-lg text-xs font-semibold flex items-center justify-between transition-colors ${
                currentTab === 'attendance'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              <span className="flex items-center gap-2.5 truncate">
                <QrCode className="w-4 h-4 shrink-0" />
                <span className="truncate">Absensi Kelas &amp; MK</span>
              </span>
              <span
                className={`text-[11px] font-mono tabular-nums ${
                  currentTab === 'attendance' ? 'text-blue-100' : 'text-slate-400'
                }`}
              >
                {attendanceSessions.length}
              </span>
            </button>

            {/* 5. Daftar Nilai Kelas & Keseluruhan */}
            <button
              id="btn-nav-gradebook"
              type="button"
              onClick={() => handleNavClick('gradebook')}
              className={`w-full px-3 py-2.5 rounded-lg text-xs font-semibold flex items-center justify-between transition-colors ${
                currentTab === 'gradebook'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              <span className="flex items-center gap-2.5 truncate">
                <Award className="w-4 h-4 shrink-0" />
                <span className="truncate">Daftar Nilai Kelas</span>
              </span>
              <span
                className={`text-[10px] font-mono ${
                  currentTab === 'gradebook' ? 'text-blue-100' : 'text-slate-400'
                }`}
              >
                {isStaff ? 'Rekap' : 'Saya'}
              </span>
            </button>

            {/* 6. Papan Transparansi Kecurangan */}
            <button
              id="btn-nav-cheating-board"
              type="button"
              onClick={() => handleNavClick('cheating_board')}
              className={`w-full px-3 py-2.5 rounded-lg text-xs font-semibold flex items-center justify-between transition-colors ${
                currentTab === 'cheating_board'
                  ? 'bg-rose-600 text-white'
                  : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              <span className="flex items-center gap-2.5 truncate">
                <Eye className="w-4 h-4 shrink-0" />
                <span className="truncate">Papan Kecurangan</span>
              </span>
              <span
                className={`text-[11px] font-mono tabular-nums ${
                  currentTab === 'cheating_board' ? 'text-rose-100' : 'text-rose-600'
                }`}
              >
                {violations.length}
              </span>
            </button>
          </div>

          {/* Admin & Lecturer Management Tools */}
          {isStaff && (
            <div className="space-y-1 pt-3 border-t border-slate-100">
              <div className="px-3 py-1.5 text-[11px] font-semibold text-slate-400">
                {isAdmin ? 'Administrasi Akademik' : 'Manajemen Pengawasan'}
              </div>

              {onOpenCreateCourseModal && (
                <button
                  id="btn-sidebar-add-course"
                  type="button"
                  onClick={() => {
                    onOpenCreateCourseModal();
                    setMobileMenuOpen(false);
                  }}
                  className="w-full px-3 py-2.5 rounded-lg text-xs font-semibold text-blue-700 bg-blue-50/70 hover:bg-blue-100 flex items-center justify-between transition-colors"
                >
                  <span className="flex items-center gap-2.5 truncate">
                    <Plus className="w-4 h-4 text-blue-600 shrink-0" />
                    <span className="truncate">Tambah Mata Kuliah Baru</span>
                  </span>
                </button>
              )}

              {onOpenClassModal && (
                <button
                  id="btn-sidebar-classes"
                  type="button"
                  onClick={() => {
                    onOpenClassModal();
                    setMobileMenuOpen(false);
                  }}
                  className="w-full px-3 py-2.5 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 flex items-center justify-between transition-colors"
                >
                  <span className="flex items-center gap-2.5 truncate">
                    <Layers className="w-4 h-4 text-slate-500 shrink-0" />
                    <span className="truncate">Manajemen Kelas / Rombel</span>
                  </span>
                  <span className="text-[11px] font-mono tabular-nums text-slate-400">
                    {classes.length}
                  </span>
                </button>
              )}

              {onOpenUserModal && (
                <button
                  id="btn-sidebar-users"
                  type="button"
                  onClick={() => {
                    onOpenUserModal();
                    setMobileMenuOpen(false);
                  }}
                  className="w-full px-3 py-2.5 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 flex items-center justify-between transition-colors"
                >
                  <span className="flex items-center gap-2.5 truncate">
                    <Users className="w-4 h-4 text-slate-500 shrink-0" />
                    <span className="truncate">Data Pengguna</span>
                  </span>
                  <span className="text-[11px] font-mono tabular-nums text-slate-400">
                    {users.length}
                  </span>
                </button>
              )}

              {onOpenNotifications && (
                <button
                  id="btn-lecturer-notifications"
                  type="button"
                  onClick={() => {
                    onOpenNotifications();
                    setMobileMenuOpen(false);
                  }}
                  className="w-full px-3 py-2.5 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 flex items-center justify-between transition-colors"
                >
                  <span className="flex items-center gap-2.5 truncate">
                    <Bell className="w-4 h-4 text-slate-500 shrink-0" />
                    <span className="truncate">Insiden AI Proctor</span>
                  </span>
                  {unreadViolationsCount > 0 ? (
                    <span className="px-1.5 py-0.5 rounded bg-rose-600 text-white text-[10px] font-mono tabular-nums font-bold">
                      {unreadViolationsCount}
                    </span>
                  ) : (
                    <span className="text-[11px] font-mono tabular-nums text-slate-400">0</span>
                  )}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Bottom Section: User Profile & Logout */}
      <div className="p-4 border-t border-slate-200 bg-slate-50/70 space-y-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-full bg-slate-200 overflow-hidden flex items-center justify-center border border-slate-300 shrink-0">
            {currentUser.avatar ? (
              <img
                src={currentUser.avatar}
                alt={currentUser.name}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            ) : (
              <UserCheck className="w-4 h-4 text-slate-600" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-bold text-slate-900 truncate">
              {currentUser.name}
            </div>
            <div className="text-[11px] text-slate-500 truncate">
              {roleLabel} · <span className="font-mono">{currentUser.nimOrNip}</span>
            </div>
          </div>
        </div>

        {/* Firebase Live Cloud Database Status */}
        <div className="px-2.5 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200/80 flex items-center justify-between text-[11px]">
          <span className="flex items-center gap-1.5 text-emerald-800 font-semibold truncate">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
            <span className="truncate">Firebase Cloud Aktif</span>
          </span>
          <span className="text-[10px] text-emerald-600 font-mono shrink-0 ml-1">
            {isFirebaseSyncing ? 'Sync...' : 'Real-time'}
          </span>
        </div>

        <button
          id="btn-logout"
          type="button"
          onClick={logout}
          className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 text-slate-700 text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          <span>Keluar Sesi</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Header Bar (only visible on small screens < lg) */}
      <div className="lg:hidden sticky top-0 z-40 bg-white border-b border-slate-200 px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            className="p-2 -ml-2 rounded-lg text-slate-700 hover:bg-slate-100"
            aria-label="Buka Navigasi"
          >
            <Menu className="w-5 h-5" />
          </button>
          <span className="font-bold text-slate-900 text-sm truncate">
            SMU Portal Akademik
          </span>
        </div>

        <div className="text-xs text-slate-500 truncate max-w-[140px]">
          {currentUser.name}
        </div>
      </div>

      {/* Mobile Drawer Overlay */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-slate-900/50"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative w-72 max-w-[85vw] h-full bg-white shadow-xl flex flex-col z-10">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              aria-label="Tutup Navigasi"
            >
              <X className="w-4 h-4" />
            </button>
            {renderNavContent()}
          </aside>
        </div>
      )}

      {/* Desktop Fixed Left Sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:shrink-0 border-r border-slate-200 bg-white sticky top-0 h-screen">
        {renderNavContent()}
      </aside>
    </>
  );
};
