import { Button, Stack, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';

export function ForbiddenPage() {
  return (
    <Stack spacing={2}>
      <Typography variant="h3">403</Typography>
      <Typography color="text.secondary">У вас недостаточно прав для доступа к этому разделу.</Typography>
      <Button component={RouterLink} to="/" variant="contained">
        Go home
      </Button>
    </Stack>
  );
}
