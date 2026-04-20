import type { ReactNode } from 'react';
import { Button } from '@mui/material';

import { ActionBar } from './action-bar';

interface FiltersSectionProps {
  children: ReactNode;
  onApply?: () => void;
  onReset?: () => void;
  applyLabel?: string;
  resetLabel?: string;
  actions?: ReactNode;
}

export function FiltersSection({
  children,
  onApply,
  onReset,
  applyLabel = 'Применить фильтры',
  resetLabel = 'Сбросить',
  actions,
}: FiltersSectionProps) {
  return (
    <ActionBar
      sx={{ borderRadius: (theme) => theme.foundation.radius.xs, overflow: 'hidden' }}
      actions={(
        <>
          {onReset ? (
            <Button variant="outlined" onClick={onReset}>
              {resetLabel}
            </Button>
          ) : null}
          {onApply ? (
            <Button variant="contained" onClick={onApply}>
              {applyLabel}
            </Button>
          ) : null}
          {actions}
        </>
      )}
    >
      {children}
    </ActionBar>
  );
}
