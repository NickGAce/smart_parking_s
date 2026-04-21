import { Button, Stack, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';

import { ContentCard } from '../shared/ui/content-card';
import { PageContentLayout } from '../shared/ui/page-content-layout';

export function NotFoundPage() {
  return (
    <PageContentLayout maxWidth={960} spacing={2.5}>
      <ContentCard sx={{ p: { xs: 3, md: 5 } }}>
        <Stack spacing={2}>
          <Typography variant="h3">404</Typography>
          <Typography variant="h6">Страница не найдена</Typography>
          <Typography color="text.secondary">
            Проверьте адрес в строке браузера или вернитесь на панель управления, чтобы продолжить работу.
          </Typography>
          <Stack direction="row" spacing={1}>
            <Button component={RouterLink} to="/dashboard" variant="contained">
              Перейти на панель управления
            </Button>
          </Stack>
        </Stack>
      </ContentCard>
    </PageContentLayout>
  );
}
