import {
  Exam,
  ExamAttempt,
  IRTItemAnalysis,
  IRTModel,
  IRTDifficultyPreset,
} from '../types';

const SCALING_D = 1.702; // Konstanta ogive normal standar psikometri

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function getPriorDifficultyB(preset?: IRTDifficultyPreset): number {
  if (preset === 'mudah') return -1.15;
  if (preset === 'sulit') return 1.25;
  return 0.0; // 'sedang' atau default
}

/**
 * Menghitung probabilitas menjawab benar P(u = 1 | theta) menggunakan model 1PL / 2PL / 3PL.
 */
export function irtProbability(
  theta: number,
  a: number,
  b: number,
  c: number
): number {
  const exponent = -SCALING_D * a * (theta - b);
  const logistic = 1 / (1 + Math.exp(clamp(exponent, -30, 30)));
  return c + (1 - c) * logistic;
}

/**
 * Kalibrasi parameter butir soal (Difficulty b, Discrimination a, Pseudo-Guessing c, dan Bobot IRT)
 * berdasarkan respon empiris seluruh peserta ujian yang telah selesai, dikombinasikan dengan
 * Bayesian smoothing agar stabil baik pada sampel kecil maupun sampel besar (seperti standar UTBK/CAT).
 */
export function calibrateExamItems(
  exam: Exam,
  completedAttempts: ExamAttempt[],
  overrideModel?: IRTModel
): IRTItemAnalysis[] {
  const model: IRTModel = overrideModel || exam.irtModel || '3PL';
  const questions = exam.questions || [];
  if (questions.length === 0) return [];

  const nRespondents = completedAttempts.length;

  // Hitung skor benar mentah setiap peserta untuk korelasi point-biserial (daya pembeda a)
  const respondentRawTotals = completedAttempts.map((att) => {
    let correct = 0;
    for (const q of questions) {
      if (att.answers[q.id]?.selectedOption === q.correctAnswer) {
        correct += 1;
      }
    }
    return correct;
  });

  const meanTotal =
    nRespondents > 0
      ? respondentRawTotals.reduce((acc, v) => acc + v, 0) / nRespondents
      : 0;

  const sdTotal =
    nRespondents > 1
      ? Math.sqrt(
          respondentRawTotals.reduce((acc, v) => acc + Math.pow(v - meanTotal, 2), 0) /
            nRespondents
        )
      : 0;

  // Langkah 1: Hitung parameter a, b, c mentah per butir soal
  const rawAnalyses = questions.map((q, index) => {
    let correctCount = 0;
    let sumTotalWhenCorrect = 0;

    completedAttempts.forEach((att, idx) => {
      const isRight = att.answers[q.id]?.selectedOption === q.correctAnswer;
      if (isRight) {
        correctCount += 1;
        sumTotalWhenCorrect += respondentRawTotals[idx];
      }
    });

    // Laplace-smoothed proportion correct agar tidak pernah 0 atau 1 murni
    const empiricalP =
      nRespondents > 0
        ? (correctCount + 0.5) / (nRespondents + 1.0)
        : q.difficultyPreset === 'mudah'
        ? 0.78
        : q.difficultyPreset === 'sulit'
        ? 0.28
        : 0.52;

    const rawProportion = nRespondents > 0 ? correctCount / nRespondents : empiricalP;

    // Parameter Kesulitan Empiris b = -ln(p / (1 - p))
    const empiricalB = clamp(-Math.log(empiricalP / (1 - empiricalP)), -2.8, 2.8);
    const priorB = getPriorDifficultyB(q.difficultyPreset);

    // Bobot empiris meningkat seiring bertambahnya jumlah peserta (Bayesian shrinkage)
    const empiricalWeight = nRespondents / (nRespondents + 3);
    const difficultyB = Number(
      clamp(
        empiricalWeight * empiricalB + (1 - empiricalWeight) * priorB,
        -3.0,
        3.0
      ).toFixed(2)
    );

    // Parameter Daya Pembeda (a) dari korelasi point-biserial (khusus 2PL & 3PL)
    let discriminationA = 1.0;
    if (model !== '1PL') {
      if (nRespondents >= 3 && sdTotal > 0 && correctCount > 0 && correctCount < nRespondents) {
        const p = correctCount / nRespondents;
        const qProp = 1 - p;
        const meanCorrect = sumTotalWhenCorrect / correctCount;
        const rPbis = ((meanCorrect - meanTotal) / sdTotal) * Math.sqrt(p / Math.max(0.0001, qProp));
        const clampedR = clamp(rPbis, -0.25, 0.85);
        // Transformasi standar psikometri dari r_pbis ke parameter diskriminasi a
        const estimatedA = clamp(0.65 + clampedR * 1.45, 0.4, 2.4);
        const aWeight = nRespondents / (nRespondents + 5);
        discriminationA = Number((aWeight * estimatedA + (1 - aWeight) * 1.0).toFixed(2));
      } else {
        discriminationA = q.difficultyPreset === 'sulit' ? 1.15 : 1.0;
      }
    }

    // Parameter Faktor Tebakan Semu (c) pada model 3PL (1 / jumlah opsi)
    const optionsCount = Math.max(2, q.options?.length || 4);
    const guessingC =
      model === '3PL'
        ? Number(clamp(1 / optionsCount, 0.1, 0.35).toFixed(2))
        : 0;

    // Klasifikasi tingkat kesulitan standar IRT
    let difficultyCategory: 'Mudah' | 'Sedang' | 'Sulit' = 'Sedang';
    if (difficultyB <= -0.65) {
      difficultyCategory = 'Mudah';
    } else if (difficultyB >= 0.65) {
      difficultyCategory = 'Sulit';
    }

    // Evaluasi kualitas daya pembeda butir soal
    let qualityStatus: 'Sangat Baik' | 'Baik' | 'Cukup' | 'Perlu Evaluasi' = 'Baik';
    if (discriminationA >= 1.3) {
      qualityStatus = 'Sangat Baik';
    } else if (discriminationA >= 0.85) {
      qualityStatus = 'Baik';
    } else if (discriminationA >= 0.55) {
      qualityStatus = 'Cukup';
    } else {
      qualityStatus = 'Perlu Evaluasi';
    }

    // Skor bobot mentah positif: soal lebih sulit (b tinggi) dan daya pembeda tinggi (a tinggi) bernilai lebih besar
    // Menggunakan fungsi eksponensial lembut sehingga b=-2 -> ~0.45, b=0 -> 1.0, b=+2 -> ~1.95
    const rawItemStrength =
      discriminationA * (1 + 0.32 * difficultyB + (difficultyB > 0 ? 0.12 * difficultyB : 0));
    const safeStrength = Math.max(0.25, rawItemStrength);

    return {
      questionId: q.id,
      questionNumber: index + 1,
      questionText: q.text,
      correctAnswer: q.correctAnswer,
      optionsCount,
      totalRespondents: nRespondents,
      correctCount,
      proportionCorrect: Number(rawProportion.toFixed(3)),
      difficultyB,
      discriminationA,
      guessingC,
      difficultyCategory,
      qualityStatus,
      rawStrength: safeStrength,
    };
  });

  // Langkah 2: Normalisasi bobot poin IRT sehingga total seluruh soal = 100.0 poin
  const totalStrength = rawAnalyses.reduce((sum, item) => sum + item.rawStrength, 0);

  return rawAnalyses.map((item) => {
    const normalizedWeight =
      totalStrength > 0
        ? Number(((item.rawStrength / totalStrength) * 100).toFixed(2))
        : Number((100 / questions.length).toFixed(2));

    const { rawStrength, ...rest } = item;
    return {
      ...rest,
      irtWeight: normalizedWeight,
    };
  });
}

