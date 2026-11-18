import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import {
  User,
  Exam,
  ExamAttempt,
  ViolationLog,
  ExamStatus,
  ClassGroup,
  ClassFile,
  Course,
  CourseMaterial,
  CourseAssignment,
  CourseAssignmentSubmission,
  CourseVideo,
  CourseTopic,
  CourseContentBlock,
  PeerProjectAssignment,
  PeerProjectSubmission,
  PeerReviewEntry,
  LecturerPeerOverrideMode,
  CheatingPenaltyTier,
  IRTModel,
  ScoringMethod,
  AttendanceSession,
  AttendanceRecord,
  AttendanceStatus,
  GradeConfig,
} from '../types';
import { createDefaultGradeConfig } from '../utils/gradebook';
import {
  allocateBalancedPeerReviewers,
  computePeerSubmissionMetrics,
} from '../utils/peerAssessment';
import {
  calibrateExamItems,
  calculateAttemptIRTScore,
} from '../utils/irtScoring';
import {
  INITIAL_USERS,
  INITIAL_EXAMS,
  INITIAL_VIOLATIONS,
  INITIAL_ATTEMPTS,
  INITIAL_CLASSES,
  INITIAL_COURSES,
} from '../data/initialData';
import { auth, db, testFirestoreConnection, cleanFirestoreData, handleFirestoreError, OperationType, FIRESTORE_DATABASE_ID } from '../lib/firebase';
import { deleteStoredFile } from '../lib/fileStorage';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth';
import {
  collection,
  doc,
  getDocs,
  getDocFromServer,
  setDoc,
  deleteDoc,
  updateDoc,
  deleteField,
  onSnapshot,
  query,
  where,
} from 'firebase/firestore';

interface ExamContextType {
  currentUser: User | null;
  users: User[];
  login: (user: User) => void;
  loginWithEmail: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  registerWithEmail: (
    userData: Omit<User, 'id'>,
    password: string
  ) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;

  // Class Management (Pengelompokan Kelas)
  classes: ClassGroup[];
  addClass: (classData: Omit<ClassGroup, 'id' | 'createdAt'>) => Promise<ClassGroup>;
  updateClass: (classData: ClassGroup) => Promise<void>;
  deleteClass: (id: string) => Promise<void>;
  addClassFile: (classId: string, fileData: Omit<ClassFile, 'id' | 'classId' | 'uploadedAt'>) => Promise<ClassFile>;
  deleteClassFile: (classId: string, fileEntryId: string) => Promise<void>;

  // User Management
  addUser: (userData: Omit<User, 'id'>) => Promise<User>;
  updateUser: (user: User) => Promise<void>;
  deleteUser: (id: string) => Promise<void>;

  // Course Management & E-Learning
  courses: Course[];
  addCourse: (courseData: Omit<Course, 'id' | 'createdAt' | 'materials' | 'assignments' | 'videos'>) => Promise<Course>;
  updateCourse: (course: Course) => Promise<void>;
  deleteCourse: (id: string) => Promise<void>;
  updateCourseEnrolledUsers: (courseId: string, enrolledUserIds: string[]) => Promise<void>;
  syncUserCourseEnrollments: (userId: string, selectedCourseIds: string[]) => Promise<void>;
  addMaterial: (courseId: string, material: Omit<CourseMaterial, 'id' | 'courseId' | 'uploadedAt'>) => Promise<void>;
  deleteMaterial: (courseId: string, materialId: string) => Promise<void>;
  addAssignment: (courseId: string, assignment: Omit<CourseAssignment, 'id' | 'courseId' | 'createdAt' | 'submissions'>) => Promise<void>;
  updateAssignment: (courseId: string, assignment: CourseAssignment) => Promise<void>;
  deleteAssignment: (courseId: string, assignmentId: string) => Promise<void>;
  submitAssignment: (courseId: string, assignmentId: string, submission: Omit<CourseAssignmentSubmission, 'id' | 'courseId' | 'assignmentId' | 'submittedAt'>) => Promise<void>;
  gradeAssignmentSubmission: (courseId: string, assignmentId: string, submissionId: string, grade: number, feedback?: string) => Promise<void>;
  addVideo: (courseId: string, video: Omit<CourseVideo, 'id' | 'courseId' | 'addedAt'>) => Promise<void>;
  deleteVideo: (courseId: string, videoId: string) => Promise<void>;

  // Moodle Topics & Text/Image Blocks
  addCourseTopic: (courseId: string, topic: Omit<CourseTopic, 'id' | 'courseId' | 'createdAt'>) => Promise<CourseTopic>;
  updateCourseTopic: (courseId: string, topic: CourseTopic) => Promise<void>;
  deleteCourseTopic: (courseId: string, topicId: string) => Promise<void>;
  addTopicBlock: (courseId: string, block: Omit<CourseContentBlock, 'id' | 'courseId' | 'createdAt'>) => Promise<CourseContentBlock>;
  updateTopicBlock: (courseId: string, block: CourseContentBlock) => Promise<void>;
  deleteTopicBlock: (courseId: string, blockId: string) => Promise<void>;

  // Tugas Projek Mahasiswa (Peer Assessment)
  addPeerProject: (courseId: string, project: Omit<PeerProjectAssignment, 'id' | 'courseId' | 'createdAt' | 'submissions'>) => Promise<PeerProjectAssignment>;
  updatePeerProject: (courseId: string, project: PeerProjectAssignment) => Promise<void>;
  deletePeerProject: (courseId: string, projectId: string) => Promise<void>;
  submitPeerProject: (
    courseId: string,
    projectId: string,
    submission: Omit<
      PeerProjectSubmission,
      'id' | 'courseId' | 'projectId' | 'submittedAt' | 'assignedReviewerIds' | 'peerReviews'
    >
  ) => Promise<void>;
  assignPeerReviewers: (courseId: string, projectId: string, forceReassign?: boolean) => Promise<void>;
  submitPeerReview: (
    courseId: string,
    projectId: string,
    submissionId: string,
    review: Omit<PeerReviewEntry, 'id' | 'submittedAt'>
  ) => Promise<void>;
  submitLecturerPeerGrade: (
    courseId: string,
    projectId: string,
    submissionId: string,
    lecturerScore: number,
    lecturerMode: LecturerPeerOverrideMode,
    lecturerFeedback?: string
  ) => Promise<void>;

  // Exam Management
  exams: Exam[];
  addExam: (exam: Omit<Exam, 'id' | 'createdAt'>) => Promise<Exam>;
  updateExam: (exam: Exam) => Promise<void>;
  assignExamToTopic: (
    examId: string,
    placement: {
      courseId?: string;
      courseCode?: string;
      courseName?: string;
      topicId?: string;
    }
  ) => Promise<void>;
  deleteExam: (id: string) => Promise<void>;
  toggleScoreAnnouncement: (examId: string, showImmediately: boolean) => Promise<void>;
  publishScores: (examId: string) => Promise<void>;
  recalibrateExamScores: (examId: string, overrideMethod?: ScoringMethod, overrideModel?: IRTModel) => Promise<void>;

  // Attempts Management
  attempts: ExamAttempt[];
  getAttempt: (examId: string, studentId: string) => ExamAttempt | undefined;
  syncAttemptFromServer: (examId: string, studentId: string) => Promise<ExamAttempt | undefined>;
  getExamAttemptRemainingSeconds: (exam: Exam, attempt: ExamAttempt) => number;
  startAttempt: (examId: string, student: User) => ExamAttempt;
  saveAnswer: (attemptId: string, questionId: string, option: string, isFlagged?: boolean) => void;
  toggleFlagAnswer: (attemptId: string, questionId: string) => void;
  submitAttempt: (attemptId: string, isTimedOut?: boolean) => ExamAttempt | undefined;

  // AI Proctoring Violations
  violations: ViolationLog[];
  unreadViolationsCount: number;
  recordViolation: (
    data: Omit<ViolationLog, 'id' | 'timestamp' | 'reviewedByLecturer'>
  ) => ViolationLog;
  markViolationReviewed: (violationId: string) => void;
  markAllViolationsReviewed: () => void;
  deleteViolation: (violationId: string) => Promise<void>;
  clearViolations: (examId?: string) => Promise<void>;

  // Attendance & Gradebook Management
  attendanceSessions: AttendanceSession[];
  createAttendanceSession: (
    data: Omit<
      AttendanceSession,
      'id' | 'createdAt' | 'records' | 'currentQrToken' | 'previousQrToken' | 'qrUpdatedAt'
    >
  ) => Promise<AttendanceSession>;
  updateAttendanceSession: (session: AttendanceSession) => Promise<void>;
  deleteAttendanceSession: (sessionId: string) => Promise<void>;
  rotateAttendanceQrToken: (sessionId: string) => Promise<string>;
  submitStudentAttendance: (params: {
    sessionId: string;
    scannedToken: string;
    status: AttendanceStatus;
    note?: string;
  }) => Promise<AttendanceRecord>;
  editAttendanceRecord: (
    sessionId: string,
    student: User,
    status: AttendanceStatus,
    note?: string
  ) => Promise<AttendanceRecord>;
  gradeConfigs: GradeConfig[];
  saveGradeConfig: (config: GradeConfig) => Promise<void>;

  // Helpers
  getExamTimeStatus: (exam: Exam) => {
    status: ExamStatus;
    canAccess: boolean;
    label: string;
    message: string;
  };
  isFirebaseSyncing: boolean;
  firebaseStatus: 'connected' | 'syncing' | 'offline' | 'error';
  lastFirebaseSyncTime: string | null;
  firestoreDbName: string;
  forceSyncFirebase: () => Promise<void>;
}

const ExamContext = createContext<ExamContextType | undefined>(undefined);

const STORAGE_KEYS = {
  USER: 'smu_current_user_v2',
  USERS: 'smu_users_cache_v2',
  CLASSES: 'smu_classes_v2',
  COURSES: 'smu_courses_v2',
  EXAMS: 'smu_exams_v2',
  UNSYNCED_EXAMS: 'smu_unsynced_exam_ids_v2',
  DELETED_EXAMS: 'smu_deleted_exam_ids_v2',
  ATTEMPTS: 'smu_attempts_v2',
  VIOLATIONS: 'smu_violations_v2',
  ATTENDANCE: 'smu_attendance_v2',
  GRADE_CONFIGS: 'smu_grade_configs_v2',
};

function readStoredIdSet(key: string): Set<string> {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? new Set(parsed.map(String)) : new Set();
  } catch {
    return new Set();
  }
}

function writeStoredIdSet(key: string, set: Set<string>) {
  try {
    localStorage.setItem(key, JSON.stringify(Array.from(set)));
  } catch {}
}

// Purge old demo storage keys from v1
try {
  localStorage.removeItem('smu_current_user');
  localStorage.removeItem('smu_users_cache');
  localStorage.removeItem('smu_exams');
  localStorage.removeItem('smu_attempts');
  localStorage.removeItem('smu_violations');
} catch (e) {}

