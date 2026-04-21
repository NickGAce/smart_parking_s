import InboxOutlinedIcon from '@mui/icons-material/InboxOutlined';
import SearchOffOutlinedIcon from '@mui/icons-material/SearchOffOutlined';
import type { ReactNode } from 'react';
import { Box, Stack, Typography } from '@mui/material';

import { stateMessages } from './state-messages';

type EmptyKind = 'generic' | 'no-results' | 'not-found';

interface EmptyStateProps {
  title?: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  actions?: ReactNode;
  compact?: boolean;
  kind?: EmptyKind;
}

function defaultsByKind(kind: EmptyKind) {
  if (kind === 'no-results') {
    return {
      title: stateMessages.empty.noResultsTitle,
      description: stateMessages.empty.noResultsDescription,
      icon: <SearchOffOutlinedIcon fontSize="small" />,
    };
  }

  if (kind === 'not-found') {
    return {
      title: stateMessages.empty.notFoundTitle,
      description: stateMessages.empty.notFoundDescription,
      icon: <SearchOffOutlinedIcon fontSize="small" />,
    };
  }

  return {
    title: stateMessages.empty.genericTitle,
    description: stateMessages.empty.genericDescription,
    icon: <InboxOutlinedIcon fontSize="small" />,
  };
}

export function EmptyState({ title, description, icon, actions, compact = false, kind = 'generic' }: EmptyStateProps) {
  const defaults = defaultsByKind(kind);

  return (
    <Stack
      role="status"
      aria-live="polite"
      alignItems="center"
      justifyContent="center"
      spacing={1}
      py={compact ? 3 : 6}
      textAlign="center"
      sx={{ color: 'text.secondary' }}
    >
      <Box
        sx={{
          width: 44,
          height: 44,
          borderRadius: '50%',
          display: 'grid',
          placeItems: 'center',
          bgcolor: 'surface.overlay',
          color: 'text.secondary',
        }}
      >
        {icon ?? defaults.icon}
      </Box>
      <Typography variant="h6" color="text.primary" sx={{ wordBreak: 'break-word' }}>
        {title ?? defaults.title}
      </Typography>
      <Typography color="text.secondary" sx={{ maxWidth: 560, wordBreak: 'break-word' }}>
        {description ?? defaults.description}
      </Typography>
      {actions}
    </Stack>
  );
}

export function EmptyStateIllustrated(props: EmptyStateProps) {
  return <EmptyState {...props} />;
}
