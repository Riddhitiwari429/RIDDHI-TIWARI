import { GoogleGenerativeAI } from "@google/generative-ai";
import { GEMIKID_SYSTEM_PROMPT } from "./constants";

// --- ऑडियो प्रोसेसिंग हेल्पर ---
function decode(base64: string) {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

// --- मुख्य सर्विस क्लास ---
export class GeminiService {
  /**
   * AI क्लाइंट शुरू करने का सही तरीका
   */
  private createAI() {
    const key = import.meta.env.VITE_GEMINI_API_KEY || "";
    return new GoogleGenerativeAI(key);
  }

  /**
   * स्पेलिंग वर्ड्स जेनरेट करना
   */
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
      console.error("Spelling words error:", e);
      return [];
    }
  }

  /**
   * AI टीचर रिस्पांस स्ट्रीम
   */
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
      console.error("Stream generation failed:", err);
      throw err;
    }
  }
}

export const geminiService = new GeminiService();
