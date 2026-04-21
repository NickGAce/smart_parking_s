import SearchOffOutlinedIcon from '@mui/icons-material/SearchOffOutlined';
import { Button, Stack, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';

import { ContentCard } from '../shared/ui/content-card';
import { DataListPageTemplate } from '../shared/ui/page-templates';

export function NotFoundPage() {
  return (
    <DataListPageTemplate
      headerMeta="системная страница"
      title="Страница не найдена"
      subtitle="Запрошенный адрес недоступен или был изменен."
      dataView={(
        <ContentCard sx={{ p: { xs: 3, md: 4 } }}>
          <Stack spacing={2} alignItems="flex-start">
            <Stack direction="row" spacing={1} alignItems="center">
              <SearchOffOutlinedIcon color="primary" />
              <Typography variant="h5">Ошибка 404</Typography>
            </Stack>
            <Typography color="text.secondary">
              Проверьте адрес в браузере или вернитесь на панель управления, чтобы продолжить работу в Smart Parking.
            </Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
              <Button component={RouterLink} to="/dashboard" variant="contained">
                На панель управления
              </Button>
              <Button component={RouterLink} to="/my-bookings" variant="outlined">
                К моим бронированиям
              </Button>
            </Stack>
          </Stack>
        </ContentCard>
      )}
    />
  );
}
