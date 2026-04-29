import type { ReactNode } from 'react';
import { Box } from '@mui/material';

interface ResponsiveTableWrapperProps {
  children: ReactNode;
}

export function ResponsiveTableWrapper({ children }: ResponsiveTableWrapperProps) {
  return (
    <Box sx={{ width: '100%', overflowX: 'auto', '& table': { minWidth: 780 }, '& td, & th': { whiteSpace: 'nowrap' } }}>
      {children}
    </Box>
  );
}
