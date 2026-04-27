import type { BookingStatus } from './common';

export type AnalyticsPeriod = 'day' | 'week' | 'month';

export interface AnalyticsFilters {
  parking_lot_id: number | null;
  zone: string | null;
  period: AnalyticsPeriod;
  from_time: string;
  to_time: string;
}

export interface AnalyticsSummary {
  filters: AnalyticsFilters;
  occupancy_percent: number;
  bookings_count: number;
  average_booking_duration_minutes: number;
  cancellation_rate: number;
  no_show_rate: number;
}

export interface OccupancyByZone {
  zone: string;
  occupancy_percent: number;
}

export interface OccupancyBySpotType {
  spot_type: string;
  occupancy_percent: number;
}

export interface PeakHour {
  hour: number;
  bookings: number;
}

export interface AnalyticsOccupancy {
  filters: AnalyticsFilters;
  occupancy_percent: number;
  by_zone: OccupancyByZone[];
  by_spot_type: OccupancyBySpotType[];
  peak_hours: PeakHour[];
}

export interface AnalyticsBookings {
  filters: AnalyticsFilters;
  bookings_count: number;
  average_booking_duration_minutes: number;
  cancellation_rate: number;
  no_show_rate: number;
  status_breakdown: Partial<Record<BookingStatus | string, number>>;
}

export interface OccupancyForecast {
  parking_lot_id: number | null;
  zone: string | null;
  history_days: number;
  bucket_size_hours: number;
  target_from: string;
  target_to: string;
  forecast: OccupancyForecastBucket[];
}

export interface OccupancyForecastBucket {
  time_bucket: string;
  predicted_occupancy_percent: number;
  confidence: string;
  comment: string;
  samples: number;
}

export type AnomalySeverity = 'low' | 'medium' | 'high';
export type ManagementSeverity = 'low' | 'medium' | 'high' | 'critical';
export type ManagementRecommendationType =
  | 'overload'
  | 'no_show'
  | 'cancellation'
  | 'underutilization'
  | 'zone_imbalance'
  | 'rule_change'
  | 'security';

export interface AnomalyRelatedEntity {
  entity_type: 'user' | 'parking_lot' | 'parking_spot';
  entity_id: number;
  label: string | null;
}

export interface Anomaly {
  anomaly_type: string;
  severity: AnomalySeverity;
  reason: string;
  explanation?: string;
  recommended_action?: string;
  impact?: string;
  related_metric?: string;
  severity_reason?: string;
  related_entity: AnomalyRelatedEntity;
  metrics: Record<string, string | number>;
}

export interface AnomaliesResponse {
  period_from: string;
  period_to: string;
  applied_filters: Record<string, string | number | null>;
  rules: string[];
  items: Anomaly[];
}

export interface ManagementRecommendation {
  id: string;
  type: ManagementRecommendationType;
  severity: ManagementSeverity;
  title: string;
  description: string;
  recommended_action: string;
  metric_source: string;
  evidence: string;
  expected_effect: string;
  created_at: string;
}

export interface ManagementRecommendationsResponse {
  period_from: string;
  period_to: string;
  parking_lot_id: number | null;
  severity: ManagementSeverity | null;
  items: ManagementRecommendation[];
}

export type ForecastQualityBucket = 'hour' | 'day';
export type ForecastQualityConfidence = 'low' | 'medium' | 'high';

export interface ForecastQuality {
  parking_lot_id: number | null;
  mae: number;
  mape: number;
  rmse: number | null;
  sample_size: number;
  confidence: ForecastQualityConfidence;
  explanation: string;
  evaluated_period: {
    from_time: string;
    to_time: string;
    bucket: ForecastQualityBucket;
  };
}

export interface AnalyticsQuery {
  period?: AnalyticsPeriod;
  parking_lot_id?: number;
  zone?: string;
  from?: string;
  to?: string;
}

export interface ForecastQuery {
  parking_lot_id?: number;
  zone?: string;
  target_date?: string;
  from?: string;
  to?: string;
  history_days?: number;
  bucket_size_hours?: number;
  moving_average_window?: number;
}

export interface ManagementRecommendationsQuery {
  parking_lot_id?: number;
  date_from: string;
  date_to: string;
  severity?: ManagementSeverity;
}

export interface ForecastQualityQuery {
  parking_lot_id?: number;
  date_from: string;
  date_to: string;
  bucket?: ForecastQualityBucket;
}
