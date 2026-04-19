import {
  Alert,
  Button,
  Chip,
  Divider,
  Grid,
  List,
  ListItem,
  ListItemText,
  Stack,
  Typography,
} from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';

import { useCurrentUser } from '../features/auth/use-current-user';
import { userRoleLabels } from '../shared/config/display-labels';
import { MetricCard } from '../shared/ui/metric-card';
import { SectionHeader } from '../shared/ui/section-header';
import { DashboardPageTemplate } from '../shared/ui/page-templates';

const operationalHighlights = [
  { label: 'Занятость парковки', value: '78%', helper: 'Пиковый час: 09:00–10:00', severity: 'warning' as const },
  { label: 'Доступно мест', value: '42', helper: 'Лучшая доступность: зона C', severity: 'success' as const },
  { label: 'Активные бронирования', value: '96', helper: '13 завершатся в ближайший час', severity: 'default' as const },
  { label: 'Проблемные зоны', value: '2', helper: 'A2 и B1 требуют внимания', severity: 'error' as const },
];

const nextActions = [
  { title: 'Проверить аномалии отмен', description: 'Есть серия отмен в зоне A2 за последние 3 часа.', to: '/analytics' },
  { title: 'Просмотреть уведомления', description: '4 новых системных оповещения ожидают подтверждения.', to: '/notifications' },
  { title: 'Открыть управление бронированиями', description: '7 бронирований скоро перейдут в статус no-show.', to: '/booking-management' },
];

export function DashboardPage() {
  const { user } = useCurrentUser();

  return (
    <DashboardPageTemplate
      title="Smart Parking Control Center"
      subtitle="Единая оперативная панель: состояние парковки, риски и ключевые действия на сегодня."
      meta="Главный экран"
      heroActions={(
        <>
          <Button component={RouterLink} to="/analytics" variant="contained">Открыть аналитику</Button>
          <Button component={RouterLink} to="/create-booking" variant="outlined">Новое бронирование</Button>
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
              <Chip label="SLA 99.9%" color="success" size="small" variant="outlined" />
              <Chip label="2 критичных алерта" color="error" size="small" variant="outlined" />
              <Chip label="Обновлено 2 мин назад" size="small" variant="outlined" />
            </Stack>
          </Stack>
          <Alert severity="info">Сфокусируйтесь на зонах A2 и B1: там наблюдается рост отмен и снижение доступности.</Alert>
        </Stack>
      )}
      kpis={(
        <>
          {operationalHighlights.map((item) => (
            <Grid item xs={12} sm={6} xl={3} key={item.label}>
              <MetricCard
                label={item.label}
                value={item.value}
                helperText={item.helper}
                badgeLabel={item.severity === 'default' ? 'Норма' : item.severity === 'success' ? 'Стабильно' : item.severity === 'warning' ? 'Риск' : 'Критично'}
                badgeColor={item.severity}
              />
            </Grid>
          ))}
        </>
      )}
      analytics={(
        <Stack spacing={2}>
          <SectionHeader title="Ключевая аналитика" subtitle="Главные сигналы по загрузке, бронированиям и эффективности за текущий день." />
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <MetricCard
                label="Средняя загрузка"
                value="74.6%"
                secondaryValue="+5.2 п.п. к вчера"
                badgeLabel="Рост"
                badgeColor="success"
                helperText="Стабильный рост в утреннем и вечернем пике."
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <MetricCard
                label="Конверсия бронирования"
                value="68%"
                secondaryValue="-2.1 п.п."
                badgeLabel="Снижение"
                badgeColor="warning"
                helperText="Причина: рост ранних отмен в зоне A2."
              />
            </Grid>
          </Grid>
          <Divider />
          <Typography variant="body2" color="text.secondary">
            Перейдите в раздел аналитики, чтобы посмотреть детализацию по периодам, зонам, прогнозу и аномалиям.
          </Typography>
        </Stack>
      )}
      activity={(
        <Stack spacing={2}>
          <SectionHeader title="Приоритетные действия" subtitle="Что важно сделать прямо сейчас." />
          <List disablePadding>
            {nextActions.map((action, index) => (
              <ListItem
                key={action.title}
                disablePadding
                secondaryAction={
                  <Button component={RouterLink} to={action.to} size="small" variant="text">
                    Перейти
                  </Button>
                }
                sx={{ mb: 1.5 }}
              >
                <ListItemText primary={action.title} secondary={action.description} />
              </ListItem>
            ))}
          </List>
        </Stack>
      )}
    />
  );
}
