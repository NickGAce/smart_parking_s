import { Button, Stack } from '@mui/material';

import { DateTimeField } from '../../../shared/ui/date-time-field';

interface IntervalPickerProps {
  startTimeLocal: string;
  endTimeLocal: string;
  onStartTimeChange: (value: string) => void;
  onEndTimeChange: (value: string) => void;
  startError?: string;
  endError?: string;
}

function roundToQuarterHour(date: Date) {
  const result = new Date(date);
  result.setSeconds(0, 0);
  const minutes = result.getMinutes();
  result.setMinutes(Math.ceil(minutes / 15) * 15);
  return result;
}

function asLocalDateTime(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export function IntervalPicker({
  startTimeLocal,
  endTimeLocal,
  onStartTimeChange,
  onEndTimeChange,
  startError,
  endError,
}: IntervalPickerProps) {
  const applyQuickRange = (durationHours: number) => {
    const start = roundToQuarterHour(new Date());
    const end = new Date(start.getTime() + durationHours * 60 * 60 * 1000);
    onStartTimeChange(asLocalDateTime(start));
    onEndTimeChange(asLocalDateTime(end));
  };

  return (
    <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
      <DateTimeField
        label="Начало"
        value={startTimeLocal}
        onChange={onStartTimeChange}
        error={Boolean(startError)}
        helperText={startError}
        required
      />
      <DateTimeField
        label="Окончание"
        value={endTimeLocal}
        onChange={onEndTimeChange}
        error={Boolean(endError)}
        helperText={endError}
        required
      />
      <Stack direction="row" spacing={1} alignItems="center" sx={{ alignSelf: 'flex-end', pb: 0.5 }}>
        <Button size="small" variant="outlined" onClick={() => applyQuickRange(1)}>Сейчас +1ч</Button>
        <Button size="small" variant="outlined" onClick={() => applyQuickRange(2)}>Сейчас +2ч</Button>
      </Stack>
    </Stack>
  );
}
