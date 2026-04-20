import { Box, Skeleton, Stack } from '@mui/material';

import { ContentCard } from './content-card';

interface TableLoadingStateProps {
  rows?: number;
  columns?: number;
}

export function TableLoadingState({ rows = 6, columns = 5 }: TableLoadingStateProps) {
  return (
    <ContentCard padded={false} sx={{ borderRadius: (theme) => theme.foundation.radius.xs }}>
      <Stack spacing={0.25} sx={{ p: 2 }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: `repeat(${columns}, minmax(80px, 1fr))`, gap: 1, pb: 1 }}>
          {Array.from({ length: columns }).map((_, index) => (
            <Skeleton key={`head-${index}`} variant="rounded" height={18} />
          ))}
        </Box>
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <Box key={`row-${rowIndex}`} sx={{ display: 'grid', gridTemplateColumns: `repeat(${columns}, minmax(80px, 1fr))`, gap: 1, py: 0.75 }}>
            {Array.from({ length: columns }).map((__, columnIndex) => (
              <Skeleton key={`cell-${rowIndex}-${columnIndex}`} variant="rounded" height={16} />
            ))}
          </Box>
        ))}
      </Stack>
    </ContentCard>
  );
}
