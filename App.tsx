
import React, { useState, useRef, useEffect } from 'react';
import { AppMode, Question, SessionResult, FixationData, EssayAnalysis, SyllabusTopic } from './types';
import * as gemini from './services/geminiService';
import { 
  BookOpen, 
  Camera, 
  FileText, 
  BarChart2, 
  CheckCircle2, 
  AlertCircle,
  ArrowLeft,
  Loader2,
  Download,
  Target,
  Sparkles,
  Trophy,
  TrendingUp,
  Library,
  Settings,
  X,
  ShieldCheck,
  Zap,
  Globe
} from 'lucide-react';

const COURSES = ['ENEM', 'PRF', 'PF', 'OAB', 'Concursos Militares', 'Magistratura', 'Receita Federal'];
const BOARDS = ['Cebraspe', 'FGV', 'FCC', 'Vunesp', 'IDECAN', 'FGV OAB'];

export default function App() {
  const [mode, setMode] = useState<AppMode>(AppMode.WELCOME);
  const [selectedCourse, setSelectedCourse] = useState('');
  const [selectedBoard, setSelectedBoard] = useState('');
  const [availableSubjects, setAvailableSubjects] = useState<string[]>([]);
  const [selectedSubject, setSelectedSubject] = useState('');
  const [userGoal, setUserGoal] = useState('');
  const [syllabus, setSyllabus] = useState<SyllabusTopic[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [loading, setLoading] = useState(false);
  const [sessionResults, setSessionResults] = useState<SessionResult[]>([]);
  const [fixation, setFixation] = useState<FixationData | null>(null);
  const [essayText, setEssayText] = useState('');
  const [essayResult, setEssayResult] = useState<EssayAnalysis | null>(null);
  const [ocrResult, setOcrResult] = useState<{ question: string; answer: string; explanation: string } | null>(null);
  const [mentorFeedback, setMentorFeedback] = useState('');
  const [essayCaptureMode, setEssayCaptureMode] = useState(false);
  const [showImplantGuide, setShowImplantGuide] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const startStudy = async () => {
    if (!userGoal) return;
    setLoading(true);
    setMode(AppMode.STUDY_FLOW);
    try {
      const [plan, q] = await Promise.all([
        gemini.getStudyPlan(selectedCourse, selectedBoard, selectedSubject),
        gemini.generateQuestion(selectedCourse, selectedBoard, userGoal, selectedSubject)
      ]);
      setSyllabus(plan);
      setCurrentQuestion(q);
    } catch (e) {
      console.error(e);
      alert("Erro ao iniciar sessão. Verifique sua conexão ou chave de API.");
      setMode(AppMode.GOAL_SETTING);
    } finally {
      setLoading(false);
    }
  };

  const loadSubjects = async (course: string, board: string) => {
    setLoading(true);
    try {
      const subjects = await gemini.getCourseSubjects(course, board);
      setAvailableSubjects(subjects);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedCourse && (selectedCourse.toUpperCase() === 'ENEM' || selectedBoard)) {
        loadSubjects(selectedCourse, selectedBoard);
    }
  }, [selectedCourse, selectedBoard]);

  const updateSyllabusProgress = (question: Question, correct: boolean) => {
    setSyllabus(prev => prev.map(topic => {
      const sName = topic.name.toLowerCase();
      const qSubject = question.subject.toLowerCase();
      if (qSubject.includes(sName) || sName.includes(qSubject)) {
        return { ...topic, status: correct ? 'Dominado' : 'Em Progresso' };
      }
      return topic;
    }));
  };

  const handleAnswer = async (index: number) => {
    if (!currentQuestion) return;
    const isCorrect = index === currentQuestion.correctAnswer;
    const result: SessionResult = {
      question: currentQuestion,
      userAnswer: index,
      isCorrect,
      timestamp: new Date(),
      mode: 'AI_GENERATED'
    };
    setSessionResults(prev => [...prev, result]);
    updateSyllabusProgress(currentQuestion, isCorrect);

    if (!isCorrect) {
      setLoading(true);
      try {
        const fix = await gemini.getFixationContent(currentQuestion, userGoal, selectedBoard);
        setFixation(fix);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    } else {
      setLoading(true);
      try {
        const nextQ = await gemini.generateQuestion(selectedCourse, selectedBoard, userGoal, selectedSubject);
        setCurrentQuestion(nextQ);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    }
  };

  const finalizeSession = async () => {
    setLoading(true);
    setMode(AppMode.REPORT);
    try {
      const feedback = await gemini.generateMentorFinalFeedback(sessionResults, userGoal);
      setMentorFeedback(feedback);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const analyzeEssayAction = async () => {
    if (!essayText) return;
    setLoading(true);
    try {
      const res = await gemini.analyzeEssay(essayText, false);
      setEssayResult(res);
    } catch (e) {
      console.error(e);
      alert("Erro na análise da redação.");
    } finally {
      setLoading(false);
    }
  };

  const captureAndAnalyzeEssay = async () => {
    if (canvasRef.current && videoRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      canvasRef.current.width = videoRef.current.videoWidth;
      canvasRef.current.height = videoRef.current.videoHeight;
      ctx?.drawImage(videoRef.current, 0, 0);
      const dataUrl = canvasRef.current.toDataURL('image/jpeg');
      const base64 = dataUrl.split(',')[1];
      
      setLoading(true);
      setEssayCaptureMode(false);
      try {
        const res = await gemini.analyzeEssay(base64, true);
        setEssayResult(res);
      } catch (e) {
        console.error(e);
        alert("Erro no OCR/Análise do manuscrito.");
      } finally {
        setLoading(false);
      }
    }
  };

  const startCameraMode = async (forEssay = false) => {
    if (forEssay) setEssayCaptureMode(true);
    else setMode(AppMode.OCR_SOLVER);
    
    setOcrResult(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      setTimeout(() => {
        if (videoRef.current) videoRef.current.srcObject = stream;
      }, 100);
    } catch (e) {
      alert("Acesso à câmera negado. Certifique-se de estar usando HTTPS.");
      if (forEssay) setEssayCaptureMode(false);
      else setMode(AppMode.WELCOME);
    }
  };

  const renderImplantGuide = () => (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl p-8 md:p-12 relative overflow-hidden">
        <button onClick={() => setShowImplantGuide(false)} className="absolute top-6 right-6 p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400">
          <X size={24} />
        </button>
        
        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center text-blue-600">
            <Settings size={28} />
          </div>
          <h2 className="text-2xl font-black text-slate-900">Guia de Implantação 80/20</h2>
        </div>

        <div className="space-y-6">
          <div className="flex gap-4 p-4 bg-blue-50 rounded-2xl border border-blue-100">
            <ShieldCheck className="text-blue-600 shrink-0" size={24} />
            <div>
              <p className="font-bold text-blue-900 text-sm mb-1">Passo 1: Gemini API Key</p>
              <p className="text-blue-800 text-xs leading-relaxed">Obtenha sua chave no Google AI Studio e configure a variável de ambiente <code>API_KEY</code> na sua plataforma de hospedagem.</p>
            </div>
          </div>

          <div className="flex gap-4 p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
            <Globe className="text-emerald-600 shrink-0" size={24} />
            <div>
              <p className="font-bold text-emerald-900 text-sm mb-1">Passo 2: Hospedagem HTTPS</p>
              <p className="text-emerald-800 text-xs leading-relaxed">A câmera (OCR e Redação) exige conexão segura. Use Vercel, Netlify ou Cloudflare Pages que oferecem SSL automático.</p>
            </div>
          </div>

          <div className="flex gap-4 p-4 bg-orange-50 rounded-2xl border border-orange-100">
            <Zap className="text-orange-600 shrink-0" size={24} />
            <div>
              <p className="font-bold text-orange-900 text-sm mb-1">Passo 3: Performance</p>
              <p className="text-orange-800 text-xs leading-relaxed">O app já vem configurado com os modelos Gemini 3 Flash e Pro para o melhor equilíbrio entre custo e inteligência pedagógica.</p>
            </div>
          </div>
        </div>

        <button 
          onClick={() => setShowImplantGuide(false)}
          className="w-full mt-10 py-4 bg-slate-900 text-white rounded-2xl font-bold hover:bg-black transition-all"
        >
          Entendi, vamos começar!
        </button>
      </div>
    </div>
  );

  const renderWelcome = () => (
    <div className="max-w-4xl mx-auto p-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <header className="text-center mb-12">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-full text-xs font-bold mb-6 border border-blue-100 uppercase tracking-widest shadow-sm">
           <Trophy size={14} /> Sistema Mentor Ativado
        </div>
        <h1 className="text-6xl font-black text-slate-900 mb-4 tracking-tight">
          IAprof <span className="text-blue-600">mentor</span>
        </h1>
        <p className="text-xl text-slate-500 max-w-2xl mx-auto font-medium leading-relaxed">
          O método 80/20 transformado em tecnologia. Estude apenas o que importa para ser aprovado.
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        <button 
          onClick={() => setMode(AppMode.GOAL_SETTING)}
          className="p-8 bg-white rounded-3xl shadow-xl hover:shadow-2xl transition-all border border-slate-100 flex flex-col items-center text-center group"
        >
          <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-inner">
            <BookOpen className="text-blue-600" size={32} />
          </div>
          <h3 className="text-xl font-bold mb-2">Ciclos 80/20</h3>
          <p className="text-slate-500 text-sm">IA gera questões táticas baseadas na recorrência da sua banca.</p>
        </button>

        <button 
          onClick={() => startCameraMode()}
          className="p-8 bg-white rounded-3xl shadow-xl hover:shadow-2xl transition-all border border-slate-100 flex flex-col items-center text-center group"
        >
          <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-inner">
            <Camera className="text-emerald-600" size={32} />
          </div>
          <h3 className="text-xl font-bold mb-2">Scanner Mentor</h3>
          <p className="text-slate-500 text-sm">Tire foto de qualquer questão física para resolução imediata.</p>
        </button>

        <button 
          onClick={() => setMode(AppMode.ESSAY_ANALYSIS)}
          className="p-8 bg-white rounded-3xl shadow-xl hover:shadow-2xl transition-all border border-slate-100 flex flex-col items-center text-center group"
        >
          <div className="w-16 h-16 bg-orange-100 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-inner">
            <FileText className="text-orange-600" size={32} />
          </div>
          <h3 className="text-xl font-bold mb-2">Redação Elite</h3>
          <p className="text-slate-500 text-sm">Correção de textos manuscritos com critérios oficiais ENEM.</p>
        </button>
      </div>

      <div className="flex justify-center">
        <button 
          onClick={() => setShowImplantGuide(true)}
          className="flex items-center gap-2 px-6 py-3 bg-white text-slate-400 hover:text-slate-600 hover:bg-slate-50 border border-slate-100 rounded-2xl font-bold transition-all text-sm"
        >
          <Settings size={18} /> Guia de Implantação do App
        </button>
      </div>

      {showImplantGuide && renderImplantGuide()}
    </div>
  );

  const renderGoalSetting = () => (
    <div className="max-w-3xl mx-auto p-6 animate-in fade-in duration-500">
      <button onClick={() => {setMode(AppMode.WELCOME); setSelectedCourse(''); setSelectedBoard(''); setSelectedSubject('');}} className="mb-6 text-slate-400 flex items-center gap-1 hover:text-slate-800 font-bold">
        <ArrowLeft size={18}/> Voltar ao Hub
      </button>
      <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl border border-slate-50">
        <div className="flex items-center gap-4 mb-8">
            <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-200">
                <Target size={32} />
            </div>
            <div>
                <h2 className="text-3xl font-black text-slate-900 leading-tight">Configuração de Alvo</h2>
                <p className="text-slate-500 font-medium">IAprof mentor mapeia as estatísticas da banca agora.</p>
            </div>
        </div>
        
        <div className="space-y-8">
            <div>
                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-3">1. Qual o Concurso/Exame?</label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {COURSES.map(c => (
                        <button 
                            key={c}
                            onClick={() => {setSelectedCourse(c); setSelectedBoard(''); setSelectedSubject('');}}
                            className={`p-3 rounded-xl border-2 font-bold transition-all text-sm ${selectedCourse === c ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-100 text-slate-500 hover:border-slate-200'}`}
                        >
                            {c}
                        </button>
                    ))}
                    <input 
                        type="text" 
                        placeholder="Outro..." 
                        className="p-3 rounded-xl border-2 border-slate-100 focus:border-blue-600 outline-none font-bold text-sm"
                        onBlur={(e) => {if(e.target.value){setSelectedCourse(e.target.value); setSelectedBoard(''); setSelectedSubject('');}}}
                    />
                </div>
            </div>

            {selectedCourse && selectedCourse.toUpperCase() !== 'ENEM' && (
                <div className="animate-in slide-in-from-top-2">
                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-3">2. Qual a Banca Organizadora?</label>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {BOARDS.map(b => (
                            <button 
                                key={b}
                                onClick={() => {setSelectedBoard(b); setSelectedSubject('');}}
                                className={`p-3 rounded-xl border-2 font-bold transition-all text-sm ${selectedBoard === b ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-slate-100 text-slate-500 hover:border-slate-200'}`}
                            >
                                {b}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {(selectedCourse && (selectedCourse.toUpperCase() === 'ENEM' || selectedBoard)) && (
                <div className="animate-in slide-in-from-top-2">
                    <div className="flex items-center justify-between mb-3">
                        <label className="block text-xs font-black text-slate-400 uppercase tracking-widest">3. Escolha a Disciplina</label>
                        {loading && <Loader2 className="animate-spin text-blue-600" size={14} />}
                    </div>
                    <div className="grid grid-cols-2 gap-3 max-h-[250px] overflow-y-auto pr-2 custom-scrollbar">
                        <button 
                            onClick={() => setSelectedSubject('')}
                            className={`p-4 rounded-xl border-2 font-black transition-all text-xs uppercase tracking-widest flex items-center justify-center gap-2 ${selectedSubject === '' ? 'border-blue-600 bg-blue-600 text-white shadow-lg' : 'border-slate-100 text-slate-400 hover:border-slate-200'}`}
                        >
                           <Sparkles size={14}/> Geral (Foco Pareto)
                        </button>
                        {availableSubjects.map(s => (
                            <button 
                                key={s}
                                onClick={() => setSelectedSubject(s)}
                                className={`p-4 rounded-xl border-2 font-bold transition-all text-sm flex items-center justify-center gap-2 ${selectedSubject === s ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-100 text-slate-500 hover:border-slate-200'}`}
                            >
                                <Library size={14} className={selectedSubject === s ? 'text-blue-600' : 'text-slate-300'} />
                                {s}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            <div>
                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-3">4. Qual seu objetivo final?</label>
                <input 
                    type="text"
                    className="w-full p-5 bg-slate-50 rounded-2xl border-2 border-slate-100 focus:border-blue-500 outline-none text-lg text-slate-800 font-bold transition-all"
                    placeholder="Ex: Nota 900+ no ENEM, Aprovação na PF..."
                    value={userGoal}
                    onChange={(e) => setUserGoal(e.target.value)}
                />
            </div>
        </div>

        <button 
          onClick={startStudy}
          disabled={!selectedCourse || !userGoal || loading}
          className="w-full mt-12 py-5 bg-blue-600 text-white rounded-2xl font-black hover:bg-blue-700 disabled:opacity-50 transition-all flex items-center justify-center gap-3 text-xl shadow-xl shadow-blue-100"
        >
          {loading ? <Loader2 className="animate-spin" /> : <><Sparkles size={24}/> Iniciar Jornada Estratégica</>}
        </button>
      </div>
    </div>
  );

  const renderStudyFlow = () => {
    if (loading) return (
      <div className="flex flex-col items-center justify-center h-[70vh] animate-in pulse duration-1000">
        <div className="relative mb-8">
          <Loader2 className="animate-spin text-blue-600" size={80} />
          <Trophy className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-blue-600" size={32} />
        </div>
        <p className="text-2xl text-slate-900 font-black mb-2 text-center">Cruzando dados de provas anteriores...</p>
        <p className="text-slate-500 font-medium text-center">Sintonizando {selectedSubject || 'Geral'} para {selectedCourse}</p>
      </div>
    );

    if (fixation) return (
      <div className="max-w-4xl mx-auto p-6 space-y-8 animate-in slide-in-from-right-4 duration-500">
        <div className="bg-amber-50 border-l-8 border-amber-500 p-10 rounded-r-[2.5rem] shadow-lg">
          <h2 className="text-2xl font-black text-amber-900 mb-6 flex items-center gap-4">
            <AlertCircle size={32} /> Bloqueio de Erro Reincidente
          </h2>
          <div className="prose prose-slate max-w-none">
            <p className="text-amber-700 font-black mb-3 uppercase text-[10px] tracking-[0.2em]">Diretriz Estratégica:</p>
            <p className="whitespace-pre-wrap text-slate-800 leading-relaxed text-xl font-medium">{fixation.stepByStep}</p>
          </div>
        </div>

        <div className="space-y-6">
          <h3 className="text-xl font-black text-slate-900 flex items-center gap-3 uppercase tracking-tighter">
            <CheckCircle2 className="text-emerald-500" /> Reforço: {fixation.mainTopic}
          </h3>
          {fixation.fixationQuestions.map((q, qIdx) => (
            <div key={q.id} className="bg-white p-10 rounded-[2.5rem] shadow-xl border border-slate-50">
              <p className="font-bold text-slate-800 mb-8 text-xl leading-snug">{qIdx + 1}. {q.text}</p>
              <div className="grid gap-4">
                {q.options.map((opt, oIdx) => (
                  <button 
                    key={oIdx}
                    className="p-6 text-left rounded-3xl border-2 border-slate-100 hover:bg-blue-50 hover:border-blue-300 transition-all font-bold text-slate-600"
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <button 
            onClick={() => { setFixation(null); startStudy(); }}
            className="w-full py-6 bg-slate-900 text-white rounded-3xl font-black hover:bg-black transition-all shadow-2xl text-xl"
          >
            Assunto Mapeado. Avançar.
          </button>
        </div>
      </div>
    );

    const masteredCount = syllabus.filter(t => t.status === 'Dominado').length;
    const progressPercent = syllabus.length > 0 ? Math.round((masteredCount / syllabus.length) * 100) : 0;

    return (
      <div className="max-w-6xl mx-auto p-6 flex flex-col lg:flex-row gap-10 animate-in fade-in duration-500">
        <aside className="lg:w-80 shrink-0 space-y-6 order-2 lg:order-1">
            <div className="bg-white p-8 rounded-[2rem] shadow-xl border border-slate-50 sticky top-10">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="font-black text-slate-900 uppercase text-xs tracking-widest">Edital 80/20</h3>
                    <TrendingUp size={16} className="text-blue-600" />
                </div>
                <div className="mb-8">
                    <div className="flex justify-between text-[10px] font-black text-slate-400 mb-2 uppercase tracking-tighter">
                        <span>Status Estratégico</span>
                        <span>{progressPercent}%</span>
                    </div>
                    <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden border border-slate-50 shadow-inner">
                        <div className="h-full bg-blue-600 transition-all duration-1000" style={{ width: `${progressPercent}%` }}></div>
                    </div>
                </div>
                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                    {syllabus.map(topic => (
                        <div key={topic.id} className="flex flex-col gap-1 p-3 rounded-xl border border-slate-50 hover:bg-slate-50 transition-colors">
                            <div className="flex justify-between items-center">
                                <span className="text-xs font-bold text-slate-700 truncate max-w-[140px]">{topic.name}</span>
                                {topic.status === 'Dominado' ? (
                                    <CheckCircle2 size={14} className="text-emerald-500" />
                                ) : topic.status === 'Em Progresso' ? (
                                    <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                                ) : (
                                    <div className="w-2 h-2 rounded-full bg-slate-200" />
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </aside>

        <div className="flex-1 order-1 lg:order-2">
            <div className="flex flex-col sm:flex-row justify-between items-center mb-8 gap-4">
                <button onClick={() => setMode(AppMode.WELCOME)} className="text-slate-400 flex items-center gap-1 hover:text-slate-800 font-bold">
                    <ArrowLeft size={18}/> Encerrar Sessão
                </button>
                <div className="bg-white px-6 py-3 rounded-2xl shadow-sm border border-slate-50 flex flex-wrap items-center gap-4 justify-center">
                    <div className="text-right">
                        <span className="text-[10px] uppercase font-black text-slate-400 tracking-tighter">Banca</span>
                        <p className="font-black text-blue-600 text-xs">{selectedBoard || 'ENEM'}</p>
                    </div>
                    {selectedSubject && (
                        <>
                            <div className="h-6 w-[1px] bg-slate-100" />
                            <div className="text-right">
                                <span className="text-[10px] uppercase font-black text-slate-400 tracking-tighter">Matéria</span>
                                <p className="font-black text-indigo-600 text-xs">{selectedSubject}</p>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {currentQuestion && (
            <div className="bg-white p-12 rounded-[3.5rem] shadow-2xl border border-slate-50 relative overflow-hidden animate-in zoom-in-95">
                <div className="absolute top-0 right-0 p-8 opacity-5">
                    <Sparkles size={120} />
                </div>
                <div className="flex items-center gap-3 mb-10">
                    <span className="px-5 py-2 bg-blue-600 text-white text-[10px] font-black rounded-full uppercase tracking-widest shadow-lg shadow-blue-100">{currentQuestion.subject}</span>
                    <span className="px-5 py-2 bg-slate-100 text-slate-500 text-[10px] font-black rounded-full uppercase tracking-widest">{currentQuestion.difficulty}</span>
                </div>
                <h2 className="text-3xl font-black text-slate-900 mb-12 leading-tight">
                    {currentQuestion.text}
                </h2>
                <div className="grid gap-5">
                    {currentQuestion.options.map((option, idx) => (
                        <button
                        key={idx}
                        onClick={() => handleAnswer(idx)}
                        className="p-7 text-left rounded-[2rem] border-2 border-slate-50 hover:border-blue-600 hover:bg-blue-50 transition-all group flex items-start gap-6 shadow-sm hover:shadow-md"
                        >
                        <span className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-lg font-black text-slate-400 group-hover:bg-blue-600 group-hover:text-white transition-all shadow-inner">
                            {String.fromCharCode(65 + idx)}
                        </span>
                        <span className="flex-1 font-bold text-slate-700 text-lg pt-3 leading-snug">{option}</span>
                        </button>
                    ))}
                </div>
                
                <div className="mt-16 pt-10 border-t border-slate-50 flex justify-center">
                    <button 
                        onClick={finalizeSession}
                        className="flex items-center gap-3 px-10 py-5 bg-slate-50 text-slate-500 hover:bg-slate-900 hover:text-white rounded-[1.5rem] font-black transition-all shadow-sm group"
                    >
                        <BarChart2 size={24} className="group-hover:scale-110 transition-transform"/> Finalizar Ciclo
                    </button>
                </div>
            </div>
            )}
        </div>
      </div>
    );
  };

  const renderOcrSolver = () => (
    <div className="max-w-4xl mx-auto p-6 animate-in fade-in duration-500">
      <button onClick={() => setMode(AppMode.WELCOME)} className="mb-6 text-slate-400 flex items-center gap-1 hover:text-slate-800 font-bold">
        <ArrowLeft size={18}/> Voltar
      </button>

      <div className="bg-white p-8 rounded-[3rem] shadow-2xl border border-slate-50">
        {!ocrResult ? (
          <>
            <div className="relative aspect-video bg-slate-900 rounded-[2rem] overflow-hidden mb-8 shadow-inner border-4 border-slate-800">
              <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover opacity-90" />
              <canvas ref={canvasRef} className="hidden" />
              <div className="absolute inset-0 border-4 border-blue-500/30 border-dashed m-12 rounded-3xl pointer-events-none animate-pulse"></div>
              <div className="absolute top-6 right-6 px-4 py-2 bg-black/60 text-white text-[10px] font-black rounded-full backdrop-blur-xl border border-white/20 uppercase tracking-widest">Scanner Tático</div>
            </div>
            <button 
              onClick={() => {
                if (canvasRef.current && videoRef.current) {
                    const ctx = canvasRef.current.getContext('2d');
                    canvasRef.current.width = videoRef.current.videoWidth;
                    canvasRef.current.height = videoRef.current.videoHeight;
                    ctx?.drawImage(videoRef.current, 0, 0);
                    const base64 = canvasRef.current.toDataURL('image/jpeg').split(',')[1];
                    setLoading(true);
                    gemini.solveFromImage(base64).then(setOcrResult).finally(() => setLoading(false));
                }
              }}
              disabled={loading}
              className="w-full py-6 bg-emerald-600 text-white rounded-3xl font-black hover:bg-emerald-700 transition-all flex items-center justify-center gap-4 text-xl shadow-xl"
            >
              {loading ? <Loader2 className="animate-spin" size={24}/> : <Camera size={28} />}
              Capturar Questão (80/20)
            </button>
          </>
        ) : (
          <div className="space-y-8 animate-in zoom-in-95">
            <div className="bg-slate-50 p-10 rounded-[2rem] border border-slate-100">
              <h3 className="font-black text-slate-400 text-xs uppercase mb-4 tracking-widest">Enunciado Processado</h3>
              <p className="text-slate-800 font-bold leading-relaxed text-lg">{ocrResult.question}</p>
            </div>
            <div className="bg-emerald-50 p-10 rounded-[2.5rem] border-l-[12px] border-emerald-500 shadow-xl shadow-emerald-50 relative">
              <div className="absolute top-6 right-10 text-emerald-200">
                  <Sparkles size={60} />
              </div>
              <h3 className="font-black text-emerald-700 text-xs uppercase mb-4 tracking-widest">Resposta Estratégica</h3>
              <p className="text-emerald-900 font-black text-4xl mb-8 leading-tight">{ocrResult.answer}</p>
              <h3 className="font-black text-emerald-700 text-xs uppercase mb-3 tracking-widest">Explicação do Mentor</h3>
              <p className="text-emerald-800 whitespace-pre-wrap leading-relaxed font-medium text-lg">{ocrResult.explanation}</p>
            </div>
            <button onClick={() => setOcrResult(null)} className="w-full py-5 bg-slate-100 text-slate-600 rounded-2xl font-black">Escanear Outra</button>
          </div>
        )}
      </div>
    </div>
  );

  const renderEssayAnalysis = () => (
    <div className="max-w-6xl mx-auto p-6 animate-in fade-in duration-500">
      <button onClick={() => setMode(AppMode.WELCOME)} className="mb-6 text-slate-400 flex items-center gap-1 hover:text-slate-800 font-bold">
        <ArrowLeft size={18}/> Voltar ao Início
      </button>

      <div className="grid lg:grid-cols-2 gap-10">
        <div className="bg-white p-12 rounded-[3.5rem] shadow-2xl border border-slate-50 flex flex-col relative min-h-[700px]">
          <div className="flex justify-between items-center mb-10">
            <h2 className="text-3xl font-black text-slate-900 flex items-center gap-4">
               <FileText className="text-orange-500" size={32} /> Redação Elite
            </h2>
            <button 
                onClick={() => startCameraMode(true)}
                className="p-4 bg-slate-50 text-slate-500 rounded-2xl hover:bg-orange-50 hover:text-orange-600 transition-all shadow-sm"
                title="Capturar foto do manuscrito"
            >
                <Camera size={24} />
            </button>
          </div>

          {essayCaptureMode ? (
            <div className="flex-1 bg-slate-900 rounded-[2.5rem] overflow-hidden relative border-4 border-slate-800">
                 <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                 <canvas ref={canvasRef} className="hidden" />
                 <div className="absolute inset-x-8 top-1/2 -translate-y-1/2 h-80 border-2 border-white/20 border-dashed rounded-3xl pointer-events-none" />
                 <div className="absolute bottom-8 inset-x-8 flex gap-4">
                    <button onClick={() => setEssayCaptureMode(false)} className="flex-1 py-4 bg-white/10 text-white rounded-2xl backdrop-blur-xl font-bold">Cancelar</button>
                    <button onClick={captureAndAnalyzeEssay} className="flex-[2] py-4 bg-orange-600 text-white rounded-2xl font-black shadow-lg">Capturar e Corrigir</button>
                 </div>
            </div>
          ) : (
            <>
                <textarea 
                    className="flex-1 w-full p-10 bg-slate-50 rounded-[2.5rem] border-4 border-transparent focus:border-orange-500 outline-none resize-none text-slate-700 leading-relaxed text-xl font-medium transition-all shadow-inner custom-scrollbar"
                    placeholder="Cole seu texto ou use a câmera para corrigir seu manuscrito..."
                    value={essayText}
                    onChange={(e) => setEssayText(e.target.value)}
                />
                <button 
                    onClick={() => analyzeEssayAction()}
                    disabled={loading || !essayText}
                    className="mt-10 w-full py-6 bg-orange-600 text-white rounded-[1.5rem] font-black hover:bg-orange-700 transition-all flex items-center justify-center gap-4 text-xl shadow-2xl shadow-orange-100"
                >
                    {loading ? <Loader2 className="animate-spin" size={24}/> : <Sparkles size={28}/>}
                    Diagnóstico Completo
                </button>
            </>
          )}
        </div>

        <div className="bg-white p-12 rounded-[3.5rem] shadow-2xl border border-slate-50">
          {essayResult ? (
            <div className="space-y-10 animate-in slide-in-from-right-8 duration-500">
              <div className="text-center pb-10 border-b-4 border-slate-50">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em]">Score Oficial IAprof</span>
                <p className="text-8xl font-black text-orange-600 mt-4 tabular-nums drop-shadow-sm">{essayResult.score}</p>
                <p className="text-slate-400 font-bold mt-4 italic leading-relaxed">"{essayResult.generalFeedback}"</p>
              </div>
              
              <div className="space-y-6">
                {[1,2,3,4,5].map(c => {
                  const comp = (essayResult.competencies as any)[`c${c}`];
                  return (
                    <div key={c} className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100 transition-all hover:bg-white hover:shadow-lg">
                      <div className="flex justify-between items-center mb-3">
                        <span className="font-black text-[10px] text-slate-500 uppercase tracking-widest">Competência {c}</span>
                        <span className="font-black text-orange-600 bg-orange-50 px-4 py-1.5 rounded-full text-sm">{comp.score}/200</span>
                      </div>
                      <p className="text-sm text-slate-600 leading-relaxed font-medium">{comp.feedback}</p>
                    </div>
                  );
                })}
              </div>

              <div className="p-10 bg-blue-900 rounded-[2.5rem] text-white shadow-2xl shadow-blue-200 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-6 opacity-10"><TrendingUp size={100} /></div>
                <h3 className="font-black text-blue-200 text-xs uppercase tracking-widest mb-6 flex items-center gap-3">
                   <Trophy size={20} /> Mapa da Nota 1000
                </h3>
                <ul className="space-y-4">
                  {essayResult.suggestions.map((s, i) => (
                    <li key={i} className="flex gap-4 text-base font-bold text-blue-50 leading-tight">
                       <div className="w-6 h-6 rounded-lg bg-blue-700 flex items-center justify-center shrink-0 text-[10px]">{i+1}</div> 
                       {s}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center py-20 opacity-30">
              <FileText size={100} className="text-slate-200 mb-10" />
              <p className="text-slate-500 font-black text-xl uppercase tracking-tighter">Aguardando correção...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderReport = () => {
    const correctCount = sessionResults.filter(r => r.isCorrect).length;
    const totalCount = sessionResults.length;
    const percent = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0;

    return (
      <div className="max-w-4xl mx-auto p-6 animate-in zoom-in-95 duration-500">
        <div id="report-content" className="bg-white p-16 rounded-[4rem] shadow-2xl border border-slate-50">
          <header className="flex flex-col sm:flex-row justify-between items-start gap-8 mb-16">
            <div>
              <div className="flex items-center gap-3 text-blue-600 font-black text-xs uppercase tracking-[0.3em] mb-4">
                 <Sparkles size={16} /> Relatório Estratégico
              </div>
              <h1 className="text-5xl font-black text-slate-900 mb-4 tracking-tighter">Performance do Ciclo</h1>
              <div className="flex flex-wrap gap-4">
                  <span className="px-4 py-2 bg-slate-100 rounded-xl text-xs font-black text-slate-600 uppercase tracking-widest">{selectedCourse}</span>
                  <span className="px-4 py-2 bg-blue-50 rounded-xl text-xs font-black text-blue-600 uppercase tracking-widest">{selectedBoard || 'ENEM'}</span>
              </div>
            </div>
            <div className="text-right">
               <div className="inline-block px-6 py-3 bg-slate-900 text-white rounded-[1.5rem] font-black text-[12px] tracking-[0.3em] uppercase shadow-lg">IAprof mentor</div>
            </div>
          </header>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
            <div className="bg-blue-600 p-10 rounded-[2.5rem] text-center shadow-2xl shadow-blue-200">
              <span className="text-[10px] font-black text-blue-100 uppercase tracking-[0.4em]">Domínio do Ciclo</span>
              <p className="text-6xl font-black text-white mt-4 tabular-nums">{percent}%</p>
            </div>
            <div className="bg-white p-10 rounded-[2.5rem] text-center border-4 border-emerald-50 shadow-xl">
              <span className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.4em]">Acertos</span>
              <p className="text-6xl font-black text-emerald-600 mt-4 tabular-nums">{correctCount}</p>
            </div>
            <div className="bg-slate-900 p-10 rounded-[2.5rem] text-center shadow-xl">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em]">Nível de Estudo</span>
              <p className="text-3xl font-black text-white mt-6 uppercase tracking-widest">Avançado</p>
            </div>
          </div>

          <div className="bg-slate-50 p-12 rounded-[3.5rem] border-2 border-slate-100 mb-16 relative overflow-hidden group">
             <div className="absolute top-0 right-0 p-10 opacity-5 group-hover:scale-110 transition-transform duration-700"><Sparkles size={140} /></div>
             <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg"><Trophy size={20} /></div>
                <h3 className="font-black text-slate-900 text-sm uppercase tracking-[0.2em]">Feedback Final</h3>
             </div>
             <p className="text-slate-800 text-2xl font-bold leading-relaxed italic relative z-10">
               {loading ? "Sincronizando diagnóstico..." : `"${mentorFeedback}"`}
             </p>
          </div>

          <div className="space-y-6 mb-16">
            <h2 className="text-xs font-black text-slate-400 uppercase tracking-[0.5em] mb-10 text-center">Detalhamento das Questões</h2>
            {sessionResults.map((res, i) => (
              <div key={i} className="flex gap-8 p-10 rounded-[2.5rem] hover:bg-slate-50 transition-all border-2 border-transparent hover:border-slate-100 group shadow-sm">
                <div className="shrink-0 pt-1">
                  {res.isCorrect ? <CheckCircle2 className="text-emerald-500" size={32} /> : <AlertCircle className="text-rose-500" size={32} />}
                </div>
                <div className="flex-1">
                  <p className="text-slate-900 font-black text-xl mb-4 leading-tight">{res.question.text}</p>
                  <div className="flex gap-4">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-white px-3 py-1 rounded-lg border">{