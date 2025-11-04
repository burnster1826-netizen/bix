import { GoogleGenAI, Type } from "@google/genai";
import { Question } from '../types';

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
        description: "If isDiagramBased is true, provide a bounding box that encapsulates both the question text and the associated diagram/visual element it refers to. The coordinates should be normalized (0-1) relative to the page dimensions.",
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

export const generateQuiz = async (parts: any[], apiKey: string): Promise<Question[] | null> => {
  if (!apiKey) {
    throw new Error("API key is missing. Please provide a valid API key.");
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