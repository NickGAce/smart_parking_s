from typing import Optional

from pydantic import BaseModel, Field, model_validator

from app.models.parking_spot import SizeCategory, SpotStatus, SpotType, VehicleType


class ParkingSpotCreate(BaseModel):
    spot_number: int
    parking_lot_id: int
    spot_type: SpotType = SpotType.regular
    vehicle_type: VehicleType = VehicleType.car
    zone_id: int | None = None
    zone_name: str | None = None
    has_charger: bool = False
    size_category: SizeCategory = SizeCategory.medium
    type: Optional[str] = Field(default=None, description="Backward compatible alias for spot_type")

    @model_validator(mode="after")
    def normalize_backward_compatibility(self):
        if self.type and not self.spot_type:
            self.spot_type = SpotType(self.type)
        if self.type:
            self.spot_type = SpotType(self.type)
        if self.zone_id is not None and self.zone_name:
            raise ValueError("Provide only one of zone_id or zone_name")
        return self

    class Config:
        from_attributes = True


class ParkingSpotOut(BaseModel):
    id: int
    spot_number: int
    status: SpotStatus
    effective_status: SpotStatus
    spot_type: SpotType
    # keep old field for existing clients
    type: str
    vehicle_type: VehicleType
    has_charger: bool
    size_category: SizeCategory
    zone_id: int | None
    zone_name: str | None
    parking_lot_id: int

    class Config:
        from_attributes = True


class ParkingSpotUpdate(BaseModel):
    spot_number: Optional[int] = None
    status: Optional[SpotStatus] = None
    spot_type: Optional[SpotType] = None
    type: Optional[str] = Field(default=None, description="Backward compatible alias for spot_type")
    vehicle_type: Optional[VehicleType] = None
    zone_id: Optional[int] = None
    zone_name: Optional[str] = None
    has_charger: Optional[bool] = None
    size_category: Optional[SizeCategory] = None
    owner_id: Optional[int] = None
    parking_lot_id: Optional[int] = None

    @model_validator(mode="after")
    def normalize_backward_compatibility(self):
        if self.type:
            self.spot_type = SpotType(self.type)
        if self.zone_id is not None and self.zone_name:
            raise ValueError("Provide only one of zone_id or zone_name")
        return self

    class Config:
        from_attributes = True
