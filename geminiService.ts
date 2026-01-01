/* Developed by Riddhi Tiwari */
import { GoogleGenAI, Modality, LiveServerMessage, Blob, Type } from "@google/genai";
import { GEMIKID_SYSTEM_PROMPT } from "./constants";
import { GoogleGenerativeAI } from "@google/generative-ai";

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
// Initialize the Gemini API client
// Vite uses import.meta.env to access environment variables
const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY || "");

export class GeminiService {
  /**
   * Always creates a fresh instance of GoogleGenAI to ensure the latest 
   * API key (from process.env.API_KEY) is used for every request.
   * Always creates a fresh instance of GoogleGenAI to ensure the latest
   * API key is used.
   */
private createAI() {
  private createAI() {
    return new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY || "");
  }

  async getSpellingWords(classLevel: string): Promise<any[]> {
  
async getSpellingWords(classLevel: string): Promise<any[]> {
  const ai = this.createAI();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: [{
      parts: [{ 
        text: `Generate a JSON array of 10 spelling words for a child in ${classLevel}. 
        Each object must have "word" (English), "hindi" (Hindi translation), and "hint" (a simple child-friendly clue).
        Focus on common educational vocabulary.` 
      }]
    }],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            word: { type: Type.STRING },
            hindi: { type: Type.STRING },
            hint: { type: Type.STRING }
          },
          required: ["word", "hindi", "hint"]
        }
      }
    }
  });

  try {
    return JSON.parse(response.text || "[]");
  } catch (e) {
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
    const ai = this.createAI();
    
    let modelName = 'gemini-3-flash-preview'; 
    if (mode === 'lite') {
      modelName = 'gemini-flash-lite-latest';
    } else if (mode === 'pro' || thinkingMode || videoData || teacherExplanationMode) {
      modelName = 'gemini-3-pro-preview'; 
    }

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
      parts.push({
        inlineData: {
          mimeType: "image/jpeg",
          data: imageData.split(',')[1]
        }
      });
    }

    if (videoData) {
      parts.push({
        inlineData: {
          mimeType: videoData.mimeType,
          data: videoData.data
        }
      });
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
          grounding: chunk.candidates?.[0]?.groundingMetadata?.groundingChunks
        };
      }
    } catch (err) {
      console.error("Stream generation failed:", err);
      throw err;
    }
  }

  async transcribeAudio(audioBase64: string): Promise<string> {
    const ai = this.createAI();
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [{
        parts: [
          { text: "Transcribe the following audio precisely. Return only the transcription." },
          { inlineData: { mimeType: 'audio/wav', data: audioBase64 } }
        ]
      }]
    });
    return response.text || "";
  }

  async generateImage(prompt: string, aspectRatio: string) {
    const ai = this.createAI();
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { parts: [{ text: `A colorful, educational, and safe illustration for children: ${prompt}` }] },
      config: { imageConfig: { aspectRatio: aspectRatio as any } },
    });

    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
    }
    throw new Error("No image generated.");
  }
    const model = ai.getGenerativeModel({ model: "gemini-1.5-flash" });

  async generateVideo(prompt: string, aspectRatio: '16:9' | '9:16' = '16:9') {
    const ai = this.createAI();
    let operation = await ai.models.generateVideos({
      model: 'veo-3.1-fast-generate-preview',
      prompt: `Safe, vibrant, educational animated short for children: ${prompt}`,
      config: { numberOfVideos: 1, resolution: '720p', aspectRatio }
    });

    while (!operation.done) {
      await new Promise(resolve => setTimeout(resolve, 10000));
      operation = await ai.operations.getVideosOperation({ operation: operation });
    }
    const prompt = `Generate a JSON array of 10 spelling words for a child in ${classLevel}. 
    Each object must have "word" (English), "hindi" (Hindi translation), and "sentence" (simple English sentence using the word).`;

    const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
    const response = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
    const blob = await response.blob();
    return URL.createObjectURL(blob);
  }

  async speak(text: string, voiceName: string = 'Kore'): Promise<AudioBuffer | null> {
    try {
      const ai = this.createAI();
      
      const lines = text.split('\n').filter(l => l.includes(':'));
      const speakersFound = new Set<string>();
      lines.forEach(line => {
        const match = line.match(/^([\w\s]+):\s*/);
        if (match) speakersFound.add(match[1].trim().toLowerCase());
      });

      let config: any = {
        responseModalities: [Modality.AUDIO],
      };

      if (speakersFound.size >= 2) {
        const voiceMap: Record<string, string> = {
          'gemikid': 'Kore',
          'gemi': 'Kore',
          'teacher': 'Kore',
          'bunti': 'Puck',
          'kid': 'Puck',
          'dadaji': 'Charon',
          'lion': 'Fenrir',
          'sher': 'Fenrir',
          'ghost': 'Zephyr'
        };

        const speakerList = Array.from(speakersFound);
        const speakerConfigs = speakerList.slice(0, 2).map(name => ({
          speaker: name.charAt(0).toUpperCase() + name.slice(1),
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voiceMap[name] || voiceName }
          }
        }));

        config.speechConfig = {
          multiSpeakerVoiceConfig: {
            speakerVoiceConfigs: speakerConfigs
          }
        };
      } else {
        config.speechConfig = {
          voiceConfig: { prebuiltVoiceConfig: { voiceName } }
        };
      }

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text }] }],
        config: config,
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        return await decodeAudioData(decode(base64Audio), audioContext, 24000, 1);
      }
    } catch (e) {
      console.error("TTS generation error:", e);
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
    return null;
  }

  async connectLive({ onAudio, onInterrupted, onClose, voiceName }: {
    onAudio: (buffer: AudioBuffer) => void;
    onInterrupted: () => void;
    onClose: () => void;
    voiceName: string;
  }) {
    const ai = this.createAI();
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });

    const sessionPromise = ai.live.connect({
      model: 'gemini-2.5-flash-native-audio-preview-09-2025',
      callbacks: {
        onopen: async () => {
          try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const inputAudioContext = new AudioContext({ sampleRate: 16000 });
            const source = inputAudioContext.createMediaStreamSource(stream);
            const scriptProcessor = inputAudioContext.createScriptProcessor(4096, 1, 1);
            
            scriptProcessor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const l = inputData.length;
              const int16 = new Int16Array(l);
              for (let i = 0; i < l; i++) {
                int16[i] = inputData[i] * 32768;
              }
              const pcmBlob: Blob = {
                data: encode(new Uint8Array(int16.buffer)),
                mimeType: 'audio/pcm;rate=16000',
              };
              sessionPromise.then(session => {
                session.sendRealtimeInput({ media: pcmBlob });
              });
            };
            source.connect(scriptProcessor);
            scriptProcessor.connect(inputAudioContext.destination);
          } catch (err) {
            console.error("Mic setup failed:", err);
          }
        },
        onmessage: async (message: LiveServerMessage) => {
          const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
          if (base64Audio) {
            const buffer = await decodeAudioData(decode(base64Audio), audioContext, 24000, 1);
            onAudio(buffer);
          }
          if (message.serverContent?.interrupted) onInterrupted();
        },
        onerror: (e) => console.error("Live session error:", e),
        onclose: () => onClose(),
      },
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName } }
        },
        systemInstruction: GEMIKID_SYSTEM_PROMPT,
      }
    });

    return {
      close: () => sessionPromise.then(s => s.close())
    };
  }
}

export const geminiService = new GeminiService();
