import { User, Exam, ExamAttempt, ViolationLog, ClassGroup, Course } from '../types';

// Akun Admin Utama
export const INITIAL_USERS: User[] = [
  {
    id: 'admin-pjsmartid',
    name: 'Administrator Ujian',
    nimOrNip: '198501012010011001',
    role: 'admin',
    email: 'pjsmartid@gmail.com',
    department: 'Administrasi Sistem & Teknologi Informasi',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=pjsmartid',
  },
];

// Pengelompokan Kelas Awal (kosongkan sesuai instruksi, biarkan admin yang menambahkan)
export const INITIAL_CLASSES: ClassGroup[] = [];

// Mata Kuliah & E-Learning Portal Awal (kosongkan, biarkan admin yang menambahkan)
export const INITIAL_COURSES: Course[] = [];

// Kosongkan seluruh data ujian demo sesuai instruksi
export const INITIAL_EXAMS: Exam[] = [];

// Kosongkan seluruh rekaman insiden pelanggaran
export const INITIAL_VIOLATIONS: ViolationLog[] = [];

// Kosongkan seluruh lembar pengerjaan mahasiswa demo
export const INITIAL_ATTEMPTS: ExamAttempt[] = [];
