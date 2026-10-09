'use client';

import React, { useEffect } from 'react';
import { RefreshCw, AlertTriangle } from 'lucide-react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[OfficeFlow Global Error]:', error?.message || 'Unknown root layout exception');
  }, [error]);

  return (
    <html lang="en">
      <body className="min-h-screen bg-[#F8FAFC] text-slate-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full p-6 sm:p-8 bg-white rounded-2xl border border-slate-200/80 shadow-lg text-center space-y-4 font-sans">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto shadow-sm">
            <AlertTriangle className="w-7 h-7" />
          </div>
          
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900">
              OfficeFlow Workspace Refresh
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-1 leading-relaxed">
              An unexpected client error occurred. Please click below to reload the workspace.
            </p>
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={() => {
                if (typeof window !== 'undefined') {
                  try {
                    localStorage.removeItem('officeflow_active_user_id');
                  } catch {}
                  window.location.href = '/login';
                } else {
                  reset();
                }
              }}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 text-white font-semibold text-xs shadow-sm hover:bg-blue-700 active:scale-[0.98] transition-all"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Reload Workspace</span>
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
