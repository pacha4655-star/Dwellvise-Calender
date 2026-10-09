'use client';

import React, { useEffect } from 'react';
import { RefreshCw, AlertTriangle, Home, LogIn } from 'lucide-react';
import Link from 'next/link';

export default function GlobalErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log non-sensitive diagnostic info safely
    console.error('[OfficeFlow Client Error Boundary]:', error?.message || 'Unknown runtime exception');
  }, [error]);

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-4">
      <div className="max-w-md w-full p-6 sm:p-8 bg-white rounded-2xl border border-slate-200/80 shadow-elevation text-center space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto shadow-sm">
          <AlertTriangle className="w-7 h-7" />
        </div>
        
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-slate-900">
            Workspace Refresh Needed
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 leading-relaxed">
            OfficeFlow encountered a temporary client-side state issue. You can reload the workspace or return to login.
          </p>
        </div>

        {error?.message && (
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/70 text-left">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              Diagnostic Reference
            </p>
            <p className="text-xs font-mono text-slate-700 break-words line-clamp-2">
              {error.message}
            </p>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-2 pt-2 justify-center">
          <button
            type="button"
            onClick={() => reset()}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 text-white font-semibold text-xs shadow-sm hover:bg-blue-700 active:scale-[0.98] transition-all"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Try Again</span>
          </button>
          
          <Link
            href="/calendar"
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-semibold text-xs hover:bg-slate-50 transition-all"
          >
            <Home className="w-3.5 h-3.5" />
            <span>Go to Calendar</span>
          </Link>

          <Link
            href="/login"
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-semibold text-xs hover:bg-slate-50 transition-all"
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>Login</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
