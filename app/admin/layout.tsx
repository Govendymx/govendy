import type { ReactNode } from 'react';
import { AdminTopMenu } from '@/components/admin/AdminTopMenu';
import { PresenceBeacon } from '@/components/PresenceBeacon';
import { AdminProvider } from '@/lib/admin/AdminContext';
import { AdminAlertsBar } from '@/components/admin/AdminAlertsBar';
import { AdminQuickActions } from '@/components/admin/AdminQuickActions';
import AdminChatAssistant from '@/components/admin/AdminChatAssistant';

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <AdminProvider>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50/30 to-pink-50/30">
        <AdminTopMenu />
        <PresenceBeacon role="admin" />
        <AdminAlertsBar />
        <div className="mx-auto max-w-7xl px-4 py-6">{children}</div>
        <AdminQuickActions />
        <AdminChatAssistant />
      </div>
    </AdminProvider>
  );
}

