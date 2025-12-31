
import React from 'react';
import { Message, Role } from '../types';

interface ChatMessageProps {
  message: Message;
  onPlayAudio?: () => void;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ message, onPlayAudio }) => {
  const isModel = message.role === Role.MODEL;

  return (
    <div className={`flex w-full mb-4 ${isModel ? 'justify-start' : 'justify-end'}`}>
      <div className={`flex max-w-[90%] md:max-w-[80%] ${isModel ? 'flex-row' : 'flex-row-reverse'} items-end gap-3`}>
        <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xl shadow-md flex-shrink-0 ${isModel ? 'bg-amber-300' : 'bg-indigo-300'}`}>
          {isModel ? '👨‍🏫' : '👶'}
        </div>
        <div className="flex flex-col gap-1">
          <div
            className={`p-4 shadow-sm border ${
              isModel
                ? 'bg-white text-gray-800 chat-bubble-left border-amber-200 border-l-4 border-l-amber-400'
                : 'bg-indigo-600 text-white chat-bubble-right border-indigo-700'
            }`}
          >
            {message.imageData && !message.imageUrl && (
              <img 
                src={message.imageData} 
                alt="Analyzed" 
                className="w-full h-48 object-cover rounded-xl mb-3 border-2 border-amber-100" 
              />
            )}

            {message.imageUrl && (
              <img 
                src={message.imageUrl} 
                alt="Generated Visual Aid" 
                className="w-full rounded-xl mb-3 border-2 border-indigo-100 shadow-lg" 
              />
            )}

            {message.videoUrl && (
              <video 
                src={message.videoUrl} 
                controls 
                className="w-full rounded-xl mb-3 bg-black shadow-lg"
              />
            )}

            <div className="whitespace-pre-wrap bilingual-text font-medium leading-relaxed">
              {message.text}
            </div>
            
            {message.sources && message.sources.length > 0 && (
              <div className="mt-4 pt-3 border-t border-amber-100 flex flex-wrap gap-2">
                <span className="text-[10px] font-bold text-amber-500 uppercase block w-full">Verified Sources:</span>
                {message.sources.map((source, i) => (
                  <a 
                    key={i} 
                    href={source.uri} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="bg-amber-50 hover:bg-amber-100 text-amber-700 text-[11px] px-2 py-1 rounded border border-amber-200 flex items-center gap-1 transition-colors"
                  >
                    <i className="fas fa-link"></i> {source.title}
                  </a>
                ))}
              </div>
            )}

            {isModel && onPlayAudio && (
              <div className="mt-3 flex flex-wrap gap-3">
                <button 
                  onClick={onPlayAudio}
                  className="text-amber-600 hover:text-amber-800 flex items-center gap-2 text-sm font-bold transition-all hover:scale-105"
                  aria-label="Listen to Teacher"
                >
                  <div className="bg-amber-100 w-7 h-7 rounded-full flex items-center justify-center">
                    <i className="fas fa-volume-up"></i>
                  </div>
                  Listen to Teacher
                </button>
                <button 
                  onClick={onPlayAudio}
                  className="text-indigo-600 hover:text-indigo-800 flex items-center gap-2 text-sm font-bold transition-all hover:scale-105"
                  aria-label="Read Aloud"
                >
                  <div className="bg-indigo-100 w-7 h-7 rounded-full flex items-center justify-center">
                    <i className="fas fa-bullhorn"></i>
                  </div>
                  Read Aloud
                </button>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 px-2">
            <span className="text-[10px] text-gray-400">
              {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
            {message.isLite && (
              <span className="text-[10px] font-bold text-emerald-500 uppercase">⚡ Fast Mode</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatMessage;
