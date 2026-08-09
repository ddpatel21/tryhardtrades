'use client';

import React, { useState, useEffect } from 'react';
import { Target, Lock, Eye, EyeOff } from 'lucide-react';

export default function PasswordLock({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    const auth = sessionStorage.getItem('tryhard_auth');
    if (auth === 'true') {
      setIsAuthenticated(true);
    }
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
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
              <div className="relative flex items-center">
                <span className="absolute left-3 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </span>
                <input 
                  type={showPassword ? 'text' : 'password'}
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="Enter journal password..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-10 py-3 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#ec3044]"
                  autoFocus
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 text-slate-400 hover:text-slate-600 transition cursor-pointer"
                  title={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
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