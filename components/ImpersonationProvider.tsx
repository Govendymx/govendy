'use client';

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase/client';

export interface SellerBalance {
    disponible: number;
    por_liberar: number;
    estimado: number;
    total_withdrawn: number;
    total_commissions: number;
    orders_disponible: number;
}

export interface ImpersonatedUserData {
    targetUserId: string;
    user: {
        email: string | null;
        phone: string | null;
        created_at: string | null;
        last_sign_in_at: string | null;
    };
    profile: {
        id: string;
        full_name?: string;
        nickname?: string;
        avatar_url?: string;
        role?: string;
        [key: string]: any;
    } | null;
    wallet: {
        balance: number;
        [key: string]: any;
    } | null;
    orders: any[];
    seller_orders: any[];
    wallet_transactions: any[];
    seller_balance: SellerBalance | null;
    disputes_buyer: any[];
    disputes_seller: any[];
    withdrawals: any[];
    listings: any[];
    reviews: any[];
}

interface ImpersonationContextType {
    isImpersonating: boolean;
    isLoading: boolean;
    targetUserId: string | null;
    targetData: ImpersonatedUserData | null;
    error: string | null;
    refresh: () => Promise<void>;
    queryAsUser: (opts: {
        table: string;
        select?: string;
        filters?: Record<string, any>;
        order?: string | { column: string; ascending?: boolean };
        limit?: number;
        single?: boolean;
    }) => Promise<{ data: any; error?: string }>;
}

const ImpersonationContext = createContext<ImpersonationContextType>({
    isImpersonating: false,
    isLoading: true,
    targetUserId: null,
    targetData: null,
    error: null,
    refresh: async () => { },
    queryAsUser: async () => ({ data: null }),
});

export function useImpersonation() {
    return useContext(ImpersonationContext);
}

export function ImpersonationProvider({ children }: { children: ReactNode }) {
    const [isImpersonating, setIsImpersonating] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [targetUserId, setTargetUserId] = useState<string | null>(null);
    const [targetData, setTargetData] = useState<ImpersonatedUserData | null>(null);
    const [error, setError] = useState<string | null>(null);

    const getToken = async () => {
        const { data } = await supabase.auth.getSession();
        return data.session?.access_token;
    };

    const loadStatus = useCallback(async () => {
        try {
            const token = await getToken();
            if (!token) {
                setIsImpersonating(false);
                setIsLoading(false);
                return;
            }

            const res = await fetch('/api/admin/impersonation/status', {
                headers: { authorization: `Bearer ${token}` },
                cache: 'no-store',
            });

            if (!res.ok) {
                setIsImpersonating(false);
                setIsLoading(false);
                return;
            }

            const json = await res.json();

            if (json.impersonating && json.targetUserId) {
                setIsImpersonating(true);
                setTargetUserId(json.targetUserId);

                // Load full user data
                const dataRes = await fetch('/api/admin/impersonate-query', {
                    headers: { authorization: `Bearer ${token}` },
                    cache: 'no-store',
                });

                if (dataRes.ok) {
                    const userData = await dataRes.json();
                    if (userData.ok) {
                        setTargetData(userData);
                    }
                }
            } else {
                setIsImpersonating(false);
                setTargetUserId(null);
                setTargetData(null);
            }
        } catch (e: any) {
            setError(e.message);
            setIsImpersonating(false);
        } finally {
            setIsLoading(false);
        }
    }, []);

    const queryAsUser = useCallback(async (opts: {
        table: string;
        select?: string;
        filters?: Record<string, any>;
        order?: string | { column: string; ascending?: boolean };
        limit?: number;
        single?: boolean;
    }) => {
        try {
            const token = await getToken();
            if (!token) return { data: null, error: 'No auth token' };

            const res = await fetch('/api/admin/impersonate-query', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(opts),
            });

            const json = await res.json();
            if (!res.ok) return { data: null, error: json.error };
            return { data: json.data };
        } catch (e: any) {
            return { data: null, error: e.message };
        }
    }, []);

    useEffect(() => {
        void loadStatus();
        const interval = setInterval(loadStatus, 60_000);
        return () => clearInterval(interval);
    }, [loadStatus]);

    return (
        <ImpersonationContext.Provider
            value={{
                isImpersonating,
                isLoading,
                targetUserId,
                targetData,
                error,
                refresh: loadStatus,
                queryAsUser,
            }}
        >
            {children}
        </ImpersonationContext.Provider>
    );
}
