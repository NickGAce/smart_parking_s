import DoneOutlinedIcon from '@mui/icons-material/DoneOutlined';
import {
  Alert,
  Box,
  Button,
  Chip,
  Paper,
  Stack,
  TablePagination,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { useState } from 'react';
import type { MouseEvent } from 'react';

import {
  useMarkNotificationReadMutation,
  useNotificationsQuery,
} from '../features/notifications/use-notifications-query';
import { EmptyState } from '../shared/ui/empty-state';
import { ErrorState } from '../shared/ui/error-state';
import type { NotificationStatus } from '../shared/types/common';

const ROWS_PER_PAGE_OPTIONS = [5, 10, 20];
const DEFAULT_ROWS_PER_PAGE = 10;

type FilterValue = NotificationStatus | 'all';

function formatTimestamp(dateTime: string) {
  return new Date(dateTime).toLocaleString();
}

function getStatusTone(status: NotificationStatus) {
  return status === 'unread' ? 'warning' : 'default';
}

export function NotificationsPage() {
  const [filter, setFilter] = useState<FilterValue>('all');
  const [rowsPerPage, setRowsPerPage] = useState(DEFAULT_ROWS_PER_PAGE);
  const [page, setPage] = useState(0);
  const queryStatus = filter === 'all' ? undefined : filter;
  const queryOffset = page * rowsPerPage;
  const listQuery = useNotificationsQuery({
    status: queryStatus,
    limit: rowsPerPage,
    offset: queryOffset,
  });
  const markReadMutation = useMarkNotificationReadMutation();

  const items = listQuery.data?.items ?? [];
  const unreadItems = items.filter((item) => item.status === 'unread');
  const readItems = items.filter((item) => item.status === 'read');
  const totalItems = listQuery.data?.meta.total ?? 0;

  const onFilterChange = (_: MouseEvent<HTMLElement>, value: FilterValue | null) => {
    if (!value) return;
    setFilter(value);
    setPage(0);
  };

  return (
    <Stack spacing={2}>
      <Alert severity="info">
        Inbox интегрирован через GET /notifications и PATCH /notifications/{'{notification_id}'}/read.
        Realtime канал отсутствует, поэтому используется polling.
      </Alert>

      <Paper sx={{ p: 2 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="space-between" alignItems={{ sm: 'center' }}>
          <ToggleButtonGroup size="small" color="primary" value={filter} exclusive onChange={onFilterChange}>
            <ToggleButton value="all">all</ToggleButton>
            <ToggleButton value="unread">unread</ToggleButton>
            <ToggleButton value="read">read</ToggleButton>
          </ToggleButtonGroup>
          <Typography color="text.secondary" variant="body2">
            {filter === 'all' ? `Всего уведомлений: ${totalItems}` : `Фильтр: ${filter}`}
          </Typography>
        </Stack>
      </Paper>

      {listQuery.isLoading && (
        <Paper sx={{ p: 2 }}>
          <Typography color="text.secondary">Загружаем уведомления...</Typography>
        </Paper>
      )}

      {listQuery.isError && (
        <ErrorState message="Не удалось загрузить inbox уведомлений. Попробуйте обновить страницу." />
      )}

      {!listQuery.isLoading && !listQuery.isError && items.length === 0 && (
        <Paper>
          <EmptyState
            title="Уведомлений пока нет"
            description="Когда backend отправит события, они появятся в этом inbox. Пока список пуст."
          />
        </Paper>
      )}

      {!listQuery.isLoading && !listQuery.isError && items.length > 0 && (
        <Paper>
          <Stack spacing={0}>
            {unreadItems.length > 0 && (
              <Box sx={{ px: 2, py: 1, borderBottom: 1, borderColor: 'divider', bgcolor: 'warning.50' }}>
                <Typography variant="subtitle2" color="warning.dark">
                  Unread
                </Typography>
              </Box>
            )}
            {unreadItems.map((item) => (
              <Box
                key={item.id}
                sx={{
                  px: 2,
                  py: 1.5,
                  borderBottom: 1,
                  borderColor: 'divider',
                  bgcolor: 'warning.50',
                }}
              >
                <Stack spacing={1}>
                  <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1}>
                    <Typography variant="subtitle1" fontWeight={700}>{item.title}</Typography>
                    <Stack direction="row" spacing={1}>
                      <Chip label={item.status} color={getStatusTone(item.status)} size="small" />
                      <Typography variant="caption" color="text.secondary">{formatTimestamp(item.created_at)}</Typography>
                    </Stack>
                  </Stack>
                  <Typography>{item.message}</Typography>
                  <Box>
                    <Button
                      size="small"
                      startIcon={<DoneOutlinedIcon />}
                      disabled={markReadMutation.isPending}
                      onClick={() => markReadMutation.mutate(item.id)}
                    >
                      Mark as read
                    </Button>
                  </Box>
                </Stack>
              </Box>
            ))}

            {readItems.length > 0 && (
              <Box sx={{ px: 2, py: 1, borderBottom: unreadItems.length === 0 ? 1 : 0, borderColor: 'divider', bgcolor: 'grey.100' }}>
                <Typography variant="subtitle2" color="text.secondary">
                  Read
                </Typography>
              </Box>
            )}
            {readItems.map((item) => (
              <Box key={item.id} sx={{ px: 2, py: 1.5, borderTop: 1, borderColor: 'divider', opacity: 0.84 }}>
                <Stack spacing={1}>
                  <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1}>
                    <Typography variant="subtitle1">{item.title}</Typography>
                    <Stack direction="row" spacing={1}>
                      <Chip label={item.status} color={getStatusTone(item.status)} size="small" />
                      <Typography variant="caption" color="text.secondary">{formatTimestamp(item.created_at)}</Typography>
                    </Stack>
                  </Stack>
                  <Typography color="text.secondary">{item.message}</Typography>
                </Stack>
              </Box>
            ))}
          </Stack>
          <TablePagination
            component="div"
            count={totalItems}
            page={page}
            rowsPerPage={rowsPerPage}
            onPageChange={(_, nextPage) => setPage(nextPage)}
            onRowsPerPageChange={(event) => {
              setRowsPerPage(Number(event.target.value));
              setPage(0);
            }}
            rowsPerPageOptions={ROWS_PER_PAGE_OPTIONS}
          />
        </Paper>
      )}
    </Stack>
  );
}