/**
 * Mengestimasi kemampuan laten peserta (Theta) dengan metode Expected A Posteriori (EAP)
 * kuadratur numerik berprior Normal Standar N(0, 1), menghitung Standard Error SE(Theta),
 * Skor Standar IRT (Skala UTBK rerata 500, SD 100), dan Nilai Akademik Berbobot IRT (0-100).
 */
export function calculateAttemptIRTScore(
  exam: Exam,
  attempt: ExamAttempt,
  itemAnalyses?: IRTItemAnalysis[],
  overrideModel?: IRTModel
): {
  correctCount: number;
  irtTheta: number;
  irtStandardError: number;
  irtScaledScore: number;
  rawScore: number;
  penaltyDeduction: number;
  finalScore: number;
  maxScore: number;
  percentage: number;
  isPassed: boolean;
  irtItemWeights: Record<string, number>;
  irtModelUsed: IRTModel;
} {
  const model: IRTModel = overrideModel || exam.irtModel || '3PL';
  const analyses =
    itemAnalyses && itemAnalyses.length > 0
      ? itemAnalyses
      : calibrateExamItems(exam, [attempt], model);

  // Petakan respon dikotomis peserta (1 = benar, 0 = salah) & hitung bobot soal yang benar
  let correctCount = 0;
  let weightedSum100 = 0;
  const irtItemWeights: Record<string, number> = {};

  const responses = analyses.map((item) => {
    irtItemWeights[item.questionId] = item.irtWeight;
    const chosen = attempt.answers[item.questionId]?.selectedOption;
    const isCorrect = chosen === item.correctAnswer;
    if (isCorrect) {
      correctCount += 1;
      weightedSum100 += item.irtWeight;
    }
    return { item, isCorrect };
  });

  // Kuadratur numerik EAP dari -3.5 s/d +3.5 (step 0.05 -> 141 titik)
  const gridMin = -3.5;
  const gridMax = 3.5;
  const step = 0.05;
  const gridPoints: number[] = [];
  for (let t = gridMin; t <= gridMax + 0.0001; t += step) {
    gridPoints.push(Number(t.toFixed(2)));
  }

  const logPosteriors = gridPoints.map((theta) => {
    // Log prior N(0, 1)
    let logL = -0.5 * theta * theta;
    for (const { item, isCorrect } of responses) {
      const p = clamp(
        irtProbability(theta, item.discriminationA, item.difficultyB, item.guessingC),
        1e-6,
        1 - 1e-6
      );
      logL += isCorrect ? Math.log(p) : Math.log(1 - p);
    }
    return logL;
  });

  // Stabilisasi numerik log-sum-exp
  const maxLog = Math.max(...logPosteriors);
  const weights = logPosteriors.map((lp) => Math.exp(lp - maxLog));
  const sumWeights = weights.reduce((acc, w) => acc + w, 0);

  let eapTheta = 0;
  if (sumWeights > 0) {
    for (let i = 0; i < gridPoints.length; i++) {
      eapTheta += (gridPoints[i] * weights[i]) / sumWeights;
    }
  }

  let varianceTheta = 0;
  if (sumWeights > 0) {
    for (let i = 0; i < gridPoints.length; i++) {
      varianceTheta += (Math.pow(gridPoints[i] - eapTheta, 2) * weights[i]) / sumWeights;
    }
  }

  const irtTheta = Number(clamp(eapTheta, -3.5, 3.5).toFixed(2));
  const irtStandardError = Number(Math.sqrt(Math.max(0.01, varianceTheta)).toFixed(2));

  // Skor Standar IRT (Skala UTBK/SNBT: Mean = 500, SD = 100, Rentang 200 - 850)
  const irtScaledScore = Math.round(clamp(500 + 100 * irtTheta, 200, 850));

  // Nilai Akademik Berbobot IRT (0 - 100):
  // Jika semua benar = 100, jika 0 benar = 0, di antaranya mengikuti jumlah bobot dinamis soal IRT
  let rawScore100 =
    analyses.length > 0 && correctCount === analyses.length
      ? 100
      : analyses.length > 0 && correctCount === 0
      ? 0
      : Number(clamp(weightedSum100, 0, 100).toFixed(1));

  // Hitung penalti kecurangan AI Proctor
  let penaltyDeduction = 0;
  const violCount = attempt.violationsCount || attempt.violationLogs?.length || 0;
  if (exam.penaltyRules && exam.penaltyRules.length > 0 && violCount > 0) {
    for (const rule of exam.penaltyRules) {
      if (violCount >= rule.minViolations && violCount <= rule.maxViolations) {
        penaltyDeduction = Math.max(penaltyDeduction, rule.pointDeduction);
      }
    }
  }

  const maxScore = 100;
  const finalScore = Number(Math.max(0, rawScore100 - penaltyDeduction).toFixed(1));
  const percentage = Math.round(finalScore);
  const isPassed = percentage >= exam.passingGrade;

  return {
    correctCount,
    irtTheta,
    irtStandardError,
    irtScaledScore,
    rawScore: rawScore100,
    penaltyDeduction,
    finalScore,
    maxScore,
    percentage,
    isPassed,
    irtItemWeights,
    irtModelUsed: model,
  };
}

