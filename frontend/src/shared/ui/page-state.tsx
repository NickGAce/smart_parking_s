import { Alert, CircularProgress, Stack, Typography } from '@mui/material';

interface PageStateProps {
  isLoading?: boolean;
  errorText?: string;
  emptyText?: string;
  isEmpty?: boolean;
}

export function PageState({ isLoading, errorText, emptyText, isEmpty }: PageStateProps) {
  if (isLoading) {
    return (
      <Stack direction="row" justifyContent="center" py={6}>
        <CircularProgress />
      </Stack>
    );
  }

  if (errorText) {
    return <Alert severity="error">{errorText}</Alert>;
  }

  if (isEmpty && emptyText) {
    return (
      <Typography color="text.secondary" py={3}>
        {emptyText}
      </Typography>
    );
  }

  return null;
}
