import { Grid, MenuItem, TextField } from '@mui/material';

import type { AnalyticsDashboardFilters } from '../../features/analytics/use-analytics-dashboard';
import { DateTimeField } from '../../shared/ui/date-time-field';
import { FiltersSection } from '../../shared/ui/filters-section';
import type { AnalyticsPeriod } from '../../shared/types/analytics';
import type { ManagementSeverity } from '../../shared/types/analytics';

const PERIOD_OPTIONS: AnalyticsPeriod[] = ['day', 'week', 'month'];

const periodLabels: Record<AnalyticsPeriod, string> = {
  day: 'День',
  week: 'Неделя',
  month: 'Месяц',
};

const severityLabels: Record<ManagementSeverity, string> = {
  low: 'Низкая',
  medium: 'Средняя',
  high: 'Высокая',
  critical: 'Критичная',
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
        <Grid item xs={12} sm={6} lg={2}>
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

        <Grid item xs={12} sm={6} lg={3}>
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

        <Grid item xs={12} sm={6} lg={2}>
          <TextField label="Зона" size="small" fullWidth value={filters.zone} onChange={(event) => onChange({ zone: event.target.value })} />
        </Grid>

        <Grid item xs={12} sm={6} lg={2}>
          <DateTimeField
            label="От"
            value={filters.from}
            onChange={(value) => onChange({ from: value })}
          />
        </Grid>

        <Grid item xs={12} sm={6} lg={2}>
          <DateTimeField
            label="До"
            value={filters.to}
            onChange={(value) => onChange({ to: value })}
          />
        </Grid>


        <Grid item xs={12} sm={6} lg={2}>
          <TextField
            label="История, дней"
            type="number"
            size="small"
            fullWidth
            value={filters.historyDays}
            onChange={(event) => onChange({ historyDays: Number(event.target.value) })}
            inputProps={{ min: 1, max: 365 }}
          />
        </Grid>

        <Grid item xs={12} sm={6} lg={2}>
          <TextField
            label="Шаг, часов"
            type="number"
            size="small"
            fullWidth
            value={filters.bucketSizeHours}
            onChange={(event) => onChange({ bucketSizeHours: Number(event.target.value) })}
            inputProps={{ min: 1, max: 24 }}
          />
        </Grid>

        {canManageAnomalyUser && (
          <Grid item xs={12} sm={6} lg={2}>
            <TextField
              label="ID пользователя"
              type="number"
              size="small"
              fullWidth
              value={filters.anomalyUserId ?? ''}
              onChange={(event) => onChange({ anomalyUserId: event.target.value ? Number(event.target.value) : null })}
            />
          </Grid>
        )}

        <Grid item xs={12} sm={6} lg={2}>
          <TextField
            select
            label="Серьёзность рекомендаций"
            size="small"
            fullWidth
            value={filters.managementSeverity}
            onChange={(event) => onChange({ managementSeverity: event.target.value as AnalyticsDashboardFilters['managementSeverity'] })}
          >
            <MenuItem value="">Все уровни</MenuItem>
            {(Object.keys(severityLabels) as ManagementSeverity[]).map((severity) => (
              <MenuItem key={severity} value={severity}>
                {severityLabels[severity]}
              </MenuItem>
            ))}
          </TextField>
        </Grid>
      </Grid>
    </FiltersSection>
  );
}
