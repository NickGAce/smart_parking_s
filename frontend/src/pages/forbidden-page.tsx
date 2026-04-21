import { Button, Stack, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';

import { ContentCard } from '../shared/ui/content-card';
import { PageContentLayout } from '../shared/ui/page-content-layout';

export function ForbiddenPage() {
  return (
    <PageContentLayout maxWidth={960} spacing={2.5}>
      <ContentCard sx={{ p: { xs: 3, md: 5 } }}>
        <Stack spacing={2}>
          <Typography variant="h3">403</Typography>
          <Typography variant="h6">Доступ к разделу ограничен</Typography>
          <Typography color="text.secondary">
            У вашей текущей роли недостаточно прав для этой страницы. Вернитесь на панель управления или выберите доступный раздел в меню.
          </Typography>
          <Stack direction="row" spacing={1}>
            <Button component={RouterLink} to="/dashboard" variant="contained">
              Вернуться на панель управления
            </Button>
          </Stack>
        </Stack>
      </ContentCard>
    </PageContentLayout>
  );
}
