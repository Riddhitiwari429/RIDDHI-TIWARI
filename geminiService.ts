import { GoogleGenerativeAI } from "@google/generative-ai";
import { GEMIKID_SYSTEM_PROMPT } from "./constants";

export class GeminiService {
  private createAI() {
// Correct way to access the key in a Vite project
const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

if (!apiKey) {
  console.error("Gemini API Key is missing! Check your GitHub Secrets.");
}

const genAI = new GoogleGenerativeAI(apiKey);
  async getSpellingWords(classLevel: string): Promise<any[]> {
    const ai = this.createAI();
    const model = ai.getGenerativeModel({ model: "gemini-1.5-flash" });
    const prompt = `Generate a JSON array of 10 spelling words for ${classLevel}. Return ONLY raw JSON starting with [ and ending with ].`;

    try {
      const result = await model.generateContent(prompt);
      const text = result.response.text();
      const jsonStr = text.substring(text.indexOf('['), text.lastIndexOf(']') + 1);
      return JSON.parse(jsonStr || "[]");
    } catch (e) {
      console.error("Spelling error:", e);
      return [];
    }
  }

  async *getTeacherResponseStream(message: string, history: any[]) {
    const ai = this.createAI();
    const model = ai.getGenerativeModel({ 
      model: "gemini-1.5-flash", 
      systemInstruction: GEMIKID_SYSTEM_PROMPT 
    });

    try {
      const result = await model.generateContentStream({
        contents: [...history, { role: 'user', parts: [{ text: message }] }]
      });
      for await (const chunk of result.stream) {
        yield { text: chunk.text() };
      }
    } catch (err) {
      console.error("Stream error:", err);
      throw err;
    }
  }
}

export const geminiService = new GeminiService();
