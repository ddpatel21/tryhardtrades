'use client';

import React, { useState, useEffect } from 'react';
import { Target, Lock } from 'lucide-react';

export default function PasswordLock({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [error, setError] = useState(false);

  // Check if already authenticated in the current session
  useEffect(() => {
    const auth = sessionStorage.getItem('tryhard_auth');
    if (auth === 'true') {
      setIsAuthenticated(true);
    }
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    // Set your custom password here
    const correctPassword = '0616'; 

    if (passwordInput === correctPassword) {
      sessionStorage.setItem('tryhard_auth', 'true');
      setIsAuthenticated(true);
      setError(false);
    } else {
      setError(true);
      setPasswordInput('');
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#F8F9FD] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white border border-slate-200/80 rounded-3xl p-8 shadow-xl space-y-6 text-center">
          <div className="w-12 h-12 bg-[#ec3044] rounded-2xl mx-auto flex items-center justify-center text-white shadow-md shadow-[#ec3044]/30">
            <Target className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight">TryhardTrades Journal</h1>
            <p className="text-xs text-slate-400 mt-1">Protected Workspace • Enter Password to Access</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </span>
                <input 
                  type="password"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="Enter journal password..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-3 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#ec3044]"
                  autoFocus
                  required
                />
              </div>
              {error && (
                <p className="text-[11px] font-bold text-rose-500 mt-2 text-left">Incorrect password. Try again.</p>
              )}
            </div>

            <button 
              type="submit"
              className="w-full py-3 bg-[#ec3044] hover:bg-[#d4283b] text-white font-bold rounded-xl text-xs shadow-md transition cursor-pointer"
            >
              Unlock Journal
            </button>
          </form>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}