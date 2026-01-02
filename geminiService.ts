/* Developed by Riddhi Tiwari */
import { GoogleGenAI, Modality, LiveServerMessage, Blob } from "@google/genai";
import { GEMIKID_SYSTEM_PROMPT } from "./constants";
import { GoogleGenerativeAI } from "@google/generative-ai";

// --- Helper functions for audio processing ---
function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

function encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
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

// --- Main Service Class ---
export class GeminiService {
  private createAI() {
    // VITE_ का इस्तेमाल करें क्योंकि आपका ऐप Vite पर है
    return new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY || "");
  }

  // New SDK for Live/Advanced features
  private createNewSDK() {
    return new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY || "" });
  }

  async getSpellingWords(classLevel: string): Promise<any[]> {
    const ai = this.createAI();
    const model = ai.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    const prompt = `Generate a JSON array of 10 spelling words for a child in ${classLevel}. 
    Each object must have "word" (English), "hindi" (Hindi translation), and "sentence" (simple English sentence using the word). 
    Return ONLY raw JSON starting with [ and ending with ].`;

    try {
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      const jsonStr = text.substring(text.indexOf('['), text.lastIndexOf(']') + 1);
      return JSON.parse(jsonStr || "[]");
    } catch (e) {
      console.error("Spelling words error:", e);
      return [];
    }
  }

  async *getTeacherResponseStream(
    message: string, 
    history: any[], 
    mode: 'lite' | 'pro' | 'search', 
    thinkingMode: boolean,
    teacherExplanationMode: boolean,
    imageData?: string,
    videoData?: { data: string, mimeType: string }
  ) {
    const ai = this.createNewSDK();
    
    let modelName = 'gemini-2.0-flash-exp'; 
    if (mode === 'lite') modelName = 'gemini-1.5-flash-8b';
    else if (mode === 'pro' || thinkingMode || videoData || teacherExplanationMode) modelName = 'gemini-2.0-flash-thinking-exp';

    const config: any = {
      systemInstruction: GEMIKID_SYSTEM_PROMPT,
      temperature: 0.7,
    };

    if (thinkingMode || teacherExplanationMode) {
      config.thinkingConfig = { thinkingBudget: 32768 };
    }

    if (mode === 'search') {
      config.tools = [{ googleSearch: {} }];
    }

    const parts: any[] = [{ text: message }];
    
    if (imageData) {
      parts.push({ inlineData: { mimeType: "image/jpeg", data: imageData.split(',')[1] } });
    }

    if (videoData) {
      parts.push({ inlineData: { mimeType: videoData.mimeType, data: videoData.data } });
    }

    try {
      const streamResponse = await ai.models.generateContentStream({
        model: modelName,
        contents: [...history, { role: 'user', parts }],
        config
      });

      for await (const chunk of streamResponse) {
        yield {
          text: chunk.text,
          grounding: (chunk as any).candidates?.[0]?.groundingMetadata?.groundingChunks
        };
      }
    } catch (err) {
      console.error("Stream generation failed:", err);
      throw err;
    }
  }

  async transcribeAudio(audioBase64: string): Promise<string> {
    const ai = this.createNewSDK();
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash-exp',
      contents: [{
        parts: [
          { text: "Transcribe the following audio precisely." },
          { inlineData: { mimeType: 'audio/wav', data: audioBase64 } }
        ]
      }]
    });
    return response.text || "";
  }

  async generateImage(prompt: string, aspectRatio: string) {
    const ai = this.createNewSDK();
    const response = await ai.models.generateContent({
      model: 'imagen-3',
      contents: { parts: [{ text: `A colorful, educational illustration for children: ${prompt}` }] },
    });
    // extraction logic here
    return response;
  }

  async speak(text: string, voiceName: string = 'Kore'): Promise<AudioBuffer | null> {
    try {
      const ai = this.createNewSDK();
      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash-exp",
        contents: [{ parts: [{ text }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName } } }
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        return await decodeAudioData(decode(base64Audio), audioContext, 24000, 1);
      }
    } catch (e) {
      console.error("TTS generation error:", e);
    }
    return null;
  }

  async connectLive({ onAudio, onInterrupted, onClose, voiceName }: any) {
    const ai = this.createNewSDK();
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });

    const sessionPromise = ai.live.connect({
      model: 'gemini-2.0-flash-exp',
      callbacks: {
        onmessage: async (message: LiveServerMessage) => {
          const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
          if (base64Audio) {
            const buffer = await decodeAudioData(decode(base64Audio), audioContext, 24000, 1);
            onAudio(buffer);
          }
          if (message.serverContent?.interrupted) onInterrupted();
        },
        onclose: () => onClose(),
      },
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName } } },
        systemInstruction: GEMIKID_SYSTEM_PROMPT,
      }
    });

    return {
      close: () => sessionPromise.then(s => s.close())
    };
  }
}

export const geminiService = new GeminiService();
