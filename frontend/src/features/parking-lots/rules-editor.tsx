import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { Alert, Button, IconButton, MenuItem, Paper, Stack, TextField, Typography } from '@mui/material';
import { useMemo, useState } from 'react';

import { ALL_USER_ROLES } from '../../shared/config/roles';
import type { UserRole } from '../../shared/types/common';
import type { AccessMode, ParkingLotRules, ScheduleExceptionItem, WorkingHourItem } from '../../shared/types/parking';

const accessModes: AccessMode[] = ['employees_only', 'guests_only', 'mixed'];
const roles: UserRole[] = ALL_USER_ROLES;
const weekdayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function defaultWorkingHours(): WorkingHourItem[] {
  return weekdayLabels.map((_, index) => ({ day_of_week: index, open_time: '09:00', close_time: '18:00', is_closed: false }));
}

function toRulesPayload(initial: ParkingLotRules): Omit<ParkingLotRules, 'parking_lot_id'> {
  return {
    access_mode: initial.access_mode,
    allowed_user_roles: initial.allowed_user_roles,
    min_booking_minutes: initial.min_booking_minutes,
    max_booking_minutes: initial.max_booking_minutes,
    booking_step_minutes: initial.booking_step_minutes,
    max_advance_minutes: initial.max_advance_minutes,
    working_hours: initial.working_hours.length ? initial.working_hours : defaultWorkingHours(),
    exceptions: initial.exceptions,
  };
}

function validate(rules: Omit<ParkingLotRules, 'parking_lot_id'>) {
  const errors: string[] = [];

  if (rules.max_booking_minutes < rules.min_booking_minutes) {
    errors.push('max_booking_minutes не может быть меньше min_booking_minutes.');
  }

  rules.working_hours.forEach((item) => {
    if (!item.is_closed && (!item.open_time || !item.close_time)) {
      errors.push(`Заполните часы работы для дня #${item.day_of_week + 1}.`);
    }
  });

  rules.exceptions.forEach((item, idx) => {
    if (!item.date) {
      errors.push(`Исключение #${idx + 1}: обязательна дата.`);
    }
    if (!item.is_closed && (!item.open_time || !item.close_time)) {
      errors.push(`Исключение #${idx + 1}: укажите open/close time.`);
    }
  });

  return errors;
}

interface RulesEditorProps {
  initial: ParkingLotRules;
  disabled?: boolean;
  readOnly?: boolean;
  serverError?: string | null;
  onSubmit: (payload: Omit<ParkingLotRules, 'parking_lot_id'>) => void;
}

