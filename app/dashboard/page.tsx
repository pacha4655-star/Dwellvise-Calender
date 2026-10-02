'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/auth-context';
import { Loader2 } from 'lucide-react';

export default function DashboardRedirectPage() {
  const router = useRouter();
  const { user, isAdmin, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading) {
      if (!user) {
        router.replace('/login');
      } else if (isAdmin) {
        router.replace('/admin');
      } else {
        router.replace('/calendar');
      }
    }
  }, [user, isAdmin, isLoading, router]);

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
      <div className="flex items-center gap-3 text-blue-600 font-semibold text-sm">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span>Redirecting to workspace...</span>
      </div>
    </div>
  );
}
