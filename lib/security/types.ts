export type SecuritySeverity = 'low' | 'medium' | 'high' | 'critical';
export type SecurityStatus = 'new' | 'investigating' | 'resolved' | 'ignored';

export interface UserIP {
  id: string;
  user_id: string;
  ip_address: string;
  country?: string;
  city?: string;
  region?: string;
  isp?: string;
  latitude?: number;
  longitude?: number;
  detected_at: string;
  user_agent?: string;
  metadata?: Record<string, any>;
  is_approximate?: boolean;
}

export interface SecurityAlert {
  id: string;
  type: string;
  user_id?: string;
  related_user_id?: string;
  ip_address?: string;
  details: Record<string, any>;
  severity: SecuritySeverity;
  status: SecurityStatus;
  created_at: string;
}

export interface GeoLocation {
  ip: string;
  country?: string;
  city?: string;
  region?: string;
  lat?: number;
  lon?: number;
  isp?: string;
}
