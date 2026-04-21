import type { SxProps, Theme } from '@mui/material/styles';

export const surfacePanelSx: SxProps<Theme> = {
  p: { xs: 2, md: 3 },
  borderRadius: (theme) => theme.foundation.radius.md,
  borderColor: 'border.subtle',
};

export const sectionHeaderSx: SxProps<Theme> = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 1.5,
  mb: 2,
};

export const tableCodeBlockSx: SxProps<Theme> = {
  m: 0,
  mt: 0.5,
  p: 1,
  borderRadius: (theme) => theme.foundation.radius.xs,
  overflowX: 'auto',
  bgcolor: 'surface.overlay',
  border: 1,
  borderColor: 'border.subtle',
};
