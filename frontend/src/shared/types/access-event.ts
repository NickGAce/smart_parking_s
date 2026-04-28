import type { ListResponse } from './common';

export type AccessDirection = 'entry' | 'exit';
export type RecognitionSource = 'manual' | 'mock' | 'provider';
export type AccessDecision = 'allowed' | 'denied' | 'review';

export interface AccessEvent {
  id: number;
  parking_lot_id: number;
  parking_spot_id: number | null;
  booking_id: number | null;
  user_id: number | null;
  vehicle_id: number | null;
  plate_number: string;
  normalized_plate_number: string;
  direction: AccessDirection;
  recognition_confidence: number | null;
  recognition_source: RecognitionSource;
  recognition_provider: string | null;
  recognition_diagnostics: Record<string, unknown> | null;
  image_url: string | null;
  video_url: string | null;
  frame_timestamp: number | null;
  processing_status: "pending" | "processed" | "failed";
  decision: AccessDecision;
  reason: string;
  created_at: string;
}

export interface AccessEventManualPayload {
  parking_lot_id: number;
  direction: AccessDirection;
  plate_number: string;
  recognition_confidence?: number;
}

export interface AccessEventRecognizePayload {
  parking_lot_id: number;
  direction: AccessDirection;
  image_token?: string;
  plate_number_hint?: string;
}

export interface AccessEventsQuery {
  parking_lot_id?: number;
  plate_number?: string;
  decision?: AccessDecision;
  direction?: AccessDirection;
  date_from?: string;
  date_to?: string;
  limit?: number;
  offset?: number;
}

export type AccessEventListResponse = ListResponse<AccessEvent>;
