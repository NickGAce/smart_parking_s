import { Button, Grid, MenuItem, Paper, TextField } from '@mui/material';

import type { AnalyticsPeriod } from '../../shared/types/analytics';
import type { AnalyticsDashboardFilters } from '../../features/analytics/use-analytics-dashboard';

const PERIOD_OPTIONS: AnalyticsPeriod[] = ['day', 'week', 'month'];

interface DashboardFiltersProps {
  filters: AnalyticsDashboardFilters;
  canManageAnomalyUser: boolean;
  onChange: (patch: Partial<AnalyticsDashboardFilters>) => void;
  onReset: () => void;
  parkingLotOptions: Array<{ id: number; name: string }>;
}

export function DashboardFilters({ filters, canManageAnomalyUser, onChange, onReset, parkingLotOptions }: DashboardFiltersProps) {
  return (
    <Paper sx={{ p: 2 }}>
      <Grid container spacing={2}>
        <Grid item xs={12} md={2}>
          <TextField
            select
            label="Period"
            size="small"
            fullWidth
            value={filters.period}
            onChange={(event) => onChange({ period: event.target.value as AnalyticsPeriod })}
          >
            {PERIOD_OPTIONS.map((period) => <MenuItem key={period} value={period}>{period}</MenuItem>)}
          </TextField>
        </Grid>

        <Grid item xs={12} md={3}>
          <TextField
            select
            label="Parking lot"
            size="small"
            fullWidth
            value={filters.parkingLotId ?? ''}
            onChange={(event) => onChange({ parkingLotId: event.target.value === '' ? null : Number(event.target.value) })}
          >
            <MenuItem value="">All lots</MenuItem>
            {parkingLotOptions.map((lot) => <MenuItem key={lot.id} value={lot.id}>{lot.name}</MenuItem>)}
          </TextField>
        </Grid>

        <Grid item xs={12} md={2}>
          <TextField label="Zone" size="small" fullWidth value={filters.zone} onChange={(event) => onChange({ zone: event.target.value })} />
        </Grid>

        <Grid item xs={12} md={2}>
          <TextField
            label="From"
            type="datetime-local"
            size="small"
            fullWidth
            value={filters.from}
            onChange={(event) => onChange({ from: event.target.value })}
            InputLabelProps={{ shrink: true }}
          />
        </Grid>

        <Grid item xs={12} md={2}>
          <TextField
            label="To"
            type="datetime-local"
            size="small"
            fullWidth
            value={filters.to}
            onChange={(event) => onChange({ to: event.target.value })}
            InputLabelProps={{ shrink: true }}
          />
        </Grid>

        <Grid item xs={12} md={1}>
          <Button fullWidth variant="outlined" onClick={onReset}>Reset</Button>
        </Grid>

        <Grid item xs={12} md={2}>
          <TextField
            label="History days"
            type="number"
            size="small"
            fullWidth
            value={filters.historyDays}
            onChange={(event) => onChange({ historyDays: Number(event.target.value) })}
            inputProps={{ min: 1, max: 365 }}
          />
        </Grid>

        <Grid item xs={12} md={2}>
          <TextField
            label="Bucket size (h)"
            type="number"
            size="small"
            fullWidth
            value={filters.bucketSizeHours}
            onChange={(event) => onChange({ bucketSizeHours: Number(event.target.value) })}
            inputProps={{ min: 1, max: 24 }}
          />
        </Grid>

        {canManageAnomalyUser && (
          <Grid item xs={12} md={2}>
            <TextField
              label="Anomaly user_id"
              type="number"
              size="small"
              fullWidth
              value={filters.anomalyUserId ?? ''}
              onChange={(event) => onChange({ anomalyUserId: event.target.value ? Number(event.target.value) : null })}
            />
          </Grid>
        )}
      </Grid>
    </Paper>
  );
}
