import DoneOutlinedIcon from '@mui/icons-material/DoneOutlined';
import {
  Box,
  Stack,
  Button,
  Paper,
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
import { notificationStatusMap } from '../shared/config/status-map';
import { EmptyState } from '../shared/ui/empty-state';
import { ErrorState } from '../shared/ui/error-state';
import { FiltersToolbar } from '../shared/ui/filters-toolbar';
import { PaginationControls } from '../shared/ui/pagination-controls';
import { StateFeedback } from '../shared/ui/state-feedback';
import { StatusChip } from '../shared/ui/status-chip';
import { TableLoadingState } from '../shared/ui/table-loading-state';
import type { NotificationStatus } from '../shared/types/common';

const ROWS_PER_PAGE_OPTIONS = [5, 10, 20];
const DEFAULT_ROWS_PER_PAGE = 10;

type FilterValue = NotificationStatus | 'all';

function formatTimestamp(dateTime: string) {
  return new Date(dateTime).toLocaleString('ru-RU');
}

const filterLabelMap: Record<FilterValue, string> = {
  all: 'Все',
  unread: 'Не прочитано',
  read: 'Прочитано',
};

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
      <StateFeedback severity="info">
        Уведомления обновляются при каждом запросе страницы. Если ожидаете новое событие, обновите список.
      </StateFeedback>

      <FiltersToolbar direction={{ xs: 'column', sm: 'row' }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="space-between" alignItems={{ sm: 'center' }}>
          <ToggleButtonGroup size="small" color="primary" value={filter} exclusive onChange={onFilterChange}>
            <ToggleButton value="all">Все</ToggleButton>
            <ToggleButton value="unread">Не прочитано</ToggleButton>
            <ToggleButton value="read">Прочитано</ToggleButton>
          </ToggleButtonGroup>
          <Typography color="text.secondary" variant="body2">
            {filter === 'all' ? `Всего уведомлений: ${totalItems}` : `Фильтр: ${filterLabelMap[filter]}`}
          </Typography>
        </Stack>
      </FiltersToolbar>

      {listQuery.isLoading && <TableLoadingState rows={5} columns={4} />}

      {listQuery.isError && (
        <ErrorState message="Не удалось загрузить уведомления. Обновите страницу или проверьте подключение." onRetry={() => listQuery.refetch()} />
      )}

      {!listQuery.isLoading && !listQuery.isError && items.length === 0 && (
        <Paper>
          <EmptyState
            kind="no-results"
            title="Уведомления не найдены"
            description="Попробуйте изменить фильтр или вернитесь позже — новые события появятся автоматически."
          />
        </Paper>
      )}

      {!listQuery.isLoading && !listQuery.isError && items.length > 0 && (
        <Paper>
          <Stack spacing={0}>
            {unreadItems.length > 0 && (
              <Box sx={{ px: 2, py: 1, borderBottom: 1, borderColor: 'divider', bgcolor: 'warning.50' }}>
                <Typography variant="subtitle2" color="warning.dark">
                  Требуют внимания
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
                    <Stack direction="row" spacing={1} alignItems="center">
                      <StatusChip status={item.status} mapping={notificationStatusMap} variant="outlined" />
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
                      Отметить как прочитанное
                    </Button>
                  </Box>
                </Stack>
              </Box>
            ))}

            {readItems.length > 0 && (
              <Box sx={{ px: 2, py: 1, borderBottom: unreadItems.length === 0 ? 1 : 0, borderColor: 'divider', bgcolor: 'surface.overlay' }}>
                <Typography variant="subtitle2" color="text.secondary">
                  История
                </Typography>
              </Box>
            )}
            {readItems.map((item) => (
              <Box key={item.id} sx={{ px: 2, py: 1.5, borderTop: 1, borderColor: 'divider', opacity: 0.88 }}>
                <Stack spacing={1}>
                  <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1}>
                    <Typography variant="subtitle1">{item.title}</Typography>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <StatusChip status={item.status} mapping={notificationStatusMap} variant="outlined" />
                      <Typography variant="caption" color="text.secondary">{formatTimestamp(item.created_at)}</Typography>
                    </Stack>
                  </Stack>
                  <Typography color="text.secondary">{item.message}</Typography>
                </Stack>
              </Box>
            ))}
          </Stack>
          <PaginationControls
            count={totalItems}
            page={page}
            rowsPerPage={rowsPerPage}
            onPageChange={setPage}
            onRowsPerPageChange={(nextRows) => {
              setRowsPerPage(nextRows);
              setPage(0);
            }}
            rowsPerPageOptions={ROWS_PER_PAGE_OPTIONS}
          />
        </Paper>
      )}
    </Stack>
  );
}
