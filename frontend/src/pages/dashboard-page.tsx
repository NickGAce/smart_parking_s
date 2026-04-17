import { Alert, Grid, Stack, Typography } from '@mui/material';

import { useCurrentUser } from '../features/auth/use-current-user';
import { userRoleLabels } from '../shared/config/display-labels';
import { MetricCard } from '../shared/ui/metric-card';
import { SectionHeader } from '../shared/ui/section-header';
import { DashboardPageTemplate } from '../shared/ui/page-templates';

export function DashboardPage() {
  const { user } = useCurrentUser();

  return (
    <DashboardPageTemplate
      title="Обзор системы"
      subtitle="Оперативная сводка по аккаунту, парковкам и ближайшим действиям."
      meta="Dashboard"
      heroExtra={<Alert severity="info">Текущий пользователь: {user?.email} ({user ? userRoleLabels[user.role] : '—'}).</Alert>}
      kpis={(
        <>
          <Grid item xs={12} sm={6} lg={3}><MetricCard label="Аккаунт" value={user ? 'Активен' : '—'} helperText="Сессия авторизована." /></Grid>
          <Grid item xs={12} sm={6} lg={3}><MetricCard label="Роль" value={user ? userRoleLabels[user.role] : '—'} helperText="Определяет доступные разделы." /></Grid>
          <Grid item xs={12} sm={6} lg={3}><MetricCard label="Режим системы" value="Стабильный" helperText="Ошибок критического уровня не обнаружено." /></Grid>
          <Grid item xs={12} sm={6} lg={3}><MetricCard label="Следующий этап" value="Ролевые виджеты" helperText="Будут добавлены без изменения бизнес-логики." /></Grid>
        </>
      )}
      analytics={(
        <Stack spacing={2}>
          <SectionHeader title="Аналитика и тренды" subtitle="Блок готов к подключению occupancy, bookings и anomalies виджетов." />
          <Typography color="text.secondary">
            Здесь будет единый контейнер для графиков загрузки парковок, динамики бронирований и аномалий.
          </Typography>
        </Stack>
      )}
      activity={(
        <Stack spacing={2}>
          <SectionHeader title="События и алерты" subtitle="Последние важные уведомления и операционные задачи." />
          <Alert severity="warning">Пока показывается базовый плейсхолдер; подключение live-ленты — следующий шаг.</Alert>
          <Typography variant="body2" color="text.secondary">Рекомендуется начать миграцию с уведомлений и бронирований для максимальной полезности блока.</Typography>
        </Stack>
      )}
    />
  );
}
