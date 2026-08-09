'use client';

import React, { useState } from 'react';
import Sidebar from '@/components/Sidebar';
import AddTradeModal from '@/components/AddTradeModal';
import PasswordLock from '@/components/PasswordLock';
import './globals.css';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isAddTradeOpen, setIsAddTradeOpen] = useState(false);

  return (
    <html lang="en">
      <body className="bg-[#F8F9FD] antialiased text-slate-800">
        <PasswordLock>
          <div className="flex min-h-screen">
            {/* Sidebar with connected onOpenAddTrade click handler */}
            <Sidebar onOpenAddTrade={() => setIsAddTradeOpen(true)} />
            
            <main className="flex-1 bg-[#F8F9FD] min-h-screen">
              {children}
            </main>
          </div>

          {/* Global Add Trade Modal reachable from Sidebar on any page */}
          <AddTradeModal 
            isOpen={isAddTradeOpen} 
            onClose={() => setIsAddTradeOpen(false)} 
          />
        </PasswordLock>
      </body>
    </html>
  );
}