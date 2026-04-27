import type { SizeCategory, SpotType, UserRole, VehicleType } from './common';

export interface RecommendationExplainFactor {
  factor: string;
  value: number;
  weight: number;
  contribution: number;
  reason: string;
}

export interface DecisionFactor {
  name: string;
  weight: number;
  raw_value: number;
  contribution: number;
  explanation: string;
}

export interface DecisionConstraint {
  name: string;
  passed: boolean;
  explanation: string;
}

export interface RejectedCandidate {
  spot_id: number;
  reason: string;
  constraint: string | null;
}

export interface SelectedCandidate {
  spot_id: number;
  spot_number: number;
  spot_label: string;
  final_score: number;
}

export interface DecisionReport {
  selected_spot_id: number;
  selected_spot_label: string;
  final_score: number;
  confidence: number;
  factors: DecisionFactor[];
  hard_constraints_passed: DecisionConstraint[];
  rejected_candidates: RejectedCandidate[];
  generated_at: string;
  selected_candidate: SelectedCandidate;
}

export interface RecommendedSpot {
  spot_id: number;
  spot_number: number;
  parking_lot_id: number;
  zone_id: number | null;
  zone_name: string | null;
  spot_type: SpotType;
  has_charger: boolean;
  score: number;
  explainability: RecommendationExplainFactor[];
}

export interface RecommendationResult {
  parking_lot_id: number;
  from: string;
  to: string;
  requested_by_role: UserRole | string;
  total_candidates: number;
  recommended_spots: RecommendedSpot[];
  ranked_candidates?: RecommendedSpot[];
  rejected_candidates?: RejectedCandidate[];
  decision_report?: DecisionReport | null;
}

export interface RecommendationRequestPayload {
  user_context?: {
    role?: UserRole;
  };
  parking_lot_id: number;
  from: string;
  to: string;
  filters?: {
    spot_types?: SpotType[];
    zone_ids?: number[];
    vehicle_type?: VehicleType;
    size_category?: SizeCategory;
    requires_charger?: boolean;
  };
  preferences?: {
    preferred_spot_types?: SpotType[];
    preferred_zone_ids?: number[];
    prefer_charger?: boolean;
    needs_accessible_spot?: boolean;
    max_results?: number;
  };
  weights?: {
    availability?: number;
    spot_type?: number;
    zone?: number;
    charger?: number;
    role?: number;
    conflict?: number;
  };
}
