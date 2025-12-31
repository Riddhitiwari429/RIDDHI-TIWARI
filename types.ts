export enum Role {
  USER = 'user',
  MODEL = 'model'
}

export interface GroundingSource {
  title: string;
  uri: string;
}

export interface Message {
  id: string;
  role: Role;
  text: string;
  timestamp: Date;
  audioUrl?: string;
  sources?: GroundingSource[];
  isLite?: boolean;
  videoUrl?: string;
  imageUrl?: string;
  imageData?: string;
}

export interface StudentProfile {
  name: string;
  phoneNumber: string;
}

export interface SpellingWord {
  word: string;
  hindi: string;
  hint: string;
}

export interface TeacherState {
  isProcessing: boolean;
  isGeneratingVideo: boolean;
  isGeneratingImage: boolean;
  error: string | null;
  isAudioEnabled: boolean;
  isLiveMode: boolean;
  isThinkingMode: boolean;
  isTeacherExplanationMode: boolean;
  modelMode: 'lite' | 'pro' | 'search';
  spellingTarget: string | null;
  studentProfile: StudentProfile | null;
  isProfileModalOpen: boolean;
  hasApiKey: boolean;
  imageAspectRatio: string;
  // Spelling Challenge State
  isSpellingChallengeActive: boolean;
  challengeScore: number;
  challengeTimeLeft: number;
  challengeWords: SpellingWord[];
  challengeCurrentIndex: number;
}