'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Check, ChevronDown } from 'lucide-react';

export const COLOR_PALETTE = [
  '#FFFFFF', '#E2E8F0', '#CBD5E1', '#94A3B8', '#64748B', '#475569', '#334155', '#1E293B', '#0F172A', '#000000',
  '#EF4444', '#F97316', '#FACC15', '#10B981', '#14B8A6', '#06B6D4', '#3B82F6', '#6366F1', '#8B5CF6', '#EC4899',
];

interface Props {
  selectedColor: string;
  onChange: (color: string) => void;
}

export default function ColorGridPicker({ selectedColor, onChange }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close popover when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative inline-block" ref={containerRef}>
      
      {/* Compact Preview Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 bg-white border border-slate-200 hover:border-purple-300 rounded-xl px-3 py-1.5 shadow-sm transition cursor-pointer"
      >
        <span 
          className="w-5 h-5 rounded-md border border-black/10 inline-block" 
          style={{ backgroundColor: selectedColor || '#8B5CF6' }} 
        />
        <span className="text-xs font-mono font-bold text-slate-700">
          {selectedColor || '#8B5CF6'}
        </span>
        <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
      </button>

      {/* Popover Grid Overlay */}
      {isOpen && (
        <div className="absolute left-0 top-full mt-2 z-50 bg-slate-900 p-3 rounded-2xl border border-slate-800 shadow-2xl animate-in fade-in zoom-in-95 duration-100">
          <div className="grid grid-cols-10 gap-2">
            {COLOR_PALETTE.map((hex) => {
              const isSelected = selectedColor.toLowerCase() === hex.toLowerCase();
              const isWhite = hex === '#FFFFFF';

              return (
                <button
                  key={hex}
                  type="button"
                  onClick={() => {
                    onChange(hex);
                    setIsOpen(false);
                  }}
                  className={`w-7 h-7 rounded-lg transition-transform hover:scale-110 flex items-center justify-center cursor-pointer border ${
                    isWhite ? 'border-slate-300' : 'border-black/20'
                  } ${isSelected ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-900 scale-105' : ''}`}
                  style={{ backgroundColor: hex }}
                >
                  {isSelected && (
                    <Check className={`w-3.5 h-3.5 ${isWhite ? 'text-slate-900' : 'text-white'}`} />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

    </div>
  );
}