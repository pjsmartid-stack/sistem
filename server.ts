import express from "express";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import { createServer as createViteServer } from "vite";

import fs from "fs";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: "15mb" }));

// Lazy initialize Gemini client
function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// AI Proctoring Analysis Endpoint
app.post("/api/proctor/analyze", async (req, res) => {
  try {
    const { imageBase64, eventType, studentName } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ error: "Missing image base64 data" });
    }

    const ai = getGeminiClient();
    if (!ai) {
      // Fallback heuristic if API key is not configured yet
      return res.json({
        analysis: {
          violationDetected: eventType !== "routine_check",
          violationType: eventType || "suspicious_movement",
          confidence: 0.85,
          description: `Analisis otomatis: Terdeteksi aktivitas [${eventType}] pada sesi mahasiswa ${studentName || "Ujian"}.`,
          severity: eventType === "tab_switch" ? "high" : "medium",
        },
      });
    }

    // Clean base64
    const cleanBase64 = imageBase64.replace(/^data:image\/[a-z]+;base64,/, "");

    const prompt = `Anda adalah sistem pengawas AI (AI Exam Proctor) canggih pada Sistem Manajemen Ujian daring.
Analisis tangkapan webcam peserta ujian berikut ini:
- Nama peserta: ${studentName || "Peserta"}
- Indikasi sensor awal: ${eventType || "Pemeriksaan rutin webcam"}

Periksa apakah ada tanda-tanda kecurangan atau pelanggaran etika ujian:
1. Tidak ada orang / peserta meninggalkan meja (Face absence).
2. Terdapat lebih dari 1 orang di frame kamera (Multiple people).
3. Peserta memegang gawai/ponsel (Smartphone/gadget usage).
4. Peserta menoleh ke samping/bawah secara ekstrem membaca catatan fisik (Looking away / cheating notes).
5. Gerak-gerik mencurigakan lainnya.

Keluarkan format JSON dengan struktur:
{
  "violationDetected": true/false,
  "violationType": "no_face" | "multiple_faces" | "gadget_detected" | "looking_away" | "unauthorized_material" | "none",
  "confidence": 0.0 - 1.0,
  "severity": "low" | "medium" | "high",
  "description": "Penjelasan singkat dalam Bahasa Indonesia formal untuk laporan dosen (maksimal 2 kalimat)"
}`;

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: cleanBase64,
            },
          },
          { text: prompt },
        ],
      },
      config: {
        responseMimeType: "application/json",
      },
    });

    const parsed = JSON.parse(response.text || "{}");
    res.json({ analysis: parsed });
  } catch (error: any) {
    console.error("Proctoring AI analysis error:", error);
    res.status(500).json({
      error: "AI analysis failed",
      fallback: {
        violationDetected: true,
        violationType: "system_flagged",
        confidence: 0.75,
        severity: "medium",
        description: "Sensor mendeteksi anomali saat ujian berlangsung.",
      },
    });
  }
});

// AI Aiken Question Generation Assistant
app.post("/api/ai/generate-aiken", async (req, res) => {
  try {
    const { topic, questionCount = 5, difficulty = "Sedang" } = req.body;
    const ai = getGeminiClient();

    if (!ai) {
      return res.status(400).json({ error: "GEMINI_API_KEY is not configured" });
    }

    const prompt = `Buatkan ${questionCount} butir soal pilihan ganda tentang "${topic}" tingkat kesulitan "${difficulty}" dalam FORMAT AIKEN standar LMS (Moodle/Canvas).

Ketentuan format Aiken yang WAJIB dipatuhi:
- Teks soal ditulis dalam 1 baris atau paragraf jelas.
- Tiap pilihan jawaban diawali huruf kapital diikuti titik dan spasi, contoh: 'A. ', 'B. ', 'C. ', 'D. '.
- Setelah pilihan jawaban terakhir, buat 1 baris berisi 'ANSWER: X' (huruf kapital).
- Berikan jarak satu baris kosong antar butir soal.
- Bahasa: Bahasa Indonesia yang baik dan akademik.

HANYA keluarkan teks mentah format Aiken tanpa pengantar markdown, tanpa backtick kode.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: prompt,
    });

    res.json({ aikenText: response.text?.trim() || "" });
  } catch (error: any) {
    console.error("AI Aiken generation error:", error);
    res.status(500).json({ error: error.message || "Failed to generate Aiken questions" });
  }
});

async function startServer() {
  const distPath = path.join(process.cwd(), "dist");
  const indexPath = path.join(distPath, "index.html");

  if (process.env.NODE_ENV === "production" && fs.existsSync(indexPath)) {
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(indexPath);
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Sistem Manajemen Ujian server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