export function RulesEditor({ initial, disabled, readOnly, serverError, onSubmit }: RulesEditorProps) {
  const [rules, setRules] = useState<Omit<ParkingLotRules, 'parking_lot_id'>>(() => toRulesPayload(initial));
  const validationErrors = useMemo(() => validate(rules), [rules]);

  const setException = (index: number, patch: Partial<ScheduleExceptionItem>) => {
    setRules((prev) => ({
      ...prev,
      exceptions: prev.exceptions.map((item, idx) => (idx === index ? { ...item, ...patch } : item)),
    }));
  };

  return (
    <Stack component="form" spacing={2} onSubmit={(event) => {
      event.preventDefault();
      if (validationErrors.length > 0) {
        return;
      }
      onSubmit(rules);
    }}>
      <Typography variant="h6">Правила парковки</Typography>
      <Alert severity="info">Этот редактор отправляет ПОЛНЫЙ набор rules через PUT (full replace semantics).</Alert>
      {serverError && <Alert severity="error">{serverError}</Alert>}
      {readOnly && <Alert severity="info">Только просмотр: сохранение доступно admin/owner.</Alert>}
      {validationErrors.length > 0 && <Alert severity="warning">{validationErrors[0]}</Alert>}

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
        <TextField select label="Access mode" value={rules.access_mode} onChange={(e) => setRules((prev) => ({ ...prev, access_mode: e.target.value as AccessMode }))} disabled={disabled || readOnly} fullWidth>
          {accessModes.map((mode) => <MenuItem key={mode} value={mode}>{mode}</MenuItem>)}
        </TextField>
        <TextField
          select
          SelectProps={{ multiple: true }}
          label="Allowed roles"
          value={rules.allowed_user_roles}
          onChange={(e) => {
            const value = e.target.value;
            setRules((prev) => ({ ...prev, allowed_user_roles: Array.isArray(value) ? (value as UserRole[]) : String(value).split(',') as UserRole[] }));
          }}
          disabled={disabled || readOnly}
          fullWidth
        >
          {roles.map((role) => <MenuItem key={role} value={role}>{role}</MenuItem>)}
        </TextField>
      </Stack>

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
        <TextField type="number" label="Min booking (min)" value={rules.min_booking_minutes} onChange={(e) => setRules((prev) => ({ ...prev, min_booking_minutes: Number(e.target.value) }))} disabled={disabled || readOnly} fullWidth />
        <TextField type="number" label="Max booking (min)" value={rules.max_booking_minutes} onChange={(e) => setRules((prev) => ({ ...prev, max_booking_minutes: Number(e.target.value) }))} disabled={disabled || readOnly} fullWidth />
        <TextField type="number" label="Step (min)" value={rules.booking_step_minutes} onChange={(e) => setRules((prev) => ({ ...prev, booking_step_minutes: Number(e.target.value) }))} disabled={disabled || readOnly} fullWidth />
        <TextField type="number" label="Advance (min)" value={rules.max_advance_minutes} onChange={(e) => setRules((prev) => ({ ...prev, max_advance_minutes: Number(e.target.value) }))} disabled={disabled || readOnly} fullWidth />
      </Stack>

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="subtitle1" mb={1}>Working hours</Typography>
        <Stack spacing={1}>
          {rules.working_hours.map((item, index) => (
            <Stack key={`wh-${item.day_of_week}`} direction={{ xs: 'column', md: 'row' }} spacing={1}>
              <TextField label="Day" value={weekdayLabels[item.day_of_week] ?? `D${item.day_of_week}`} InputProps={{ readOnly: true }} fullWidth />
              <TextField type="time" label="Open" value={item.open_time ?? ''} onChange={(e) => setRules((prev) => ({
                ...prev,
                working_hours: prev.working_hours.map((wh, idx) => (idx === index ? { ...wh, open_time: e.target.value || null } : wh)),
              }))} disabled={disabled || readOnly || item.is_closed} fullWidth InputLabelProps={{ shrink: true }} />
              <TextField type="time" label="Close" value={item.close_time ?? ''} onChange={(e) => setRules((prev) => ({
                ...prev,
                working_hours: prev.working_hours.map((wh, idx) => (idx === index ? { ...wh, close_time: e.target.value || null } : wh)),
              }))} disabled={disabled || readOnly || item.is_closed} fullWidth InputLabelProps={{ shrink: true }} />
              <TextField select label="Closed" value={item.is_closed ? 'yes' : 'no'} onChange={(e) => setRules((prev) => ({
                ...prev,
                working_hours: prev.working_hours.map((wh, idx) => (idx === index ? { ...wh, is_closed: e.target.value === 'yes' } : wh)),
              }))} disabled={disabled || readOnly} fullWidth>
                <MenuItem value="no">No</MenuItem>
                <MenuItem value="yes">Yes</MenuItem>
              </TextField>
            </Stack>
          ))}
        </Stack>
      </Paper>

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
          <Typography variant="subtitle1">Schedule exceptions</Typography>
          <Button startIcon={<AddIcon />} onClick={() => setRules((prev) => ({ ...prev, exceptions: [...prev.exceptions, { date: '', open_time: null, close_time: null, is_closed: false }] }))} disabled={disabled || readOnly}>Добавить</Button>
        </Stack>
        <Stack spacing={1}>
          {rules.exceptions.map((item, index) => (
            <Stack key={`exception-${index}`} direction={{ xs: 'column', md: 'row' }} spacing={1} alignItems="center">
              <TextField type="date" label="Date" value={item.date} onChange={(e) => setException(index, { date: e.target.value })} disabled={disabled || readOnly} fullWidth InputLabelProps={{ shrink: true }} />
              <TextField type="time" label="Open" value={item.open_time ?? ''} onChange={(e) => setException(index, { open_time: e.target.value || null })} disabled={disabled || readOnly || item.is_closed} fullWidth InputLabelProps={{ shrink: true }} />
              <TextField type="time" label="Close" value={item.close_time ?? ''} onChange={(e) => setException(index, { close_time: e.target.value || null })} disabled={disabled || readOnly || item.is_closed} fullWidth InputLabelProps={{ shrink: true }} />
              <TextField select label="Closed" value={item.is_closed ? 'yes' : 'no'} onChange={(e) => setException(index, { is_closed: e.target.value === 'yes' })} disabled={disabled || readOnly} fullWidth>
                <MenuItem value="no">No</MenuItem>
                <MenuItem value="yes">Yes</MenuItem>
              </TextField>
              <IconButton onClick={() => setRules((prev) => ({ ...prev, exceptions: prev.exceptions.filter((_, idx) => idx !== index) }))} disabled={disabled || readOnly}>
                <DeleteOutlineIcon />
              </IconButton>
            </Stack>
          ))}
        </Stack>
      </Paper>

      <Button type="submit" variant="contained" disabled={disabled || readOnly || validationErrors.length > 0}>Сохранить rules</Button>
    </Stack>
  );
}
