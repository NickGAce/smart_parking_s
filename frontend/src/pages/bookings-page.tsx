import { Stack, Typography } from '@mui/material';

import { DataPanel } from '../shared/ui/data-panel';

export function BookingsPage() {
  return (
    <DataPanel title="Бронирования" subtitle="Раздел в процессе миграции на новый UI kit.">
      <Stack spacing={1.5}>
        <Typography color="text.secondary">Страница-заглушка для бронирований.</Typography>
      </Stack>
    </DataPanel>
  );
}
