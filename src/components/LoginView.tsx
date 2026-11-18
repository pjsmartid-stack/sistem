import React, { useState } from 'react';
import { useExam } from '../context/ExamContext';
import {
  ShieldAlert,
  GraduationCap,
  Mail,
  Lock,
  Eye,
  EyeOff,
  UserPlus,
  LogIn,
  CheckCircle2,
  FileText,
  Clock,
  Award,
  Database,
  Info,
} from 'lucide-react';

export const LoginView: React.FC = () => {
  const { loginWithEmail, isFirebaseSyncing } = useExam();

  // Unified login state (Pre-filled with primary admin account pjsmartid@gmail.com / 12345)
  const [email, setEmail] = useState('pjsmartid@gmail.com');
  const [password, setPassword] = useState('12345');
  const [showPassword, setShowPassword] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!email.trim() || !password.trim()) {
      setErrorMessage('Alamat email dan kata sandi wajib diisi.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await loginWithEmail(email.trim(), password);
      if (!res.success) {
        setErrorMessage(res.error || 'Gagal masuk. Periksa kembali email dan sandi Anda.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Terjadi kesalahan saat menghubungkan ke Firebase.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-10 sm:px-6 lg:px-8">
      {/* Brand Header */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-500/25 mb-4">
          <ShieldAlert className="w-9 h-9" />
        </div>
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
          Sistem Manajemen Ujian
        </h1>
        <p className="mt-2 text-sm text-slate-600 max-w-sm mx-auto">
          Portal LMS Ujian Daring Terintegrasi dengan Pengawas AI &amp; E-Learning Mata Kuliah
        </p>
        <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <Database className="w-3 h-3 text-emerald-600" />
          <span>Terhubung ke Firebase Firestore</span>
        </div>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 sm:px-10 shadow-xl shadow-slate-200/50 sm:rounded-2xl border border-slate-200 space-y-6">
          {/* Header & Policy Notice */}
          <div className="border-b border-slate-100 pb-4">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <LogIn className="w-5 h-5 text-blue-600" />
              Masuk ke Akun Anda
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Gunakan email terdaftar (Mahasiswa, Dosen, atau Administrator).
            </p>
          </div>

          {/* Alerts */}
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
              {errorMessage}
            </div>
          )}

          {/* Form: LOGIN ONLY */}
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="input-email"
                className="block text-xs font-bold text-slate-700 mb-1"
              >
                Alamat Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  id="input-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="pjsmartid@gmail.com / email mahasiswa"
                  className="w-full pl-9 pr-3.5 py-2.5 text-xs sm:text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-slate-50 focus:bg-white"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label
                  htmlFor="input-password"
                  className="block text-xs font-bold text-slate-700"
                >
                  Kata Sandi
                </label>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  id="input-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Masukkan kata sandi"
                  className="w-full pl-9 pr-10 py-2.5 text-xs sm:text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-slate-50 focus:bg-white"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              id="btn-submit-login"
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 px-4 rounded-xl font-bold text-xs sm:text-sm text-white bg-blue-600 hover:bg-blue-700 shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {isLoading ? (
                <span>Menghubungkan ke Firebase...</span>
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  <span>Masuk ke Sistem</span>
                </>
              )}
            </button>
          </form>

          {/* Admin Policy Notice */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5 text-xs text-slate-600">
            <div className="flex items-center gap-2 font-bold text-slate-800">
              <Info className="w-4 h-4 text-blue-600 shrink-0" />
              <span>Ketentuan Pendaftaran Mahasiswa:</span>
            </div>
            <p className="text-[11px] leading-relaxed text-slate-500">
              Pendaftaran akun mahasiswa baru dikelola secara terpusat oleh <strong>Administrator</strong>. Mahasiswa tidak melakukan registrasi mandiri di layar awal. Silakan hubungi bagian akademik/administrator untuk mendapatkan akun ujian.
            </p>
          </div>

          {/* Key Features Overview */}
          <div className="pt-4 border-t border-slate-200 grid grid-cols-2 gap-3 text-left">
            <div className="flex items-start gap-2">
              <Eye className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
              <div>
                <div className="text-xs font-semibold text-slate-800">AI Proctoring</div>
                <div className="text-[11px] text-slate-500">Kunci layar &amp; bukti screenshot</div>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <FileText className="w-4 h-4 text-purple-600 mt-0.5 shrink-0" />
              <div>
                <div className="text-xs font-semibold text-slate-800">E-Learning</div>
                <div className="text-[11px] text-slate-500">Materi PDF/PPT &amp; Video YouTube</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
