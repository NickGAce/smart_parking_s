import type { ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { CssBaseline, ThemeProvider } from '@mui/material';

import { queryClient } from '../../shared/api/query-client';
import { appTheme } from '../../shared/theme/app-theme';
import { AuthProvider } from './auth-provider';

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider theme={appTheme}>
      <CssBaseline />
      <QueryClientProvider client={queryClient}>
        <AuthProvider>{children}</AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
