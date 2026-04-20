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

import { FormActions } from '../../shared/ui/form-actions';
import { InlineFieldHint } from '../../shared/ui/inline-field-hint';
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
      return 'Укажите только одно значение: ID зоны или название зоны.';
    }
    return 'Если указать новое название зоны, backend может создать ее автоматически.';
  }, [zoneId, zoneName]);

  const handleSubmit = () => {
    if (!Number.isFinite(spotNumber) || spotNumber <= 0) {
      setFormError('Номер места должен быть положительным числом.');
      return;
    }
    if (!Number.isFinite(parkingLotId) || parkingLotId <= 0) {
      setFormError('ID парковки должен быть положительным числом.');
      return;
    }
    if (zoneId.trim() && zoneName.trim()) {
      setFormError('Нельзя одновременно передавать ID и название зоны.');
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
      <Typography variant="h6">{isCreateMode ? 'Новое парковочное место' : `Редактирование места #${initial?.id}`}</Typography>

      {formError && <Alert severity="error">{formError}</Alert>}
      {serverError && <Alert severity="error">{serverError}</Alert>}

      <Grid container spacing={2}>
        <Grid item xs={12} sm={6}>
          <TextField
            label="Номер места"
            type="number"
            value={spotNumber}
            fullWidth
            required
            disabled={disabled || readOnly}
            onChange={(e) => setSpotNumber(Number(e.target.value))}
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            label="ID парковки"
            type="number"
            value={parkingLotId}
            fullWidth
            required
            disabled={disabled || readOnly}
            onChange={(e) => setParkingLotId(Number(e.target.value))}
          />
        </Grid>

        <Grid item xs={12} sm={6}>
          <FormControl fullWidth>
            <InputLabel id="spot-type-label">Тип места</InputLabel>
            <Select labelId="spot-type-label" label="Тип места" value={spotType} disabled={disabled || readOnly} onChange={(e) => setSpotType(e.target.value as typeof spotType)}>
              {parkingSpotTypeOptions.map((value) => <MenuItem key={value} value={value}>{value}</MenuItem>)}
            </Select>
          </FormControl>
        </Grid>

        <Grid item xs={12} sm={6}>
          <FormControl fullWidth>
            <InputLabel id="vehicle-type-label">Тип транспорта</InputLabel>
            <Select labelId="vehicle-type-label" label="Тип транспорта" value={vehicleType} disabled={disabled || readOnly} onChange={(e) => setVehicleType(e.target.value as typeof vehicleType)}>
              {parkingSpotVehicleTypeOptions.map((value) => <MenuItem key={value} value={value}>{value}</MenuItem>)}
            </Select>
          </FormControl>
        </Grid>

        <Grid item xs={12} sm={6}>
          <FormControl fullWidth>
            <InputLabel id="size-category-label">Размер места</InputLabel>
            <Select labelId="size-category-label" label="Размер места" value={sizeCategory} disabled={disabled || readOnly} onChange={(e) => setSizeCategory(e.target.value as typeof sizeCategory)}>
              {parkingSpotSizeCategoryOptions.map((value) => <MenuItem key={value} value={value}>{value}</MenuItem>)}
            </Select>
          </FormControl>
        </Grid>

        {!isCreateMode && (
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth>
              <InputLabel id="spot-status-label">Статус</InputLabel>
              <Select labelId="spot-status-label" label="Статус" value={status} disabled={disabled || readOnly} onChange={(e) => setStatus(e.target.value as typeof status)}>
                {parkingSpotRawStatusOptions.map((value) => <MenuItem key={value} value={value}>{value}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>
        )}

        <Grid item xs={12} sm={6}>
          <TextField
            label="ID зоны"
            type="number"
            value={zoneId}
            fullWidth
            disabled={disabled || readOnly}
            onChange={(e) => setZoneId(e.target.value)}
            helperText={<InlineFieldHint>{zoneHint}</InlineFieldHint>}
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            label="Название зоны"
            value={zoneName}
            fullWidth
            disabled={disabled || readOnly}
            onChange={(e) => setZoneName(e.target.value)}
            helperText={<InlineFieldHint>{zoneHint}</InlineFieldHint>}
          />
        </Grid>
      </Grid>

      <FormControlLabel
        control={<Checkbox checked={hasCharger} onChange={(e) => setHasCharger(e.target.checked)} disabled={disabled || readOnly} />}
        label="Есть зарядка для электромобиля"
      />


      <FormActions
        primary={(
          <Button variant="contained" onClick={handleSubmit} disabled={disabled || readOnly}>
            {isCreateMode ? 'Создать место' : 'Сохранить изменения'}
          </Button>
        )}
      />
    </Stack>
  );
}
