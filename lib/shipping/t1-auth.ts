/**
 * T1 Envíos Auth Service — DB-Configurable
 * 
 * Reads credentials from Supabase `app_settings.t1_envios_config` (JSONB)
 * instead of process.env. Supports hot-swapping credentials via admin panel.
 */

import { supabaseAdmin } from '@/lib/supabase/admin';
import type { T1AuthResponse, T1Config } from './t1-types';

const T1_CLIENT_ID = 't1envios';
const T1_CLIENT_SECRET = 'f64cd365-346d-461d-95b4-91938594b84a';

// ─── Token Cache ────────────────────────────────────────

let tokenCache: {
    token: string;
    expiresAt: number;
    refreshToken: string;
    configHash: string; // To detect credential changes
} | null = null;

function hashConfig(cfg: T1Config): string {
    return `${cfg.api_url}|${cfg.shop_id}|${cfg.username}|${cfg.password}`;
}

// ─── Load Config from DB ────────────────────────────────

let configCache: { config: T1Config; loadedAt: number } | null = null;
const CONFIG_TTL = 30_000; // Cache config for 30 seconds

export async function getT1ConfigFromDB(): Promise<T1Config> {
    // Return cached if fresh
    if (configCache && Date.now() - configCache.loadedAt < CONFIG_TTL) {
        return configCache.config;
    }

    const defaultConfig: T1Config = {
        enabled: false,
        api_url: 'https://apiv2.t1envios.com',
        auth_url: 'https://id.t1.com/auth/realms/T1/protocol/openid-connect/token',
        shop_id: '',
        username: '',
        password: '',
        test_mode: true,
        markup_basic: 60,
        markup_pro: 50,
        markup_platinum: 40,
    };

    try {
        const { data } = await supabaseAdmin()
            .from('app_settings')
            .select('t1_envios_config')
            .eq('id', 1)
            .maybeSingle();

        const raw = (data as any)?.t1_envios_config;
        if (raw && typeof raw === 'object') {
            const config: T1Config = {
                enabled: Boolean(raw.enabled ?? defaultConfig.enabled),
                api_url: String(raw.api_url || raw.endpoint_url || defaultConfig.api_url),
                auth_url: String(raw.auth_url || defaultConfig.auth_url),
                shop_id: String(raw.shop_id || defaultConfig.shop_id),
                username: String(raw.username || raw.api_key || defaultConfig.username),
                password: String(raw.password || raw.api_secret || defaultConfig.password),
                test_mode: Boolean(raw.test_mode ?? defaultConfig.test_mode),
                markup_basic: Number(raw.markup_basic ?? defaultConfig.markup_basic),
                markup_pro: Number(raw.markup_pro ?? defaultConfig.markup_pro),
                markup_platinum: Number(raw.markup_platinum ?? defaultConfig.markup_platinum),
            };
            configCache = { config, loadedAt: Date.now() };
            return config;
        }
    } catch (err) {
        console.error('[T1Config] Error loading from DB:', err);
    }

    configCache = { config: defaultConfig, loadedAt: Date.now() };
    return defaultConfig;
}

/** Force reload the config on next call (e.g. after admin saves new credentials) */
export function clearT1ConfigCache(): void {
    configCache = null;
}

// ─── Token Management ───────────────────────────────────

export async function getT1AccessToken(forceRefresh = false): Promise<string> {
    const config = await getT1ConfigFromDB();
    if (!config.enabled) throw new Error('T1 Envíos no está habilitado');
    if (!config.username || !config.password) throw new Error('Credenciales T1 no configuradas');

    const currentHash = hashConfig(config);

    // If credentials changed, clear token cache
    if (tokenCache && tokenCache.configHash !== currentHash) {
        tokenCache = null;
    }

    // Return cached token if valid
    if (!forceRefresh && tokenCache && Date.now() < tokenCache.expiresAt) {
        return tokenCache.token;
    }

    // Try refresh token
    if (tokenCache?.refreshToken && !forceRefresh) {
        try {
            return await refreshT1Token(config.auth_url, tokenCache.refreshToken, currentHash);
        } catch {
            // Fall through to get new token
        }
    }

    // Get new token
    const formData = new URLSearchParams();
    formData.append('grant_type', 'password');
    formData.append('client_id', T1_CLIENT_ID);
    formData.append('client_secret', T1_CLIENT_SECRET);
    formData.append('username', config.username);
    formData.append('password', config.password);

    const response = await fetch(config.auth_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData.toString(),
    });

    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error_description || err.error || `Auth error ${response.status}`);
    }

    const data: T1AuthResponse = await response.json();
    tokenCache = {
        token: data.access_token,
        expiresAt: Date.now() + (data.expires_in * 1000) - 60_000,
        refreshToken: data.refresh_token,
        configHash: currentHash,
    };

    return data.access_token;
}

async function refreshT1Token(authUrl: string, refreshToken: string, configHash: string): Promise<string> {
    const formData = new URLSearchParams();
    formData.append('grant_type', 'refresh_token');
    formData.append('client_id', T1_CLIENT_ID);
    formData.append('client_secret', T1_CLIENT_SECRET);
    formData.append('refresh_token', refreshToken);

    const response = await fetch(authUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData.toString(),
    });

    if (!response.ok) throw new Error(`Refresh failed: ${response.status}`);

    const data: T1AuthResponse = await response.json();
    tokenCache = {
        token: data.access_token,
        expiresAt: Date.now() + (data.expires_in * 1000) - 60_000,
        refreshToken: data.refresh_token,
        configHash,
    };

    return data.access_token;
}

/** Clear token cache (used when admin changes credentials) */
export function clearT1TokenCache(): void {
    tokenCache = null;
}
