import { Button, Grid, MenuItem, TextField } from '@mui/material';

import type { AnalyticsDashboardFilters } from '../../features/analytics/use-analytics-dashboard';
import { FiltersSection } from '../../shared/ui/filters-section';
import type { AnalyticsPeriod } from '../../shared/types/analytics';

const PERIOD_OPTIONS: AnalyticsPeriod[] = ['day', 'week', 'month'];

const periodLabels: Record<AnalyticsPeriod, string> = {
  day: 'День',
  week: 'Неделя',
  month: 'Месяц',
};

interface DashboardFiltersProps {
  filters: AnalyticsDashboardFilters;
  canManageAnomalyUser: boolean;
  onChange: (patch: Partial<AnalyticsDashboardFilters>) => void;
  onReset: () => void;
  parkingLotOptions: Array<{ id: number; name: string }>;
}

export function DashboardFilters({ filters, canManageAnomalyUser, onChange, onReset, parkingLotOptions }: DashboardFiltersProps) {
  return (
    <FiltersSection onReset={onReset}>
      <Grid container spacing={2} width="100%">
        <Grid item xs={12} md={2}>
          <TextField
            select
            label="Период"
            size="small"
            fullWidth
            value={filters.period}
            onChange={(event) => onChange({ period: event.target.value as AnalyticsPeriod })}
          >
            {PERIOD_OPTIONS.map((period) => <MenuItem key={period} value={period}>{periodLabels[period]}</MenuItem>)}
          </TextField>
        </Grid>

        <Grid item xs={12} md={3}>
          <TextField
            select
            label="Парковка"
            size="small"
            fullWidth
            value={filters.parkingLotId ?? ''}
            onChange={(event) => onChange({ parkingLotId: event.target.value === '' ? null : Number(event.target.value) })}
          >
            <MenuItem value="">Все парковки</MenuItem>
            {parkingLotOptions.map((lot) => <MenuItem key={lot.id} value={lot.id}>{lot.name}</MenuItem>)}
          </TextField>
        </Grid>

        <Grid item xs={12} md={2}>
          <TextField label="Зона" size="small" fullWidth value={filters.zone} onChange={(event) => onChange({ zone: event.target.value })} />
        </Grid>

        <Grid item xs={12} md={2}>
          <TextField
            label="От"
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
            label="До"
            type="datetime-local"
            size="small"
            fullWidth
            value={filters.to}
            onChange={(event) => onChange({ to: event.target.value })}
            InputLabelProps={{ shrink: true }}
          />
        </Grid>

        <Grid item xs={12} md={1}>
          <Button fullWidth variant="outlined" onClick={onReset}>Сбросить</Button>
        </Grid>

        <Grid item xs={12} md={2}>
          <TextField
            label="Глубина истории, дней"
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
            label="Шаг бакета, часов"
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
              label="ID пользователя аномалий"
              type="number"
              size="small"
              fullWidth
              value={filters.anomalyUserId ?? ''}
              onChange={(event) => onChange({ anomalyUserId: event.target.value ? Number(event.target.value) : null })}
            />
          </Grid>
        )}
      </Grid>
    </FiltersSection>
  );
}
