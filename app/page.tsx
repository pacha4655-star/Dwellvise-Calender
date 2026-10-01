'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/auth-context';
import { Loader2, AlertCircle, RefreshCw, LogIn } from 'lucide-react';
import Link from 'next/link';

export default function HomePage() {
  const router = useRouter();
  const { user, isLoading, authError, retryAuth } = useAuth();
  const [hasTimedOut, setHasTimedOut] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setHasTimedOut(true);
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!isLoading) {
      if (user) {
        router.replace('/calendar');
      } else {
        router.replace('/login');
      }
    }
  }, [user, isLoading, router]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#F8FAFC] p-4 text-center">
      {!hasTimedOut && !authError ? (
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/25">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
          <p className="text-sm font-semibold text-slate-800">
            Initializing OfficeFlow Workspace...
          </p>
          <p className="text-xs text-slate-500">
            Verifying secure session and calendar state
          </p>
        </div>
      ) : (
        <div className="max-w-md w-full p-6 bg-white rounded-2xl border border-slate-200/80 shadow-elevation text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-base font-bold text-slate-900">
            Welcome to OfficeFlow
          </h2>
          <p className="text-xs text-slate-500">
            {authError || 'Taking a moment to redirect. You can continue directly to login or retry.'}
          </p>
          <div className="flex flex-col sm:flex-row gap-2 pt-2 justify-center">
            <Link
              href="/login"
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 text-white font-semibold text-xs shadow-sm hover:bg-blue-700 transition-all"
            >
              <LogIn className="w-4 h-4" />
              <span>Go to Login</span>
            </Link>
            <button
              type="button"
              onClick={() => {
                setHasTimedOut(false);
                retryAuth();
              }}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-semibold text-xs hover:bg-slate-50 transition-all"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry Connection</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
