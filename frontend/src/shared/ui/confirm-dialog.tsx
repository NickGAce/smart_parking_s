import type { ReactNode } from 'react';
import { useId } from 'react';
import { Button, Dialog, DialogActions, DialogContent, Typography } from '@mui/material';

import { DialogHeader } from './dialog-header';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  subtitle?: string;
  description: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  pending?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ConfirmDialog({
  open,
  title,
  subtitle,
  description,
  confirmLabel = 'Подтвердить',
  cancelLabel = 'Отмена',
  danger = false,
  pending = false,
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  const id = useId();
  const titleId = `${id}-title`;
  const descriptionId = `${id}-description`;
  const subtitleId = subtitle ? `${id}-subtitle` : undefined;

  return (
    <Dialog
      open={open}
      onClose={onCancel}
      maxWidth="xs"
      fullWidth
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
    >
      <DialogHeader title={title} subtitle={subtitle} titleId={titleId} subtitleId={subtitleId} />
      <DialogContent id={descriptionId} sx={{ pt: 1 }}>
        {typeof description === 'string' ? <Typography>{description}</Typography> : description}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onCancel} disabled={pending} color="inherit">
          {cancelLabel}
        </Button>
        <Button color={danger ? 'error' : 'primary'} variant="contained" disabled={pending} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
