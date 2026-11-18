import React, { useMemo, useState } from 'react';
import { useExam } from '../../context/ExamContext';
import { Role, User } from '../../types';
import {
  Search,
  Check,
  UserPlus,
  Users,
  GraduationCap,
  BookOpen,
  ShieldCheck,
  AlertCircle,
  Loader2,
  X,
} from 'lucide-react';

interface CourseUserPickerProps {
  selectedUserIds: string[];
  onChange: (nextIds: string[]) => void;
  assignedClassIds?: string[];
  primaryLecturerId?: string;
  compactHeightClass?: string;
}

export const CourseUserPicker: React.FC<CourseUserPickerProps> = ({
  selectedUserIds,
  onChange,
  assignedClassIds = [],
  primaryLecturerId,
  compactHeightClass = 'max-h-64',
}) => {
  const { users, classes, addUser } = useExam();

  const [roleFilter, setRoleFilter] = useState<'all' | Role>('all');
  const [classFilter, setClassFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Quick-create new user inline so every user can be created & added directly
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [qaName, setQaName] = useState('');
  const [qaEmail, setQaEmail] = useState('');
  const [qaRole, setQaRole] = useState<Role>('mahasiswa');
  const [qaNimOrNip, setQaNimOrNip] = useState('');
  const [qaDepartment, setQaDepartment] = useState('Teknik Informatika');
  const [qaClassId, setQaClassId] = useState('');
  const [qaSaving, setQaSaving] = useState(false);
  const [qaError, setQaError] = useState<string | null>(null);

  const selectedSet = useMemo(() => new Set(selectedUserIds), [selectedUserIds]);
  const assignedClassSet = useMemo(() => new Set(assignedClassIds), [assignedClassIds]);

  const roleCounts = useMemo(() => {
    return {
      all: users.length,
      mahasiswa: users.filter((u) => u.role === 'mahasiswa').length,
      dosen: users.filter((u) => u.role === 'dosen').length,
      admin: users.filter((u) => u.role === 'admin').length,
    };
  }, [users]);

  const filteredUsers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return users
      .filter((u) => {
        if (roleFilter !== 'all' && u.role !== roleFilter) return false;
        if (classFilter !== 'all') {
          if (classFilter === '__no_class__') {
            if (u.classId) return false;
          } else if (u.classId !== classFilter) {
            return false;
          }
        }
        if (!q) return true;
        return (
          u.name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          u.nimOrNip.toLowerCase().includes(q) ||
          (u.department || '').toLowerCase().includes(q) ||
          (u.className || '').toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        const aSel = selectedSet.has(a.id) ? 0 : 1;
        const bSel = selectedSet.has(b.id) ? 0 : 1;
        if (aSel !== bSel) return aSel - bSel;
        return a.name.localeCompare(b.name);
      });
  }, [users, roleFilter, classFilter, searchQuery, selectedSet]);

  const selectedBreakdown = useMemo(() => {
    let mhs = 0;
    let staff = 0;
    users.forEach((u) => {
      if (!selectedSet.has(u.id)) return;
      if (u.role === 'mahasiswa') mhs += 1;
      else staff += 1;
    });
    return { total: selectedUserIds.length, mhs, staff };
  }, [users, selectedSet, selectedUserIds.length]);

  const toggleUser = (uid: string) => {
    if (selectedSet.has(uid)) {
      onChange(selectedUserIds.filter((id) => id !== uid));
    } else {
      onChange([...selectedUserIds, uid]);
    }
  };

  const handleSelectFiltered = () => {
    const merged = new Set(selectedUserIds);
    filteredUsers.forEach((u) => merged.add(u.id));
    onChange(Array.from(merged));
  };

  const handleClearFiltered = () => {
    const filteredSet = new Set(filteredUsers.map((u) => u.id));
    onChange(selectedUserIds.filter((id) => !filteredSet.has(id)));
  };

  const handleQuickAddUser = async () => {
    setQaError(null);
    if (!qaName.trim() || !qaEmail.trim() || !qaNimOrNip.trim()) {
      setQaError('Nama lengkap, email, dan NIM/NIP wajib diisi.');
      return;
    }

    const dupEmail = users.some(
      (u) => u.email.toLowerCase() === qaEmail.trim().toLowerCase()
    );
    if (dupEmail) {
      setQaError('Email tersebut sudah terdaftar pada sistem.');
      return;
    }

    setQaSaving(true);
    try {
      const cls = classes.find((c) => c.id === qaClassId);
      const created: User = await addUser({
        name: qaName.trim(),
        email: qaEmail.trim(),
        role: qaRole,
        nimOrNip: qaNimOrNip.trim(),
        department: qaDepartment.trim() || 'Umum',
        classId: qaRole === 'mahasiswa' && cls ? cls.id : undefined,
        className: qaRole === 'mahasiswa' && cls ? cls.name : undefined,
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(
          qaName.trim()
        )}`,
      });
      onChange(Array.from(new Set([...selectedUserIds, created.id])));
      setQaName('');
      setQaEmail('');
      setQaNimOrNip('');
      setShowQuickAdd(false);
    } catch (err: any) {
      setQaError(err?.message || 'Gagal menambahkan pengguna baru.');
    } finally {
      setQaSaving(false);
    }
  };

  const roleBadgeText = (role: Role) => {
    if (role === 'admin') return 'Admin';
    if (role === 'dosen') return 'Dosen';
    return 'Mahasiswa';
  };

  return (
    <div className="space-y-3 border border-slate-200 rounded-xl p-3.5 bg-slate-50/70">
      {/* Header & Summary */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
            <Users className="w-4 h-4 text-blue-600" />
            <span>Tambahkan Pengguna ke Mata Kuliah (Semua Peran)</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Terpilih{' '}
            <span className="font-mono tabular-nums font-bold text-slate-800">
              {selectedBreakdown.total}
            </span>{' '}
            pengguna ({selectedBreakdown.mhs} Mahasiswa · {selectedBreakdown.staff} Dosen/Admin).
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setShowQuickAdd((prev) => !prev);
            setQaError(null);
          }}
          className="px-2.5 py-1.5 rounded-lg border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-700 text-[11px] font-semibold inline-flex items-center gap-1 transition-colors"
        >
          {showQuickAdd ? <X className="w-3.5 h-3.5" /> : <UserPlus className="w-3.5 h-3.5" />}
          <span>{showQuickAdd ? 'Tutup Form Pengguna' : '+ Buat & Tambah Pengguna Baru'}</span>
        </button>
      </div>

      {/* Inline Quick Create & Enroll User */}
      {showQuickAdd && (
        <div className="bg-white border border-blue-200 rounded-xl p-3 space-y-2.5 text-xs">
          <div className="font-bold text-slate-800 flex items-center gap-1.5">
            <UserPlus className="w-3.5 h-3.5 text-blue-600" />
            <span>Daftarkan Pengguna Baru &amp; Langsung Tambahkan</span>
          </div>

          {qaError && (
            <div className="p-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-[11px] flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{qaError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">
                Peran
              </label>
              <select
                value={qaRole}
                onChange={(e) => setQaRole(e.target.value as Role)}
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="mahasiswa">Mahasiswa</option>
                <option value="dosen">Dosen</option>
                <option value="admin">Administrator</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">
                Nama Lengkap *
              </label>
              <input
                type="text"
                value={qaName}
                onChange={(e) => setQaName(e.target.value)}
                placeholder="Nama lengkap pengguna..."
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">
                Email *
              </label>
              <input
                type="email"
                value={qaEmail}
                onChange={(e) => setQaEmail(e.target.value)}
                placeholder="email@kampus.ac.id"
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">
                {qaRole === 'mahasiswa' ? 'NIM *' : 'NIP / ID *'}
              </label>
              <input
                type="text"
                value={qaNimOrNip}
                onChange={(e) => setQaNimOrNip(e.target.value)}
                placeholder={qaRole === 'mahasiswa' ? '2301001' : '19850101...'}
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">
                Program Studi
              </label>
              <input
                type="text"
                value={qaDepartment}
                onChange={(e) => setQaDepartment(e.target.value)}
                placeholder="Teknik Informatika"
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            {qaRole === 'mahasiswa' && classes.length > 0 ? (
              <select
                value={qaClassId}
                onChange={(e) => setQaClassId(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-[11px]"
              >
                <option value="">Tanpa Rombel Kelas (Individu)</option>
                {classes.map((cls) => (
                  <option key={cls.id} value={cls.id}>
                    Kelas {cls.name} ({cls.code})
                  </option>
                ))}
              </select>
            ) : (
              <span className="text-[11px] text-slate-500">
                Pengguna langsung tersimpan di Firebase &amp; otomatis tercentang.
              </span>
            )}

            <button
              type="button"
              onClick={handleQuickAddUser}
              disabled={qaSaving}
              className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-[11px] inline-flex items-center gap-1.5 disabled:opacity-50"
            >
              {qaSaving && <Loader2 className="w-3 h-3 animate-spin" />}
              <span>{qaSaving ? 'Menyimpan...' : 'Simpan & Tambahkan'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari nama, NIM/NIP, email, atau kelas..."
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {classes.length > 0 && (
          <select
            value={classFilter}
            onChange={(e) => setClassFilter(e.target.value)}
            className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Semua Kelas</option>
            <option value="__no_class__">Tanpa Kelas</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Role Filter Segmented Control + Bulk Actions */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 text-[11px]">
          {(
            [
              { id: 'all', label: `Semua (${roleCounts.all})` },
              { id: 'mahasiswa', label: `Mahasiswa (${roleCounts.mahasiswa})` },
              { id: 'dosen', label: `Dosen (${roleCounts.dosen})` },
              { id: 'admin', label: `Admin (${roleCounts.admin})` },
            ] as { id: 'all' | Role; label: string }[]
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setRoleFilter(tab.id)}
              className={`px-2.5 py-1 rounded-md font-semibold transition-colors ${
                roleFilter === tab.id
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 text-[11px]">
          <button
            type="button"
            onClick={handleSelectFiltered}
            disabled={filteredUsers.length === 0}
            className="px-2.5 py-1 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-semibold disabled:opacity-40"
          >
            Pilih Semua ({filteredUsers.length})
          </button>
          <button
            type="button"
            onClick={handleClearFiltered}
            disabled={selectedUserIds.length === 0}
            className="px-2.5 py-1 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-600 font-semibold disabled:opacity-40"
          >
            Kosongkan
          </button>
        </div>
      </div>

      {/* Checklist */}
      <div
        className={`bg-white border border-slate-200 rounded-xl overflow-y-auto divide-y divide-slate-100 ${compactHeightClass}`}
      >
        {filteredUsers.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400">
            Tidak ada pengguna yang cocok dengan filter saat ini.
          </div>
        ) : (
          filteredUsers.map((user) => {
            const isChecked = selectedSet.has(user.id);
            const isViaClass = Boolean(user.classId && assignedClassSet.has(user.classId));
            const isPrimaryLecturer = primaryLecturerId === user.id;

            return (
              <label
                key={user.id}
                className={`px-3 py-2.5 flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                  isChecked ? 'bg-blue-50/60 hover:bg-blue-50' : 'hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleUser(user.id)}
                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 shrink-0"
                  />
                  <div className="w-7 h-7 rounded-full bg-slate-200 overflow-hidden shrink-0 flex items-center justify-center text-[11px] font-bold text-slate-700 border border-slate-300">
                    {user.avatar ? (
                      <img
                        src={user.avatar}
                        alt={user.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      user.name.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-900 truncate flex items-center gap-1.5">
                      <span className="truncate">{user.name}</span>
                      {isPrimaryLecturer && (
                        <span className="text-[10px] font-semibold text-blue-700 shrink-0">
                          · Pengampu Utama
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-500 truncate flex items-center gap-1">
                      <span className="inline-flex items-center gap-1 font-medium text-slate-700">
                        {user.role === 'mahasiswa' ? (
                          <GraduationCap className="w-3 h-3 text-blue-600" />
                        ) : user.role === 'dosen' ? (
                          <BookOpen className="w-3 h-3 text-purple-600" />
                        ) : (
                          <ShieldCheck className="w-3 h-3 text-emerald-600" />
                        )}
                        {roleBadgeText(user.role)}
                      </span>
                      <span>·</span>
                      <span className="font-mono">{user.nimOrNip}</span>
                      {user.className && (
                        <>
                          <span>·</span>
                          <span>{user.className}</span>
                        </>
                      )}
                      <span>·</span>
                      <span className="truncate">{user.email}</span>
                    </div>
                  </div>
                </div>

                <div className="shrink-0 flex items-center gap-1.5">
                  {isViaClass && !isChecked && (
                    <span className="text-[10px] font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                      Via Kelas
                    </span>
                  )}
                  {isChecked && (
                    <span className="text-[10px] font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded inline-flex items-center gap-1">
                      <Check className="w-3 h-3" />
                      Terdaftar
                    </span>
                  )}
                </div>
              </label>
            );
          })
        )}
      </div>

      {/* Explanatory Note */}
      <p className="text-[11px] text-slate-500 leading-relaxed">
        {selectedBreakdown.mhs === 0 && assignedClassIds.length === 0
          ? 'Catatan: Jika belum ada mahasiswa maupun kelas yang dipilih, mata kuliah bersifat terbuka untuk seluruh mahasiswa. Centang pengguna tertentu atau pilih semua untuk mendaftarkan peserta secara eksplisit.'
          : 'Pengguna yang dicentang (bersama anggota kelas rombel terpilih) otomatis terdaftar dan dapat mengakses mata kuliah, absensi, tugas projek, serta daftar nilai.'}
      </p>
    </div>
  );
};
