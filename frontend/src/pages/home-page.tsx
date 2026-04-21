import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined';
import { Button, Stack, Typography } from '@mui/material';
import { Navigate, Link as RouterLink } from 'react-router-dom';

import { useAuth } from '../features/auth/use-auth';
import { DataListPageTemplate } from '../shared/ui/page-templates';

export function HomePage() {
  const { user } = useAuth();

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <DataListPageTemplate
      headerMeta="legacy-путь"
      title="Главная"
      subtitle="Маршрут /home оставлен для обратной совместимости и ведет к актуальному входу в продукт."
      topBanner={(
        <Stack spacing={1}>
          <Typography color="text.secondary">
            Используйте страницу входа, чтобы перейти в рабочие разделы Smart Parking.
          </Typography>
          <Button component={RouterLink} to="/login" variant="contained" startIcon={<HomeOutlinedIcon />}>
            Перейти ко входу
          </Button>
        </Stack>
      )}
      isEmpty
      emptyText="Продукт работает через защищенные маршруты"
      dataView={null}
      stateSx={{ p: { xs: 3, md: 4 } }}
    />
  );
}
