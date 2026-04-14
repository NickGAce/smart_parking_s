import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import { Alert, Stack } from '@mui/material';

export function ErrorState({ message }: { message: string }) {
  return (
    <Stack py={2}>
      <Alert icon={<ErrorOutlineIcon fontSize="inherit" />} severity="error">
        {message}
      </Alert>
    </Stack>
  );
}
