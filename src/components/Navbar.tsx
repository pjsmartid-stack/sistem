import React from 'react';
import { useExam } from '../context/ExamContext';
import {
  ShieldAlert,
  LogOut,
  Bell,
  UserCheck,
  Eye,
  BookOpen,
  GraduationCap,
} from 'lucide-react';

interface NavbarProps {
  currentTab: 'exams' | 'courses' | 'cheating_board';
  onSelectTab: (tab: 'exams' | 'courses' | 'cheating_board') => void;
  onOpenNotifications?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onSelectTab,
  onOpenNotifications,
}) => {
  const { currentUser, logout, unreadViolationsCount, violations, courses } = useExam();

  if (!currentUser) return null;

  const isDosen = currentUser.role === 'dosen';

  return (
    <header
      id="main-app-header"
      className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-xs"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo & Name */}
          <div
            className="flex items-center gap-3 cursor-pointer"
            onClick={() => onSelectTab('exams')}
          >
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-sm shadow-blue-500/20">
              <ShieldAlert className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900 text-lg tracking-tight">
                  Sistem Manajemen Ujian
                </span>
                <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                  LMS + AI Proctor
                </span>
              </div>
              <p className="text-xs text-slate-500 hidden sm:block">
                Platform Ujian Daring Terintegrasi &amp; Deteksi Kecurangan Real-Time
              </p>
            </div>
          </div>

          {/* Navigation Links (Center / Right) */}
          <div className="flex items-center gap-1 sm:gap-2">
            {/* Tab: Ujian & Evaluasi */}
            <button
              id="btn-nav-exams"
              type="button"
              onClick={() => onSelectTab('exams')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all border ${
                currentTab === 'exams'
                  ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <GraduationCap className="w-4 h-4" />
              <span className="hidden md:inline">Ujian &amp; Jadwal</span>
              <span className="md:hidden">Ujian</span>
            </button>

            {/* Tab: Mata Kuliah & E-Learning */}
            <button
              id="btn-nav-courses"
              type="button"
              onClick={() => onSelectTab('courses')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all border ${
                currentTab === 'courses'
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                  : 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100'
              }`}
              title="Daftar Mata Kuliah, Jadwal Ujian & E-Learning"
            >
              <BookOpen className="w-4 h-4" />
              <span className="hidden md:inline">Mata Kuliah &amp; E-Learning</span>
              <span className="md:hidden">Mata Kuliah</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
                  currentTab === 'courses' ? 'bg-white text-indigo-700' : 'bg-indigo-200 text-indigo-900'
                }`}
              >
                {courses.length}
              </span>
            </button>

            {/* Public Cheating Report Board Button (Visible to both Mahasiswa and Dosen) */}
            <button
              id="btn-nav-cheating-board"
              type="button"
              onClick={() => onSelectTab('cheating_board')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all border ${
                currentTab === 'cheating_board'
                  ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                  : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
              }`}
              title="Papan Transparansi Pelanggaran & Kecurangan Mahasiswa"
            >
              <Eye className="w-4 h-4" />
              <span className="hidden md:inline">Papan Kecurangan</span>
              <span className="md:hidden">Kecurangan</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
                  currentTab === 'cheating_board' ? 'bg-white text-rose-700' : 'bg-rose-200 text-rose-800'
                }`}
              >
                {violations.length}
              </span>
            </button>

            {/* Lecturer Notification Bell */}
            {isDosen && (
              <button
                id="btn-lecturer-notifications"
                type="button"
                onClick={onOpenNotifications}
                className="relative p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                title="Laporan Pelanggaran AI"
              >
                <Bell className="w-5 h-5" />
                {unreadViolationsCount > 0 && (
                  <span className="absolute top-1 right-1 flex h-4 w-4">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-4 w-4 bg-rose-600 text-[10px] font-bold text-white items-center justify-center">
                      {unreadViolationsCount > 9 ? '9+' : unreadViolationsCount}
                    </span>
                  </span>
                )}
              </button>
            )}

            {/* User Profile Card */}
            <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
              <div className="w-8 h-8 rounded-full bg-slate-200 overflow-hidden flex items-center justify-center border border-slate-300">
                {currentUser.avatar ? (
                  <img
                    src={currentUser.avatar}
                    alt={currentUser.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <UserCheck className="w-4 h-4 text-slate-600" />
                )}
              </div>
              <div className="hidden lg:block text-left">
                <div className="text-xs font-semibold text-slate-900 leading-tight">
                  {currentUser.name}
                </div>
                <div className="text-[11px] text-slate-500">
                  {isDosen ? 'Dosen / Admin' : 'Mahasiswa'} • {currentUser.nimOrNip}
                </div>
              </div>
              <span
                className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                  isDosen
                    ? 'bg-purple-50 text-purple-700 border-purple-200'
                    : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                }`}
              >
                {isDosen ? 'Dosen' : 'Mahasiswa'}
              </span>
            </div>

            {/* Logout */}
            <button
              id="btn-logout"
              type="button"
              onClick={logout}
              className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors ml-1"
              title="Keluar"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
