import { GoogleGenAI, Type } from "@google/genai";
import { Question } from '../types';

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

const quizOnlySchema = {
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
      }
    },
    required: ["question", "options", "correctAnswer"],
  },
};

export const generateQuizFromText = async (text: string): Promise<Question[] | null> => {
  try {
    const prompt = `
      You are an expert quiz creator. Analyze the following text extracted from a document and generate a multiple-choice quiz based on its content.
      Ensure the questions cover the key topics in the text. Each question must have exactly four options.
      The provided text is:
      ---
      ${text}
      ---
    `;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: quizOnlySchema,
      },
    });

    const jsonText = response.text.trim();
    const quizData = JSON.parse(jsonText) as Question[];
    
    // Validate that options array has 4 items for each question
    return quizData.filter(q => q.options && q.options.length > 1 && q.question && q.correctAnswer);

  } catch (error) {
    console.error("Error generating quiz from Gemini:", error);
    return null;
  }
};

export const generateQuizFromImage = async (base64Image: string, mimeType: string): Promise<Question[] | null> => {
  try {
    const prompt = `
      You are an expert quiz creator. Analyze the following image, which contains text and questions, and generate a multiple-choice quiz based on its content.
      Ensure the questions cover the key topics in the image. Each question must have exactly four options.
    `;

    const imagePart = {
      inlineData: {
        data: base64Image,
        mimeType: mimeType,
      },
    };

    const textPart = { text: prompt };

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash", 
      contents: { parts: [imagePart, textPart] },
      config: {
        responseMimeType: "application/json",
        responseSchema: quizOnlySchema,
      },
    });

    const jsonText = response.text.trim();
    const quizData = JSON.parse(jsonText) as Question[];
    
    return quizData.filter(q => q.options && q.options.length > 1 && q.question && q.correctAnswer);

  } catch (error)    {
    console.error("Error generating quiz from Gemini with image:", error);
    return null;
  }
};
