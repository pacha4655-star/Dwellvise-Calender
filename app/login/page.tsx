'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Calendar, Lock, Mail, ArrowRight, ShieldCheck, AlertCircle } from 'lucide-react';
import { useAuth } from '@/lib/auth/auth-context';
import { useToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const { success, error: toastError } = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);

  // Guarantee fields start completely empty on every mount/refresh
  React.useEffect(() => {
    setEmail('');
    setPassword('');
  }, []);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!email.trim() || !password) {
      setErrorMsg('Please enter both your work email address and password.');
      return;
    }

    setIsLoading(true);

    try {
      const result = await login(email, password);
      if (result.success) {
        success(result.message, 'Signed In');
        router.push('/calendar');
      } else {
        setErrorMsg(result.message || 'Invalid login credentials');
        toastError(result.message || 'Invalid login credentials', 'Authentication Failed');
        setPassword('');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'An error occurred while connecting to authentication service.';
      setErrorMsg(msg);
      toastError(msg, 'Sign In Error');
      setPassword('');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectAccount = (userEmail: string) => {
    setEmail(userEmail);
    setPassword('');
  };

  return (
    <div className="min-h-dvh w-full bg-[#F8FAFC] flex flex-col justify-between p-3 sm:p-4 md:p-6 box-border">
      {/* Center Main Section */}
      <main className="flex-1 w-full flex flex-col items-center justify-center py-2 sm:py-3 min-h-0">
        <div className="w-full max-w-md mx-auto">
          {/* Logo & Branding Header */}
          <div className="w-full text-center mb-3 sm:mb-4 flex-shrink-0">
            <div className="mx-auto w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20 mb-2 sm:mb-2.5">
              <Calendar className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight text-slate-900 leading-tight">
              OfficeFlow
            </h1>
            <p className="mt-0.5 text-xs sm:text-sm text-slate-500 font-medium px-2">
              Leave & Government Holiday Calendar
            </p>
          </div>

          {/* Login Card */}
          <div className="w-full bg-white py-5 sm:py-6 px-4 sm:px-6 md:px-8 rounded-2xl border border-slate-200/80 shadow-elevation box-border">
            {errorMsg && (
              <div className="mb-3 sm:mb-4 flex items-start gap-2.5 p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs break-words">
                <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                <span className="leading-relaxed flex-1">{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleSignIn} className="space-y-3 sm:space-y-3.5" autoComplete="off">
              <Input
                label="Work Email Address"
                type="email"
                name="officeflow_login_email"
                id="officeflow-work-email"
                autoComplete="off"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                placeholder="name@dwellvise.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                leftIcon={<Mail className="w-4 h-4" />}
              />

              <Input
                label="Password"
                type="password"
                name="officeflow_login_password"
                id="officeflow-work-password"
                autoComplete="new-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                leftIcon={<Lock className="w-4 h-4" />}
              />

              <div className="flex flex-wrap items-center justify-between gap-2 text-xs pt-0.5">
                <label className="flex items-center gap-1.5 sm:gap-2 text-slate-600 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    className="rounded text-blue-600 focus:ring-blue-500 w-3.5 h-3.5 flex-shrink-0"
                  />
                  <span className="text-[11px] sm:text-xs">Remember device</span>
                </label>

                <button
                  type="button"
                  onClick={() => setIsForgotModalOpen(true)}
                  className="font-semibold text-blue-600 hover:text-blue-700 text-[11px] sm:text-xs whitespace-nowrap"
                >
                  Forgot password?
                </button>
              </div>

              <div className="pt-1">
                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  isLoading={isLoading}
                  className="w-full"
                  rightIcon={<ArrowRight className="w-4 h-4 flex-shrink-0" />}
                >
                  Sign In to Workspace
                </Button>
              </div>
            </form>

            {/* Quick Member Selector */}
            <div className="mt-4 pt-3.5 sm:mt-5 sm:pt-4 border-t border-slate-100">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Company Members
                </span>
                <span className="text-[9px] sm:text-[10px] text-blue-600 font-semibold bg-blue-50 px-2 py-0.5 rounded">
                  Dwellvise Team
                </span>
              </div>

              <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                <button
                  type="button"
                  onClick={() => handleSelectAccount('pachamuthu@dwellvise.com')}
                  className={`p-1.5 sm:p-2.5 rounded-xl border text-left transition-all group min-w-0 w-full ${
                    email === 'pachamuthu@dwellvise.com'
                      ? 'border-blue-500 bg-blue-50/50'
                      : 'border-slate-200 hover:border-blue-300 hover:bg-slate-50'
                  }`}
                >
                  <p className="text-[11px] sm:text-xs font-bold text-slate-900 group-hover:text-blue-700 truncate">Pachamuthu</p>
                  <span className="text-[8px] sm:text-[9px] font-semibold text-slate-500 bg-slate-100 px-1 py-0.2 rounded mt-0.5 inline-block">Staff</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSelectAccount('aswin@dwellvise.com')}
                  className={`p-1.5 sm:p-2.5 rounded-xl border text-left transition-all group min-w-0 w-full ${
                    email === 'aswin@dwellvise.com'
                      ? 'border-blue-500 bg-blue-50/50'
                      : 'border-slate-200 hover:border-blue-300 hover:bg-slate-50'
                  }`}
                >
                  <p className="text-[11px] sm:text-xs font-bold text-slate-900 group-hover:text-blue-700 truncate">Aswin</p>
                  <span className="text-[8px] sm:text-[9px] font-semibold text-slate-500 bg-slate-100 px-1 py-0.2 rounded mt-0.5 inline-block">Staff</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSelectAccount('dinesh@dwellvise.com')}
                  className={`p-1.5 sm:p-2.5 rounded-xl border text-left transition-all group min-w-0 w-full ${
                    email === 'dinesh@dwellvise.com'
                      ? 'border-blue-500 bg-blue-50/50'
                      : 'border-blue-200 bg-blue-50/30 hover:border-blue-400'
                  }`}
                >
                  <p className="text-[11px] sm:text-xs font-bold text-blue-900 group-hover:text-blue-700 truncate">Dinesh</p>
                  <span className="text-[8px] sm:text-[9px] font-bold text-blue-700 bg-blue-100 px-1 py-0.2 rounded mt-0.5 inline-block">Admin</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Security badge footer */}
      <footer className="w-full max-w-md mx-auto py-2 sm:py-2.5 text-center text-xs text-slate-400 flex items-center justify-center gap-1.5 flex-shrink-0 px-2 box-border">
        <ShieldCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-600 flex-shrink-0" />
        <span className="text-[11px] sm:text-xs">Protected with Row Level Security & Encrypted Auth</span>
      </footer>

      {/* Forgot Password Modal */}
      <Modal
        isOpen={isForgotModalOpen}
        onClose={() => setIsForgotModalOpen(false)}
        title="Password Reset"
        subtitle="Recover your OfficeFlow workspace credentials"
        maxWidth="sm"
      >
        <div className="space-y-3 text-xs text-slate-600">
          <p>
            For security reasons, password resets are handled via your company IT administrator (<strong>Dinesh</strong>).
          </p>
          <div className="p-3 bg-slate-50 rounded-xl border text-[11px] space-y-1">
            <p><strong>Admin Contact:</strong> dinesh@dwellvise.com</p>
            <p><strong>Emergency Line:</strong> +91 98400 11223</p>
          </div>
          <div className="pt-2 flex justify-end">
            <Button variant="primary" size="sm" onClick={() => setIsForgotModalOpen(false)}>
              Understood
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
