import { Alert, Box, Button, Chip, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { useMemo, useState } from 'react';

import type { UserRole } from '../../shared/types/common';
import type { AccessMode, CreateParkingLotPayload, ParkingLot } from '../../shared/types/parking';

const accessModes: AccessMode[] = ['employees_only', 'guests_only', 'mixed'];
const roleOptions: UserRole[] = ['admin', 'owner', 'tenant', 'guard', 'uk'];

export interface ParkingLotFormValue {
  name: string;
  address: string;
  total_spots: number;
  guest_spot_percentage: number;
  access_mode: AccessMode;
  allowed_user_roles: UserRole[];
  min_booking_minutes: number;
  max_booking_minutes: number;
  booking_step_minutes: number;
  max_advance_minutes: number;
}

function toInitialValue(initial?: ParkingLot): ParkingLotFormValue {
  return {
    name: initial?.name ?? '',
    address: initial?.address ?? '',
    total_spots: initial?.total_spots ?? 1,
    guest_spot_percentage: initial?.guest_spot_percentage ?? 0,
    access_mode: initial?.access_mode ?? 'mixed',
    allowed_user_roles: initial?.allowed_user_roles ?? [],
    min_booking_minutes: initial?.min_booking_minutes ?? 30,
    max_booking_minutes: initial?.max_booking_minutes ?? 480,
    booking_step_minutes: initial?.booking_step_minutes ?? 30,
    max_advance_minutes: initial?.max_advance_minutes ?? 10080,
  };
}

function validate(value: ParkingLotFormValue) {
  const errors: Partial<Record<keyof ParkingLotFormValue, string>> = {};

  if (!value.name.trim()) errors.name = 'Название обязательно.';
  if (!value.address.trim()) errors.address = 'Адрес обязателен.';
  if (value.total_spots < 1) errors.total_spots = 'Минимум 1 место.';
  if (value.guest_spot_percentage < 0 || value.guest_spot_percentage > 100) {
    errors.guest_spot_percentage = 'От 0 до 100%.';
  }
  if (value.min_booking_minutes < 1) errors.min_booking_minutes = 'Должно быть > 0.';
  if (value.max_booking_minutes < value.min_booking_minutes) errors.max_booking_minutes = 'Не может быть меньше min.';
  if (value.booking_step_minutes < 1) errors.booking_step_minutes = 'Должно быть > 0.';
  if (value.max_advance_minutes < value.max_booking_minutes) errors.max_advance_minutes = 'Слишком мало для max длительности.';

  return errors;
}

interface ParkingLotFormProps {
  initial?: ParkingLot;
  title: string;
  submitLabel: string;
  disabled?: boolean;
  readOnly?: boolean;
  serverError?: string | null;
  onSubmit: (payload: CreateParkingLotPayload) => void;
}

export function ParkingLotForm({ initial, title, submitLabel, disabled, readOnly, serverError, onSubmit }: ParkingLotFormProps) {
  const [value, setValue] = useState<ParkingLotFormValue>(() => toInitialValue(initial));
  const errors = useMemo(() => validate(value), [value]);

  return (
    <Stack spacing={2} component="form" onSubmit={(event) => {
      event.preventDefault();
      if (Object.keys(errors).length) {
        return;
      }
      onSubmit(value);
    }}>
      <Typography variant="h6">{title}</Typography>
      {serverError && <Alert severity="error">{serverError}</Alert>}
      {readOnly && <Alert severity="info">Режим только чтение: редактирование доступно только admin/owner.</Alert>}
      <TextField label="Название" value={value.name} onChange={(e) => setValue((prev) => ({ ...prev, name: e.target.value }))} error={Boolean(errors.name)} helperText={errors.name} disabled={disabled || readOnly} required />
      <TextField label="Адрес" value={value.address} onChange={(e) => setValue((prev) => ({ ...prev, address: e.target.value }))} error={Boolean(errors.address)} helperText={errors.address} disabled={disabled || readOnly} required />

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
        <TextField type="number" label="Всего мест" value={value.total_spots} onChange={(e) => setValue((prev) => ({ ...prev, total_spots: Number(e.target.value) }))} error={Boolean(errors.total_spots)} helperText={errors.total_spots} disabled={disabled || readOnly} fullWidth />
        <TextField type="number" label="Гостевые места (%)" value={value.guest_spot_percentage} onChange={(e) => setValue((prev) => ({ ...prev, guest_spot_percentage: Number(e.target.value) }))} error={Boolean(errors.guest_spot_percentage)} helperText={errors.guest_spot_percentage} disabled={disabled || readOnly} fullWidth />
      </Stack>

      <TextField select label="Access mode" value={value.access_mode} onChange={(e) => setValue((prev) => ({ ...prev, access_mode: e.target.value as AccessMode }))} disabled={disabled || readOnly}>
        {accessModes.map((mode) => <MenuItem key={mode} value={mode}>{mode}</MenuItem>)}
      </TextField>

      <Stack spacing={1}>
        <Typography variant="subtitle2">Allowed user roles</Typography>
        <Stack direction="row" gap={1} flexWrap="wrap">
          {roleOptions.map((role) => {
            const active = value.allowed_user_roles.includes(role);
            return (
              <Chip
                key={role}
                label={role}
                color={active ? 'primary' : 'default'}
                variant={active ? 'filled' : 'outlined'}
                disabled={disabled || readOnly}
                onClick={() => setValue((prev) => ({
                  ...prev,
                  allowed_user_roles: active ? prev.allowed_user_roles.filter((x) => x !== role) : [...prev.allowed_user_roles, role],
                }))}
              />
            );
          })}
        </Stack>
      </Stack>

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
        <TextField type="number" label="Min booking (min)" value={value.min_booking_minutes} onChange={(e) => setValue((prev) => ({ ...prev, min_booking_minutes: Number(e.target.value) }))} error={Boolean(errors.min_booking_minutes)} helperText={errors.min_booking_minutes} disabled={disabled || readOnly} fullWidth />
        <TextField type="number" label="Max booking (min)" value={value.max_booking_minutes} onChange={(e) => setValue((prev) => ({ ...prev, max_booking_minutes: Number(e.target.value) }))} error={Boolean(errors.max_booking_minutes)} helperText={errors.max_booking_minutes} disabled={disabled || readOnly} fullWidth />
      </Stack>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
        <TextField type="number" label="Booking step (min)" value={value.booking_step_minutes} onChange={(e) => setValue((prev) => ({ ...prev, booking_step_minutes: Number(e.target.value) }))} error={Boolean(errors.booking_step_minutes)} helperText={errors.booking_step_minutes} disabled={disabled || readOnly} fullWidth />
        <TextField type="number" label="Max advance (min)" value={value.max_advance_minutes} onChange={(e) => setValue((prev) => ({ ...prev, max_advance_minutes: Number(e.target.value) }))} error={Boolean(errors.max_advance_minutes)} helperText={errors.max_advance_minutes} disabled={disabled || readOnly} fullWidth />
      </Stack>

      <Box>
        <Button type="submit" variant="contained" disabled={disabled || readOnly || Boolean(Object.keys(errors).length)}>
          {submitLabel}
        </Button>
      </Box>
    </Stack>
  );
}
