import type { ReactNode } from 'react';
import { Box, Paper, Stack, type SxProps, type Theme } from '@mui/material';

interface FormActionsProps {
  secondary?: ReactNode;
  primary: ReactNode;
  sx?: SxProps<Theme>;
}

export function FormActions({ secondary, primary, sx }: FormActionsProps) {
  return (
    <Stack
      direction={{ xs: 'column-reverse', sm: 'row' }}
      spacing={1.5}
      justifyContent="flex-end"
      sx={sx}
    >
      {secondary}
      {primary}
    </Stack>
  );
}

interface StickyActionBarProps {
  children: ReactNode;
  sx?: SxProps<Theme>;
}

export function StickyActionBar({ children, sx }: StickyActionBarProps) {
  return (
    <Box sx={{ position: 'sticky', bottom: 12, zIndex: 5, ...sx }}>
      <Paper variant="outlined" sx={{ p: { xs: 1.5, md: 2 } }}>
        {children}
      </Paper>
    </Box>
  );
}
