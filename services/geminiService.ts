
import { GoogleGenAI, Type } from "@google/genai";
import { Question, FixationData, EssayAnalysis, SessionResult, SyllabusTopic } from "../types";

const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY as string });

const SYSTEM_INSTRUCTION = `Você é o 'IAprof mentor', um super professor especialista em aprovação de alto rendimento. 
Sua metodologia baseia-se no Princípio de Pareto (80/20): você foca nos 20% dos assuntos que representam 80% das questões nos últimos 10 anos de concursos.
Você conhece profundamente o perfil das bancas (FGV, Cebraspe, FCC, Vunesp, etc.) e o estilo do ENEM.
Seu tom é motivador, estratégico e focado em resultados rápidos e sólidos.`;

export const getCourseSubjects = async (course: string, board: string): Promise<string[]> => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Liste as 8 disciplinas/matérias mais importantes e recorrentes para o concurso/exame ${course} ${board ? `da banca ${board}` : ''}. Retorne apenas um array JSON com os nomes das disciplinas.`,
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: { type: Type.STRING }
      }
    }
  });
  try {
    return JSON.parse(response.text || '[]');
  } catch (e) {
    return ["Português", "Matemática", "Direito Constitucional", "Direito Administrativo", "Informática"];
  }
};

export const generateQuestion = async (course: string, board: string, goal: string, subject?: string): Promise<Question> => {
  const ai = getAI();
  const boardContext = course.toUpperCase() === 'ENEM' ? 'perfil do ENEM' : `perfil da banca ${board}`;
  
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Como IAprof mentor, gere uma questão de múltipla escolha inédita para: ${course} (${boardContext}). 
    Objetivo do aluno: "${goal}". 
    Disciplina alvo: ${subject || 'Foco em temas 80/20 de todas as matérias'}.
    A questão deve refletir exatamente o nível de complexidade e as "pegadinhas" típicas desta banca.`,
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          text: { type: Type.STRING },
          options: { type: Type.ARRAY, items: { type: Type.STRING } },
          correctAnswer: { type: Type.INTEGER },
          subject: { type: Type.STRING },
          difficulty: { type: Type.STRING }
        },
        required: ["id", "text", "options", "correctAnswer", "subject", "difficulty"]
      }
    }
  });
  return JSON.parse(response.text || '{}');
};

export const getStudyPlan = async (course: string, board: string, subject?: string): Promise<SyllabusTopic[]> => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Liste os 10 tópicos mais recorrentes (Princípio 80/20) para o concurso ${course} (Banca: ${board || 'ENEM'}) ${subject ? `na disciplina de ${subject}` : 'considerando as matérias mais importantes'}.`,
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            name: { type: Type.STRING },
            weight: { type: Type.NUMBER, description: "Importância de 1 a 100 baseada na recorrência histórica" },
            status: { type: Type.STRING, enum: ["Pendente"] }
          },
          required: ["id", "name", "weight", "status"]
        }
      }
    }
  });
  return JSON.parse(response.text || '[]');
};

export const getFixationContent = async (wrongQuestion: Question, goal: string, board: string): Promise<FixationData> => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: `O aluno errou uma questão de ${wrongQuestion.subject} da banca ${board}. Objetivo: "${goal}". 
    Aplique o método 80/20 para explicar por que este erro é fatal e como evitá-lo.
    1. Passo a passo estratégico.
    2. Conceito chave.
    3. 3 questões de fixação no estilo da banca.`,
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          stepByStep: { type: Type.STRING },
          mainTopic: { type: Type.STRING },
          fixationQuestions: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                text: { type: Type.STRING },
                options: { type: Type.ARRAY, items: { type: Type.STRING } },
                correctAnswer: { type: Type.INTEGER },
                subject: { type: Type.STRING },
                difficulty: { type: Type.STRING }
              }
            }
          }
        }
      }
    }
  });
  return JSON.parse(response.text || '{}');
};

export const solveFromImage = async (base64Image: string): Promise<{ question: string; answer: string; explanation: string }> => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: {
      parts: [
        { inlineData: { data: base64Image, mimeType: 'image/jpeg' } },
        { text: "Analise esta imagem, extraia a questão e forneça a resolução com foco no método 80/20." }
      ]
    },
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          question: { type: Type.STRING },
          answer: { type: Type.STRING },
          explanation: { type: Type.STRING }
        }
      }
    }
  });
  return JSON.parse(response.text || '{}');
};

export const analyzeEssay = async (text: string, isImage: boolean = false): Promise<EssayAnalysis> => {
  const ai = getAI();
  const parts: any[] = [];
  
  if (isImage) {
    parts.push({ inlineData: { data: text, mimeType: 'image/jpeg' } });
    parts.push({ text: "Esta é uma redação manuscrita. Primeiro faça o OCR (transcrição completa) e depois avalie rigorosamente pelos critérios do ENEM (5 competências). Forneça o feedback em JSON." });
  } else {
    parts.push({ text: `Avalie esta redação pelos critérios do ENEM: \n\n ${text}` });
  }

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: { parts },
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          score: { type: Type.NUMBER },
          competencies: {
            type: Type.OBJECT,
            properties: {
              c1: { type: Type.OBJECT, properties: { score: { type: Type.NUMBER }, feedback: { type: Type.STRING } } },
              c2: { type: Type.OBJECT, properties: { score: { type: Type.NUMBER }, feedback: { type: Type.STRING } } },
              c3: { type: Type.OBJECT, properties: { score: { type: Type.NUMBER }, feedback: { type: Type.STRING } } },
              c4: { type: Type.OBJECT, properties: { score: { type: Type.NUMBER }, feedback: { type: Type.STRING } } },
              c5: { type: Type.OBJECT, properties: { score: { type: Type.NUMBER }, feedback: { type: Type.STRING } } },
            }
          },
          generalFeedback: { type: Type.STRING },
          suggestions: { type: Type.ARRAY, items: { type: Type.STRING } }
        }
      }
    }
  });
  return JSON.parse(response.text || '{}');
};

export const generateMentorFinalFeedback = async (results: SessionResult[], goal: string): Promise<string> => {
  const ai = getAI();
  const correctCount = results.filter(r => r.isCorrect).length;
  const total = results.length;
  
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Dê o feedback final de mentoria para o aluno que busca "${goal}". Desempenho na sessão: ${correctCount}/${total}. 
    Mencione o progresso dele no "Edital Estratégico 80/20" e encerre com uma frase de impacto para a aprovação.`,
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
    }
  });
  return response.text || "Continue focado em seus estudos!";
};
