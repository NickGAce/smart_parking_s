import { Paper } from '@mui/material';

import { EmptyState } from './empty-state';

export function PagePlaceholder({ description }: { description: string }) {
  return (
    <Paper sx={{ p: 3 }}>
      <EmptyState title="In progress" description={description} />
    </Paper>
  );
}
