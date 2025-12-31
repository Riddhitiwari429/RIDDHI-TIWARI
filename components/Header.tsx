
import React from 'react';
import { StudentProfile } from '../types';

interface HeaderProps {
  profile: StudentProfile | null;
  onEditProfile: () => void;
}

const Header: React.FC<HeaderProps> = ({ profile, onEditProfile }) => {
  return (
    <header className="bg-amber-400 p-4 shadow-lg flex items-center justify-between sticky top-0 z-50 border-b-4 border-amber-500/20">
      <div className="flex items-center gap-3">
        <div className="bg-white p-2 rounded-2xl shadow-inner border-2 border-amber-200 animate-pulse">
          <span className="text-3xl">🐯</span>
        </div>
        <div>
          <h1 className="text-2xl font-black text-amber-900 leading-none tracking-tight">GemiKid</h1>
          <p className="text-[10px] font-extrabold text-amber-800 uppercase tracking-widest bg-white/30 px-2 py-0.5 rounded-full mt-1">Tuition Teacher Friend</p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        {profile ? (
          <button 
            onClick={onEditProfile}
            className="flex items-center gap-2 bg-white/40 hover:bg-white/60 p-1 pr-3 rounded-2xl transition-all group border border-white/50 shadow-sm"
          >
            <div className="w-8 h-8 bg-amber-600 rounded-xl flex items-center justify-center text-sm text-white font-black shadow-inner">
              {profile.name[0].toUpperCase()}
            </div>
            <div className="hidden sm:block text-left">
              <p className="text-[9px] font-black text-amber-900 uppercase leading-none opacity-60">Champ</p>
              <p className="text-sm font-black text-amber-900 leading-none">{profile.name}</p>
            </div>
            <i className="fas fa-chevron-down text-amber-800 text-[10px] group-hover:translate-y-0.5 transition-transform ml-1"></i>
          </button>
        ) : (
          <div className="bg-amber-500/30 px-4 py-1.5 rounded-full text-xs font-black text-amber-900 border border-amber-500/20 shadow-inner">
            🌟 English-Hindi Fun
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
