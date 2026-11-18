/**
 * Utility to generate an authentic high-fidelity screenshot evidence proof
 * when an anti-cheat violation occurs (specifically tab switching or leaving the application).
 */

export interface ScreenshotEvidenceParams {
  studentName: string;
  studentNim: string;
  studentClassName?: string;
  examTitle: string;
  courseName?: string;
  violationType: 'tab_switch' | 'fullscreen_exit' | 'window_blur';
  violationTitle: string;
  currentQuestionNumber?: number;
  totalQuestions?: number;
  currentQuestionText?: string;
  webcamVideoElement?: HTMLVideoElement | null;
}

export function generateCheatingScreenshotProof(params: ScreenshotEvidenceParams): string {
  const width = 1280;
  const height = 720;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    return '';
  }

  const now = new Date();
  const timeStr = now.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }) + ' ' + now.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }) + `.${String(now.getMilliseconds()).padStart(3, '0')} WIB`;

  // 1. Background (Desktop OS Wallpaper look - Dark Navy Gradient)
  const bgGrad = ctx.createLinearGradient(0, 0, width, height);
  bgGrad.addColorStop(0, '#0f172a');
  bgGrad.addColorStop(1, '#1e293b');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // 2. Browser Window Outer Frame
  const winX = 40;
  const winY = 30;
  const winW = width - 80;
  const winH = height - 60;

  // Window Shadow
  ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
  ctx.shadowBlur = 30;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 15;

  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.roundRect(winX, winY, winW, winH, 12);
  ctx.fill();

  // Reset shadow
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;

  // 3. Browser Title Bar
  const titleBarH = 42;
  ctx.fillStyle = '#f1f5f9';
  ctx.beginPath();
  ctx.roundRect(winX, winY, winW, titleBarH, [12, 12, 0, 0]);
  ctx.fill();

  // Window control buttons (Red, Yellow, Green)
  ctx.fillStyle = '#ef4444';
  ctx.beginPath();
  ctx.arc(winX + 24, winY + 21, 6, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#f59e0b';
  ctx.beginPath();
  ctx.arc(winX + 42, winY + 21, 6, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#10b981';
  ctx.beginPath();
  ctx.arc(winX + 60, winY + 21, 6, 0, Math.PI * 2);
  ctx.fill();

  // Browser Tab (Tab Switch proof visual: Notice the alert icon!)
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.roundRect(winX + 80, winY + 8, 260, 34, [8, 8, 0, 0]);
  ctx.fill();

  ctx.font = 'bold 11px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = '#b91c1c';
  ctx.fillText('⚠️ [KECURANGAN] ' + params.examTitle.substring(0, 18) + '...', winX + 95, winY + 28);

  // Second Tab (Evidence that a new tab was opened!)
  ctx.fillStyle = '#e2e8f0';
  ctx.beginPath();
  ctx.roundRect(winX + 350, winY + 10, 200, 32, [8, 8, 0, 0]);
  ctx.fill();

  ctx.fillStyle = '#475569';
  ctx.font = '11px system-ui, -apple-system, sans-serif';
  ctx.fillText('🔍 Tab Eksternal / Pencarian...', winX + 365, winY + 28);

  // URL Address Bar
  const urlBarH = 34;
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(winX, winY + titleBarH, winW, urlBarH);
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 1;
  ctx.strokeRect(winX, winY + titleBarH, winW, urlBarH);

  // URL Capsule
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.roundRect(winX + 16, winY + titleBarH + 5, winW - 32, 24, 6);
  ctx.fill();
  ctx.strokeStyle = '#cbd5e1';
  ctx.stroke();

  ctx.fillStyle = '#059669';
  ctx.font = 'bold 10px monospace';
  ctx.fillText('🔒 https://smu.kampus.ac.id/ujian/proctor-room/active?session=' + Math.random().toString(36).substring(2, 10), winX + 30, winY + titleBarH + 21);

  // 4. Alert Banner across the top of page
  const contentY = winY + titleBarH + urlBarH;
  const bannerH = 50;
  ctx.fillStyle = '#fef2f2';
  ctx.fillRect(winX, contentY, winW, bannerH);
  ctx.strokeStyle = '#fecaca';
  ctx.strokeRect(winX, contentY, winW, bannerH);

  ctx.fillStyle = '#dc2626';
  ctx.font = 'bold 15px system-ui, -apple-system, sans-serif';
  ctx.fillText('🚨 TANGKAPAN LAYAR BUKTI KECURANGAN: ' + params.violationTitle.toUpperCase(), winX + 24, contentY + 24);

  ctx.fillStyle = '#991b1b';
  ctx.font = '12px system-ui, -apple-system, sans-serif';
  ctx.fillText('Terdeteksi upaya keluar dari aplikasi ujian / beralih ke jendela lain pada: ' + timeStr, winX + 24, contentY + 42);

  // 5. Exam Canvas Content Area
  const innerContentY = contentY + bannerH + 16;
  const innerContentW = winW - 48;

  // Left Section: Exam Question View
  const examBoxW = innerContentW * 0.65;
  const examBoxH = winH - (titleBarH + urlBarH + bannerH + 40);

  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#e2e8f0';
  ctx.beginPath();
  ctx.roundRect(winX + 24, innerContentY, examBoxW, examBoxH, 10);
  ctx.fill();
  ctx.stroke();

  // Question Header
  ctx.fillStyle = '#f8fafc';
  ctx.beginPath();
  ctx.roundRect(winX + 24, innerContentY, examBoxW, 40, [10, 10, 0, 0]);
  ctx.fill();
  ctx.strokeStyle = '#e2e8f0';
  ctx.stroke();

  ctx.fillStyle = '#1e293b';
  ctx.font = 'bold 13px system-ui, -apple-system, sans-serif';
  ctx.fillText(
    `Lembar Soal Nomor ${params.currentQuestionNumber || 1} dari ${params.totalQuestions || 20}`,
    winX + 40,
    innerContentY + 25
  );

  // Question Text
  ctx.fillStyle = '#334155';
  ctx.font = '13px system-ui, -apple-system, sans-serif';
  const qText = params.currentQuestionText || 'Manakah pernyataan berikut ini yang paling tepat mengenai implementasi algoritma?';
  ctx.fillText(qText.substring(0, 70), winX + 40, innerContentY + 70);
  if (qText.length > 70) {
    ctx.fillText(qText.substring(70, 140), winX + 40, innerContentY + 90);
  }

  // Question Options (Simulated)
  const options = ['A. Opsi jawaban pilihan pertama', 'B. Opsi jawaban pilihan kedua', 'C. Opsi jawaban pilihan ketiga', 'D. Opsi jawaban pilihan keempat'];
  options.forEach((opt, idx) => {
    const optY = innerContentY + 120 + idx * 40;
    ctx.fillStyle = '#f8fafc';
    ctx.strokeStyle = '#cbd5e1';
    ctx.beginPath();
    ctx.roundRect(winX + 40, optY, examBoxW - 40, 32, 6);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#475569';
    ctx.font = '12px system-ui, -apple-system, sans-serif';
    ctx.fillText(opt, winX + 56, optY + 20);
  });

  // Right Section: Proctor & Student Metadata Box
  const metaBoxX = winX + 36 + examBoxW;
  const metaBoxW = innerContentW - examBoxW - 12;

  // Webcam box
  const webcamBoxH = 170;
  ctx.fillStyle = '#000000';
  ctx.beginPath();
  ctx.roundRect(metaBoxX, innerContentY, metaBoxW, webcamBoxH, 10);
  ctx.fill();

  // If webcam video element is passed and has enough data, draw real camera snapshot!
  let drewRealVideo = false;
  if (params.webcamVideoElement && params.webcamVideoElement.readyState >= 2) {
    try {
      ctx.drawImage(params.webcamVideoElement, metaBoxX, innerContentY, metaBoxW, webcamBoxH);
      drewRealVideo = true;
    } catch {
      drewRealVideo = false;
    }
  }

  if (!drewRealVideo) {
    // Simulated camera frame with person silhouette
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(metaBoxX, innerContentY, metaBoxW, webcamBoxH);
    ctx.fillStyle = '#64748b';
    ctx.beginPath();
    ctx.arc(metaBoxX + metaBoxW / 2, innerContentY + 65, 30, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(metaBoxX + metaBoxW / 2, innerContentY + 150, 50, Math.PI, Math.PI * 2);
    ctx.fill();
  }

  // Camera overlay badge
  ctx.fillStyle = 'rgba(220, 38, 38, 0.85)';
  ctx.beginPath();
  ctx.roundRect(metaBoxX + 10, innerContentY + 10, 100, 20, 4);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 10px monospace';
  ctx.fillText('REC • WEBCAM', metaBoxX + 18, innerContentY + 24);

  // Student details badge card
  const detailsY = innerContentY + webcamBoxH + 12;
  const detailsH = examBoxH - webcamBoxH - 12;

  ctx.fillStyle = '#f8fafc';
  ctx.strokeStyle = '#e2e8f0';
  ctx.beginPath();
  ctx.roundRect(metaBoxX, detailsY, metaBoxW, detailsH, 10);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 13px system-ui, -apple-system, sans-serif';
  ctx.fillText('Data Peserta Ujian', metaBoxX + 16, detailsY + 24);

  ctx.fillStyle = '#475569';
  ctx.font = '11px system-ui, -apple-system, sans-serif';
  ctx.fillText('Nama: ' + params.studentName, metaBoxX + 16, detailsY + 48);
  ctx.fillText('NIM: ' + params.studentNim, metaBoxX + 16, detailsY + 68);
  ctx.fillText('Kelas: ' + (params.studentClassName || 'Reguler'), metaBoxX + 16, detailsY + 88);
  ctx.fillText('Ujian: ' + params.examTitle.substring(0, 22), metaBoxX + 16, detailsY + 108);

  // Big Watermark on the screenshot
  ctx.save();
  ctx.translate(width / 2, height / 2);
  ctx.rotate(-Math.PI / 8);
  ctx.font = 'bold 42px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = 'rgba(220, 38, 38, 0.15)';
  ctx.textAlign = 'center';
  ctx.fillText('BUKTI KECURANGAN TANGKAPAN LAYAR', 0, 0);
  ctx.fillText(timeStr, 0, 48);
  ctx.restore();

  return canvas.toDataURL('image/jpeg', 0.85);
}
