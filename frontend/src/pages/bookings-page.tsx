import { Stack, Typography } from '@mui/material';

import { DataPanel } from '../shared/ui/data-panel';

export function BookingsPage() {
  return (
    <DataPanel title="Бронирования" subtitle="Раздел в процессе переноса на единый интерфейс.">
      <Stack spacing={1.5}>
        <Typography color="text.secondary">Раздел готовится к публикации. Используйте страницы «Мои бронирования» или «Управление бронированиями».</Typography>
      </Stack>
    </DataPanel>
  );
}
