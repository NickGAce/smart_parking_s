import { Alert, Paper, Stack, Typography } from '@mui/material';

export function HomePage() {
  return (
    <Paper sx={{ p: 3 }}>
      <Stack spacing={2}>
        <Typography variant="h4">Каркас интерфейса готов</Typography>
        <Typography color="text.secondary">
          Это первый этап SPA: базовый роутинг, провайдеры, тема, API-клиент и структура модулей.
        </Typography>
        <Alert severity="info">
          Бизнес-экраны и сценарии (логин, бронирования, аналитика и т.д.) будут добавлены в следующих этапах.
        </Alert>
      </Stack>
    </Paper>
  );
}
