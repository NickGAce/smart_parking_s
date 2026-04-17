import type { ReactNode } from 'react';
import { Stack, type StackProps } from '@mui/material';

import { FiltersSection } from './filters-section';

interface FiltersToolbarProps {
  children: ReactNode;
  onReset?: () => void;
  resetLabel?: string;
  actions?: ReactNode;
  direction?: StackProps['direction'];
}

export function FiltersToolbar({
  children,
  onReset,
  resetLabel = 'Сбросить',
  actions,
  direction = { xs: 'column', md: 'row' },
}: FiltersToolbarProps) {
  return (
    <FiltersSection
      onReset={onReset}
      resetLabel={resetLabel}
      actions={actions}
    >
      <Stack direction={direction} spacing={2} flexWrap="wrap" useFlexGap>
        {children}
      </Stack>
    </FiltersSection>
  );
}
