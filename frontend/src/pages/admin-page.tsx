import AdminPanelSettingsOutlinedIcon from '@mui/icons-material/AdminPanelSettingsOutlined';
import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined';
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined';
import { Box, Button, Grid, Stack, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';

import { DashboardPageTemplate } from '../shared/ui/page-templates';

export function AdminPage() {
  return (
    <DashboardPageTemplate
      meta="центр администрирования"
      title="Администрирование"
      subtitle="Единый экран для контроля доступа и проверки событий безопасности."
      heroActions={(
        <Button component={RouterLink} to="/dashboard" variant="outlined">
          Назад на панель управления
        </Button>
      )}
      heroExtra={(
        <Stack spacing={1}>
          <Typography color="text.secondary">
            Используйте этот раздел как единую точку входа в административные функции во время внешнего показа.
          </Typography>
        </Stack>
      )}
      analytics={(
        <Box sx={{ p: { xs: 2, md: 2.5 } }}>
          <Stack spacing={1}>
            <Typography variant="tableLabel" color="text.secondary">пользователи и роли</Typography>
            <Typography variant="h6">Управление пользователями</Typography>
            <Typography color="text.secondary">Создание пользователей и обновление ролей в рамках API администрирования.</Typography>
            <Button component={RouterLink} to="/admin-users" variant="contained" startIcon={<BadgeOutlinedIcon />}>
              Открыть раздел пользователей
            </Button>
          </Stack>
        </Box>
      )}
      activity={(
        <Box sx={{ p: { xs: 2, md: 2.5 } }}>
          <Stack spacing={1}>
            <Typography variant="tableLabel" color="text.secondary">контроль изменений</Typography>
            <Typography variant="h6">Журнал аудита</Typography>
            <Typography color="text.secondary">Проверка действий в системе, фильтры и экспорт для администраторов.</Typography>
            <Button component={RouterLink} to="/audit-logs" variant="contained" startIcon={<FactCheckOutlinedIcon />}>
              Открыть журнал аудита
            </Button>
          </Stack>
        </Box>
      )}
      kpis={(
        <>
          <Grid item xs={12}>
            <Stack direction="row" spacing={1} alignItems="center">
              <AdminPanelSettingsOutlinedIcon color="primary" fontSize="small" />
              <Typography variant="body2" color="text.secondary">
                Все административные функции доступны только роли «admin».
              </Typography>
            </Stack>
          </Grid>
        </>
      )}
    />
  );
}
