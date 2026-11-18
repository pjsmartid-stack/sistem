import { Question, QuestionOption, AikenParseResult, AikenParseError } from '../types';

/**
 * Robust Aiken Format Parser for LMS
 * Conforms to Moodle / Canvas Aiken specification.
 */
export function parseAikenFormat(rawText: string, defaultPoints: number = 10): AikenParseResult {
  const lines = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const questions: Question[] = [];
  const errors: AikenParseError[] = [];

  let currentQuestionTextLines: string[] = [];
  let currentOptions: QuestionOption[] = [];
  let currentLineNumber = 1;
  let blockStartLine = 1;

  function commitQuestion(endLine: number) {
    if (currentQuestionTextLines.length === 0 && currentOptions.length === 0) {
      return;
    }

    const questionText = currentQuestionTextLines.join(' ').trim();

    if (!questionText) {
      errors.push({
        line: blockStartLine,
        message: 'Teks pertanyaan kosong.',
        rawText: '',
      });
      return;
    }

    if (currentOptions.length < 2) {
      errors.push({
        line: blockStartLine,
        message: `Pertanyaan "${questionText.slice(0, 30)}..." harus memiliki minimal 2 pilihan jawaban.`,
        rawText: questionText,
      });
      return;
    }

    errors.push({
      line: endLine,
      message: `Pertanyaan "${questionText.slice(0, 30)}..." belum memiliki baris penentu jawaban 'ANSWER: X'.`,
      rawText: questionText,
    });
  }

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();
    currentLineNumber = i + 1;

    if (!trimmed) {
      // Empty line could be separator between questions
      continue;
    }

    // Check if line is ANSWER: X
    const answerMatch = trimmed.match(/^ANSWER:\s*([A-Za-z])/i);
    if (answerMatch) {
      const correctAnswer = answerMatch[1].toUpperCase();
      const questionText = currentQuestionTextLines.join(' ').trim();

      if (!questionText) {
        errors.push({
          line: currentLineNumber,
          message: 'Ditemukan "ANSWER:" tanpa teks soal sebelumnya.',
          rawText: rawLine,
        });
      } else if (currentOptions.length < 2) {
        errors.push({
          line: currentLineNumber,
          message: `Soal "${questionText.slice(0, 35)}..." harus memiliki minimal 2 pilihan jawaban sebelum ANSWER.`,
          rawText: rawLine,
        });
      } else {
        const optionExists = currentOptions.some((opt) => opt.id === correctAnswer);
        if (!optionExists) {
          errors.push({
            line: currentLineNumber,
            message: `Kunci jawaban "${correctAnswer}" tidak terdapat dalam daftar pilihan (${currentOptions.map((o) => o.id).join(', ')}).`,
            rawText: rawLine,
          });
        } else {
          questions.push({
            id: `q_${Date.now()}_${questions.length + 1}_${Math.random().toString(36).substr(2, 4)}`,
            text: questionText,
            options: [...currentOptions],
            correctAnswer,
            points: defaultPoints,
          });
        }
      }

      // Reset for next question block
      currentQuestionTextLines = [];
      currentOptions = [];
      blockStartLine = currentLineNumber + 1;
      continue;
    }

    // Check if line is an Option: e.g., 'A. ', 'A) ', 'A - '
    const optionMatch = trimmed.match(/^([A-Za-z])[\.\)\-]\s+(.+)$/);
    if (optionMatch) {
      const optLetter = optionMatch[1].toUpperCase();
      const optText = optionMatch[2].trim();

      if (currentQuestionTextLines.length === 0) {
        errors.push({
          line: currentLineNumber,
          message: `Pilihan "${optLetter}" ditemukan sebelum teks pertanyaan.`,
          rawText: rawLine,
        });
      } else {
        currentOptions.push({
          id: optLetter,
          text: optText,
        });
      }
      continue;
    }

    // Otherwise, it is part of the question text
    if (currentOptions.length === 0) {
      if (currentQuestionTextLines.length === 0) {
        blockStartLine = currentLineNumber;
      }
      currentQuestionTextLines.push(trimmed);
    } else {
      // If we already have options and see a non-option, non-answer line
      errors.push({
        line: currentLineNumber,
        message: `Baris tidak dikenali setelah pilihan jawaban. Harapkan pilihan berikutnya atau "ANSWER: X".`,
        rawText: rawLine,
      });
    }
  }

  // If there's an uncommitted question remaining
  if (currentQuestionTextLines.length > 0 || currentOptions.length > 0) {
    commitQuestion(currentLineNumber);
  }

  return {
    success: errors.length === 0 && questions.length > 0,
    questions,
    errors,
    totalQuestions: questions.length,
  };
}

export const SAMPLE_AIKEN_QUESTIONS = `Apa kepanjangan dari singkatan CPU dalam arsitektur komputer?
A. Central Processing Unit
B. Computer Personal Unit
C. Control Processing Utility
D. Central Power Unit
ANSWER: A

Manakah dari berikut ini yang BUKAN merupakan struktur data linier?
A. Array
B. Stack
C. Binary Search Tree
D. Queue
ANSWER: C

Protokol jaringan manakah yang bertugas menerjemahkan nama domain (seperti google.com) menjadi alamat IP?
A. HTTP
B. DNS
C. FTP
D. DHCP
ANSWER: B

Kompleksitas waktu rata-rata untuk algoritma pencarian biner (Binary Search) adalah...
A. O(1)
B. O(n)
C. O(log n)
D. O(n log n)
ANSWER: C

Dalam konsep basis data relasional, apa fungsi dari PRIMARY KEY pada sebuah tabel?
A. Mengizinkan nilai NULL untuk identifikasi opsional
B. Mengidentifikasi setiap baris (record) secara unik dan tidak boleh bernilai NULL
C. Menghubungkan tabel dengan tabel di database eksternal saja
D. Mempercepat proses backup otomatis server
ANSWER: B`;
