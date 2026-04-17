import { Alert, Stack, Typography } from '@mui/material';

import { useCurrentUser } from '../features/auth/use-current-user';
import { userRoleLabels } from '../shared/config/display-labels';
import { PageSection } from '../shared/ui/page-section';

export function DashboardPage() {
  const { user } = useCurrentUser();

  return (
    <PageSection title="Обзор системы" subtitle="Ключевая информация по аккаунту и состоянию панели управления.">
      <Stack spacing={2}>
        <Typography color="text.secondary">
          Ролевые виджеты панели находятся в следующем этапе и будут добавлены без изменения бизнес-логики.
        </Typography>
        <Alert severity="info">Текущий пользователь: {user?.email} ({user ? userRoleLabels[user.role] : '—'}).</Alert>
      </Stack>
    </PageSection>
  );
}
