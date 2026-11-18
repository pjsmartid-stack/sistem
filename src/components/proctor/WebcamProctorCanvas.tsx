import React, { useRef, useEffect, useState } from 'react';
import { useExam } from '../../context/ExamContext';
import { ViolationType } from '../../types';
import { Camera, ShieldAlert, CheckCircle, AlertTriangle, RefreshCw } from 'lucide-react';

interface WebcamProctorCanvasProps {
  examId: string;
  examTitle: string;
  studentId: string;
  studentName: string;
  studentNim: string;
  onViolationTriggered?: (type: ViolationType, description: string) => void;
}

export const WebcamProctorCanvas: React.FC<WebcamProctorCanvasProps> = ({
  examId,
  examTitle,
  studentId,
  studentName,
  studentNim,
  onViolationTriggered,
}) => {
  const { recordViolation } = useExam();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [hasCameraAccess, setHasCameraAccess] = useState<boolean | null>(null);
  const [aiStatus, setAiStatus] = useState<'monitoring' | 'analyzing' | 'warning'>('monitoring');
  const [lastCheckNotice, setLastCheckNotice] = useState('AI Memantau Wajah & Integritas');
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Initialize webcam stream
  useEffect(() => {
    let stream: MediaStream | null = null;

    async function startCamera() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 320, height: 240, facingMode: 'user' },
          audio: false,
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setHasCameraAccess(true);
        setCameraError(null);
      } catch (err: any) {
        console.warn('Camera access error:', err);
        setHasCameraAccess(false);
        setCameraError('Kamera tidak terdeteksi atau izin belum diberikan.');
      }
    }

    startCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  // Periodic AI snapshot evaluation and proctoring heuristics
  useEffect(() => {
    if (!hasCameraAccess) return;

    const interval = setInterval(async () => {
      if (!videoRef.current || !canvasRef.current) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (video.readyState !== video.HAVE_ENOUGH_DATA) return;

      canvas.width = 320;
      canvas.height = 240;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageBase64 = canvas.toDataURL('image/jpeg', 0.6);

      // Lightweight canvas heuristic check (detect if camera is covered or pitch black)
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      let totalBrightness = 0;
      for (let i = 0; i < data.length; i += 16) {
        totalBrightness += (data[i] + data[i + 1] + data[i + 2]) / 3;
      }
      const avgBrightness = totalBrightness / (data.length / 16);

      if (avgBrightness < 15) {
        // Camera covered / pitch black
        setAiStatus('warning');
        setLastCheckNotice('Peringatan: Kamera tertutup / terhalang');
        const v = recordViolation({
          examId,
          examTitle,
          studentId,
          studentName,
          studentNim,
          violationType: 'face_absence',
          title: 'Kamera Ditutup / Lensa Terhalang',
          description: 'Rata-rata kecerahan kamera di bawah ambang batas normal (diduga kamera sengaja ditutup).',
          severity: 'high',
          snapshotUrl: imageBase64,
          aiConfidence: 0.95,
        });
        onViolationTriggered?.('face_absence', v.description);
        return;
      }

      // Randomly or periodically verify with server-side Gemini AI proctor
      // to check for gadgets, multiple people, looking away
      try {
        setAiStatus('analyzing');
        const response = await fetch('/api/proctor/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageBase64,
            eventType: 'routine_camera_scan',
            studentName,
          }),
        });

        if (response.ok) {
          const resData = await response.json();
          const analysis = resData.analysis;

          if (analysis && analysis.violationDetected && analysis.violationType !== 'none') {
            setAiStatus('warning');
            setLastCheckNotice(`AI Alert: ${analysis.description}`);
            const recorded = recordViolation({
              examId,
              examTitle,
              studentId,
              studentName,
              studentNim,
              violationType: analysis.violationType || 'looking_away',
              title: `Deteksi AI: ${analysis.violationType}`,
              description: analysis.description || 'Pola gerakan mencurigakan terekam oleh AI pengawas.',
              severity: analysis.severity || 'medium',
              snapshotUrl: imageBase64,
              aiConfidence: analysis.confidence || 0.88,
            });
            onViolationTriggered?.(analysis.violationType, analysis.description);
          } else {
            setAiStatus('monitoring');
            setLastCheckNotice('Pengawasan AI Normal (Wajah Terverifikasi)');
          }
        }
      } catch (e) {
        setAiStatus('monitoring');
      }
    }, 25000); // scan every 25 seconds during exam to conserve quota while maintaining high surveillance

    return () => clearInterval(interval);
  }, [hasCameraAccess, examId, examTitle, studentId, studentName, studentNim, recordViolation, onViolationTriggered]);

  return (
    <div className="relative rounded-xl overflow-hidden border-2 border-slate-700 bg-slate-900 shadow-lg text-white w-48 sm:w-56">
      {/* Live Video */}
      <div className="relative aspect-video bg-black flex items-center justify-center overflow-hidden">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`w-full h-full object-cover ${!hasCameraAccess ? 'hidden' : ''}`}
        />
        <canvas ref={canvasRef} className="hidden" />

        {!hasCameraAccess && (
          <div className="p-3 text-center space-y-1">
            <Camera className="w-6 h-6 text-slate-500 mx-auto" />
            <div className="text-[11px] text-slate-400 font-medium leading-tight">
              {cameraError || 'Menghubungkan kamera pengawas...'}
            </div>
          </div>
        )}

        {/* AI Monitoring Overlay Badge */}
        <div className="absolute top-1.5 left-1.5 flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-xs text-[10px] font-bold">
          <span
            className={`w-2 h-2 rounded-full ${
              aiStatus === 'warning'
                ? 'bg-rose-500 animate-ping'
                : aiStatus === 'analyzing'
                ? 'bg-purple-400 animate-spin'
                : 'bg-emerald-500'
            }`}
          />
          <span className="tracking-wider uppercase">
            {aiStatus === 'warning' ? 'ALERT AI' : 'AI PROCTOR'}
          </span>
        </div>
      </div>

      {/* Footer Info */}
      <div className="px-2.5 py-1.5 bg-slate-800/90 text-[10px] text-slate-300 flex items-center justify-between">
        <span className="truncate max-w-[150px]">{lastCheckNotice}</span>
        {aiStatus === 'warning' ? (
          <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
        ) : (
          <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
        )}
      </div>
    </div>
  );
};
