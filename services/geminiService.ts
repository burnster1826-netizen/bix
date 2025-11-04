import { GoogleGenAI, Type } from "@google/genai";
import { Question } from '../types';

// NOTE: API_KEY check and `ai` instantiation are moved into generateQuiz.
// This prevents the entire application from crashing on load if the API key is not
// configured, which is the cause of the "blank white screen" on platforms like Vercel.
// The error is now thrown when the user tries to generate a quiz, and is handled
// gracefully by the UI.

const quizSchema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      question: {
        type: Type.STRING,
        description: "The question text."
      },
      options: {
        type: Type.ARRAY,
        items: {
          type: Type.STRING,
        },
        description: "An array of 4 multiple-choice options."
      },
      correctAnswer: {
        type: Type.STRING,
        description: "The correct answer from the options array."
      },
      isDiagramBased: {
        type: Type.BOOLEAN,
        description: "Set to true if the question refers to a diagram, chart, or image that is required to answer it. Default to false."
      },
      pageNumber: {
        type: Type.INTEGER,
        description: "For multi-page documents, the 1-indexed page number this question is from. For single images, default to 1."
      },
      diagramBoundingBox: {
        type: Type.OBJECT,
        description: "If isDiagramBased is true, provide the bounding box of the specific diagram or visual element. The coordinates should be normalized (0-1) relative to the page dimensions.",
        properties: {
          x: { type: Type.NUMBER, description: "Normalized top-left x-coordinate." },
          y: { type: Type.NUMBER, description: "Normalized top-left y-coordinate." },
          width: { type: Type.NUMBER, description: "Normalized width." },
          height: { type: Type.NUMBER, description: "Normalized height." }
        }
      }
    },
    required: ["question", "options", "correctAnswer"],
  },
};

export const generateQuiz = async (parts: any[]): Promise<Question[] | null> => {
  // The API key is now expected to be injected by the aistudio platform helper,
  // which makes `process.env.API_KEY` available. This check remains as a safeguard.
  const apiKey = (typeof process !== 'undefined' && process.env) ? process.env.API_KEY : undefined;

  if (!apiKey) {
    // This error should now rarely be seen by the user, as the UI flow in App.tsx
    // handles key selection. It serves as a fallback.
    throw new Error("Configuration Error: API key not found. Please select an API key to continue.");
  }

  const ai = new GoogleGenAI({ apiKey });

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: { parts },
    config: {
      responseMimeType: "application/json",
      responseSchema: quizSchema,
    },
  });

  const jsonText = response.text.trim();
  const quizData = JSON.parse(jsonText) as Question[];
  
  // Validate that options array has >1 item for each question
  const validQuestions = quizData.filter(q => q.options && q.options.length > 1 && q.question && q.correctAnswer);
  
  if (validQuestions.length === 0) {
    return null; // This will trigger the "could not generate quiz" message in App.tsx
  }
  
  return validQuestions;
};