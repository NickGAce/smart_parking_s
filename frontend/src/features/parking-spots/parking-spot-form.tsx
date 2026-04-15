import {
  Alert,
  Button,
  Checkbox,
  FormControl,
  FormControlLabel,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useMemo, useState } from 'react';

import type { CreateParkingSpotPayload, ParkingSpot, UpdateParkingSpotPayload } from '../../shared/types/parking';
import {
  parkingSpotRawStatusOptions,
  parkingSpotSizeCategoryOptions,
  parkingSpotTypeOptions,
  parkingSpotVehicleTypeOptions,
} from './constants';

interface ParkingSpotFormProps {
  initial?: ParkingSpot;
  mode: 'create' | 'edit';
  onSubmit: (payload: CreateParkingSpotPayload | UpdateParkingSpotPayload) => void;
  disabled?: boolean;
  readOnly?: boolean;
  serverError?: string | null;
}

export function ParkingSpotForm({ initial, mode, onSubmit, disabled = false, readOnly = false, serverError = null }: ParkingSpotFormProps) {
  const [spotNumber, setSpotNumber] = useState(initial?.spot_number ?? 1);
  const [parkingLotId, setParkingLotId] = useState(initial?.parking_lot_id ?? 1);
  const [spotType, setSpotType] = useState(initial?.spot_type ?? (initial?.type as ParkingSpot['spot_type']) ?? 'regular');
  const [vehicleType, setVehicleType] = useState(initial?.vehicle_type ?? 'car');
  const [sizeCategory, setSizeCategory] = useState(initial?.size_category ?? 'medium');
  const [status, setStatus] = useState(initial?.status ?? 'available');
  const [zoneId, setZoneId] = useState(initial?.zone_id ? String(initial.zone_id) : '');
  const [zoneName, setZoneName] = useState(initial?.zone_name ?? '');
  const [hasCharger, setHasCharger] = useState(initial?.has_charger ?? false);
  const [formError, setFormError] = useState<string | null>(null);

  const isCreateMode = mode === 'create';

  const zoneHint = useMemo(() => {
    if (zoneId.trim() || zoneName.trim()) {
      return 'Укажите только одно: zone_id или zone_name.';
    }
    return 'Если указать zone_name и зоны нет, backend может создать её автоматически.';
  }, [zoneId, zoneName]);

  const handleSubmit = () => {
    if (!Number.isFinite(spotNumber) || spotNumber <= 0) {
      setFormError('spot_number должен быть положительным числом.');
      return;
    }
    if (!Number.isFinite(parkingLotId) || parkingLotId <= 0) {
      setFormError('parking_lot_id должен быть положительным числом.');
      return;
    }
    if (zoneId.trim() && zoneName.trim()) {
      setFormError('Нельзя одновременно отправлять zone_id и zone_name.');
      return;
    }

    setFormError(null);

    const basePayload = {
      spot_number: spotNumber,
      parking_lot_id: parkingLotId,
      spot_type: spotType,
      type: spotType,
      vehicle_type: vehicleType,
      size_category: sizeCategory,
      has_charger: hasCharger,
      ...(zoneId.trim() ? { zone_id: Number(zoneId) } : {}),
      ...(zoneName.trim() ? { zone_name: zoneName.trim() } : {}),
    };

    if (isCreateMode) {
      onSubmit(basePayload as CreateParkingSpotPayload);
      return;
    }

    onSubmit({ ...basePayload, status } as UpdateParkingSpotPayload);
  };

  return (
    <Stack spacing={2}>
      <Typography variant="h6">{isCreateMode ? 'Новый parking spot' : `Редактирование spot #${initial?.id}`}</Typography>

      {formError && <Alert severity="error">{formError}</Alert>}
      {serverError && <Alert severity="error">{serverError}</Alert>}

      <Grid container spacing={2}>
        <Grid item xs={12} sm={6}>
          <TextField label="Spot number" type="number" value={spotNumber} fullWidth disabled={disabled || readOnly} onChange={(e) => setSpotNumber(Number(e.target.value))} />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField label="Parking lot ID" type="number" value={parkingLotId} fullWidth disabled={disabled || readOnly} onChange={(e) => setParkingLotId(Number(e.target.value))} />
        </Grid>

        <Grid item xs={12} sm={6}>
          <FormControl fullWidth>
            <InputLabel id="spot-type-label">Spot type</InputLabel>
            <Select labelId="spot-type-label" label="Spot type" value={spotType} disabled={disabled || readOnly} onChange={(e) => setSpotType(e.target.value as typeof spotType)}>
              {parkingSpotTypeOptions.map((value) => <MenuItem key={value} value={value}>{value}</MenuItem>)}
            </Select>
          </FormControl>
        </Grid>

        <Grid item xs={12} sm={6}>
          <FormControl fullWidth>
            <InputLabel id="vehicle-type-label">Vehicle type</InputLabel>
            <Select labelId="vehicle-type-label" label="Vehicle type" value={vehicleType} disabled={disabled || readOnly} onChange={(e) => setVehicleType(e.target.value as typeof vehicleType)}>
              {parkingSpotVehicleTypeOptions.map((value) => <MenuItem key={value} value={value}>{value}</MenuItem>)}
            </Select>
          </FormControl>
        </Grid>

        <Grid item xs={12} sm={6}>
          <FormControl fullWidth>
            <InputLabel id="size-category-label">Size category</InputLabel>
            <Select labelId="size-category-label" label="Size category" value={sizeCategory} disabled={disabled || readOnly} onChange={(e) => setSizeCategory(e.target.value as typeof sizeCategory)}>
              {parkingSpotSizeCategoryOptions.map((value) => <MenuItem key={value} value={value}>{value}</MenuItem>)}
            </Select>
          </FormControl>
        </Grid>

        {!isCreateMode && (
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth>
              <InputLabel id="spot-status-label">Raw status</InputLabel>
              <Select labelId="spot-status-label" label="Raw status" value={status} disabled={disabled || readOnly} onChange={(e) => setStatus(e.target.value as typeof status)}>
                {parkingSpotRawStatusOptions.map((value) => <MenuItem key={value} value={value}>{value}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>
        )}

        <Grid item xs={12} sm={6}>
          <TextField label="Zone ID" type="number" value={zoneId} fullWidth disabled={disabled || readOnly} onChange={(e) => setZoneId(e.target.value)} helperText={zoneHint} />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField label="Zone name" value={zoneName} fullWidth disabled={disabled || readOnly} onChange={(e) => setZoneName(e.target.value)} helperText={zoneHint} />
        </Grid>
      </Grid>

      <FormControlLabel
        control={<Checkbox checked={hasCharger} onChange={(e) => setHasCharger(e.target.checked)} disabled={disabled || readOnly} />}
        label="Has charger"
      />

      <Stack direction="row" justifyContent="flex-end">
        <Button variant="contained" onClick={handleSubmit} disabled={disabled || readOnly}>
          {isCreateMode ? 'Создать spot' : 'Сохранить spot'}
        </Button>
      </Stack>
    </Stack>
  );
}
