import { Stack, TextField } from '@mui/material';

interface IntervalPickerProps {
  startTimeLocal: string;
  endTimeLocal: string;
  onStartTimeChange: (value: string) => void;
  onEndTimeChange: (value: string) => void;
  startError?: string;
  endError?: string;
}

export function IntervalPicker({
  startTimeLocal,
  endTimeLocal,
  onStartTimeChange,
  onEndTimeChange,
  startError,
  endError,
}: IntervalPickerProps) {
  return (
    <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
      <TextField
        type="datetime-local"
        label="Начало"
        value={startTimeLocal}
        onChange={(event) => onStartTimeChange(event.target.value)}
        error={Boolean(startError)}
        helperText={startError}
        fullWidth
        InputLabelProps={{ shrink: true }}
        required
      />
      <TextField
        type="datetime-local"
        label="Окончание"
        value={endTimeLocal}
        onChange={(event) => onEndTimeChange(event.target.value)}
        error={Boolean(endError)}
        helperText={endError}
        fullWidth
        InputLabelProps={{ shrink: true }}
        required
      />
    </Stack>
  );
}
