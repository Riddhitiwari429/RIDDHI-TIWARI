import { GoogleGenerativeAI } from "@google/generative-ai";
import { GEMIKID_SYSTEM_PROMPT } from "./constants";

export class GeminiService {
  private createAI() {
    // Vite के लिए सही API Key वेरिएबल
    return new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY || "");
  }

  async getSpellingWords(classLevel: string): Promise<any[]> {
    const ai = this.createAI();
    const model = ai.getGenerativeModel({ model: "gemini-1.5-flash" });
    try {
      const result = await model.generateContent(`Generate 10 spelling words for ${classLevel} in JSON format.`);
      const text = result.response.text();
      const jsonStr = text.substring(text.indexOf('['), text.lastIndexOf(']') + 1);
      return JSON.parse(jsonStr || "[]");
    } catch (e) { return []; }
  }

  async *getTeacherResponseStream(message: string, history: any[]) {
    const ai = this.createAI();
    const model = ai.getGenerativeModel({ model: "gemini-1.5-flash", systemInstruction: GEMIKID_SYSTEM_PROMPT });
    const result = await model.generateContentStream({ contents: [...history, { role: 'user', parts: [{ text: message }] }] });
    for await (const chunk of result.stream) { yield { text: chunk.text() }; }
  }
}

export const geminiService = new GeminiService();
