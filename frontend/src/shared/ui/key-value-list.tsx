import type { ReactNode } from 'react';
import { Stack, Typography } from '@mui/material';

export interface KeyValueItem {
  key: ReactNode;
  value: ReactNode;
}

export function KeyValueList({ items }: { items: KeyValueItem[] }) {
  return (
    <Stack spacing={1.25}>
      {items.map((item, index) => (
        <Stack key={index} direction={{ xs: 'column', sm: 'row' }} spacing={1}>
          <Typography variant="body2" color="text.secondary" sx={{ minWidth: { sm: 170 } }}>
            {item.key}
          </Typography>
          <Typography variant="body2" sx={{ wordBreak: 'break-word' }}>
            {item.value}
          </Typography>
        </Stack>
      ))}
    </Stack>
  );
}
