import { Alert } from '@mui/material';

interface ApiErrorAlertProps {
  message: string;
}

export function ApiErrorAlert({ message }: ApiErrorAlertProps) {
  return <Alert severity="error">{message}</Alert>;
}