export const ExamProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.USER);
    if (!saved) return null;
    const parsed = JSON.parse(saved);
    // If it was an old demo user, clear it
    if (parsed.id === 'dosen-1' || parsed.id?.startsWith('mhs-')) {
      return null;
    }
    return parsed;
  });

  const [users, setUsers] = useState<User[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.USERS);
    if (!saved) return INITIAL_USERS;
    const parsed = JSON.parse(saved) as User[];
    // Filter out any old demo users
    const filtered = parsed.filter(
      (u) => u.id !== 'dosen-1' && !u.id.startsWith('mhs-')
    );
    return filtered.length > 0 ? filtered : INITIAL_USERS;
  });

  const DEMO_CLASS_IDS = ['class-ti-3a', 'class-ti-3b', 'class-si-2a'];
  const DEMO_COURSE_IDS = ['course-pw-301', 'course-bd-202'];

  const [classes, setClasses] = useState<ClassGroup[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.CLASSES);
    if (!saved) return INITIAL_CLASSES;
    try {
      const parsed = JSON.parse(saved) as ClassGroup[];
      return parsed.filter((c) => !DEMO_CLASS_IDS.includes(c.id));
    } catch {
      return INITIAL_CLASSES;
    }
  });

  const [exams, setExams] = useState<Exam[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.EXAMS);
    if (!saved) return INITIAL_EXAMS;
    const parsed = JSON.parse(saved) as Exam[];
    const filtered = parsed.filter((e) => !e.id.startsWith('exam-0'));
    return filtered;
  });

  const [attempts, setAttempts] = useState<ExamAttempt[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.ATTEMPTS);
    if (!saved) return INITIAL_ATTEMPTS;
    const parsed = JSON.parse(saved) as ExamAttempt[];
    return parsed.filter((a) => !a.id.includes('mhs2'));
  });

  const [violations, setViolations] = useState<ViolationLog[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.VIOLATIONS);
    if (!saved) return INITIAL_VIOLATIONS;
    const parsed = JSON.parse(saved) as ViolationLog[];
    return parsed.filter((v) => v.id !== 'v-1' && v.id !== 'v-2');
  });

  const [courses, setCourses] = useState<Course[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.COURSES);
    if (!saved) return INITIAL_COURSES;
    try {
      const parsed = JSON.parse(saved) as Course[];
      return parsed.filter((c) => !DEMO_COURSE_IDS.includes(c.id));
    } catch {
      return INITIAL_COURSES;
    }
  });

  const [attendanceSessions, setAttendanceSessions] = useState<AttendanceSession[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.ATTENDANCE);
    if (!saved) return [];
    try {
      return JSON.parse(saved) as AttendanceSession[];
    } catch {
      return [];
    }
  });

  const [gradeConfigs, setGradeConfigs] = useState<GradeConfig[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.GRADE_CONFIGS);
    if (!saved) return [createDefaultGradeConfig({ scope: 'global' })];
    try {
      const parsed = JSON.parse(saved) as GradeConfig[];
      return parsed.length > 0 ? parsed : [createDefaultGradeConfig({ scope: 'global' })];
    } catch {
      return [createDefaultGradeConfig({ scope: 'global' })];
    }
  });

  const [isFirebaseSyncing, setIsFirebaseSyncing] = useState(false);
  const [firebaseStatus, setFirebaseStatus] = useState<'connected' | 'syncing' | 'offline' | 'error'>('syncing');
  const [lastFirebaseSyncTime, setLastFirebaseSyncTime] = useState<string | null>(null);
  const firestoreDbName = FIRESTORE_DATABASE_ID;

  const usersRef = useRef<User[]>(users);
  usersRef.current = users;
  const examsRef = useRef<Exam[]>(exams);
  examsRef.current = exams;
  const attemptsRef = useRef<ExamAttempt[]>(attempts);
  attemptsRef.current = attempts;
  const violationsRef = useRef<ViolationLog[]>(violations);
  violationsRef.current = violations;
  const coursesRef = useRef<Course[]>(courses);
  coursesRef.current = courses;
  const classesRef = useRef<ClassGroup[]>(classes);
  classesRef.current = classes;
  const attendanceSessionsRef = useRef<AttendanceSession[]>(attendanceSessions);
  attendanceSessionsRef.current = attendanceSessions;
  const gradeConfigsRef = useRef<GradeConfig[]>(gradeConfigs);
  gradeConfigsRef.current = gradeConfigs;
  const unsyncedExamIdsRef = useRef<Set<string>>(readStoredIdSet(STORAGE_KEYS.UNSYNCED_EXAMS));
  const deletedExamIdsRef = useRef<Set<string>>(readStoredIdSet(STORAGE_KEYS.DELETED_EXAMS));

  // Sync to local storage
  useEffect(() => {
    if (currentUser) {
      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(currentUser));
    } else {
      localStorage.removeItem(STORAGE_KEYS.USER);
    }
  }, [currentUser]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
  }, [users]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.CLASSES, JSON.stringify(classes));
  }, [classes]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.COURSES, JSON.stringify(courses));
  }, [courses]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.EXAMS, JSON.stringify(exams));
  }, [exams]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.ATTEMPTS, JSON.stringify(attempts));
  }, [attempts]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.VIOLATIONS, JSON.stringify(violations));
  }, [violations]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.ATTENDANCE, JSON.stringify(attendanceSessions));
  }, [attendanceSessions]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.GRADE_CONFIGS, JSON.stringify(gradeConfigs));
  }, [gradeConfigs]);

  // Robust Two-Way Sync with Firebase Firestore
  const syncFromFirestore = useCallback(async () => {
    setIsFirebaseSyncing(true);
    setFirebaseStatus('syncing');
    try {
      await testFirestoreConnection();

      // 1. Sync Users & Purge legacy demo users
      const usersCol = collection(db, 'users');
      const userSnapshot = await getDocs(usersCol);

      let remoteUsers: User[] = [];
      for (const docSnap of userSnapshot.docs) {
        const docId = docSnap.id;
        if (docId === 'dosen-1' || docId.startsWith('mhs-')) {
          await deleteDoc(doc(db, 'users', docId)).catch(() => {});
        } else {
          remoteUsers.push(docSnap.data() as User);
        }
      }

      // Ensure admin user exists in Firestore
      const hasAdmin = remoteUsers.some((u) => u.email.toLowerCase() === 'pjsmartid@gmail.com');
      if (!hasAdmin) {
        const adminUser = INITIAL_USERS[0];
        await setDoc(doc(db, 'users', adminUser.id), cleanFirestoreData(adminUser)).catch(() => {});
        remoteUsers = [adminUser, ...remoteUsers];
      }

      // Two-way merge users
      const userMap = new Map<string, User>();
      remoteUsers.forEach((u) => userMap.set(u.id, u));
      try {
        const localSavedUsers = localStorage.getItem(STORAGE_KEYS.USERS);
        const localUsers: User[] = localSavedUsers ? JSON.parse(localSavedUsers) : [];
        for (const lu of localUsers) {
          if (lu.id !== 'dosen-1' && !lu.id.startsWith('mhs-') && !userMap.has(lu.id)) {
            userMap.set(lu.id, lu);
            setDoc(doc(db, 'users', lu.id), cleanFirestoreData(lu)).catch(() => {});
          }
        }
      } catch (e) {}
      setUsers(Array.from(userMap.values()));

      // 2. Sync Exams with Two-Way Preservation (NEVER LOSE AN EXAM)
      const examsCol = collection(db, 'exams');
      const examSnapshot = await getDocs(examsCol);

      let remoteExams: Exam[] = [];
      for (const docSnap of examSnapshot.docs) {
        const docId = docSnap.id;
        if (
          docId === 'exam-01' ||
          docId === 'exam-02' ||
          docId === 'exam-03' ||
          docId === 'exam-04' ||
          deletedExamIdsRef.current.has(docId)
        ) {
          await deleteDoc(doc(db, 'exams', docId)).catch(() => {});
        } else {
          remoteExams.push(docSnap.data() as Exam);
        }
      }

      const examMap = new Map<string, Exam>();
      remoteExams.forEach((e) => examMap.set(e.id, e));

      // Only push local exams that were genuinely pending upload (not previously deleted exams)
      try {
        const localSavedExams = localStorage.getItem(STORAGE_KEYS.EXAMS);
        const localExams: Exam[] = localSavedExams ? JSON.parse(localSavedExams) : [];
        for (const localExam of localExams) {
          if (
            !localExam.id.startsWith('exam-0') &&
            !deletedExamIdsRef.current.has(localExam.id) &&
            unsyncedExamIdsRef.current.has(localExam.id) &&
            !examMap.has(localExam.id)
          ) {
            console.log('🔄 Mengunggah ujian tertunda ke Firestore:', localExam.id, localExam.title);
            examMap.set(localExam.id, localExam);
            await setDoc(doc(db, 'exams', localExam.id), cleanFirestoreData(localExam))
              .then(() => {
                unsyncedExamIdsRef.current.delete(localExam.id);
                writeStoredIdSet(STORAGE_KEYS.UNSYNCED_EXAMS, unsyncedExamIdsRef.current);
              })
              .catch((err) => {
                handleFirestoreError(err, OperationType.WRITE, `exams/${localExam.id}`);
              });
          }
        }
      } catch (e) {
        console.warn('Error reading local exams during sync:', e);
      }

      const mergedExams = Array.from(examMap.values()).sort(
        (a, b) => new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime()
      );
      examsRef.current = mergedExams;
      setExams(mergedExams);
      try {
        localStorage.setItem(STORAGE_KEYS.EXAMS, JSON.stringify(mergedExams));
      } catch {}

      // 3. Sync Attempts with Two-Way Merge
      const attemptsCol = collection(db, 'attempts');
      const attSnapshot = await getDocs(attemptsCol);

      let remoteAttempts: ExamAttempt[] = [];
      for (const docSnap of attSnapshot.docs) {
        const docId = docSnap.id;
        const attData = docSnap.data() as ExamAttempt;
        if (
          docId.includes('mhs2') ||
          docId.includes('exam-0') ||
          deletedExamIdsRef.current.has(attData.examId)
        ) {
          await deleteDoc(doc(db, 'attempts', docId)).catch(() => {});
        } else {
          remoteAttempts.push(attData);
        }
      }

      const attMap = new Map<string, ExamAttempt>();
      remoteAttempts.forEach((a) => attMap.set(a.id, a));
      try {
        const localSavedAtt = localStorage.getItem(STORAGE_KEYS.ATTEMPTS);
        const localAtt: ExamAttempt[] = localSavedAtt ? JSON.parse(localSavedAtt) : [];
        for (const la of localAtt) {
          if (
            !la.id.includes('mhs2') &&
            !la.id.includes('exam-0') &&
            !deletedExamIdsRef.current.has(la.examId) &&
            !attMap.has(la.id)
          ) {
            attMap.set(la.id, la);
            setDoc(doc(db, 'attempts', la.id), cleanFirestoreData(la), { merge: true }).catch(() => {});
          }
        }
      } catch (e) {}
      const mergedAttempts = Array.from(attMap.values());
      attemptsRef.current = mergedAttempts;
      setAttempts(mergedAttempts);

      // 4. Sync Violations
      const violCol = collection(db, 'violations');
      const violSnapshot = await getDocs(violCol);

      let remoteViolations: ViolationLog[] = [];
      for (const docSnap of violSnapshot.docs) {
        const docId = docSnap.id;
        const violData = docSnap.data() as ViolationLog;
        if (
          docId === 'v-1' ||
          docId === 'v-2' ||
          docId.includes('exam-01') ||
          deletedExamIdsRef.current.has(violData.examId)
        ) {
          await deleteDoc(doc(db, 'violations', docId)).catch(() => {});
        } else {
          remoteViolations.push(violData);
        }
      }
      const violMap = new Map<string, ViolationLog>();
      remoteViolations.forEach((v) => violMap.set(v.id, v));
      try {
        const localSavedViol = localStorage.getItem(STORAGE_KEYS.VIOLATIONS);
        const localViol: ViolationLog[] = localSavedViol ? JSON.parse(localSavedViol) : [];
        for (const lv of localViol) {
          if (
            lv.id !== 'v-1' &&
            lv.id !== 'v-2' &&
            !lv.id.includes('exam-01') &&
            !deletedExamIdsRef.current.has(lv.examId) &&
            !violMap.has(lv.id)
          ) {
            violMap.set(lv.id, lv);
            setDoc(doc(db, 'violations', lv.id), cleanFirestoreData(lv)).catch(() => {});
          }
        }
      } catch (e) {}
      const mergedViolations = Array.from(violMap.values());
      violationsRef.current = mergedViolations;
      setViolations(mergedViolations);

      // 5. Sync Classes
      const classesCol = collection(db, 'classes');
      const classSnapshot = await getDocs(classesCol);
      const remoteClasses: ClassGroup[] = [];
      for (const docSnap of classSnapshot.docs) {
        if (DEMO_CLASS_IDS.includes(docSnap.id)) {
          await deleteDoc(doc(db, 'classes', docSnap.id)).catch(() => {});
        } else {
          remoteClasses.push(docSnap.data() as ClassGroup);
        }
      }
      const classMap = new Map<string, ClassGroup>();
      remoteClasses.forEach((c) => classMap.set(c.id, c));
      try {
        const localSavedClasses = localStorage.getItem(STORAGE_KEYS.CLASSES);
        const localClasses: ClassGroup[] = localSavedClasses ? JSON.parse(localSavedClasses) : [];
        for (const lc of localClasses) {
          if (!DEMO_CLASS_IDS.includes(lc.id) && !classMap.has(lc.id)) {
            classMap.set(lc.id, lc);
            setDoc(doc(db, 'classes', lc.id), cleanFirestoreData(lc)).catch(() => {});
          }
        }
      } catch (e) {}
      setClasses(Array.from(classMap.values()));

      // 6. Sync Courses
      const coursesCol = collection(db, 'courses');
      const courseSnapshot = await getDocs(coursesCol);
      const remoteCourses: Course[] = [];
      for (const docSnap of courseSnapshot.docs) {
        if (DEMO_COURSE_IDS.includes(docSnap.id)) {
          await deleteDoc(doc(db, 'courses', docSnap.id)).catch(() => {});
        } else {
          remoteCourses.push(docSnap.data() as Course);
        }
      }
      const courseMap = new Map<string, Course>();
      remoteCourses.forEach((c) => courseMap.set(c.id, c));
      try {
        const localSavedCourses = localStorage.getItem(STORAGE_KEYS.COURSES);
        const localCourses: Course[] = localSavedCourses ? JSON.parse(localSavedCourses) : [];
        for (const lc of localCourses) {
          if (!DEMO_COURSE_IDS.includes(lc.id) && !courseMap.has(lc.id)) {
            courseMap.set(lc.id, lc);
            setDoc(doc(db, 'courses', lc.id), cleanFirestoreData(lc)).catch(() => {});
          }
        }
      } catch (e) {}
      setCourses(Array.from(courseMap.values()));

      // 7. Sync Attendance Sessions
      const attSesCol = collection(db, 'attendance_sessions');
      const attSesSnapshot = await getDocs(attSesCol);
      const sesMap = new Map<string, AttendanceSession>();
      attSesSnapshot.forEach((docSnap) => {
        sesMap.set(docSnap.id, docSnap.data() as AttendanceSession);
      });
      try {
        const localSavedSes = localStorage.getItem(STORAGE_KEYS.ATTENDANCE);
        const localSes: AttendanceSession[] = localSavedSes ? JSON.parse(localSavedSes) : [];
        for (const ls of localSes) {
          if (!sesMap.has(ls.id)) {
            sesMap.set(ls.id, ls);
            setDoc(doc(db, 'attendance_sessions', ls.id), cleanFirestoreData(ls)).catch(() => {});
          }
        }
      } catch (e) {}
      setAttendanceSessions(
        Array.from(sesMap.values()).sort(
          (a, b) => new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime()
        )
      );

      // 8. Sync Grade Configs
      const gradeCfgCol = collection(db, 'grade_configs');
      const gradeCfgSnapshot = await getDocs(gradeCfgCol);
      const cfgMap = new Map<string, GradeConfig>();
      gradeCfgSnapshot.forEach((docSnap) => {
        cfgMap.set(docSnap.id, docSnap.data() as GradeConfig);
      });
      if (!cfgMap.has('global_default')) {
        const defCfg = createDefaultGradeConfig({ scope: 'global' });
        cfgMap.set(defCfg.id, defCfg);
        setDoc(doc(db, 'grade_configs', defCfg.id), cleanFirestoreData(defCfg)).catch(() => {});
      }
      setGradeConfigs(Array.from(cfgMap.values()));

      setFirebaseStatus('connected');
      setLastFirebaseSyncTime(new Date().toLocaleTimeString('id-ID'));
    } catch (err) {
      console.warn('Firestore initial sync notice:', err);
      setFirebaseStatus('error');
      handleFirestoreError(err, OperationType.LIST, 'initial_sync');
    } finally {
      setIsFirebaseSyncing(false);
    }
  }, []);

  // Run initial sync on mount
  useEffect(() => {
    syncFromFirestore();
  }, [syncFromFirestore]);

  // Real-time onSnapshot listener on exams collection
  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, 'exams'),
      (snapshot) => {
        const liveExams: Exam[] = [];
        snapshot.forEach((docSnap) => {
          const docId = docSnap.id;
          if (!docId.startsWith('exam-0') && !deletedExamIdsRef.current.has(docId)) {
            liveExams.push(docSnap.data() as Exam);
          }
        });

        if (!snapshot.metadata.fromCache || liveExams.length > 0) {
          setExams((prev) => {
            const map = new Map<string, Exam>();
            liveExams.forEach((e) => map.set(e.id, e));
            // Only preserve genuinely unsynced local exams that are still pending upload
            prev.forEach((e) => {
              if (
                !map.has(e.id) &&
                !e.id.startsWith('exam-0') &&
                !deletedExamIdsRef.current.has(e.id) &&
                unsyncedExamIdsRef.current.has(e.id)
              ) {
                map.set(e.id, e);
              }
            });
            const next = Array.from(map.values()).sort(
              (a, b) => new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime()
            );
            examsRef.current = next;
            return next;
          });
          setFirebaseStatus('connected');
          setLastFirebaseSyncTime(new Date().toLocaleTimeString('id-ID'));
        }
      },
      (error) => {
        console.warn('Real-time exam listener notice:', error);
      }
    );

    return () => unsubscribe();
  }, []);

  // Real-time onSnapshot listener on courses collection (so uploaded materials & assignments appear live for students)
  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, 'courses'),
      (snapshot) => {
        const liveCourses: Course[] = [];
        snapshot.forEach((docSnap) => {
          if (!DEMO_COURSE_IDS.includes(docSnap.id)) {
            liveCourses.push(docSnap.data() as Course);
          }
        });

        if (liveCourses.length > 0) {
          setCourses((prev) => {
            const map = new Map<string, Course>();
            liveCourses.forEach((c) => map.set(c.id, c));
            prev.forEach((c) => {
              if (!map.has(c.id) && !DEMO_COURSE_IDS.includes(c.id)) {
                map.set(c.id, c);
              }
            });
            return Array.from(map.values());
          });
          setFirebaseStatus('connected');
          setLastFirebaseSyncTime(new Date().toLocaleTimeString('id-ID'));
        }
      },
      (error) => {
        console.warn('Real-time courses listener notice:', error);
      }
    );

    return () => unsubscribe();
  }, []);

  // Real-time onSnapshot listener on classes collection (so class files appear live for students)
  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, 'classes'),
      (snapshot) => {
        const liveClasses: ClassGroup[] = [];
        snapshot.forEach((docSnap) => {
          if (!DEMO_CLASS_IDS.includes(docSnap.id)) {
            liveClasses.push(docSnap.data() as ClassGroup);
          }
        });

        if (liveClasses.length > 0) {
          setClasses((prev) => {
            const map = new Map<string, ClassGroup>();
            liveClasses.forEach((c) => map.set(c.id, c));
            prev.forEach((c) => {
              if (!map.has(c.id) && !DEMO_CLASS_IDS.includes(c.id)) {
                map.set(c.id, c);
              }
            });
            return Array.from(map.values());
          });
          setFirebaseStatus('connected');
          setLastFirebaseSyncTime(new Date().toLocaleTimeString('id-ID'));
        }
      },
      (error) => {
        console.warn('Real-time classes listener notice:', error);
      }
    );

    return () => unsubscribe();
  }, []);

  // Real-time onSnapshot listener on attendance_sessions (live QR token updates & student attendance records)
  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, 'attendance_sessions'),
      (snapshot) => {
        const liveSessions: AttendanceSession[] = [];
        snapshot.forEach((docSnap) => {
          liveSessions.push(docSnap.data() as AttendanceSession);
        });
        setAttendanceSessions(
          liveSessions.sort(
            (a, b) => new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime()
          )
        );
        setFirebaseStatus('connected');
        setLastFirebaseSyncTime(new Date().toLocaleTimeString('id-ID'));
      },
      (error) => {
        console.warn('Real-time attendance listener notice:', error);
      }
    );

    return () => unsubscribe();
  }, []);

  // Real-time onSnapshot listener on grade_configs (live weight & grade category updates)
  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, 'grade_configs'),
      (snapshot) => {
        const liveConfigs: GradeConfig[] = [];
        snapshot.forEach((docSnap) => {
          liveConfigs.push(docSnap.data() as GradeConfig);
        });
        if (liveConfigs.length > 0) {
          setGradeConfigs(liveConfigs);
          setFirebaseStatus('connected');
          setLastFirebaseSyncTime(new Date().toLocaleTimeString('id-ID'));
        }
      },
      (error) => {
        console.warn('Real-time grade_configs listener notice:', error);
      }
    );

    return () => unsubscribe();
  }, []);

  // Real-time onSnapshot listener on attempts (enforce single-access & cross-tab lock sync)
  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, 'attempts'),
      (snapshot) => {
        const remoteList: ExamAttempt[] = [];
        snapshot.forEach((docSnap) => {
          if (!docSnap.id.includes('mhs2') && !docSnap.id.includes('att_exam-0')) {
            remoteList.push(docSnap.data() as ExamAttempt);
          }
        });

        setAttempts((prev) => {
          const map = new Map<string, ExamAttempt>();
          prev.forEach((a) => map.set(a.id, a));
          remoteList.forEach((remote) => {
            const local = map.get(remote.id);
            if (local?.isCompleted && !remote.isCompleted) {
              // Never regress a completed attempt back to in_progress
              return;
            }
            map.set(remote.id, remote);
          });
          const merged = Array.from(map.values());
          attemptsRef.current = merged;
          return merged;
        });
      },
      (error) => {
        console.warn('Real-time attempts listener notice:', error);
      }
    );

    return () => unsubscribe();
  }, []);

  // Listen to Firebase Auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser && !currentUser) {
        const found = users.find((u) => u.email.toLowerCase() === firebaseUser.email?.toLowerCase());
        if (found) {
          setCurrentUser(found);
        }
      }
    });
    return () => unsubscribe();
  }, [users, currentUser]);

  // Login with Firebase Email & Password
  const loginWithEmail = async (
    email: string,
    password: string
  ): Promise<{ success: boolean; error?: string }> => {
    const normalizedEmail = email.trim().toLowerCase();

    // 1. Direct handler for the requested Admin Account: pjsmartid@gmail.com with password 12345
    if (
      normalizedEmail === 'pjsmartid@gmail.com' &&
      (password === '12345' || password === '123456')
    ) {
      let adminUser = users.find((u) => u.email.toLowerCase() === 'pjsmartid@gmail.com');
      if (!adminUser) {
        adminUser = INITIAL_USERS[0];
        setUsers((prev) => [adminUser!, ...prev]);
      }
      setCurrentUser(adminUser);

      // Async background Firebase auth ensure
      const paddedPass = password.length < 6 ? password + '0' : password;
      signInWithEmailAndPassword(auth, normalizedEmail, paddedPass).catch(() => {
        createUserWithEmailAndPassword(auth, normalizedEmail, paddedPass).catch(() => {});
      });

      return { success: true };
    }

    try {
      // 2. Regular Firebase Authentication
      const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password);
      const authUser = userCredential.user;

      let matchedUser = users.find(
        (u) => u.email.toLowerCase() === normalizedEmail || u.id === authUser.uid
      );

      if (!matchedUser) {
        matchedUser = {
          id: authUser.uid,
          name: authUser.displayName || email.split('@')[0],
          email: authUser.email || email,
          role: email.toLowerCase().includes('dosen') || email.toLowerCase().includes('admin') ? 'dosen' : 'mahasiswa',
          nimOrNip: '1985' + Math.floor(1000 + Math.random() * 9000),
          department: 'Administrasi Sistem & Teknologi Informasi',
          avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(email)}`,
        };
        await setDoc(doc(db, 'users', matchedUser.id), matchedUser);
        setUsers((prev) => [...prev, matchedUser!]);
      }

      setCurrentUser(matchedUser);
      return { success: true };
    } catch (err: any) {
      // Check local user match with simple password fallback
      const localMatched = users.find(
        (u) => u.email.toLowerCase() === normalizedEmail && (password === '12345' || password === 'password123')
      );
      if (localMatched) {
        setCurrentUser(localMatched);
        return { success: true };
      }

      let msg = 'Email atau kata sandi tidak valid.';
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password') {
        msg = 'Kata sandi atau email yang Anda masukkan salah.';
      } else if (err.code === 'auth/user-not-found') {
        msg = 'Pengguna dengan email ini belum terdaftar.';
      } else if (err.code === 'auth/invalid-email') {
        msg = 'Format alamat email tidak valid.';
      } else if (err.message) {
        msg = err.message;
      }

      return { success: false, error: msg };
    }
  };

  // Register with Firebase Email & Password
  const registerWithEmail = async (
    userData: Omit<User, 'id'>,
    password: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, userData.email, password);
      const authUser = userCredential.user;

      const newUser: User = {
        ...userData,
        id: authUser.uid,
      };

      // Save to Firestore
      await setDoc(doc(db, 'users', newUser.id), newUser);

      setUsers((prev) => [...prev, newUser]);
      setCurrentUser(newUser);

      return { success: true };
    } catch (err: any) {
      console.error('Firebase register error:', err);
      let msg = 'Gagal mendaftar akun baru.';
      if (err.code === 'auth/email-already-in-use') {
        msg = 'Alamat email ini sudah terdaftar. Silakan gunakan menu Masuk.';
      } else if (err.code === 'auth/weak-password') {
        msg = 'Kata sandi terlalu lemah (minimal 6 karakter).';
      } else if (err.message) {
        msg = err.message;
      }
      return { success: false, error: msg };
    }
  };

  const login = (user: User) => {
    setCurrentUser(user);
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (e) {
      // ignore
    }
    setCurrentUser(null);
  };

  // CLASS MANAGEMENT (Add, Update, Delete)
  const addClass = async (classData: Omit<ClassGroup, 'id' | 'createdAt'>): Promise<ClassGroup> => {
    const newId = `class_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newClass: ClassGroup = {
      ...classData,
      id: newId,
      createdAt: new Date().toISOString(),
    };

    setClasses((prev) => [...prev, newClass]);

    try {
      await setDoc(doc(db, 'classes', newId), cleanFirestoreData(newClass));
    } catch (err) {
      console.warn('Failed saving class to Firestore:', err);
    }

    return newClass;
  };

  const updateClass = async (classData: ClassGroup): Promise<void> => {
    setClasses((prev) => prev.map((c) => (c.id === classData.id ? classData : c)));

    // Sync student user records that belong to this class
    setUsers((prev) =>
      prev.map((u) => (u.classId === classData.id ? { ...u, className: classData.name } : u))
    );

    try {
      await setDoc(doc(db, 'classes', classData.id), cleanFirestoreData(classData), { merge: true });
    } catch (err) {
      console.warn('Failed updating class in Firestore:', err);
    }
  };

  const deleteClass = async (id: string): Promise<void> => {
    setClasses((prev) => prev.filter((c) => c.id !== id));

    // Remove class assignment from users
    setUsers((prev) =>
      prev.map((u) => (u.classId === id ? { ...u, classId: '', className: '' } : u))
    );

    try {
      await deleteDoc(doc(db, 'classes', id));
    } catch (err) {
      console.warn('Failed deleting class from Firestore:', err);
    }
  };

  const addClassFile = async (
    classId: string,
    fileData: Omit<ClassFile, 'id' | 'classId' | 'uploadedAt'>
  ): Promise<ClassFile> => {
    const newFile: ClassFile = {
      ...fileData,
      id: `cfile-${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      classId,
      uploadedAt: new Date().toISOString(),
    };

    const existing = classesRef.current.find((c) => c.id === classId);
    if (!existing) {
      throw new Error('Kelas tidak ditemukan.');
    }

    const updatedClass: ClassGroup = {
      ...existing,
      files: [newFile, ...(existing.files || [])],
    };

    setClasses((prev) => prev.map((c) => (c.id === classId ? updatedClass : c)));

    try {
      await setDoc(doc(db, 'classes', classId), cleanFirestoreData(updatedClass), { merge: true });
      setFirebaseStatus('connected');
      setLastFirebaseSyncTime(new Date().toLocaleTimeString('id-ID'));
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `classes/${classId}`);
      throw err;
    }

    return newFile;
  };

  const deleteClassFile = async (classId: string, fileEntryId: string): Promise<void> => {
    const existing = classesRef.current.find((c) => c.id === classId);
    if (!existing) return;

    const targetFile = (existing.files || []).find((f) => f.id === fileEntryId);
    const updatedClass: ClassGroup = {
      ...existing,
      files: (existing.files || []).filter((f) => f.id !== fileEntryId),
    };

    setClasses((prev) => prev.map((c) => (c.id === classId ? updatedClass : c)));

    try {
      await setDoc(doc(db, 'classes', classId), cleanFirestoreData(updatedClass), { merge: true });
      if (targetFile?.fileId) {
        await deleteStoredFile(targetFile.fileId);
      }
      setFirebaseStatus('connected');
      setLastFirebaseSyncTime(new Date().toLocaleTimeString('id-ID'));
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `classes/${classId}`);
      throw err;
    }
  };

  // USER MANAGEMENT (Add, Update, Delete)
  const addUser = async (userData: Omit<User, 'id'>): Promise<User> => {
    const newId = `user_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newUser: User = {
      ...userData,
      id: newId,
    };

    setUsers((prev) => [...prev, newUser]);

    // Persist to Firestore
    try {
      await setDoc(doc(db, 'users', newId), cleanFirestoreData(newUser));
    } catch (err) {
      console.warn('Failed saving user to Firestore:', err);
    }

    return newUser;
  };

  const updateUser = async (updatedUser: User): Promise<void> => {
    setUsers((prev) => prev.map((u) => (u.id === updatedUser.id ? updatedUser : u)));
    if (currentUser?.id === updatedUser.id) {
      setCurrentUser(updatedUser);
    }

    try {
      await setDoc(doc(db, 'users', updatedUser.id), cleanFirestoreData(updatedUser), { merge: true });
    } catch (err) {
      console.warn('Failed updating user in Firestore:', err);
    }
  };

  const deleteUser = async (id: string): Promise<void> => {
    setUsers((prev) => prev.filter((u) => u.id !== id));

    try {
      await deleteDoc(doc(db, 'users', id));
    } catch (err) {
      console.warn('Failed deleting user from Firestore:', err);
    }
  };

  // EXAMS MANAGEMENT
  const getExamTimeStatus = useCallback((exam: Exam) => {
    const now = new Date().getTime();
    const start = new Date(exam.schedule.startTime).getTime();
    const end = new Date(exam.schedule.endTime).getTime();

    if (now < start) {
      return {
        status: 'upcoming' as ExamStatus,
        canAccess: false,
        label: 'Belum Waktunya',
        message: 'Ujian belum dibuka. Akses akan aktif secara otomatis pada jadwal mulai.',
      };
    }

    if (now > end) {
      return {
        status: 'completed' as ExamStatus,
        canAccess: false,
        label: 'Sudah Habis Waktunya',
        message: 'Jadwal ujian telah berakhir. Peserta tidak dapat lagi mengakses ruang ujian.',
      };
    }

    return {
      status: 'ongoing' as ExamStatus,
      canAccess: true,
      label: 'Sedang Berlangsung',
      message: 'Ujian aktif dan dapat dikerjakan sekarang.',
    };
  }, []);

  const addExam = async (newExamData: Omit<Exam, 'id' | 'createdAt'>): Promise<Exam> => {
    const newExam: Exam = {
      ...newExamData,
      id: `exam-${Date.now()}`,
      createdAt: new Date().toISOString(),
      assignedClassIds: newExamData.assignedClassIds || [],
      penaltyRules: newExamData.penaltyRules || [],
      scoringMethod: newExamData.scoringMethod || 'irt',
      irtModel: newExamData.irtModel || '3PL',
      showScoreImmediately: newExamData.showScoreImmediately ?? false,
      isScorePublished: newExamData.isScorePublished ?? false,
      allowLateSubmission: newExamData.allowLateSubmission ?? false,
      aiProctoringEnabled: newExamData.aiProctoringEnabled ?? true,
      shuffleQuestions: newExamData.shuffleQuestions ?? false,
      shuffleOptions: newExamData.shuffleOptions ?? false,
    };

    deletedExamIdsRef.current.delete(newExam.id);
    writeStoredIdSet(STORAGE_KEYS.DELETED_EXAMS, deletedExamIdsRef.current);
    unsyncedExamIdsRef.current.add(newExam.id);
    writeStoredIdSet(STORAGE_KEYS.UNSYNCED_EXAMS, unsyncedExamIdsRef.current);

    // Update local state and localStorage immediately
    const nextExams = [newExam, ...examsRef.current.filter((e) => e.id !== newExam.id)];
    examsRef.current = nextExams;
    setExams(nextExams);
    try {
      localStorage.setItem(STORAGE_KEYS.EXAMS, JSON.stringify(nextExams));
    } catch {}

    // Clean payload so no undefined values ever reach Firestore
    const cleanExam = cleanFirestoreData(newExam);
    try {
      await setDoc(doc(db, 'exams', newExam.id), cleanExam);
      unsyncedExamIdsRef.current.delete(newExam.id);
      writeStoredIdSet(STORAGE_KEYS.UNSYNCED_EXAMS, unsyncedExamIdsRef.current);
      console.log('✅ Ujian berhasil disimpan ke Firestore:', newExam.id, newExam.title);
      setFirebaseStatus('connected');
      setLastFirebaseSyncTime(new Date().toLocaleTimeString('id-ID'));
    } catch (err) {
      console.error('❌ Gagal menyimpan ujian ke Firestore:', err);
      handleFirestoreError(err, OperationType.CREATE, `exams/${newExam.id}`);
      setFirebaseStatus('error');
      throw err;
    }

    return newExam;
  };

  const computeEvaluatedAttemptsForExam = (
    targetExam: Exam,
    allAttempts: ExamAttempt[]
  ): ExamAttempt[] => {
    const completedForExam = allAttempts.filter(
      (a) => a.examId === targetExam.id && a.isCompleted
    );
    if (completedForExam.length === 0) return allAttempts;

    const method: ScoringMethod = targetExam.scoringMethod || 'classical';
    const model: IRTModel = targetExam.irtModel || '3PL';
    const itemAnalyses = calibrateExamItems(targetExam, completedForExam, model);

    return allAttempts.map((att) => {
      if (att.examId !== targetExam.id || !att.isCompleted) return att;

      const irtResult = calculateAttemptIRTScore(targetExam, att, itemAnalyses, model);

      if (method === 'irt') {
        const updatedAtt: ExamAttempt = {
          ...att,
          correctCount: irtResult.correctCount,
          scoringMethodUsed: 'irt',
          irtModelUsed: model,
          irtTheta: irtResult.irtTheta,
          irtStandardError: irtResult.irtStandardError,
          irtScaledScore: irtResult.irtScaledScore,
          irtItemWeights: irtResult.irtItemWeights,
          rawScore: irtResult.rawScore,
          penaltyDeduction: irtResult.penaltyDeduction,
          score: irtResult.finalScore,
          maxScore: 100,
          percentage: irtResult.percentage,
          isPassed: irtResult.isPassed,
        };
        setDoc(doc(db, 'attempts', updatedAtt.id), cleanFirestoreData(updatedAtt), { merge: true }).catch(() => {});
        return updatedAtt;
      }

      // Classical Scoring (Bobot Tetap)
      let totalEarned = 0;
      let totalMax = 0;
      targetExam.questions.forEach((q) => {
        totalMax += q.points;
        if (att.answers[q.id]?.selectedOption === q.correctAnswer) {
          totalEarned += q.points;
        }
      });

      let penaltyDeduction = 0;
      const violCount = att.violationsCount || att.violationLogs?.length || 0;
      if (targetExam.penaltyRules && targetExam.penaltyRules.length > 0 && violCount > 0) {
        for (const rule of targetExam.penaltyRules) {
          if (violCount >= rule.minViolations && violCount <= rule.maxViolations) {
            penaltyDeduction = Math.max(penaltyDeduction, rule.pointDeduction);
          }
        }
      }

      const rawScore = totalEarned;
      const finalScore = Math.max(0, rawScore - penaltyDeduction);
      const percentage = totalMax > 0 ? Math.round((finalScore / totalMax) * 100) : 0;
      const isPassed = percentage >= targetExam.passingGrade;

      const updatedAtt: ExamAttempt = {
        ...att,
        correctCount: irtResult.correctCount,
        scoringMethodUsed: 'classical',
        irtModelUsed: model,
        irtTheta: irtResult.irtTheta,
        irtStandardError: irtResult.irtStandardError,
        irtScaledScore: irtResult.irtScaledScore,
        irtItemWeights: irtResult.irtItemWeights,
        rawScore,
        penaltyDeduction,
        score: finalScore,
        maxScore: totalMax,
        percentage,
        isPassed,
      };
      setDoc(doc(db, 'attempts', updatedAtt.id), cleanFirestoreData(updatedAtt), { merge: true }).catch(() => {});
      return updatedAtt;
    });
  };

  const recalibrateExamScores = async (
    examId: string,
    overrideMethod?: ScoringMethod,
    overrideModel?: IRTModel
  ): Promise<void> => {
    const existingExam = exams.find((ex) => ex.id === examId);
    if (!existingExam) return;

    const updatedExam: Exam = {
      ...existingExam,
      scoringMethod: overrideMethod || existingExam.scoringMethod || 'irt',
      irtModel: overrideModel || existingExam.irtModel || '3PL',
    };

    if (
      updatedExam.scoringMethod !== existingExam.scoringMethod ||
      updatedExam.irtModel !== existingExam.irtModel
    ) {
      setExams((prev) => prev.map((ex) => (ex.id === examId ? updatedExam : ex)));
      try {
        await setDoc(doc(db, 'exams', examId), cleanFirestoreData(updatedExam), { merge: true });
        setFirebaseStatus('connected');
        setLastFirebaseSyncTime(new Date().toLocaleTimeString('id-ID'));
      } catch (err) {
        console.warn('Failed updating exam scoring config:', err);
        handleFirestoreError(err, OperationType.UPDATE, `exams/${examId}`);
      }
    }

    setAttempts((prev) => computeEvaluatedAttemptsForExam(updatedExam, prev));
  };

  const updateExam = async (updatedExamData: Exam): Promise<void> => {
    const normalizedTopicId = updatedExamData.topicId?.trim() || undefined;
    const updatedExam: Exam = {
      ...updatedExamData,
      topicId: normalizedTopicId,
      assignedClassIds: updatedExamData.assignedClassIds || [],
      penaltyRules: updatedExamData.penaltyRules || [],
      scoringMethod: updatedExamData.scoringMethod || 'irt',
      irtModel: updatedExamData.irtModel || '3PL',
    };

    const nextExams = examsRef.current.map((ex) => (ex.id === updatedExam.id ? updatedExam : ex));
    examsRef.current = nextExams;
    setExams(nextExams);
    setAttempts((prev) => computeEvaluatedAttemptsForExam(updatedExam, prev));

    try {
      const cleanExam = cleanFirestoreData(updatedExam) as Record<string, any>;
      if (!normalizedTopicId) {
        cleanExam.topicId = deleteField();
      }
      await setDoc(doc(db, 'exams', updatedExam.id), cleanExam, { merge: true });
      console.log('✅ Ujian berhasil diperbarui di Firestore:', updatedExam.id);
      setFirebaseStatus('connected');
      setLastFirebaseSyncTime(new Date().toLocaleTimeString('id-ID'));
    } catch (err) {
      console.error('❌ Failed updating exam in Firestore:', err);
      handleFirestoreError(err, OperationType.UPDATE, `exams/${updatedExam.id}`);
      setFirebaseStatus('error');
      throw err;
    }
  };

  const assignExamToTopic = async (
    examId: string,
    placement: {
      courseId?: string;
      courseCode?: string;
      courseName?: string;
      topicId?: string;
    }
  ): Promise<void> => {
    const existing = examsRef.current.find((ex) => ex.id === examId);
    if (!existing) throw new Error('Data ujian tidak ditemukan.');
    const normalizedTopicId = placement.topicId?.trim() || undefined;

    const updatedExam: Exam = {
      ...existing,
      courseId: placement.courseId !== undefined ? placement.courseId : existing.courseId,
      courseCode: placement.courseCode || existing.courseCode,
      courseName: placement.courseName || existing.courseName,
      topicId: normalizedTopicId,
    };

    const nextExams = examsRef.current.map((ex) => (ex.id === examId ? updatedExam : ex));
    examsRef.current = nextExams;
    setExams(nextExams);

    try {
      const payload: Record<string, any> = cleanFirestoreData({
        courseId: updatedExam.courseId,
        courseCode: updatedExam.courseCode,
        courseName: updatedExam.courseName,
        topicId: normalizedTopicId,
      });
      if (!normalizedTopicId) {
        payload.topicId = deleteField();
      }
      await setDoc(doc(db, 'exams', examId), payload, { merge: true });
      setFirebaseStatus('connected');
      setLastFirebaseSyncTime(new Date().toLocaleTimeString('id-ID'));
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `exams/${examId}`);
      setFirebaseStatus('error');
      throw err;
    }
  };

  const deleteExam = async (id: string): Promise<void> => {
    const previousExam = examsRef.current.find((ex) => ex.id === id);
    const previousAttempts = attemptsRef.current;
    const previousViolations = violationsRef.current;

    deletedExamIdsRef.current.add(id);
    writeStoredIdSet(STORAGE_KEYS.DELETED_EXAMS, deletedExamIdsRef.current);
    unsyncedExamIdsRef.current.delete(id);
    writeStoredIdSet(STORAGE_KEYS.UNSYNCED_EXAMS, unsyncedExamIdsRef.current);

    const remainingExams = examsRef.current.filter((ex) => ex.id !== id);
    examsRef.current = remainingExams;
    setExams(remainingExams);

    const remainingAttempts = previousAttempts.filter((att) => att.examId !== id);
    attemptsRef.current = remainingAttempts;
    setAttempts(remainingAttempts);

    const remainingViolations = previousViolations.filter((v) => v.examId !== id);
    violationsRef.current = remainingViolations;
    setViolations(remainingViolations);

    try {
      localStorage.setItem(STORAGE_KEYS.EXAMS, JSON.stringify(remainingExams));
      localStorage.setItem(STORAGE_KEYS.ATTEMPTS, JSON.stringify(remainingAttempts));
      localStorage.setItem(STORAGE_KEYS.VIOLATIONS, JSON.stringify(remainingViolations));
    } catch {}

    try {
      // 1. Delete primary exam document in Firestore
      await deleteDoc(doc(db, 'exams', id));

      // 2. Cascade delete related attempts & violations in Firestore
      const attemptIdsToDelete = new Set(
        previousAttempts.filter((att) => att.examId === id).map((att) => att.id)
      );
      const violationIdsToDelete = new Set(
        previousViolations.filter((v) => v.examId === id).map((v) => v.id)
      );

      try {
        const remoteAttSnap = await getDocs(
          query(collection(db, 'attempts'), where('examId', '==', id))
        );
        remoteAttSnap.forEach((d) => attemptIdsToDelete.add(d.id));
      } catch {}

      try {
        const remoteViolSnap = await getDocs(
          query(collection(db, 'violations'), where('examId', '==', id))
        );
        remoteViolSnap.forEach((d) => violationIdsToDelete.add(d.id));
      } catch {}

      await Promise.allSettled([
        ...Array.from(attemptIdsToDelete).map((attId) =>
          deleteDoc(doc(db, 'attempts', attId))
        ),
        ...Array.from(violationIdsToDelete).map((violId) =>
          deleteDoc(doc(db, 'violations', violId))
        ),
      ]);

      console.log('✅ Ujian & data terkait berhasil dihapus permanen dari Firestore:', id);
      setFirebaseStatus('connected');
      setLastFirebaseSyncTime(new Date().toLocaleTimeString('id-ID'));
    } catch (err) {
      console.error('❌ Failed deleting exam in Firestore:', err);
      // Rollback local state if Firestore deletion failed
      deletedExamIdsRef.current.delete(id);
      writeStoredIdSet(STORAGE_KEYS.DELETED_EXAMS, deletedExamIdsRef.current);
      if (previousExam) {
        const restoredExams = [previousExam, ...examsRef.current];
        examsRef.current = restoredExams;
        setExams(restoredExams);
        try {
          localStorage.setItem(STORAGE_KEYS.EXAMS, JSON.stringify(restoredExams));
        } catch {}
      }
      attemptsRef.current = previousAttempts;
      setAttempts(previousAttempts);
      violationsRef.current = previousViolations;
      setViolations(previousViolations);
      try {
        localStorage.setItem(STORAGE_KEYS.ATTEMPTS, JSON.stringify(previousAttempts));
        localStorage.setItem(STORAGE_KEYS.VIOLATIONS, JSON.stringify(previousViolations));
      } catch {}

      handleFirestoreError(err, OperationType.DELETE, `exams/${id}`);
      setFirebaseStatus('error');
      throw err;
    }
  };

  const toggleScoreAnnouncement = async (examId: string, showImmediately: boolean) => {
    setExams((prev) =>
      prev.map((ex) => (ex.id === examId ? { ...ex, showScoreImmediately: showImmediately } : ex))
    );
    try {
      await updateDoc(doc(db, 'exams', examId), { showScoreImmediately: showImmediately });
    } catch (err) {
      console.warn('Failed updating score announcement in Firestore:', err);
    }
  };

  const publishScores = async (examId: string) => {
    setExams((prev) =>
      prev.map((ex) => (ex.id === examId ? { ...ex, isScorePublished: true } : ex))
    );
    try {
      await updateDoc(doc(db, 'exams', examId), { isScorePublished: true });
    } catch (err) {
      console.warn('Failed publishing scores in Firestore:', err);
    }
  };

  // ATTEMPTS (Single-Access & Immutable After Completion)
  const getExamAttemptRemainingSeconds = useCallback((exam: Exam, attempt: ExamAttempt): number => {
    const durationMs = Math.max(1, exam.durationMinutes || 1) * 60 * 1000;
    const startedMs = attempt.startedAt ? new Date(attempt.startedAt).getTime() : Date.now();
    const attemptDeadlineMs = (Number.isNaN(startedMs) ? Date.now() : startedMs) + durationMs;
    const scheduleEndMs = exam.schedule?.endTime
      ? new Date(exam.schedule.endTime).getTime()
      : attemptDeadlineMs;
    const effectiveEndMs = Number.isNaN(scheduleEndMs)
      ? attemptDeadlineMs
      : Math.min(attemptDeadlineMs, scheduleEndMs);
    return Math.max(0, Math.floor((effectiveEndMs - Date.now()) / 1000));
  }, []);

  const getAttempt = (examId: string, studentId: string): ExamAttempt | undefined => {
    return attemptsRef.current.find((att) => att.examId === examId && att.studentId === studentId);
  };

  const syncAttemptFromServer = useCallback(
    async (examId: string, studentId: string): Promise<ExamAttempt | undefined> => {
      const attemptId = `att_${examId}_${studentId}`;
      try {
        const snap = await getDocFromServer(doc(db, 'attempts', attemptId));
        if (!snap.exists()) return undefined;
        const remoteAttempt = snap.data() as ExamAttempt;
        setAttempts((prev) => {
          const idx = prev.findIndex((a) => a.id === remoteAttempt.id);
          let next: ExamAttempt[];
          if (idx >= 0) {
            // Preserve local completed lock if already submitted locally
            if (prev[idx].isCompleted && !remoteAttempt.isCompleted) {
              return prev;
            }
            next = prev.map((a, i) => (i === idx ? remoteAttempt : a));
          } else {
            next = [...prev, remoteAttempt];
          }
          attemptsRef.current = next;
          return next;
        });
        return remoteAttempt;
      } catch (err) {
        console.warn('Firestore attempt server check notice:', err);
        return undefined;
      }
    },
    []
  );

  const startAttempt = (examId: string, student: User): ExamAttempt => {
    const existing = getAttempt(examId, student.id);
    if (existing) {
      // Strictly 1 attempt per student per exam (either resuming active session or returning locked attempt)
      return existing;
    }

    const exam = examsRef.current.find((e) => e.id === examId);
    let shuffledQuestionIds: string[] | undefined;
    let shuffledOptionMap: Record<string, string[]> | undefined;

    if (exam && exam.questions && exam.questions.length > 0) {
      // 1. Acak urutan butir soal per mahasiswa jika diaktifkan
      if (exam.shuffleQuestions) {
        const qIds = exam.questions.map((q) => q.id);
        for (let i = qIds.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [qIds[i], qIds[j]] = [qIds[j], qIds[i]];
        }
        shuffledQuestionIds = qIds;
      }

      // 2. Acak opsi jawaban (A, B, C, D) per mahasiswa jika diaktifkan
      if (exam.shuffleOptions) {
        shuffledOptionMap = {};
        exam.questions.forEach((q) => {
          const optIds = q.options.map((o) => o.id);
          for (let i = optIds.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [optIds[i], optIds[j]] = [optIds[j], optIds[i]];
          }
          shuffledOptionMap![q.id] = optIds;
        });
      }
    }

    const newAttempt: ExamAttempt = {
      id: `att_${examId}_${student.id}`,
      examId,
      studentId: student.id,
      studentName: student.name,
      studentNim: student.nimOrNip,
      studentClassName: student.className,
      startedAt: new Date().toISOString(),
      isCompleted: false,
      answers: {},
      violationsCount: 0,
      violationLogs: [],
      status: 'in_progress',
      shuffledQuestionIds,
      shuffledOptionMap,
    };

    const nextAttempts = [...attemptsRef.current, newAttempt];
    attemptsRef.current = nextAttempts;
    setAttempts(nextAttempts);

    // Async save to Firestore
    setDoc(doc(db, 'attempts', newAttempt.id), cleanFirestoreData(newAttempt)).catch((e) => {
      console.warn('Firestore attempt save:', e);
    });

    return newAttempt;
  };

  const saveAnswer = (
    attemptId: string,
    questionId: string,
    option: string,
    isFlagged: boolean = false
  ) => {
    const target = attemptsRef.current.find((a) => a.id === attemptId);
    if (
      !target ||
      target.isCompleted ||
      target.status === 'submitted' ||
      target.status === 'timed_out'
    ) {
      return;
    }

    const exam = examsRef.current.find((e) => e.id === target.examId);
    if (exam && getExamAttemptRemainingSeconds(exam, target) <= 0) {
      return;
    }

    setAttempts((prev) => {
      const next = prev.map((att) => {
        if (
          att.id !== attemptId ||
          att.isCompleted ||
          att.status === 'submitted' ||
          att.status === 'timed_out'
        ) {
          return att;
        }
        const updated = {
          ...att,
          answers: {
            ...att.answers,
            [questionId]: {
              questionId,
              selectedOption: option,
              isFlagged,
            },
          },
        };
        setDoc(doc(db, 'attempts', attemptId), cleanFirestoreData(updated), { merge: true }).catch(
          (err) => {
            console.warn('Firestore saveAnswer blocked/error:', err);
          }
        );
        return updated;
      });
      attemptsRef.current = next;
      return next;
    });
  };

  const toggleFlagAnswer = (attemptId: string, questionId: string) => {
    const target = attemptsRef.current.find((a) => a.id === attemptId);
    if (
      !target ||
      target.isCompleted ||
      target.status === 'submitted' ||
      target.status === 'timed_out'
    ) {
      return;
    }

    const exam = examsRef.current.find((e) => e.id === target.examId);
    if (exam && getExamAttemptRemainingSeconds(exam, target) <= 0) {
      return;
    }

    setAttempts((prev) => {
      const next = prev.map((att) => {
        if (
          att.id !== attemptId ||
          att.isCompleted ||
          att.status === 'submitted' ||
          att.status === 'timed_out'
        ) {
          return att;
        }
        const currentAnswer = att.answers[questionId] || {
          questionId,
          selectedOption: '',
          isFlagged: false,
        };
        const updated = {
          ...att,
          answers: {
            ...att.answers,
            [questionId]: {
              ...currentAnswer,
              isFlagged: !currentAnswer.isFlagged,
            },
          },
        };
        setDoc(doc(db, 'attempts', attemptId), cleanFirestoreData(updated), { merge: true }).catch(
          () => {}
        );
        return updated;
      });
      attemptsRef.current = next;
      return next;
    });
  };

  // COURSE & E-LEARNING MANAGEMENT
  const addCourse = async (
    courseData: Omit<Course, 'id' | 'createdAt' | 'materials' | 'assignments' | 'videos'>
  ): Promise<Course> => {
    const newCourse: Course = {
      ...courseData,
      id: `course-${Date.now()}`,
      assignedClassIds: courseData.assignedClassIds || [],
      enrolledUserIds: courseData.enrolledUserIds || [],
      materials: [],
      assignments: [],
      videos: [],
      createdAt: new Date().toISOString(),
    };
    setCourses((prev) => [newCourse, ...prev]);
    coursesRef.current = [newCourse, ...coursesRef.current];
    try {
      await setDoc(doc(db, 'courses', newCourse.id), cleanFirestoreData(newCourse));
      setFirebaseStatus('connected');
      setLastFirebaseSyncTime(new Date().toLocaleTimeString('id-ID'));
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `courses/${newCourse.id}`);
      throw err;
    }
    return newCourse;
  };

  const updateCourse = async (updated: Course): Promise<void> => {
    const normalized: Course = {
      ...updated,
      assignedClassIds: updated.assignedClassIds || [],
      enrolledUserIds: updated.enrolledUserIds || [],
    };
    setCourses((prev) => prev.map((c) => (c.id === normalized.id ? normalized : c)));
    coursesRef.current = coursesRef.current.map((c) => (c.id === normalized.id ? normalized : c));
    try {
      await setDoc(doc(db, 'courses', normalized.id), cleanFirestoreData(normalized), { merge: true });
      setFirebaseStatus('connected');
      setLastFirebaseSyncTime(new Date().toLocaleTimeString('id-ID'));
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `courses/${normalized.id}`);
      throw err;
    }
  };

  const updateCourseEnrolledUsers = async (
    courseId: string,
    enrolledUserIds: string[]
  ): Promise<void> => {
    const existing = coursesRef.current.find((c) => c.id === courseId);
    if (!existing) throw new Error('Mata kuliah tidak ditemukan.');
    const uniqueIds = Array.from(new Set(enrolledUserIds));
    const updated: Course = { ...existing, enrolledUserIds: uniqueIds };
    setCourses((prev) => prev.map((c) => (c.id === courseId ? updated : c)));
    coursesRef.current = coursesRef.current.map((c) => (c.id === courseId ? updated : c));
    try {
      await setDoc(doc(db, 'courses', courseId), cleanFirestoreData(updated), { merge: true });
      setFirebaseStatus('connected');
      setLastFirebaseSyncTime(new Date().toLocaleTimeString('id-ID'));
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `courses/${courseId}`);
      throw err;
    }
  };

  const syncUserCourseEnrollments = async (
    userId: string,
    selectedCourseIds: string[]
  ): Promise<void> => {
    const selectedSet = new Set(selectedCourseIds);
    const updatedList: Course[] = [];
    const changedCourses: Course[] = [];

    for (const c of coursesRef.current) {
      const currentEnrolled = c.enrolledUserIds || [];
      const hasUser = currentEnrolled.includes(userId);
      const shouldHaveUser = selectedSet.has(c.id);

      if (hasUser === shouldHaveUser) {
        updatedList.push(c);
      } else {
        const nextEnrolled = shouldHaveUser
          ? Array.from(new Set([...currentEnrolled, userId]))
          : currentEnrolled.filter((id) => id !== userId);
        const nextCourse: Course = { ...c, enrolledUserIds: nextEnrolled };
        updatedList.push(nextCourse);
        changedCourses.push(nextCourse);
      }
    }

    if (changedCourses.length === 0) return;

    setCourses(updatedList);
    coursesRef.current = updatedList;

    try {
      await Promise.all(
        changedCourses.map((c) =>
          setDoc(doc(db, 'courses', c.id), cleanFirestoreData(c), { merge: true })
        )
      );
      setFirebaseStatus('connected');
      setLastFirebaseSyncTime(new Date().toLocaleTimeString('id-ID'));
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'courses');
      throw err;
    }
  };

  const deleteCourse = async (id: string): Promise<void> => {
    setCourses((prev) => prev.filter((c) => c.id !== id));
    coursesRef.current = coursesRef.current.filter((c) => c.id !== id);
    try {
      await deleteDoc(doc(db, 'courses', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `courses/${id}`);
      throw err;
    }
  };

  const addMaterial = async (
    courseId: string,
    materialData: Omit<CourseMaterial, 'id' | 'courseId' | 'uploadedAt'>
  ): Promise<void> => {
    const newMat: CourseMaterial = {
      ...materialData,
      id: `mat-${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      courseId,
      uploadedAt: new Date().toISOString(),
    };
    const existing = coursesRef.current.find((c) => c.id === courseId);
    if (!existing) {
      throw new Error('Mata kuliah tidak ditemukan.');
    }
    const updated = { ...existing, materials: [newMat, ...existing.materials] };
    setCourses((prev) => prev.map((c) => (c.id === courseId ? updated : c)));

    try {
      await setDoc(doc(db, 'courses', courseId), cleanFirestoreData(updated), { merge: true });
      setFirebaseStatus('connected');
      setLastFirebaseSyncTime(new Date().toLocaleTimeString('id-ID'));
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `courses/${courseId}`);
      throw err;
    }
  };

  const deleteMaterial = async (courseId: string, materialId: string): Promise<void> => {
    const existing = coursesRef.current.find((c) => c.id === courseId);
    if (!existing) return;
    const targetMat = existing.materials.find((m) => m.id === materialId);
    const updated = {
      ...existing,
      materials: existing.materials.filter((m) => m.id !== materialId),
    };
    setCourses((prev) => prev.map((c) => (c.id === courseId ? updated : c)));

    try {
      await setDoc(doc(db, 'courses', courseId), cleanFirestoreData(updated), { merge: true });
      if (targetMat?.fileId) {
        await deleteStoredFile(targetMat.fileId);
      }
      setFirebaseStatus('connected');
      setLastFirebaseSyncTime(new Date().toLocaleTimeString('id-ID'));
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `courses/${courseId}`);
      throw err;
    }
  };

  const addAssignment = async (
    courseId: string,
    assignmentData: Omit<CourseAssignment, 'id' | 'courseId' | 'createdAt' | 'submissions'>
  ): Promise<void> => {
    const newAss: CourseAssignment = {
      ...assignmentData,
      id: `ass-${Date.now()}`,
      courseId,
      submissions: [],
      createdAt: new Date().toISOString(),
    };
    const existing = coursesRef.current.find((c) => c.id === courseId);
    if (!existing) {
      throw new Error('Mata kuliah tidak ditemukan.');
    }
    const updated = { ...existing, assignments: [newAss, ...existing.assignments] };
    setCourses((prev) => prev.map((c) => (c.id === courseId ? updated : c)));

    try {
      await setDoc(doc(db, 'courses', courseId), cleanFirestoreData(updated), { merge: true });
      setFirebaseStatus('connected');
      setLastFirebaseSyncTime(new Date().toLocaleTimeString('id-ID'));
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `courses/${courseId}`);
      throw err;
    }
  };

  const updateAssignment = async (
    courseId: string,
    updatedAssignment: CourseAssignment
  ): Promise<void> => {
    const existing = coursesRef.current.find((c) => c.id === courseId);
    if (!existing) {
      throw new Error('Mata kuliah tidak ditemukan.');
    }
    const updated = {
      ...existing,
      assignments: existing.assignments.map((a) =>
        a.id === updatedAssignment.id ? updatedAssignment : a
      ),
    };
    setCourses((prev) => prev.map((c) => (c.id === courseId ? updated : c)));

    try {
      await setDoc(doc(db, 'courses', courseId), cleanFirestoreData(updated), { merge: true });
      setFirebaseStatus('connected');
      setLastFirebaseSyncTime(new Date().toLocaleTimeString('id-ID'));
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `courses/${courseId}`);
      throw err;
    }
  };

  const deleteAssignment = async (courseId: string, assignmentId: string): Promise<void> => {
    const existing = coursesRef.current.find((c) => c.id === courseId);
    if (!existing) return;
    const targetAss = existing.assignments.find((a) => a.id === assignmentId);
    const updated = {
      ...existing,
      assignments: existing.assignments.filter((a) => a.id !== assignmentId),
    };
    setCourses((prev) => prev.map((c) => (c.id === courseId ? updated : c)));

    try {
      await setDoc(doc(db, 'courses', courseId), cleanFirestoreData(updated), { merge: true });
      if (targetAss?.attachmentFileId) {
        await deleteStoredFile(targetAss.attachmentFileId);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `courses/${courseId}`);
      throw err;
    }
  };

  const submitAssignment = async (
    courseId: string,
    assignmentId: string,
    submissionData: Omit<CourseAssignmentSubmission, 'id' | 'courseId' | 'assignmentId' | 'submittedAt'>
  ): Promise<void> => {
    const existing = coursesRef.current.find((c) => c.id === courseId);
    if (!existing) {
      throw new Error('Mata kuliah tidak ditemukan.');
    }
    const targetAss = existing.assignments.find((a) => a.id === assignmentId);
    if (!targetAss) {
      throw new Error('Slot tugas tidak ditemukan.');
    }

    const nowMs = Date.now();
    if (targetAss.openDate && nowMs < new Date(targetAss.openDate).getTime()) {
      throw new Error('Slot pengumpulan tugas ini belum dibuka sesuai jadwal.');
    }
    const isPastDeadline = nowMs > new Date(targetAss.dueDate).getTime();
    const shouldAutoLock = targetAss.lockAfterDeadline !== false;
    if (isPastDeadline && shouldAutoLock) {
      throw new Error(
        'Tenggat waktu pengumpulan tugas telah berakhir. Slot pengumpulan sudah terkunci otomatis.'
      );
    }

    const newSubmission: CourseAssignmentSubmission = {
      ...submissionData,
      id: `sub-${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      courseId,
      assignmentId,
      submittedAt: new Date().toISOString(),
      submissionStatus: isPastDeadline ? 'terlambat' : 'tepat_waktu',
    };

    const updatedAssignments = existing.assignments.map((ass) => {
      if (ass.id !== assignmentId) return ass;
      const filtered = ass.submissions.filter((s) => s.studentId !== submissionData.studentId);
      return {
        ...ass,
        submissions: [newSubmission, ...filtered],
      };
    });
    const updatedCourse = { ...existing, assignments: updatedAssignments };
    setCourses((prev) => prev.map((c) => (c.id === courseId ? updatedCourse : c)));

    try {
      await setDoc(doc(db, 'courses', courseId), cleanFirestoreData(updatedCourse), { merge: true });
      setFirebaseStatus('connected');
      setLastFirebaseSyncTime(new Date().toLocaleTimeString('id-ID'));
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `courses/${courseId}`);
      throw err;
    }
  };

  const gradeAssignmentSubmission = async (
    courseId: string,
    assignmentId: string,
    submissionId: string,
    grade: number,
    feedback?: string
  ): Promise<void> => {
    const existing = coursesRef.current.find((c) => c.id === courseId);
    if (!existing) return;
    const updatedAssignments = existing.assignments.map((ass) => {
      if (ass.id !== assignmentId) return ass;
      return {
        ...ass,
        submissions: ass.submissions.map((s) =>
          s.id === submissionId ? { ...s, grade, feedback: feedback ?? '' } : s
        ),
      };
    });
    const updatedCourse = { ...existing, assignments: updatedAssignments };
    setCourses((prev) => prev.map((c) => (c.id === courseId ? updatedCourse : c)));

    try {
      await setDoc(doc(db, 'courses', courseId), cleanFirestoreData(updatedCourse), { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `courses/${courseId}`);
      throw err;
    }
  };

  const addVideo = async (
    courseId: string,
    videoData: Omit<CourseVideo, 'id' | 'courseId' | 'addedAt'>
  ): Promise<void> => {
    const newVideo: CourseVideo = {
      ...videoData,
      id: `vid-${Date.now()}`,
      courseId,
      addedAt: new Date().toISOString(),
    };
    const existing = coursesRef.current.find((c) => c.id === courseId);
    if (!existing) return;
    const updated = { ...existing, videos: [newVideo, ...existing.videos] };
    setCourses((prev) => prev.map((c) => (c.id === courseId ? updated : c)));

    try {
      await setDoc(doc(db, 'courses', courseId), cleanFirestoreData(updated), { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `courses/${courseId}`);
      throw err;
    }
  };

  // =========================================================================
  // MOODLE TOPICS & CONTENT BLOCKS (ADD TEXT / GAMBAR)
  // =========================================================================
  const persistCourseUpdate = async (courseId: string, updatedCourse: Course) => {
    setCourses((prev) => prev.map((c) => (c.id === courseId ? updatedCourse : c)));
    try {
      await setDoc(doc(db, 'courses', courseId), cleanFirestoreData(updatedCourse), { merge: true });
      setFirebaseStatus('connected');
      setLastFirebaseSyncTime(new Date().toLocaleTimeString('id-ID'));
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `courses/${courseId}`);
      throw err;
    }
  };

  const addCourseTopic = async (
    courseId: string,
    topicData: Omit<CourseTopic, 'id' | 'courseId' | 'createdAt'>
  ): Promise<CourseTopic> => {
    const existing = coursesRef.current.find((c) => c.id === courseId);
    if (!existing) throw new Error('Mata kuliah tidak ditemukan.');
    const newTopic: CourseTopic = {
      ...topicData,
      id: `topic-${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      courseId,
      createdAt: new Date().toISOString(),
    };
    const updatedTopics = [...(existing.topics || []), newTopic].sort((a, b) => a.order - b.order);
    await persistCourseUpdate(courseId, { ...existing, topics: updatedTopics });
    return newTopic;
  };

  const updateCourseTopic = async (courseId: string, updatedTopic: CourseTopic): Promise<void> => {
    const existing = coursesRef.current.find((c) => c.id === courseId);
    if (!existing) throw new Error('Mata kuliah tidak ditemukan.');
    const updatedTopics = (existing.topics || [])
      .map((t) => (t.id === updatedTopic.id ? updatedTopic : t))
      .sort((a, b) => a.order - b.order);
    await persistCourseUpdate(courseId, { ...existing, topics: updatedTopics });
  };

  const deleteCourseTopic = async (courseId: string, topicId: string): Promise<void> => {
    const existing = coursesRef.current.find((c) => c.id === courseId);
    if (!existing) return;
    const updatedCourse: Course = {
      ...existing,
      topics: (existing.topics || []).filter((t) => t.id !== topicId),
      contentBlocks: (existing.contentBlocks || []).map((b) =>
        b.topicId === topicId ? { ...b, topicId: undefined } : b
      ),
      materials: existing.materials.map((m) =>
        m.topicId === topicId ? { ...m, topicId: undefined } : m
      ),
      assignments: existing.assignments.map((a) =>
        a.topicId === topicId ? { ...a, topicId: undefined } : a
      ),
      peerProjects: (existing.peerProjects || []).map((p) =>
        p.topicId === topicId ? { ...p, topicId: undefined } : p
      ),
      videos: existing.videos.map((v) =>
        v.topicId === topicId ? { ...v, topicId: undefined } : v
      ),
    };
    await persistCourseUpdate(courseId, updatedCourse);
  };

  const addTopicBlock = async (
    courseId: string,
    blockData: Omit<CourseContentBlock, 'id' | 'courseId' | 'createdAt'>
  ): Promise<CourseContentBlock> => {
    const existing = coursesRef.current.find((c) => c.id === courseId);
    if (!existing) throw new Error('Mata kuliah tidak ditemukan.');
    const newBlock: CourseContentBlock = {
      ...blockData,
      id: `blk-${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      courseId,
      createdAt: new Date().toISOString(),
    };
    await persistCourseUpdate(courseId, {
      ...existing,
      contentBlocks: [...(existing.contentBlocks || []), newBlock],
    });
    return newBlock;
  };

  const updateTopicBlock = async (
    courseId: string,
    updatedBlock: CourseContentBlock
  ): Promise<void> => {
    const existing = coursesRef.current.find((c) => c.id === courseId);
    if (!existing) throw new Error('Mata kuliah tidak ditemukan.');
    await persistCourseUpdate(courseId, {
      ...existing,
      contentBlocks: (existing.contentBlocks || []).map((b) =>
        b.id === updatedBlock.id ? updatedBlock : b
      ),
    });
  };

  const deleteTopicBlock = async (courseId: string, blockId: string): Promise<void> => {
    const existing = coursesRef.current.find((c) => c.id === courseId);
    if (!existing) return;
    const targetBlock = (existing.contentBlocks || []).find((b) => b.id === blockId);
    await persistCourseUpdate(courseId, {
      ...existing,
      contentBlocks: (existing.contentBlocks || []).filter((b) => b.id !== blockId),
    });
    if (targetBlock?.imageFileId) {
      await deleteStoredFile(targetBlock.imageFileId);
    }
  };

  // =========================================================================
  // TUGAS PROJEK MAHASISWA (PEER ASSESSMENT + LECTURER OVERRIDE)
  // =========================================================================
  const getCandidateStudentsForCourse = (course: Course): User[] => {
    const allStudents = usersRef.current.filter((u) => u.role === 'mahasiswa');
    const enrolledIds = course.enrolledUserIds || [];
    const assignedClasses = course.assignedClassIds || [];
    const hasEnrolledStudents = enrolledIds.some((uid) =>
      allStudents.some((s) => s.id === uid)
    );

    if (assignedClasses.length > 0 || hasEnrolledStudents) {
      const scoped = allStudents.filter(
        (u) =>
          enrolledIds.includes(u.id) ||
          (u.classId && assignedClasses.includes(u.classId))
      );
      if (scoped.length > 0) return scoped;
    }
    return allStudents;
  };

  const addPeerProject = async (
    courseId: string,
    projectData: Omit<PeerProjectAssignment, 'id' | 'courseId' | 'createdAt' | 'submissions'>
  ): Promise<PeerProjectAssignment> => {
    const existing = coursesRef.current.find((c) => c.id === courseId);
    if (!existing) throw new Error('Mata kuliah tidak ditemukan.');
    const newProj: PeerProjectAssignment = {
      ...projectData,
      id: `pproj-${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      courseId,
      submissions: [],
      createdAt: new Date().toISOString(),
    };
    await persistCourseUpdate(courseId, {
      ...existing,
      peerProjects: [newProj, ...(existing.peerProjects || [])],
    });
    return newProj;
  };

  const updatePeerProject = async (
    courseId: string,
    updatedProject: PeerProjectAssignment
  ): Promise<void> => {
    const existing = coursesRef.current.find((c) => c.id === courseId);
    if (!existing) throw new Error('Mata kuliah tidak ditemukan.');
    await persistCourseUpdate(courseId, {
      ...existing,
      peerProjects: (existing.peerProjects || []).map((p) =>
        p.id === updatedProject.id ? updatedProject : p
      ),
    });
  };

  const deletePeerProject = async (courseId: string, projectId: string): Promise<void> => {
    const existing = coursesRef.current.find((c) => c.id === courseId);
    if (!existing) return;
    const target = (existing.peerProjects || []).find((p) => p.id === projectId);
    await persistCourseUpdate(courseId, {
      ...existing,
      peerProjects: (existing.peerProjects || []).filter((p) => p.id !== projectId),
    });
    if (target?.attachmentFileId) {
      await deleteStoredFile(target.attachmentFileId);
    }
  };

  const submitPeerProject = async (
    courseId: string,
    projectId: string,
    submissionData: Omit<
      PeerProjectSubmission,
      'id' | 'courseId' | 'projectId' | 'submittedAt' | 'assignedReviewerIds' | 'peerReviews'
    >
  ): Promise<void> => {
    const existing = coursesRef.current.find((c) => c.id === courseId);
    if (!existing) throw new Error('Mata kuliah tidak ditemukan.');
    const targetProj = (existing.peerProjects || []).find((p) => p.id === projectId);
    if (!targetProj) throw new Error('Slot Tugas Projek Mahasiswa tidak ditemukan.');

    const nowMs = Date.now();
    if (targetProj.openDate && nowMs < new Date(targetProj.openDate).getTime()) {
      throw new Error('Slot pengumpulan Tugas Projek Mahasiswa belum dibuka.');
    }
    const isPastDeadline = nowMs > new Date(targetProj.dueDate).getTime();
    if (isPastDeadline && targetProj.lockAfterDeadline !== false) {
      throw new Error(
        'Tenggat pengumpulan telah berakhir. Slot pengumpulan sudah terkunci otomatis.'
      );
    }

    const prevSub = (targetProj.submissions || []).find(
      (s) => s.studentId === submissionData.studentId
    );

    const newSub: PeerProjectSubmission = {
      ...submissionData,
      id: prevSub?.id || `psub-${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      courseId,
      projectId,
      submittedAt: new Date().toISOString(),
      submissionStatus: isPastDeadline ? 'terlambat' : 'tepat_waktu',
      assignedReviewerIds: prevSub?.assignedReviewerIds || [],
      peerReviews: prevSub?.peerReviews || [],
      lecturerScore: prevSub?.lecturerScore,
      lecturerFeedback: prevSub?.lecturerFeedback,
      lecturerMode: prevSub?.lecturerMode,
      lecturerGradedBy: prevSub?.lecturerGradedBy,
      lecturerGradedAt: prevSub?.lecturerGradedAt,
      finalScore: prevSub?.finalScore,
    };

    const mergedSubmissions = [
      newSub,
      ...(targetProj.submissions || []).filter((s) => s.studentId !== submissionData.studentId),
    ];

    // Auto-assign peer reviewers fairly whenever submissions are updated
    const candidates = getCandidateStudentsForCourse(existing);
    const allocatedSubmissions = allocateBalancedPeerReviewers({
      submissions: mergedSubmissions,
      candidateStudents: candidates,
      reviewersPerSubmission: targetProj.reviewersPerSubmission || 2,
      forceReassign: false,
    });

    const updatedProjects = (existing.peerProjects || []).map((p) =>
      p.id === projectId ? { ...p, submissions: allocatedSubmissions } : p
    );
    await persistCourseUpdate(courseId, { ...existing, peerProjects: updatedProjects });
  };

  const assignPeerReviewers = async (
    courseId: string,
    projectId: string,
    forceReassign: boolean = false
  ): Promise<void> => {
    const existing = coursesRef.current.find((c) => c.id === courseId);
    if (!existing) throw new Error('Mata kuliah tidak ditemukan.');
    const targetProj = (existing.peerProjects || []).find((p) => p.id === projectId);
    if (!targetProj) throw new Error('Slot Tugas Projek Mahasiswa tidak ditemukan.');

    const candidates = getCandidateStudentsForCourse(existing);
    const allocated = allocateBalancedPeerReviewers({
      submissions: targetProj.submissions || [],
      candidateStudents: candidates,
      reviewersPerSubmission: targetProj.reviewersPerSubmission || 2,
      forceReassign,
    });

    const updatedProjects = (existing.peerProjects || []).map((p) =>
      p.id === projectId ? { ...p, submissions: allocated } : p
    );
    await persistCourseUpdate(courseId, { ...existing, peerProjects: updatedProjects });
  };

  const submitPeerReview = async (
    courseId: string,
    projectId: string,
    submissionId: string,
    reviewData: Omit<PeerReviewEntry, 'id' | 'submittedAt'>
  ): Promise<void> => {
    const existing = coursesRef.current.find((c) => c.id === courseId);
    if (!existing) throw new Error('Mata kuliah tidak ditemukan.');
    const targetProj = (existing.peerProjects || []).find((p) => p.id === projectId);
    if (!targetProj) throw new Error('Tugas Projek Mahasiswa tidak ditemukan.');

    const entry: PeerReviewEntry = {
      ...reviewData,
      id: `prev-${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      submittedAt: new Date().toISOString(),
    };

    const updatedProjects = (existing.peerProjects || []).map((proj) => {
      if (proj.id !== projectId) return proj;
      return {
        ...proj,
        submissions: proj.submissions.map((sub) => {
          if (sub.id !== submissionId) return sub;
          const nextReviews = [
            entry,
            ...(sub.peerReviews || []).filter((r) => r.reviewerId !== reviewData.reviewerId),
          ];
          const updatedSub: PeerProjectSubmission = {
            ...sub,
            peerReviews: nextReviews,
          };
          const metrics = computePeerSubmissionMetrics(updatedSub, proj.maxPoints || 100);
          return {
            ...updatedSub,
            finalScore: metrics.finalScore ?? undefined,
          };
        }),
      };
    });

    await persistCourseUpdate(courseId, { ...existing, peerProjects: updatedProjects });
  };

  const submitLecturerPeerGrade = async (
    courseId: string,
    projectId: string,
    submissionId: string,
    lecturerScore: number,
    lecturerMode: LecturerPeerOverrideMode,
    lecturerFeedback?: string
  ): Promise<void> => {
    const existing = coursesRef.current.find((c) => c.id === courseId);
    if (!existing) throw new Error('Mata kuliah tidak ditemukan.');

    const updatedProjects = (existing.peerProjects || []).map((proj) => {
      if (proj.id !== projectId) return proj;
      return {
        ...proj,
        submissions: proj.submissions.map((sub) => {
          if (sub.id !== submissionId) return sub;
          const updatedSub: PeerProjectSubmission = {
            ...sub,
            lecturerScore: Number(lecturerScore),
            lecturerMode,
            lecturerFeedback: lecturerFeedback ?? '',
            lecturerGradedBy: currentUser?.name || 'Dosen Pengampu',
            lecturerGradedAt: new Date().toISOString(),
          };
          const metrics = computePeerSubmissionMetrics(updatedSub, proj.maxPoints || 100);
          return {
            ...updatedSub,
            finalScore: metrics.finalScore ?? undefined,
          };
        }),
      };
    });

    await persistCourseUpdate(courseId, { ...existing, peerProjects: updatedProjects });
  };

  const deleteVideo = async (courseId: string, videoId: string): Promise<void> => {
    const existing = coursesRef.current.find((c) => c.id === courseId);
    if (!existing) return;
    const updated = { ...existing, videos: existing.videos.filter((v) => v.id !== videoId) };
    setCourses((prev) => prev.map((c) => (c.id === courseId ? updated : c)));

    try {
      await setDoc(doc(db, 'courses', courseId), cleanFirestoreData(updated), { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `courses/${courseId}`);
      throw err;
    }
  };

  const submitAttempt = (attemptId: string, isTimedOut: boolean = false): ExamAttempt | undefined => {
    const currentList = attemptsRef.current;
    const targetAtt = currentList.find((a) => a.id === attemptId);
    if (!targetAtt) return undefined;

    // Terminal state lock: if already completed, never allow re-submission or altering answers
    if (targetAtt.isCompleted) {
      return targetAtt;
    }

    const exam = examsRef.current.find((e) => e.id === targetAtt.examId);
    if (!exam) return undefined;

    const submittedAtNow = new Date().toISOString();
    const prelimUpdated = currentList.map((att) =>
      att.id === attemptId
        ? {
            ...att,
            isCompleted: true,
            submittedAt: submittedAtNow,
            status: (isTimedOut ? 'timed_out' : 'submitted') as 'timed_out' | 'submitted',
          }
        : att
    );

    const evaluatedAll = computeEvaluatedAttemptsForExam(exam, prelimUpdated);
    const completedAttempt = evaluatedAll.find((a) => a.id === attemptId);
    attemptsRef.current = evaluatedAll;
    setAttempts(evaluatedAll);

    return completedAttempt;
  };

  // VIOLATIONS
  const recordViolation = (
    data: Omit<ViolationLog, 'id' | 'timestamp' | 'reviewedByLecturer'>
  ): ViolationLog => {
    const student = users.find((u) => u.id === data.studentId);
    const newViolation: ViolationLog = {
      ...data,
      studentClassName: data.studentClassName || student?.className || '',
      id: `viol_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
      reviewedByLecturer: false,
    };

    setViolations((prev) => [newViolation, ...prev]);

    setDoc(doc(db, 'violations', newViolation.id), cleanFirestoreData(newViolation)).catch((e) =>
      console.warn('Failed saving violation to Firestore:', e)
    );

    setAttempts((prev) =>
      prev.map((att) => {
        if (att.examId === data.examId && att.studentId === data.studentId) {
          const updated = {
            ...att,
            violationsCount: att.violationsCount + 1,
            violationLogs: [newViolation, ...att.violationLogs],
          };
          setDoc(doc(db, 'attempts', att.id), cleanFirestoreData(updated), { merge: true }).catch(() => {});
          return updated;
        }
        return att;
      })
    );

    return newViolation;
  };

  const markViolationReviewed = (violationId: string) => {
    setViolations((prev) =>
      prev.map((v) => (v.id === violationId ? { ...v, reviewedByLecturer: true } : v))
    );
    updateDoc(doc(db, 'violations', violationId), { reviewedByLecturer: true }).catch(() => {});
  };

  const markAllViolationsReviewed = () => {
    setViolations((prev) => prev.map((v) => ({ ...v, reviewedByLecturer: true })));
    violations.forEach((v) => {
      updateDoc(doc(db, 'violations', v.id), { reviewedByLecturer: true }).catch(() => {});
    });
  };

  const deleteViolation = async (violationId: string): Promise<void> => {
    setViolations((prev) => prev.filter((v) => v.id !== violationId));
    try {
      await deleteDoc(doc(db, 'violations', violationId));
    } catch (err) {
      console.warn('Failed deleting violation from Firestore:', err);
    }
    // Also remove from attempts
    setAttempts((prev) =>
      prev.map((att) => {
        const hasViol = att.violationLogs.some((v) => v.id === violationId);
        if (!hasViol) return att;
        const remainingLogs = att.violationLogs.filter((v) => v.id !== violationId);
        const updatedAtt = {
          ...att,
          violationLogs: remainingLogs,
          violationsCount: remainingLogs.length,
        };
        setDoc(doc(db, 'attempts', att.id), updatedAtt, { merge: true }).catch(() => {});
        return updatedAtt;
      })
    );
  };

  const clearViolations = async (examId?: string): Promise<void> => {
    if (examId) {
      const toDelete = violations.filter((v) => v.examId === examId);
      setViolations((prev) => prev.filter((v) => v.examId !== examId));
      for (const v of toDelete) {
        deleteDoc(doc(db, 'violations', v.id)).catch(() => {});
      }
      setAttempts((prev) =>
        prev.map((att) => {
          if (att.examId !== examId) return att;
          const updated = { ...att, violationLogs: [], violationsCount: 0 };
          setDoc(doc(db, 'attempts', att.id), updated, { merge: true }).catch(() => {});
          return updated;
        })
      );
    } else {
      const all = [...violations];
      setViolations([]);
      for (const v of all) {
        deleteDoc(doc(db, 'violations', v.id)).catch(() => {});
      }
      setAttempts((prev) =>
        prev.map((att) => {
          const updated = { ...att, violationLogs: [], violationsCount: 0 };
          setDoc(doc(db, 'attempts', att.id), updated, { merge: true }).catch(() => {});
          return updated;
        })
      );
    }
  };

  const unreadViolationsCount = violations.filter((v) => !v.reviewedByLecturer).length;

  // ATTENDANCE & GRADEBOOK ACTIONS
  const generateQrTokenString = () => {
    const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
    const ts = Date.now().toString(36).slice(-5).toUpperCase();
    return `QR-${ts}-${rand}`;
  };

  const createAttendanceSession = async (
    data: Omit<
      AttendanceSession,
      'id' | 'createdAt' | 'records' | 'currentQrToken' | 'previousQrToken' | 'qrUpdatedAt'
    >
  ): Promise<AttendanceSession> => {
    const newId = `att_ses_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const nowIso = new Date().toISOString();
    const newSession: AttendanceSession = {
      ...data,
      id: newId,
      currentQrToken: generateQrTokenString(),
      qrUpdatedAt: nowIso,
      records: [],
      createdAt: nowIso,
    };

    setAttendanceSessions((prev) => [newSession, ...prev]);

    try {
      await setDoc(doc(db, 'attendance_sessions', newId), cleanFirestoreData(newSession));
      setFirebaseStatus('connected');
      setLastFirebaseSyncTime(new Date().toLocaleTimeString('id-ID'));
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `attendance_sessions/${newId}`);
      throw err;
    }

    return newSession;
  };

  const updateAttendanceSession = async (session: AttendanceSession): Promise<void> => {
    setAttendanceSessions((prev) => prev.map((s) => (s.id === session.id ? session : s)));
    try {
      await setDoc(
        doc(db, 'attendance_sessions', session.id),
        cleanFirestoreData(session),
        { merge: true }
      );
      setFirebaseStatus('connected');
      setLastFirebaseSyncTime(new Date().toLocaleTimeString('id-ID'));
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `attendance_sessions/${session.id}`);
      throw err;
    }
  };

  const deleteAttendanceSession = async (sessionId: string): Promise<void> => {
    setAttendanceSessions((prev) => prev.filter((s) => s.id !== sessionId));
    try {
      await deleteDoc(doc(db, 'attendance_sessions', sessionId));
      setFirebaseStatus('connected');
      setLastFirebaseSyncTime(new Date().toLocaleTimeString('id-ID'));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `attendance_sessions/${sessionId}`);
      throw err;
    }
  };

  const rotateAttendanceQrToken = async (sessionId: string): Promise<string> => {
    const existing = attendanceSessionsRef.current.find((s) => s.id === sessionId);
    if (!existing) throw new Error('Sesi absensi tidak ditemukan.');

    const nextToken = generateQrTokenString();
    const nowIso = new Date().toISOString();
    const updatedSession: AttendanceSession = {
      ...existing,
      previousQrToken: existing.currentQrToken,
      currentQrToken: nextToken,
      qrUpdatedAt: nowIso,
    };

    setAttendanceSessions((prev) =>
      prev.map((s) => (s.id === sessionId ? updatedSession : s))
    );

    try {
      await setDoc(
        doc(db, 'attendance_sessions', sessionId),
        cleanFirestoreData({
          previousQrToken: updatedSession.previousQrToken,
          currentQrToken: updatedSession.currentQrToken,
          qrUpdatedAt: updatedSession.qrUpdatedAt,
        }),
        { merge: true }
      );
      setFirebaseStatus('connected');
      setLastFirebaseSyncTime(new Date().toLocaleTimeString('id-ID'));
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `attendance_sessions/${sessionId}`);
      throw err;
    }

    return nextToken;
  };

  const submitStudentAttendance = async (params: {
    sessionId: string;
    scannedToken: string;
    status: AttendanceStatus;
    note?: string;
  }): Promise<AttendanceRecord> => {
    if (!currentUser) {
      throw new Error('Silakan masuk ke akun mahasiswa terlebih dahulu.');
    }

    const session = attendanceSessionsRef.current.find((s) => s.id === params.sessionId);
    if (!session) {
      throw new Error('Sesi absensi tidak ditemukan atau telah dihapus oleh dosen.');
    }

    if (!session.isActive) {
      throw new Error('Sesi absensi ini sedang ditutup atau dinonaktifkan oleh dosen.');
    }

    const nowMs = Date.now();
    const startMs = new Date(session.startTime).getTime();
    const endMs = new Date(session.endTime).getTime();
    if (!Number.isNaN(startMs) && nowMs < startMs) {
      throw new Error('Sesi absensi belum dibuka sesuai jadwal yang ditentukan dosen.');
    }
    if (!Number.isNaN(endMs) && nowMs > endMs) {
      throw new Error('Waktu absensi telah berakhir. Batas waktu pengisian absensi sudah lewat.');
    }

    const cleanToken = params.scannedToken.trim();
    const qrUpdatedAtMs = new Date(session.qrUpdatedAt).getTime();
    const isWithinGraceWindow =
      Boolean(session.previousQrToken) &&
      cleanToken === session.previousQrToken &&
      !Number.isNaN(qrUpdatedAtMs) &&
      nowMs - qrUpdatedAtMs <= 8000;

    if (cleanToken !== session.currentQrToken && !isWithinGraceWindow) {
      throw new Error(
        'QR Code tidak valid atau sudah kedaluwarsa karena diperbarui otomatis. Silakan scan ulang QR terbaru dari dosen.'
      );
    }

    if (!session.allowedStatuses.includes(params.status)) {
      throw new Error('Opsi status absensi yang dipilih tidak diizinkan pada sesi ini.');
    }

    const cleanNote = (params.note || '').trim();
    const isPermitOrSick = params.status === 'izin' || params.status === 'sakit';
    if (session.requireNoteForPermit && isPermitOrSick) {
      const minLen = session.minNoteLength || 10;
      if (cleanNote.length < minLen) {
        throw new Error(
          `Format keterangan wajib diisi minimal ${minLen} karakter untuk opsi ${params.status.toUpperCase()}.`
        );
      }
    } else if (session.minNoteLength && session.minNoteLength > 0 && cleanNote.length > 0 && cleanNote.length < session.minNoteLength) {
      throw new Error(
        `Catatan keterangan harus sesuai format dosen (minimal ${session.minNoteLength} karakter).`
      );
    }

    const newRecord: AttendanceRecord = {
      id: `att_rec_${session.id}_${currentUser.id}`,
      sessionId: session.id,
      studentId: currentUser.id,
      studentName: currentUser.name,
      studentNim: currentUser.nimOrNip,
      studentClassId: currentUser.classId,
      studentClassName: currentUser.className,
      status: params.status,
      submittedAt: new Date().toISOString(),
      note: cleanNote,
      scannedToken: cleanToken,
      editedByLecturer: false,
    };

    const updatedRecords = [
      newRecord,
      ...session.records.filter((r) => r.studentId !== currentUser.id),
    ];
    const updatedSession: AttendanceSession = {
      ...session,
      records: updatedRecords,
    };

    setAttendanceSessions((prev) =>
      prev.map((s) => (s.id === session.id ? updatedSession : s))
    );

    try {
      await setDoc(
        doc(db, 'attendance_sessions', session.id),
        cleanFirestoreData({ records: updatedRecords }),
        { merge: true }
      );
      setFirebaseStatus('connected');
      setLastFirebaseSyncTime(new Date().toLocaleTimeString('id-ID'));
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `attendance_sessions/${session.id}`);
      throw err;
    }

    return newRecord;
  };

  const editAttendanceRecord = async (
    sessionId: string,
    student: User,
    status: AttendanceStatus,
    note?: string
  ): Promise<AttendanceRecord> => {
    const session = attendanceSessionsRef.current.find((s) => s.id === sessionId);
    if (!session) {
      throw new Error('Sesi absensi tidak ditemukan.');
    }

    const existingRec = session.records.find((r) => r.studentId === student.id);
    const nowIso = new Date().toISOString();
    const updatedRecord: AttendanceRecord = {
      id: existingRec?.id || `att_rec_${sessionId}_${student.id}`,
      sessionId,
      studentId: student.id,
      studentName: student.name,
      studentNim: student.nimOrNip,
      studentClassId: student.classId,
      studentClassName: student.className,
      status,
      submittedAt: existingRec?.submittedAt || nowIso,
      note: note !== undefined ? note.trim() : existingRec?.note || '',
      scannedToken: existingRec?.scannedToken,
      editedByLecturer: true,
      editedByName: currentUser?.name || 'Dosen Pengampu',
      editedAt: nowIso,
    };

    const updatedRecords = [
      updatedRecord,
      ...session.records.filter((r) => r.studentId !== student.id),
    ];

    setAttendanceSessions((prev) =>
      prev.map((s) => (s.id === sessionId ? { ...s, records: updatedRecords } : s))
    );

    try {
      await setDoc(
        doc(db, 'attendance_sessions', sessionId),
        cleanFirestoreData({ records: updatedRecords }),
        { merge: true }
      );
      setFirebaseStatus('connected');
      setLastFirebaseSyncTime(new Date().toLocaleTimeString('id-ID'));
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `attendance_sessions/${sessionId}`);
      throw err;
    }

    return updatedRecord;
  };

  const saveGradeConfig = async (config: GradeConfig): Promise<void> => {
    const cleanConfig: GradeConfig = {
      ...config,
      updatedAt: new Date().toISOString(),
      updatedBy: currentUser?.name || config.updatedBy || 'Dosen Pengampu',
    };

    setGradeConfigs((prev) => {
      const exists = prev.some((g) => g.id === cleanConfig.id);
      if (exists) {
        return prev.map((g) => (g.id === cleanConfig.id ? cleanConfig : g));
      }
      return [...prev, cleanConfig];
    });

    try {
      await setDoc(
        doc(db, 'grade_configs', cleanConfig.id),
        cleanFirestoreData(cleanConfig),
        { merge: true }
      );
      setFirebaseStatus('connected');
      setLastFirebaseSyncTime(new Date().toLocaleTimeString('id-ID'));
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `grade_configs/${cleanConfig.id}`);
      throw err;
    }
  };

  return (
    <ExamContext.Provider
      value={{
        currentUser,
        users,
        login,
        loginWithEmail,
        registerWithEmail,
        logout,
        classes,
        addClass,
        updateClass,
        deleteClass,
        addClassFile,
        deleteClassFile,
        addUser,
        updateUser,
        deleteUser,
        courses,
        addCourse,
        updateCourse,
        deleteCourse,
        updateCourseEnrolledUsers,
        syncUserCourseEnrollments,
        addMaterial,
        deleteMaterial,
        addAssignment,
        updateAssignment,
        deleteAssignment,
        submitAssignment,
        gradeAssignmentSubmission,
        addVideo,
        deleteVideo,
        addCourseTopic,
        updateCourseTopic,
        deleteCourseTopic,
        addTopicBlock,
        updateTopicBlock,
        deleteTopicBlock,
        addPeerProject,
        updatePeerProject,
        deletePeerProject,
        submitPeerProject,
        assignPeerReviewers,
        submitPeerReview,
        submitLecturerPeerGrade,
        exams,
        addExam,
        updateExam,
        assignExamToTopic,
        deleteExam,
        toggleScoreAnnouncement,
        publishScores,
        recalibrateExamScores,
        attempts,
        getAttempt,
        syncAttemptFromServer,
        getExamAttemptRemainingSeconds,
        startAttempt,
        saveAnswer,
        toggleFlagAnswer,
        submitAttempt,
        violations,
        unreadViolationsCount,
        recordViolation,
        markViolationReviewed,
        markAllViolationsReviewed,
        deleteViolation,
        clearViolations,
        attendanceSessions,
        createAttendanceSession,
        updateAttendanceSession,
        deleteAttendanceSession,
        rotateAttendanceQrToken,
        submitStudentAttendance,
        editAttendanceRecord,
        gradeConfigs,
        saveGradeConfig,
        getExamTimeStatus,
        isFirebaseSyncing,
        firebaseStatus,
        lastFirebaseSyncTime,
        firestoreDbName,
        forceSyncFirebase: syncFromFirestore,
      }}
    >
      {children}
    </ExamContext.Provider>
  );
};

export const useExam = () => {
  const context = useContext(ExamContext);
  if (!context) {
    throw new Error('useExam must be used within an ExamProvider');
  }
  return context;
};
