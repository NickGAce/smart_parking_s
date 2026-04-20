import { ConfirmDialog } from './confirm-dialog';

interface DestructiveConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  pending?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function DestructiveConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Удалить',
  cancelLabel = 'Отмена',
  pending = false,
  onCancel,
  onConfirm,
}: DestructiveConfirmDialogProps) {
  return (
    <ConfirmDialog
      open={open}
      title={title}
      subtitle="Это действие нельзя отменить."
      description={description}
      confirmLabel={confirmLabel}
      cancelLabel={cancelLabel}
      danger
      pending={pending}
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  );
}
