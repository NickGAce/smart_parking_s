import InboxOutlinedIcon from '@mui/icons-material/InboxOutlined';
import { Stack, Typography } from '@mui/material';

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <Stack alignItems="center" justifyContent="center" spacing={1} py={6}>
      <InboxOutlinedIcon color="disabled" />
      <Typography variant="h6">{title}</Typography>
      {description && <Typography color="text.secondary">{description}</Typography>}
    </Stack>
  );
}
