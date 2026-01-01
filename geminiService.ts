/* Developed by Riddhi Tiwari */
import { GoogleGenerativeAI } from "@google/generative-ai";

// Initialize the Gemini API client
// Vite uses import.meta.env to access environment variables
const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY || "");

export class GeminiService {
  /**
   * Always creates a fresh instance of GoogleGenAI to ensure the latest
   * API key is used.
   */
  private createAI() {
    return new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY || "");
  }

  async getSpellingWords(classLevel: string): Promise<any[]> {
    const ai = this.createAI();
    const model = ai.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `Generate a JSON array of 10 spelling words for a child in ${classLevel}. 
    Each object must have "word" (English), "hindi" (Hindi translation), and "sentence" (simple English sentence using the word).`;

    try {
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      // Simple JSON extraction to handle potential markdown
      const jsonStr = text.substring(text.indexOf('['), text.lastIndexOf(']') + 1);
      return JSON.parse(jsonStr);
    } catch (error) {
      console.error("Gemini Error:", error);
      throw error;
    }
  }
}

export const geminiService = new GeminiService();
