'use client';

import React, { useState, useEffect } from 'react';
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
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Listen to sidebar collapse state changes from Sidebar component
  useEffect(() => {
    const handleCollapseChange = (e: any) => {
      setIsCollapsed(e.detail);
    };
    window.addEventListener('sidebar-collapse-changed', handleCollapseChange);
    return () => window.removeEventListener('sidebar-collapse-changed', handleCollapseChange);
  }, []);

  return (
    <html lang="en">
      <body className="bg-[#F8F9FD] antialiased text-slate-800">
        <PasswordLock>
          <div className="flex min-h-screen">
            {/* Sidebar */}
            <Sidebar onOpenAddTrade={() => setIsAddTradeOpen(true)} />
            
            {/* Main Content Area with dynamic left padding matching sidebar width */}
            <main className={`flex-1 bg-[#F8F9FD] min-h-screen pt-16 lg:pt-0 transition-all duration-300 ${
              isCollapsed ? 'lg:pl-20' : 'lg:pl-64'
            }`}>
              {children}
            </main>
          </div>

          {/* Global Add Trade Modal */}
          <AddTradeModal 
            isOpen={isAddTradeOpen} 
            onClose={() => setIsAddTradeOpen(false)} 
          />
        </PasswordLock>
      </body>
    </html>
  );
}