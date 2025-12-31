/* Developed by Riddhi Tiwari */
import React, { useState, useRef, useEffect } from 'react';
import Header from './components/Header';
import ChatMessage from './components/ChatMessage';
import { Message, Role, TeacherState, StudentProfile, SpellingWord } from './types';
import { gemini } from './geminiService';
import { ASPECT_RATIOS, CLASS_LEVELS, AVAILABLE_VOICES } from './constants';

const App: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: Role.MODEL,
      text: "🐯 Welcome children! 🌟\n\nHi! I am GemiKid, your friendly AI tuition teacher! You can ask me any question about Math, English, or Hindi. I love stories and animals too! 🐘🦁🦒\n\n(Welcome bacchon! Hi, main GemiKid hoon, aapka friendly AI tuition teacher! Aap mujhse Math, English, ya Hindi ka koi bhi sawal pooch sakte hain. Mujhe kahaniyan aur jaanwar bhi bahut pasand hain!) 🍎✍️\n\nWhich class are you in? (Aap kaunsi kaksha mein hain?)",
      timestamp: new Date(),
    }
  ]);
  const [input, setInput] = useState('');
  const [challengeInput, setChallengeInput] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<{ data: string, mimeType: string, url: string } | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [selectedClass, setSelectedClass] = useState<string | null>(null);
  const [selectedVoice, setSelectedVoice] = useState('Kore');
  
  const [state, setState] = useState<TeacherState>({
    isProcessing: false,
    isGeneratingVideo: false,
    isGeneratingImage: false,
    error: null,
    isAudioEnabled: true,
    isLiveMode: false,
    isThinkingMode: false,
    isTeacherExplanationMode: false,
    modelMode: 'pro',
    spellingTarget: null,
    studentProfile: null,
    isProfileModalOpen: false,
    hasApiKey: false,
    imageAspectRatio: '1:1',
    isSpellingChallengeActive: false,
    challengeScore: 0,
    challengeTimeLeft: 60,
    challengeWords: [],
    challengeCurrentIndex: 0
  });

  const [profileForm, setProfileForm] = useState({ name: '', phoneNumber: '' });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const liveSessionRef = useRef<{ close: () => void } | null>(null);
  const nextStartTimeRef = useRef(0);
  const audioSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    const checkKey = async () => {
      if (typeof (window as any).aistudio?.hasSelectedApiKey === 'function') {
        const has = await (window as any).aistudio.hasSelectedApiKey();
        setState(prev => ({ ...prev, hasApiKey: has }));
      }
    };
    checkKey();

    const saved = localStorage.getItem('gemikid_student_profile');
    if (saved) {
      const parsed = JSON.parse(saved);
      setState(prev => ({ ...prev, studentProfile: parsed }));
      setProfileForm(parsed);
    } else {
      setState(prev => ({ ...prev, isProfileModalOpen: true }));
    }
  }, []);

  // Timer logic for Spelling Challenge
  useEffect(() => {
    if (state.isSpellingChallengeActive && state.challengeTimeLeft > 0) {
      timerRef.current = window.setInterval(() => {
        setState(prev => {
          if (prev.challengeTimeLeft <= 1) {
            if (timerRef.current) clearInterval(timerRef.current);
            return { ...prev, challengeTimeLeft: 0 };
          }
          return { ...prev, challengeTimeLeft: prev.challengeTimeLeft - 1 };
        });
      }, 1000);
    } else if (state.challengeTimeLeft === 0) {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [state.isSpellingChallengeActive]);

  const ensureApiKey = async () => {
    if (typeof (window as any).aistudio?.hasSelectedApiKey === 'function') {
      const has = await (window as any).aistudio.hasSelectedApiKey();
      if (!has && typeof (window as any).aistudio?.openSelectKey === 'function') {
        await (window as any).aistudio.openSelectKey();
        setState(prev => ({ ...prev, hasApiKey: true }));
      }
    }
    return true;
  };

  const saveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileForm.name || !profileForm.phoneNumber) return;
    localStorage.setItem('gemikid_student_profile', JSON.stringify(profileForm));
    setState(prev => ({ ...prev, studentProfile: profileForm, isProfileModalOpen: false }));
    setMessages([{
      id: '1',
      role: Role.MODEL,
      text: `🌟 Welcome ${profileForm.name}! 🐯\n\nHi! I am GemiKid, your tuition teacher. (Hi! Main GemiKid hoon, aapka tuition teacher.) 🐘🦁\n\nI am ready to help you with Math, English, and Hindi! Let's have fun!`,
      timestamp: new Date(),
    }]);
  };

  const scrollToBottom = () => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  useEffect(() => scrollToBottom(), [messages, state.isProcessing]);

  const stopAllAudio = () => {
    audioSourcesRef.current.forEach(source => { try { source.stop(); } catch(e) {} });
    audioSourcesRef.current.clear();
    nextStartTimeRef.current = 0;
  };

  const playAudio = async (text: string) => {
    if (!state.isAudioEnabled) return;
    try {
      if (!audioContextRef.current) audioContextRef.current = new AudioContext({ sampleRate: 24000 });
      if (audioContextRef.current.state === 'suspended') await audioContextRef.current.resume();
      
      const buffer = await gemini.speak(text, selectedVoice);
      if (buffer && audioContextRef.current) {
        const source = audioContextRef.current.createBufferSource();
        source.buffer = buffer;
        source.connect(audioContextRef.current.destination);
        source.start();
        audioSourcesRef.current.add(source);
        source.onended = () => audioSourcesRef.current.delete(source);
      }
    } catch (err: any) {
      console.warn("Audio playback failed:", err);
    }
  };

  const handleMediaUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'video') => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const data = reader.result as string;
        if (type === 'image') {
          setSelectedImage(data);
          setSelectedVideo(null);
        } else {
          setSelectedVideo({ 
            data: data.split(',')[1], 
            mimeType: file.type, 
            url: URL.createObjectURL(file) 
          });
          setSelectedImage(null);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => audioChunksRef.current.push(e.data);
      recorder.onstop = async () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64 = (reader.result as string).split(',')[1];
          setState(prev => ({ ...prev, isProcessing: true }));
          try {
            const transcription = await gemini.transcribeAudio(base64);
            setInput(transcription);
          } catch (err) {
            setState(prev => ({ ...prev, error: "Oops! Voice recognition failed." }));
          } finally {
            setState(prev => ({ ...prev, isProcessing: false }));
          }
        };
        reader.readAsDataURL(blob);
      };
      recorder.start();
      setIsRecording(true);
    } catch (err) {
      setState(prev => ({ ...prev, error: "Mic access denied." }));
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  };

  const startSpellingChallenge = async () => {
    setState(prev => ({ ...prev, isProcessing: true, error: null }));
    try {
      const words = await gemini.getSpellingWords(selectedClass || "Class 1");
      setState(prev => ({
        ...prev,
        isSpellingChallengeActive: true,
        challengeWords: words,
        challengeScore: 0,
        challengeTimeLeft: 60,
        challengeCurrentIndex: 0,
        isProcessing: false
      }));
      if (words.length > 0) {
        playAudio(`Spell the word: ${words[0].word}. It means ${words[0].hindi}.`);
      }
    } catch (err) {
      setState(prev => ({ ...prev, isProcessing: false, error: "Failed to load Spelling Challenge." }));
    }
  };

  const handleChallengeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const currentWord = state.challengeWords[state.challengeCurrentIndex];
    const isCorrect = challengeInput.trim().toLowerCase() === currentWord.word.toLowerCase();

    if (isCorrect) {
      setState(prev => ({ ...prev, challengeScore: prev.challengeScore + 1 }));
    }

    const nextIndex = state.challengeCurrentIndex + 1;
    if (nextIndex < state.challengeWords.length) {
      setState(prev => ({ ...prev, challengeCurrentIndex: nextIndex }));
      setChallengeInput('');
      playAudio(`Next word: ${state.challengeWords[nextIndex].word}.`);
    } else {
      // Challenge finished early
      setState(prev => ({ ...prev, challengeTimeLeft: 0 }));
    }
  };

  const handleDirectSubmit = async (textToSubmit: string) => {
    if (state.isProcessing) return;
    await ensureApiKey();
    const userMessage: Message = {
      id: Date.now().toString(),
      role: Role.USER,
      text: textToSubmit,
      timestamp: new Date(),
      imageData: selectedImage || undefined,
      videoUrl: selectedVideo?.url
    };
    setMessages(prev => [...prev, userMessage]);
    const currentImg = selectedImage;
    const currentVid = selectedVideo;
    setSelectedImage(null);
    setSelectedVideo(null);
    setState(prev => ({ ...prev, isProcessing: true, error: null }));

    try {
      const isVideoGen = /show me|make a video|video of|create video/i.test(textToSubmit);
      const isImageGen = /generate image|create picture|draw a|paint a/i.test(textToSubmit);

      if (isVideoGen) {
        setState(prev => ({ ...prev, isGeneratingVideo: true }));
        try {
          const videoUrl = await gemini.generateVideo(textToSubmit);
          setMessages(prev => [...prev, {
            id: Date.now().toString(),
            role: Role.MODEL,
            text: `Shabash! 🌟 Look at this video I made for you! 🎥`,
            timestamp: new Date(),
            videoUrl
          }]);
        } finally { setState(prev => ({ ...prev, isGeneratingVideo: false })); }
      } else if (isImageGen) {
        setState(prev => ({ ...prev, isGeneratingImage: true }));
        try {
          const imageUrl = await gemini.generateImage(textToSubmit, state.imageAspectRatio);
          setMessages(prev => [...prev, {
            id: Date.now().toString(),
            role: Role.MODEL,
            text: `Awesome! 🎨 Look at this colorful picture!`,
            timestamp: new Date(),
            imageUrl
          }]);
        } finally { setState(prev => ({ ...prev, isGeneratingImage: false })); }
      }

      const history = messages.slice(-10).map(m => ({ role: m.role, parts: [{ text: m.text }] }));
      let finalPrompt = textToSubmit;
      if (selectedClass) finalPrompt = `[Class: ${selectedClass}] ${finalPrompt}`;
      
      const modelMsgId = (Date.now() + 1).toString();
      let fullText = "";
      const stream = gemini.getTeacherResponseStream(finalPrompt, history, state.modelMode, state.isThinkingMode, state.isTeacherExplanationMode, currentImg || undefined, currentVid ? { data: currentVid.data, mimeType: currentVid.mimeType } : undefined);

      setMessages(prev => [...prev, { id: modelMsgId, role: Role.MODEL, text: "", timestamp: new Date(), isLite: state.modelMode === 'lite' }]);
      for await (const chunk of stream) {
        fullText += chunk.text;
        setMessages(prev => prev.map(m => m.id === modelMsgId ? { ...m, text: fullText } : m));
      }
      if (fullText) playAudio(fullText);
    } catch (err: any) {
      setState(prev => ({ ...prev, error: "Something went wrong. Let's try again!" }));
    } finally { setState(prev => ({ ...prev, isProcessing: false })); }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if ((!input.trim() && !selectedImage && !selectedVideo) || state.isProcessing) return;
    const txt = input;
    setInput('');
    handleDirectSubmit(txt);
  };

  const toggleLiveMode = async () => {
    if (state.isLiveMode) {
      liveSessionRef.current?.close();
      setState(prev => ({ ...prev, isLiveMode: false }));
      stopAllAudio();
    } else {
      await ensureApiKey();
      setState(prev => ({ ...prev, isProcessing: true }));
      try {
        const session = await gemini.connectLive({
          voiceName: selectedVoice,
          onAudio: (buf) => {
            if (!audioContextRef.current) audioContextRef.current = new AudioContext({ sampleRate: 24000 });
            const ctx = audioContextRef.current;
            nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
            const src = ctx.createBufferSource();
            src.buffer = buf;
            src.connect(ctx.destination);
            src.start(nextStartTimeRef.current);
            nextStartTimeRef.current += buf.duration;
            audioSourcesRef.current.add(src);
          },
          onInterrupted: () => stopAllAudio(),
          onClose: () => setState(prev => ({ ...prev, isLiveMode: false }))
        });
        liveSessionRef.current = session;
        setState(prev => ({ ...prev, isLiveMode: true, isProcessing: false }));
      } catch (err) { setState(prev => ({ ...prev, isProcessing: false, error: "Live session failed." })); }
    }
  };

  return (
    <div className="flex flex-col h-screen max-h-screen bg-amber-50 overflow-hidden relative">
      <Header profile={state.studentProfile} onEditProfile={() => setState(p => ({ ...p, isProfileModalOpen: true }))} />

      {/* Spelling Challenge Overlay */}
      {state.isSpellingChallengeActive && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-amber-500/95 backdrop-blur-md">
          <div className="bg-white rounded-[3rem] p-10 w-full max-w-2xl shadow-2xl border-8 border-amber-300 text-center animate-bounce-in">
            {state.challengeTimeLeft > 0 ? (
              <>
                <div className="flex justify-between items-center mb-8">
                  <div className="bg-emerald-100 px-6 py-2 rounded-2xl border-2 border-emerald-200">
                    <span className="text-emerald-700 font-black text-xl">Score: {state.challengeScore}</span>
                  </div>
                  <div className={`px-6 py-2 rounded-2xl border-2 ${state.challengeTimeLeft < 10 ? 'bg-red-100 border-red-200 animate-pulse' : 'bg-amber-100 border-amber-200'}`}>
                    <span className={`${state.challengeTimeLeft < 10 ? 'text-red-600' : 'text-amber-700'} font-black text-xl`}>Time: {state.challengeTimeLeft}s</span>
                  </div>
                </div>

                <div className="mb-10">
                  <p className="text-amber-800 text-sm font-black uppercase tracking-widest mb-2">Spell this word:</p>
                  <h3 className="text-5xl font-black text-amber-900 mb-2">{state.challengeWords[state.challengeCurrentIndex]?.hindi}</h3>
                  <p className="text-amber-600 font-bold italic">Hint: {state.challengeWords[state.challengeCurrentIndex]?.hint}</p>
                  <button 
                    onClick={() => playAudio(`The word is ${state.challengeWords[state.challengeCurrentIndex].word}`)} 
                    className="mt-4 bg-amber-100 p-4 rounded-full text-amber-600 hover:scale-110 transition-transform"
                  >
                    <i className="fas fa-volume-up text-2xl"></i>
                  </button>
                </div>

                <form onSubmit={handleChallengeSubmit} className="relative">
                  <input 
                    autoFocus
                    type="text" 
                    value={challengeInput}
                    onChange={(e) => setChallengeInput(e.target.value)}
                    placeholder="Type the spelling..."
                    className="w-full bg-amber-50 border-4 border-amber-200 rounded-3xl px-8 py-6 text-3xl font-black text-center text-amber-900 focus:outline-none focus:border-emerald-400 transition-colors uppercase"
                  />
                  <button type="submit" className="absolute right-4 top-1/2 -translate-y-1/2 bg-emerald-500 text-white w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg hover:scale-105 active:scale-90">
                    <i className="fas fa-arrow-right text-xl"></i>
                  </button>
                </form>
              </>
            ) : (
              <div className="py-10">
                <div className="text-7xl mb-6">🏆</div>
                <h2 className="text-4xl font-black text-amber-900 mb-4">Time's Up!</h2>
                <div className="bg-amber-100 p-8 rounded-3xl border-4 border-amber-200 mb-8">
                  <p className="text-amber-700 font-bold text-xl uppercase mb-1">Your Total Score</p>
                  <p className="text-7xl font-black text-emerald-600">{state.challengeScore}</p>
                </div>
                <button 
                  onClick={() => setState(p => ({ ...p, isSpellingChallengeActive: false }))}
                  className="bg-emerald-500 hover:bg-emerald-600 text-white font-black px-10 py-5 rounded-3xl text-xl shadow-xl transition-all active:scale-95"
                >
                  Back to GemiKid 🚀
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {state.isProfileModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-[2rem] p-8 w-full max-w-md shadow-2xl border-4 border-amber-400 animate-slide-up">
            <div className="text-center mb-6">
              <div className="text-6xl mb-4 animate-bounce">🐯</div>
              <h2 className="text-3xl font-bold text-amber-900 mb-2">Welcome!</h2>
              <p className="text-amber-800 text-sm font-bold italic">Tuition Teacher Friend 🌟</p>
            </div>
            <form onSubmit={saveProfile} className="space-y-4">
              <div className="space-y-1">
                <label htmlFor="profileName" className="text-[10px] font-bold text-amber-700 uppercase px-2 tracking-widest">Aapka Naam (Name)</label>
                <input id="profileName" name="name" type="text" required autoComplete="name" value={profileForm.name} placeholder="Type your name..." onChange={e => setProfileForm(p => ({ ...p, name: e.target.value }))} className="w-full bg-amber-50 border-2 border-amber-200 rounded-2xl px-5 py-4 focus:border-amber-400 font-bold outline-none shadow-inner" />
              </div>
              <div className="space-y-1">
                <label htmlFor="profilePhone" className="text-[10px] font-bold text-amber-700 uppercase px-2 tracking-widest">Phone Number</label>
                <input id="profilePhone" name="phoneNumber" type="tel" required autoComplete="tel" value={profileForm.phoneNumber} placeholder="Parent's number..." onChange={e => setProfileForm(p => ({ ...p, phoneNumber: e.target.value }))} className="w-full bg-amber-50 border-2 border-amber-200 rounded-2xl px-5 py-4 focus:border-amber-400 font-bold outline-none shadow-inner" />
              </div>
              <div className="flex justify-center gap-6 text-4xl my-6 bg-amber-100/50 p-4 rounded-2xl"><span>🐘</span><span>🦁</span><span>🦒</span><span>🍎</span></div>
              <button type="submit" className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-4 rounded-2xl shadow-lg transition-all active:scale-95 text-lg">Let's Start Learning! 🚀</button>
            </form>
          </div>
        </div>
      )}

      <div className="bg-amber-100 p-2 flex gap-2 border-b border-amber-200 overflow-x-auto no-scrollbar items-center px-4">
        <div className="flex gap-1 shrink-0">
          <button onClick={() => setState(p => ({ ...p, modelMode: 'lite' }))} className={`px-2 py-1 rounded-full text-[10px] font-bold transition-all ${state.modelMode === 'lite' ? 'bg-emerald-500 text-white' : 'bg-white text-emerald-600 border border-emerald-100'}`}>⚡ Lite</button>
          <button onClick={() => setState(p => ({ ...p, modelMode: 'pro' }))} className={`px-2 py-1 rounded-full text-[10px] font-bold transition-all ${state.modelMode === 'pro' ? 'bg-indigo-500 text-white' : 'bg-white text-indigo-600 border border-indigo-100'}`}>🎓 Pro</button>
        </div>
        <div className="h-6 w-[1px] bg-amber-200 shrink-0 mx-1"></div>
        <div className="flex gap-1 shrink-0">
          {CLASS_LEVELS.map(lvl => (
            <button key={lvl} onClick={() => setSelectedClass(lvl)} className={`px-2 py-1 rounded-full text-[10px] font-bold transition-all border ${selectedClass === lvl ? 'bg-amber-600 text-white border-amber-700 shadow' : 'bg-white text-amber-700 border-amber-200'}`}>{lvl}</button>
          ))}
        </div>
        <div className="h-6 w-[1px] bg-amber-200 shrink-0 mx-1"></div>
        <div className="flex gap-1 shrink-0">
          <button onClick={() => setState(p => ({ ...p, isThinkingMode: !p.isThinkingMode }))} className={`px-3 py-1 rounded-full text-[10px] font-bold transition-all flex items-center gap-1 ${state.isThinkingMode ? 'bg-purple-600 text-white' : 'bg-white text-purple-600 border border-purple-100'}`}><i className="fas fa-brain text-[8px]"></i> Think</button>
          <button onClick={() => setState(p => ({ ...p, isTeacherExplanationMode: !p.isTeacherExplanationMode }))} className={`px-3 py-1 rounded-full text-[10px] font-bold transition-all flex items-center gap-1 ${state.isTeacherExplanationMode ? 'bg-rose-600 text-white' : 'bg-white text-rose-600 border border-rose-100'}`}><i className="fas fa-chalkboard-teacher text-[8px]"></i> Explain</button>
        </div>
      </div>

      <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
        <div className="max-w-4xl mx-auto">
          {messages.map((msg) => <ChatMessage key={msg.id} message={msg} onPlayAudio={msg.role === Role.MODEL ? () => playAudio(msg.text) : undefined} />)}
          {state.isProcessing && messages[messages.length-1].role !== Role.MODEL && (
            <div className="flex justify-start">
              <div className="bg-white p-4 rounded-2xl shadow-sm border-l-4 border-amber-400 flex items-center gap-3 animate-pulse">
                <div className="flex gap-1"><div className="w-2 h-2 bg-amber-400 rounded-full animate-bounce"></div><div className="w-2 h-2 bg-amber-400 rounded-full animate-bounce [animation-delay:-.3s]"></div><div className="w-2 h-2 bg-amber-400 rounded-full animate-bounce [animation-delay:-.5s]"></div></div>
                <span className="text-xs font-bold text-amber-600 italic">{state.isGeneratingVideo ? "GemiKid is drawing your video..." : "GemiKid is thinking... 🌟"}</span>
              </div>
            </div>
          )}
          {state.error && <div className="bg-red-100 border border-red-200 text-red-700 p-4 rounded-xl text-center font-bold text-sm shadow-inner animate-shake">{state.error}</div>}
          <div ref={chatEndRef} />
        </div>
      </main>

      {(selectedImage || selectedVideo) && (
        <div className="p-4 bg-amber-100 flex items-center gap-4 border-t border-amber-200 animate-slide-up">
           {selectedImage && <img src={selectedImage} alt="Preview" className="w-20 h-20 rounded-2xl object-cover border-4 border-white shadow-lg" />}
           {selectedVideo && <video src={selectedVideo.url} className="w-20 h-20 rounded-2xl object-cover border-4 border-white shadow-lg" />}
           <div className="flex-1"><p className="text-xs font-bold text-amber-900 uppercase">File Attached! 📸</p><p className="text-[10px] text-amber-700 font-bold italic">Ask GemiKid something about this!</p></div>
           <button onClick={() => { setSelectedImage(null); setSelectedVideo(null); }} className="text-red-500 p-2 hover:scale-110 transition-transform"><i className="fas fa-times-circle text-2xl"></i></button>
        </div>
      )}

      <footer className="bg-white border-t border-amber-100 shadow-[0_-10px_30px_rgba(251,191,36,0.1)] shrink-0">
        <div className="p-4 max-w-4xl mx-auto flex gap-3 items-end">
          <div className="flex flex-col gap-2">
            <button onClick={toggleLiveMode} className={`w-14 h-14 rounded-full flex items-center justify-center shadow-xl transition-all hover:scale-105 active:scale-95 ${state.isLiveMode ? 'bg-red-500 text-white animate-pulse' : 'bg-amber-100 text-amber-600 border-2 border-amber-200 hover:bg-amber-200'}`} title="Live Talk"><i className={`fas ${state.isLiveMode ? 'fa-stop text-xl' : 'fa-microphone text-2xl'}`}></i></button>
            <div className="flex gap-2">
              <button onClick={() => fileInputRef.current?.click()} className="w-10 h-10 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center shadow-sm border border-indigo-100 hover:bg-indigo-100 transition-colors" title="Add Image"><i className="fas fa-camera text-xs"></i></button>
              <button onClick={() => videoInputRef.current?.click()} className="w-10 h-10 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center shadow-sm border border-rose-100 hover:bg-rose-100 transition-colors" title="Add Video"><i className="fas fa-video text-xs"></i></button>
            </div>
            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={e => handleMediaUpload(e, 'image')} />
            <input type="file" ref={videoInputRef} className="hidden" accept="video/*" onChange={e => handleMediaUpload(e, 'video')} />
          </div>

          <div className="flex-1 flex flex-col gap-2">
            <div className="relative">
              <input id="chatInput" name="chatMessage" type="text" value={input} onChange={e => setInput(e.target.value)} placeholder="Ask GemiKid a question..." className="w-full bg-amber-50 border-2 rounded-[1.5rem] px-6 py-5 focus:outline-none font-bold text-amber-900 border-amber-200 focus:border-amber-400 pr-28 shadow-inner placeholder:text-amber-300 transition-all" disabled={state.isProcessing || state.isLiveMode} onKeyPress={e => e.key === 'Enter' && handleSubmit(e)} />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2">
                <button onClick={isRecording ? stopRecording : startRecording} className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${isRecording ? 'bg-red-500 text-white animate-pulse' : 'bg-amber-200 text-amber-600 hover:bg-amber-300'}`} title="Voice Input"><i className={`fas ${isRecording ? 'fa-microphone' : 'fa-keyboard-alt'}`}></i></button>
                <button onClick={() => setState(p => ({ ...p, isAudioEnabled: !p.isAudioEnabled }))} className={`w-10 h-10 rounded-full flex items-center justify-center transition-all shadow-sm ${state.isAudioEnabled ? 'bg-amber-400 text-white shadow-amber-200' : 'bg-gray-200 text-gray-400'}`} title="Toggle Sound"><i className={`fas ${state.isAudioEnabled ? 'fa-volume-up' : 'fa-volume-mute'}`}></i></button>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap items-center">
              <button type="button" onClick={startSpellingChallenge} className="text-[10px] font-bold bg-amber-500 text-white px-4 py-2 rounded-full border border-amber-600 hover:bg-amber-600 transition-all shadow-md animate-pulse">🔥 Spelling Race</button>
              <button type="button" onClick={() => handleDirectSubmit("Tell me a multi-voice character story with a moral. (Ask me story)")} className="text-[10px] font-bold bg-amber-50 text-amber-700 px-4 py-2 rounded-full border border-amber-100 hover:bg-amber-100 transition-all shadow-sm">📖 Ask me story</button>
              <button type="button" onClick={() => handleDirectSubmit("Let's solve a fun Math puzzle together!")} className="text-[10px] font-bold bg-blue-50 text-blue-700 px-4 py-2 rounded-full border border-blue-100 hover:bg-blue-100 transition-all shadow-sm">🔢 Math Game</button>
            </div>
          </div>
          <button onClick={handleSubmit} disabled={state.isProcessing || (!input.trim() && !selectedImage && !selectedVideo) || state.isLiveMode} className="text-white w-16 h-16 rounded-[1.5rem] flex items-center justify-center shadow-lg bg-emerald-500 hover:bg-emerald-600 disabled:bg-gray-300 shrink-0 transition-all hover:scale-105 active:scale-90 shadow-emerald-200"><i className="fas fa-paper-plane text-2xl"></i></button>
        </div>
        <div className="bg-amber-100/30 py-1 border-t border-amber-200 text-center"><p className="text-[9px] font-bold text-amber-400 uppercase tracking-widest opacity-80">GemiKid • Your AI Tuition Friend</p></div>
      </footer>
    </div>
  );
};

export default App;