import React, { useState } from 'react';
import { Question, AikenParseResult } from '../../types';
import { parseAikenFormat, SAMPLE_AIKEN_QUESTIONS } from '../../utils/aikenParser';
import {
  X,
  Upload,
  FileText,
  CheckCircle,
  AlertCircle,
  Sparkles,
  RefreshCw,
  Copy,
  HelpCircle,
} from 'lucide-react';

interface AikenImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportQuestions: (questions: Question[]) => void;
}

export const AikenImportModal: React.FC<AikenImportModalProps> = ({
  isOpen,
  onClose,
  onImportQuestions,
}) => {
  const [aikenText, setAikenText] = useState<string>(SAMPLE_AIKEN_QUESTIONS);
  const [pointsPerQuestion, setPointsPerQuestion] = useState<number>(20);
  const [parseResult, setParseResult] = useState<AikenParseResult | null>(() =>
    parseAikenFormat(SAMPLE_AIKEN_QUESTIONS, 20)
  );
  const [activeTab, setActiveTab] = useState<'editor' | 'preview'>('editor');

  // AI Generation state
  const [aiTopic, setAiTopic] = useState('');
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [aiError, setAiError] = useState('');

  if (!isOpen) return null;

  const handleTextChange = (text: string) => {
    setAikenText(text);
    const res = parseAikenFormat(text, pointsPerQuestion);
    setParseResult(res);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      handleTextChange(content);
    };
    reader.readAsText(file);
  };

  const handleLoadSample = () => {
    handleTextChange(SAMPLE_AIKEN_QUESTIONS);
  };

  const handleGenerateWithAi = async () => {
    if (!aiTopic.trim()) {
      setAiError('Silakan masukkan topik materi soal.');
      return;
    }

    setIsGeneratingAi(true);
    setAiError('');

    try {
      const res = await fetch('/api/ai/generate-aiken', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: aiTopic,
          questionCount: 4,
          difficulty: 'Sedang',
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Gagal menghasilkan soal dengan AI');
      }

      if (data.aikenText) {
        handleTextChange(data.aikenText);
        setActiveTab('preview');
      }
    } catch (err: any) {
      setAiError(err.message || 'Terjadi kesalahan saat memanggil AI');
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const handleConfirmImport = () => {
    if (!parseResult || parseResult.questions.length === 0) return;
    onImportQuestions(parseResult.questions);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Impor Soal Format AIKEN Standar
              </h2>
              <p className="text-xs text-slate-500">
                Format resmi LMS (Moodle/Blackboard/Canvas) untuk soal pilihan ganda
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-2 rounded-lg hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Controls & Guidelines */}
        <div className="px-6 py-3 bg-blue-50/50 border-b border-blue-100 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 text-blue-900">
            <HelpCircle className="w-4 h-4 text-blue-600 shrink-0" />
            <span>
              Format: <strong>Teks Soal</strong> &rarr; <strong>A. Opsi</strong> &rarr;{' '}
              <strong>B. Opsi</strong> &rarr; <strong>ANSWER: A</strong> (pisahkan antar soal dengan baris kosong)
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleLoadSample}
              className="px-2.5 py-1 rounded bg-white text-blue-700 border border-blue-200 hover:bg-blue-50 font-medium transition-colors"
            >
              Muat Contoh Soal
            </button>
            <label className="cursor-pointer px-2.5 py-1 rounded bg-blue-600 text-white hover:bg-blue-700 font-medium inline-flex items-center gap-1 transition-colors">
              <Upload className="w-3.5 h-3.5" />
              Unggah Berkas .txt
              <input
                type="file"
                accept=".txt"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
          </div>
        </div>

        {/* AI Question Assistant Banner */}
        <div className="px-6 py-3 bg-purple-50 border-b border-purple-100 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-purple-900 text-xs">
            <Sparkles className="w-4 h-4 text-purple-600 shrink-0" />
            <span>
              <strong>Bantuan Gemini AI:</strong> Buat otomatis butir soal Aiken berdasarkan materi
            </span>
          </div>
          <div className="flex items-center gap-2 flex-1 max-w-md">
            <input
              type="text"
              placeholder="Ketik topik (cth: Keamanan Jaringan, SQL, Python)"
              value={aiTopic}
              onChange={(e) => setAiTopic(e.target.value)}
              className="px-3 py-1 text-xs rounded-lg border border-purple-200 bg-white w-full focus:outline-none focus:ring-1 focus:ring-purple-500"
            />
            <button
              type="button"
              onClick={handleGenerateWithAi}
              disabled={isGeneratingAi}
              className="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-lg shrink-0 disabled:opacity-50 inline-flex items-center gap-1.5 transition-colors"
            >
              {isGeneratingAi ? (
                <>
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  Membuat...
                </>
              ) : (
                <>
                  <Sparkles className="w-3 h-3" />
                  Buat Soal
                </>
              )}
            </button>
          </div>
          {aiError && <p className="text-[11px] text-rose-600 w-full">{aiError}</p>}
        </div>

        {/* Tab Selector & Question Stats */}
        <div className="px-6 pt-3 flex items-center justify-between border-b border-slate-200">
          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => setActiveTab('editor')}
              className={`pb-2 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors ${
                activeTab === 'editor'
                  ? 'border-purple-600 text-purple-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              Editor Teks Aiken
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('preview')}
              className={`pb-2 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors flex items-center gap-1.5 ${
                activeTab === 'preview'
                  ? 'border-purple-600 text-purple-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              Pratinjau Hasil
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  parseResult?.success
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-rose-100 text-rose-800'
                }`}
              >
                {parseResult?.totalQuestions || 0} Soal
              </span>
            </button>
          </div>

          <div className="flex items-center gap-2 pb-2 text-xs text-slate-600">
            <span>Poin per Soal:</span>
            <input
              type="number"
              min="1"
              max="100"
              value={pointsPerQuestion}
              onChange={(e) => {
                const val = Number(e.target.value) || 10;
                setPointsPerQuestion(val);
                setParseResult(parseAikenFormat(aikenText, val));
              }}
              className="w-16 px-2 py-0.5 border border-slate-300 rounded text-center text-xs font-bold"
            />
          </div>
        </div>

        {/* Body Area */}
        <div className="flex-1 p-6 overflow-y-auto">
          {activeTab === 'editor' ? (
            <div className="space-y-3">
              <textarea
                value={aikenText}
                onChange={(e) => handleTextChange(e.target.value)}
                placeholder="Paste atau ketik format AIKEN di sini..."
                rows={16}
                className="w-full p-3.5 font-mono text-xs text-slate-800 bg-slate-50 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white"
              />

              {/* Real-time Syntax Warnings / Validation Result */}
              {parseResult && parseResult.errors.length > 0 && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs space-y-1">
                  <div className="font-bold text-rose-700 flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4" />
                    Terdeteksi {parseResult.errors.length} Kesalahan Format Aiken:
                  </div>
                  <ul className="list-disc list-inside text-rose-600 space-y-0.5 pl-2">
                    {parseResult.errors.map((err, idx) => (
                      <li key={idx}>
                        Baris {err.line}: {err.message}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {parseResult && parseResult.success && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    Format valid! Siap mengimpor{' '}
                    <strong>{parseResult.totalQuestions} butir soal</strong> (Total nilai:{' '}
                    <strong>{parseResult.totalQuestions * pointsPerQuestion} poin</strong>).
                  </span>
                </div>
              )}
            </div>
          ) : (
            /* Preview Mode */
            <div className="space-y-4">
              {parseResult?.questions.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-sm">
                  Belum ada soal yang terdeteksi. Silakan ketik format Aiken di tab Editor.
                </div>
              ) : (
                parseResult?.questions.map((q, idx) => (
                  <div
                    key={q.id || idx}
                    className="p-4 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition-colors space-y-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2.5">
                        <span className="w-6 h-6 rounded-full bg-purple-100 text-purple-700 font-bold text-xs flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        <p className="font-semibold text-slate-800 text-sm leading-relaxed">
                          {q.text}
                        </p>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-[11px] font-bold shrink-0">
                        {q.points} Poin
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-8">
                      {q.options.map((opt) => {
                        const isCorrect = opt.id === q.correctAnswer;
                        return (
                          <div
                            key={opt.id}
                            className={`p-2.5 rounded-lg text-xs flex items-center gap-2 border ${
                              isCorrect
                                ? 'bg-emerald-50 border-emerald-300 text-emerald-900 font-semibold'
                                : 'bg-slate-50 border-slate-200 text-slate-700'
                            }`}
                          >
                            <span
                              className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[11px] ${
                                isCorrect
                                  ? 'bg-emerald-600 text-white'
                                  : 'bg-slate-200 text-slate-700'
                              }`}
                            >
                              {opt.id}
                            </span>
                            <span>{opt.text}</span>
                            {isCorrect && (
                              <span className="ml-auto text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">
                                Kunci
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="text-xs text-slate-500">
            {parseResult?.success ? (
              <span className="text-emerald-700 font-semibold">
                ✓ {parseResult.totalQuestions} soal terverifikasi
              </span>
            ) : (
              <span className="text-rose-600">
                ✗ Format belum valid, perbaiki sebelum menyimpan
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Batal
            </button>
            <button
              id="btn-confirm-import-aiken"
              type="button"
              onClick={handleConfirmImport}
              disabled={!parseResult?.success || parseResult.questions.length === 0}
              className="px-5 py-2 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-sm transition-colors flex items-center gap-1.5"
            >
              <CheckCircle className="w-4 h-4" />
              Terapkan Soal ke Ujian ({parseResult?.totalQuestions || 0})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
