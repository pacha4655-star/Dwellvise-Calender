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
        setErrorMsg(result.message);
        toastError(result.message, 'Authentication Failed');
      }
    } catch {
      setErrorMsg('An unexpected error occurred during sign in.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectAccount = (userEmail: string) => {
    setEmail(userEmail);
    setPassword('');
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        {/* Logo */}
        <div className="mx-auto w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/25 mb-4">
          <Calendar className="w-6 h-6" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
          OfficeFlow
        </h1>
        <p className="mt-1 text-sm text-slate-500 font-medium">
          Leave & Government Holiday Calendar
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="bg-white py-8 px-6 sm:px-10 rounded-2xl border border-slate-200/80 shadow-elevation">
          {errorMsg && (
            <div className="mb-5 flex items-start gap-2.5 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs">
              <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSignIn} className="space-y-4">
            <Input
              label="Work Email Address"
              type="email"
              placeholder="name@dwellvise.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              leftIcon={<Mail className="w-4 h-4" />}
            />

            <Input
              label="Password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              leftIcon={<Lock className="w-4 h-4" />}
            />

            <div className="flex items-center justify-between text-xs pt-1">
              <label className="flex items-center gap-2 text-slate-600 cursor-pointer">
                <input
                  type="checkbox"
                  defaultChecked
                  className="rounded text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                />
                <span>Remember on this device</span>
              </label>

              <button
                type="button"
                onClick={() => setIsForgotModalOpen(true)}
                className="font-semibold text-blue-600 hover:text-blue-700"
              >
                Forgot password?
              </button>
            </div>

            <div className="pt-2">
              <Button
                type="submit"
                variant="primary"
                size="lg"
                isLoading={isLoading}
                className="w-full"
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                Sign In to Workspace
              </Button>
            </div>
          </form>

          {/* Quick Member Selector */}
          <div className="mt-8 pt-6 border-t border-slate-100">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Company Members
              </span>
              <span className="text-[10px] text-blue-600 font-semibold bg-blue-50 px-2 py-0.5 rounded">
                Dwellvise Team
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleSelectAccount('pachamuthu@dwellvise.com')}
                className={`p-2.5 rounded-xl border text-left transition-all group ${
                  email === 'pachamuthu@dwellvise.com'
                    ? 'border-blue-500 bg-blue-50/50'
                    : 'border-slate-200 hover:border-blue-300 hover:bg-slate-50'
                }`}
              >
                <p className="text-xs font-bold text-slate-900 group-hover:text-blue-700 truncate">Pachamuthu</p>
                <span className="text-[9px] font-semibold text-slate-500 bg-slate-100 px-1 py-0.2 rounded mt-1 inline-block">Staff</span>
              </button>

              <button
                type="button"
                onClick={() => handleSelectAccount('aswin@dwellvise.com')}
                className={`p-2.5 rounded-xl border text-left transition-all group ${
                  email === 'aswin@dwellvise.com'
                    ? 'border-blue-500 bg-blue-50/50'
                    : 'border-slate-200 hover:border-blue-300 hover:bg-slate-50'
                }`}
              >
                <p className="text-xs font-bold text-slate-900 group-hover:text-blue-700 truncate">Aswin</p>
                <span className="text-[9px] font-semibold text-slate-500 bg-slate-100 px-1 py-0.2 rounded mt-1 inline-block">Staff</span>
              </button>

              <button
                type="button"
                onClick={() => handleSelectAccount('dinesh@dwellvise.com')}
                className={`p-2.5 rounded-xl border text-left transition-all group ${
                  email === 'dinesh@dwellvise.com'
                    ? 'border-blue-500 bg-blue-50/50'
                    : 'border-blue-200 bg-blue-50/30 hover:border-blue-400'
                }`}
              >
                <p className="text-xs font-bold text-blue-900 group-hover:text-blue-700 truncate">Dinesh</p>
                <span className="text-[9px] font-bold text-blue-700 bg-blue-100 px-1 py-0.2 rounded mt-1 inline-block">Admin</span>
              </button>
            </div>
          </div>
        </div>

        {/* Security badge footer */}
        <div className="mt-6 text-center text-xs text-slate-400 flex items-center justify-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>Protected with Row Level Security & Encrypted Auth</span>
        </div>
      </div>

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
