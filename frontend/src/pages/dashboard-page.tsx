import { Alert, Button, Chip, Grid, Stack, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';

import type { AnalyticsDashboardFilters } from '../features/analytics/use-analytics-dashboard';
import { useAnalyticsDashboard } from '../features/analytics/use-analytics-dashboard';
import { useCurrentUser } from '../features/auth/use-current-user';
import { useUnreadNotificationsCountQuery } from '../features/notifications/use-notifications-query';
import { useLatestAccessEventsQuery } from '../features/access-events/hooks';
import { userRoleLabels } from '../shared/config/display-labels';
import { MetricCard } from '../shared/ui/metric-card';
import { SectionHeader } from '../shared/ui/section-header';
import { DashboardPageTemplate } from '../shared/ui/page-templates';
import { AnomaliesSection } from '../widgets/analytics/sections/anomalies-section';

const DASHBOARD_FILTERS: AnalyticsDashboardFilters = {
  period: 'day',
  parkingLotId: null,
  zone: '',
  from: '',
  to: '',
  historyDays: 28,
  bucketSizeHours: 2,
  anomalyUserId: null,
  managementSeverity: '',
  forecastQualityBucket: 'hour',
};

function formatPercent(value?: number, digits = 1) {
  if (value === undefined) return '—';
  return `${value.toFixed(digits)}%`;
}

const directionLabel: Record<'entry' | 'exit', string> = {
  entry: 'Въезд',
  exit: 'Выезд',
};

const decisionLabel: Record<'allowed' | 'review' | 'denied', string> = {
  allowed: 'Разрешено',
  review: 'Проверка',
  denied: 'Запрещено',
};

function formatDelta(value: number) {
  if (value === 0) return '0 п.п.';
  return `${value > 0 ? '+' : ''}${value.toFixed(1)} п.п.`;
}

export function DashboardPage() {
  const { user, role } = useCurrentUser();
  const analytics = useAnalyticsDashboard(DASHBOARD_FILTERS, role);
  const unreadNotificationsQuery = useUnreadNotificationsCountQuery();
  const latestAccessEventsQuery = useLatestAccessEventsQuery(5);

  const summary = analytics.summaryQuery.data;
  const occupancy = analytics.occupancyQuery.data;
  const anomalies = analytics.anomaliesQuery.data;

  const criticalAnomalies = anomalies?.items.filter((item) => item.severity === 'high').length ?? 0;
  const hottestZone = occupancy?.by_zone.reduce<{ zone: string; occupancy_percent: number } | null>((acc, zone) => {
    if (!acc) return zone;
    return zone.occupancy_percent > acc.occupancy_percent ? zone : acc;
  }, null);
  const topPeakHour = occupancy?.peak_hours[0];

  const cancellationRate = summary ? summary.cancellation_rate * 100 : undefined;
  const noShowRate = summary ? summary.no_show_rate * 100 : undefined;

  return (
    <DashboardPageTemplate
      title="Центр управления Smart Parking"
      subtitle="Данные в этом блоке берутся из реальных аналитических API (сводка, загрузка, аномалии, уведомления)."
      meta="Главный экран"
      heroActions={(
        <>
          <Button component={RouterLink} to="/analytics" variant="contained">Открыть аналитику</Button>
          <Button component={RouterLink} to="/bookings/new" variant="outlined">Новое бронирование</Button>
        </>
      )}
      heroExtra={(
        <Stack spacing={1.5}>
          <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1.5}>
            <Stack spacing={0.5}>
              <Typography variant="cardTitle">Смена под контролем</Typography>
              <Typography variant="body2" color="text.secondary">
                Пользователь: {user?.email ?? '—'} · Роль: {user ? userRoleLabels[user.role] : '—'}
              </Typography>
            </Stack>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              <Chip
                label={criticalAnomalies > 0 ? `Критичные аномалии: ${criticalAnomalies}` : 'Критичных аномалий нет'}
                color={criticalAnomalies > 0 ? 'error' : 'success'}
                size="small"
                variant="outlined"
              />
              <Chip
                label={unreadNotificationsQuery.data !== undefined ? `Непрочитанные уведомления: ${unreadNotificationsQuery.data}` : 'Непрочитанные уведомления: —'}
                color={unreadNotificationsQuery.data ? 'warning' : 'default'}
                size="small"
                variant="outlined"
              />
              <Chip label="Обновление: онлайн" size="small" variant="outlined" />
            </Stack>
          </Stack>
          <Alert severity={criticalAnomalies > 0 ? 'warning' : 'info'}>
            {criticalAnomalies > 0
              ? 'Есть критичные отклонения — откройте раздел «Аномалии» для детальной проверки причин.'
              : 'Критичных отклонений не зафиксировано. Система работает в штатном режиме.'}
          </Alert>
        </Stack>
      )}
      kpis={(
        <>
          <Grid item xs={12} sm={6} lg={3}>
            <MetricCard
              align="center"
              label="Загрузка парковки"
              value={summary ? formatPercent(summary.occupancy_percent) : '—'}
              secondaryValue={hottestZone ? `Пиковая зона: ${hottestZone.zone}` : 'Пиковая зона: —'}
              helperText="Источник: analytics/summary + analytics/occupancy"
            />
          </Grid>
          <Grid item xs={12} sm={6} lg={3}>
            <MetricCard
              align="center"
              label="Бронирования за день"
              value={summary ? String(summary.bookings_count) : '—'}
              secondaryValue={topPeakHour ? `Пик: ${String(topPeakHour.hour).padStart(2, '0')}:00` : 'Пик: —'}
              helperText="Источник: analytics/summary + analytics/occupancy"
            />
          </Grid>
          <Grid item xs={12} sm={6} lg={3}>
            <MetricCard
              align="center"
              label="Доля отмен"
              value={formatPercent(cancellationRate)}
              secondaryValue={summary ? `Неявка: ${formatPercent(noShowRate)}` : 'Неявка: —'}
              badgeLabel={cancellationRate !== undefined && cancellationRate > 15 ? 'Риск' : 'Норма'}
              badgeColor={cancellationRate !== undefined && cancellationRate > 15 ? 'warning' : 'success'}
              helperText="Источник: analytics/summary"
            />
          </Grid>
          <Grid item xs={12} sm={6} lg={3}>
            <MetricCard
              align="center"
              label="Операционный риск"
              value={criticalAnomalies > 0 ? 'Требует реакции' : 'Под контролем'}
              secondaryValue={summary ? `Δ отмен: ${formatDelta((summary.cancellation_rate - summary.no_show_rate) * 100)}` : 'Δ отмен: —'}
              badgeLabel={criticalAnomalies > 0 ? 'Высокий' : 'Низкий'}
              badgeColor={criticalAnomalies > 0 ? 'error' : 'success'}
              helperText="Источник: analytics/anomalies"
            />
          </Grid>
        </>
      )}
      analytics={(
        <Stack spacing={2}>
          <SectionHeader title="Ключевая аналитика" subtitle="Актуальные метрики за день для быстрого операционного решения." />
          <Grid container spacing={2}>
            <Grid item xs={12} md={6} xl={4}>
              <MetricCard
                align="center"
                label="Средняя длительность бронирования"
                value={summary ? `${summary.average_booking_duration_minutes.toFixed(1)} мин` : '—'}
                helperText="Реальные данные из analytics/summary"
              />
            </Grid>
            <Grid item xs={12} md={6} xl={4}>
              <MetricCard
                align="center"
                label="Пиковый час бронирований"
                value={topPeakHour ? `${String(topPeakHour.hour).padStart(2, '0')}:00` : '—'}
                secondaryValue={topPeakHour ? `${topPeakHour.bookings} бронирований` : 'Нет данных'}
                helperText="Источник: analytics/occupancy (peak_hours)"
              />
            </Grid>
            <Grid item xs={12} xl={4}>
              <MetricCard
                align="left"
                label="Фокус смены"
                value={criticalAnomalies > 0 ? `${criticalAnomalies} критичных аномалий` : 'Критичных аномалий нет'}
                secondaryValue={unreadNotificationsQuery.data ? `Непрочитанные уведомления: ${unreadNotificationsQuery.data}` : 'Новых уведомлений нет'}
                badgeLabel={criticalAnomalies > 0 ? 'Действие' : 'Стабильно'}
                badgeColor={criticalAnomalies > 0 ? 'warning' : 'success'}
                helperText="Откройте раздел аналитики для детального списка отклонений."
              />
            </Grid>
          </Grid>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            <Button component={RouterLink} to="/analytics" size="small" variant="outlined">Открыть аналитику</Button>
            <Button component={RouterLink} to="/booking-management" size="small" variant="outlined">Проверить бронирования</Button>
          </Stack>
          <Stack spacing={1}>
            <SectionHeader title="Краткая лента событий" subtitle="Последние события контроля доступа и риска в одном месте." />
            <Grid container spacing={1.5}>
              {(latestAccessEventsQuery.data?.items ?? []).slice(0, 4).map((event) => (
                <Grid item xs={12} md={6} key={`feed-${event.id}`}>
                  <MetricCard
                    align="left"
                    label={`${event.plate_number} · ${directionLabel[event.direction]}`}
                    value={decisionLabel[event.decision]}
                    secondaryValue={event.reason}
                    helperText={new Date(event.created_at).toLocaleString()}
                  />
                </Grid>
              ))}
              <Grid item xs={12}>
                <MetricCard
                  align="left"
                  label="Сводка аномалий"
                  value={analytics.anomaliesQuery.data?.items?.length ?? 0}
                  secondaryValue={criticalAnomalies > 0 ? `Критичных: ${criticalAnomalies}` : 'Критичных нет'}
                  helperText="Источник: analytics/anomalies. Детали доступны справа в компактном блоке."
                />
              </Grid>
            </Grid>
          </Stack>
        </Stack>
      )}
      activity={(
        <Stack spacing={1.5}>
          <SectionHeader title="Приоритетные действия" subtitle="Переход к ключевым операциям." />
          <MetricCard
            align="center"
            label="Непрочитанные уведомления"
            value={unreadNotificationsQuery.data !== undefined ? String(unreadNotificationsQuery.data) : '—'}
            helperText="Источник: notifications"
            sx={{ minHeight: 144 }}
          />
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Button component={RouterLink} to="/notifications" size="small" variant="outlined">Уведомления</Button>
            <Button component={RouterLink} to="/analytics" size="small" variant="outlined">Аномалии</Button>
            <Button component={RouterLink} to="/booking-management" size="small" variant="outlined">Бронирования</Button>
          </Stack>
          <Stack spacing={1}>
            <SectionHeader title="Аномалии (компактно)" subtitle="Быстрый обзор; откройте детали по каждой записи." />
            <AnomaliesSection
              role={role}
              isLoading={analytics.anomaliesQuery.isLoading}
              isError={analytics.anomaliesQuery.isError}
              data={analytics.anomaliesQuery.data}
              mode="compact"
              maxItems={3}
            />
          </Stack>
        </Stack>
      )}
    />
  );
}
