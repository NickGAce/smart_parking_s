import LockPersonOutlinedIcon from '@mui/icons-material/LockPersonOutlined';
import { Button, Stack, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';

import { ContentCard } from '../shared/ui/content-card';
import { DataListPageTemplate } from '../shared/ui/page-templates';

export function ForbiddenPage() {
  return (
    <DataListPageTemplate
      headerMeta="системная страница"
      title="Доступ ограничен"
      subtitle="У текущей роли нет прав для этого раздела."
      dataView={(
        <ContentCard sx={{ p: { xs: 3, md: 4 } }}>
          <Stack spacing={2} alignItems="flex-start">
            <Stack direction="row" spacing={1} alignItems="center">
              <LockPersonOutlinedIcon color="primary" />
              <Typography variant="h5">Ошибка 403</Typography>
            </Stack>
            <Typography color="text.secondary">
              Вернитесь на панель управления и выберите раздел, доступный вашей роли.
            </Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
              <Button component={RouterLink} to="/dashboard" variant="contained">
                На панель управления
              </Button>
              <Button component={RouterLink} to="/notifications" variant="outlined">
                Открыть уведомления
              </Button>
            </Stack>
          </Stack>
        </ContentCard>
      )}
    />
  );
}
