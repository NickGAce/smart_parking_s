import { Button, Stack, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <Stack spacing={2}>
      <Typography variant="h3">404</Typography>
      <Typography>Страница не найдена.</Typography>
      <Button component={RouterLink} to="/" variant="contained">Go home</Button>
    </Stack>
  );
}
