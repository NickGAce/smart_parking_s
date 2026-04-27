import { Grid, MenuItem, TextField, type TextFieldProps } from '@mui/material';

const DEFAULT_TIME = '09:00';

const TIME_OPTIONS = Array.from({ length: 24 * 4 }, (_, index) => {
  const hours = String(Math.floor(index / 4)).padStart(2, '0');
  const minutes = String((index % 4) * 15).padStart(2, '0');
  return `${hours}:${minutes}`;
});

function toTodayDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function splitDateTime(value: string) {
  if (!value) {
    return { date: '', time: '' };
  }
  const [date = '', timeWithSeconds = ''] = value.split('T');
  const time = timeWithSeconds.slice(0, 5);
  return { date, time };
}

interface DateTimeFieldProps extends Omit<TextFieldProps, 'type' | 'value' | 'onChange'> {
  value: string;
  onChange: (value: string) => void;
}

export function DateTimeField({ label, value, onChange, helperText, error, disabled, required, size = 'small', fullWidth = true }: DateTimeFieldProps) {
  const { date, time } = splitDateTime(value);

  return (
    <Grid container spacing={1}>
      <Grid item xs={12} sm={7}>
        <TextField
          label={label}
          type="date"
          size={size}
          fullWidth={fullWidth}
          value={date}
          onChange={(event) => {
            const nextDate = event.target.value;
            if (!nextDate) {
              onChange('');
              return;
            }
            onChange(`${nextDate}T${time || DEFAULT_TIME}`);
          }}
          InputLabelProps={{ shrink: true }}
          error={error}
          disabled={disabled}
          required={required}
          helperText={helperText}
        />
      </Grid>
      <Grid item xs={12} sm={5}>
        <TextField
          select
          label="Время"
          size={size}
          fullWidth={fullWidth}
          value={time}
          onChange={(event) => {
            const nextTime = event.target.value;
            if (!nextTime) {
              onChange('');
              return;
            }
            onChange(`${date || toTodayDateString()}T${nextTime}`);
          }}
          InputLabelProps={{ shrink: true }}
          error={error}
          disabled={disabled}
          required={required}
        >
          {TIME_OPTIONS.map((option) => (
            <MenuItem key={option} value={option}>
              {option}
            </MenuItem>
          ))}
        </TextField>
      </Grid>
    </Grid>
  );
}
