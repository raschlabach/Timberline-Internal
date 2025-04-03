'use client';

import { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { LoadBoardOrders } from '@/components/orders/load-board-orders';

export default function LoadBoardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  // Redirect to login if not authenticated
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login?callbackUrl=/dashboard/load-board');
    }
  }, [status, router]);

  // Show loading state while checking authentication
  if (status === 'loading') {
    return (
      <div className="py-4 px-2">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        </div>
      </div>
    );
  }

  // Show content only if authenticated
  if (status === 'authenticated') {
    return (
      <div className="py-4 px-2">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">Load Board</h1>
        </div>
        
        <Card className="p-2">
          <LoadBoardOrders />
        </Card>
      </div>
    );
  }

  // This should never be reached due to the redirect in useEffect
  return null;
} 