/**
 * Menghasilkan titik data Kurva Karakteristik Soal (ICC) dan Tes (TCC) untuk grafik Recharts.
 */
export function generateIRCCurvePoints(itemAnalyses: IRTItemAnalysis[]) {
  if (itemAnalyses.length === 0) return [];

  // Cari representasi butir Mudah, Sedang, dan Sulit untuk kurva perbandingan
  const sortedByDiff = [...itemAnalyses].sort((a, b) => a.difficultyB - b.difficultyB);
  const easiest = sortedByDiff[0];
  const median = sortedByDiff[Math.floor(sortedByDiff.length / 2)];
  const hardest = sortedByDiff[sortedByDiff.length - 1];

  const points: Array<{
    theta: string;
    thetaVal: number;
    expectedScorePct: number;
    easyProb: number;
    mediumProb: number;
    hardProb: number;
  }> = [];

  for (let t = -3.0; t <= 3.001; t += 0.5) {
    const thetaVal = Number(t.toFixed(1));
    let expectedWeighted = 0;
    for (const item of itemAnalyses) {
      const p = irtProbability(thetaVal, item.discriminationA, item.difficultyB, item.guessingC);
      expectedWeighted += p * item.irtWeight;
    }

    points.push({
      theta: thetaVal > 0 ? `+${thetaVal.toFixed(1)}` : thetaVal.toFixed(1),
      thetaVal,
      expectedScorePct: Number(clamp(expectedWeighted, 0, 100).toFixed(1)),
      easyProb: Number(
        (
          irtProbability(
            thetaVal,
            easiest.discriminationA,
            easiest.difficultyB,
            easiest.guessingC
          ) * 100
        ).toFixed(1)
      ),
      mediumProb: Number(
        (
          irtProbability(
            thetaVal,
            median.discriminationA,
            median.difficultyB,
            median.guessingC
          ) * 100
        ).toFixed(1)
      ),
      hardProb: Number(
        (
          irtProbability(
            thetaVal,
            hardest.discriminationA,
            hardest.difficultyB,
            hardest.guessingC
          ) * 100
        ).toFixed(1)
      ),
    });
  }

  return points;
}
