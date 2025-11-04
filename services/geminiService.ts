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
        description: "An array of 4 multiple-choice options. For questions requiring a numerical answer, this array should be empty or omitted."
      },
      correctAnswers: {
        type: Type.ARRAY,
        items: {
          type: Type.STRING,
        },
        description: "An array containing the correct answer(s). For multiple-choice, this contains the correct option text(s). For numerical questions, this contains a single string with the correct number."
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
    required: ["question", "correctAnswers"],
  },
};

// Fix: Updated function signature to not accept apiKey, as it will be read from environment variables.
export const generateQuiz = async (parts: any[]): Promise<Question[] | null> => {
  // Fix: API key is now read from environment variables as per guidelines.
  // The guidelines state to assume `process.env.API_KEY` is always available.
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    // Fix: The 'contents' property expects an array of Content objects. The 'parts' array should be wrapped in an object and then an array.
    contents: [{ parts }],
    config: {
      responseMimeType: "application/json",
      responseSchema: quizSchema,
    },
  });

  const jsonText = response.text.trim();
  const parsedData = JSON.parse(jsonText);
  
  if (!Array.isArray(parsedData)) {
    throw new Error("AI response is not in the expected format.");
  }

  const quizData: Question[] = parsedData.map((q: any) => ({
    ...q,
    correctAnswers: q.correctAnswers 
        ? (Array.isArray(q.correctAnswers) ? q.correctAnswers : [q.correctAnswers]) 
        : (q.correctAnswer ? [q.correctAnswer] : [])
  }));
  
  const validQuestions = quizData.filter(q => {
    const commonValid = q.question && q.correctAnswers && q.correctAnswers.length > 0;
    if (!commonValid) return false;

    if (q.options && q.options.length > 0) { // Multiple choice
      return q.options.length > 1; 
    } else { // Numerical answer
      return true;
    }
  });
  
  if (validQuestions.length === 0) {
    return null;
  }
  
  return validQuestions;
};
