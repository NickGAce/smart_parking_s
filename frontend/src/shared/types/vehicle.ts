export type VehicleType = 'car' | 'ev' | 'truck' | 'bike' | 'van';

export interface Vehicle {
  id: number;
  user_id: number;
  plate_number: string;
  normalized_plate_number: string;
  vehicle_type: VehicleType;
  brand: string | null;
  model: string | null;
  color: string | null;
  is_primary: boolean;
  is_active: boolean;
  created_at: string;
}

export interface VehicleCreatePayload {
  plate_number: string;
  vehicle_type: VehicleType;
  brand?: string;
  model?: string;
  color?: string;
  is_primary?: boolean;
  is_active?: boolean;
}

export interface VehicleUpdatePayload {
  plate_number?: string;
  vehicle_type?: VehicleType;
  brand?: string;
  model?: string;
  color?: string;
  is_primary?: boolean;
  is_active?: boolean;
}
