import {
  Box,
  Chip,
  Grid,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { useDeferredValue, useMemo, useState } from 'react';

import { useAuditLogsQuery } from '../features/audit/use-audit-logs-query';
import { DATE_TIME_INPUT_PROPS } from '../shared/config/date-time-input';
import { EmptyState } from '../shared/ui/empty-state';
import { ErrorState } from '../shared/ui/error-state';
import { FiltersToolbar } from '../shared/ui/filters-toolbar';
import { PaginationControls } from '../shared/ui/pagination-controls';
import { StateFeedback } from '../shared/ui/state-feedback';
import { TableLoadingState } from '../shared/ui/table-loading-state';
import { tableCodeBlockSx } from '../shared/theme/semantic-sx';
import type { AuditLogsQuery } from '../shared/types/audit';

const DEFAULT_LIMIT = 10;
const ROW_OPTIONS = [5, 10, 20, 50];

function cleanString(value: string) {
  const normalized = value.trim();
  return normalized.length === 0 ? undefined : normalized;
}

function formatValue(value: unknown) {
  if (value === null || value === undefined) {
    return '—';
  }

  if (typeof value === 'object') {
    return JSON.stringify(value, null, 2);
  }

  return String(value);
}

function formatTimestamp(dateTime: string) {
  return new Date(dateTime).toLocaleString('ru-RU');
}

function actionTone(action: string): 'default' | 'success' | 'warning' {
  const normalized = action.toLowerCase();

  if (normalized.includes('create')) {
    return 'success';
  }

  if (normalized.includes('delete')) {
    return 'warning';
  }

  return 'default';
}

export function AuditLogsPage() {
  const [actor, setActor] = useState('');
  const [action, setAction] = useState('');
  const [entity, setEntity] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(DEFAULT_LIMIT);
  const deferredActor = useDeferredValue(actor);
  const deferredAction = useDeferredValue(action);
  const deferredEntity = useDeferredValue(entity);
  const deferredFrom = useDeferredValue(from);
  const deferredTo = useDeferredValue(to);

  const query = useMemo<AuditLogsQuery>(() => ({
    actor_user_id: deferredActor ? Number(deferredActor) : undefined,
    action_type: cleanString(deferredAction),
    entity_type: cleanString(deferredEntity),
    from: cleanString(deferredFrom),
    to: cleanString(deferredTo),
    limit: rowsPerPage,
    offset: page * rowsPerPage,
  }), [deferredAction, deferredActor, deferredEntity, deferredFrom, deferredTo, page, rowsPerPage]);

  const listQuery = useAuditLogsQuery(query);

  const clearFilters = () => {
    setActor('');
    setAction('');
    setEntity('');
    setFrom('');
    setTo('');
    setPage(0);
  };

  const totalRows = listQuery.data?.meta.total ?? 0;

  return (
    <Stack spacing={2}>
      <StateFeedback severity="info">
        Журнал изменений показывает действия пользователей и системные изменения. Используйте фильтры, чтобы быстро найти нужный эпизод.
      </StateFeedback>

      <FiltersToolbar onReset={clearFilters}>
        <Grid container spacing={2}>
          <Grid item xs={12} md={2}>
            <TextField
              label="ID пользователя"
              type="number"
              size="small"
              fullWidth
              value={actor}
              onChange={(event) => {
                setActor(event.target.value);
                setPage(0);
              }}
            />
          </Grid>
          <Grid item xs={12} md={2}>
            <TextField
              label="Действие"
              size="small"
              fullWidth
              value={action}
              onChange={(event) => {
                setAction(event.target.value);
                setPage(0);
              }}
            />
          </Grid>
          <Grid item xs={12} md={2}>
            <TextField
              label="Сущность"
              size="small"
              fullWidth
              value={entity}
              onChange={(event) => {
                setEntity(event.target.value);
                setPage(0);
              }}
            />
          </Grid>
          <Grid item xs={12} md={2}>
            <TextField
              label="С"
              type="datetime-local"
              size="small"
              fullWidth
              value={from}
              onChange={(event) => {
                setFrom(event.target.value);
                setPage(0);
              }}
              InputLabelProps={{ shrink: true }}
              inputProps={DATE_TIME_INPUT_PROPS}
            />
          </Grid>
          <Grid item xs={12} md={2}>
            <TextField
              label="По"
              type="datetime-local"
              size="small"
              fullWidth
              value={to}
              onChange={(event) => {
                setTo(event.target.value);
                setPage(0);
              }}
              InputLabelProps={{ shrink: true }}
              inputProps={DATE_TIME_INPUT_PROPS}
            />
          </Grid>
        </Grid>
      </FiltersToolbar>

      {listQuery.isError && (
        <ErrorState message="Не удалось загрузить журнал аудита. Проверьте фильтры и повторите попытку." onRetry={() => listQuery.refetch()} />
      )}

      {listQuery.isLoading && <TableLoadingState rows={8} columns={7} />}

      {listQuery.data && listQuery.data.items.length === 0 && (
        <Paper>
          <EmptyState
            kind="no-results"
            title="Записи не найдены"
            description="По выбранным фильтрам журнал пуст. Измените параметры поиска или период."
          />
        </Paper>
      )}

      {listQuery.data && listQuery.data.items.length > 0 && (
        <Paper>
          <TableContainer sx={{ overflowX: 'auto' }}>
            <Table size="small" aria-label="Журнал аудита" sx={{ minWidth: 1080 }}>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ position: 'sticky', top: 0, zIndex: 2, bgcolor: 'action.hover' }}>ID</TableCell>
                  <TableCell sx={{ position: 'sticky', top: 0, zIndex: 2, bgcolor: 'action.hover' }}>Время</TableCell>
                  <TableCell sx={{ position: 'sticky', top: 0, zIndex: 2, bgcolor: 'action.hover' }}>Пользователь</TableCell>
                  <TableCell sx={{ position: 'sticky', top: 0, zIndex: 2, bgcolor: 'action.hover' }}>Действие</TableCell>
                  <TableCell sx={{ position: 'sticky', top: 0, zIndex: 2, bgcolor: 'action.hover' }}>Сущность</TableCell>
                  <TableCell sx={{ position: 'sticky', top: 0, zIndex: 2, bgcolor: 'action.hover' }}>Изменения</TableCell>
                  <TableCell sx={{ position: 'sticky', top: 0, zIndex: 2, bgcolor: 'action.hover' }}>Метаданные</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {listQuery.data.items.map((log) => (
                  <TableRow key={log.id} hover>
                    <TableCell>{log.id}</TableCell>
                    <TableCell>{formatTimestamp(log.timestamp)}</TableCell>
                    <TableCell>{log.actor_user_id ?? 'система'}</TableCell>
                    <TableCell>
                      <Chip label={log.action_type} size="small" color={actionTone(log.action_type)} />
                    </TableCell>
                    <TableCell>
                      <Stack spacing={0.5}>
                        <Typography variant="body2">{log.entity_type}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          ID сущности: {log.entity_id ?? '—'}
                        </Typography>
                      </Stack>
                    </TableCell>
                    <TableCell sx={{ maxWidth: 280 }}>
                      <Stack spacing={1}>
                        <Box>
                          <Typography variant="caption" color="text.secondary">Старые значения</Typography>
                          <Box component="pre" sx={tableCodeBlockSx}>{formatValue(log.old_values)}</Box>
                        </Box>
                        <Box>
                          <Typography variant="caption" color="text.secondary">Новые значения</Typography>
                          <Box component="pre" sx={tableCodeBlockSx}>{formatValue(log.new_values)}</Box>
                        </Box>
                      </Stack>
                    </TableCell>
                    <TableCell sx={{ maxWidth: 220 }}>
                      <Box component="pre" sx={tableCodeBlockSx}>{formatValue(log.source_metadata)}</Box>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          <PaginationControls
            count={totalRows}
            page={page}
            rowsPerPage={rowsPerPage}
            onPageChange={setPage}
            onRowsPerPageChange={(nextRows) => {
              setRowsPerPage(nextRows);
              setPage(0);
            }}
            rowsPerPageOptions={ROW_OPTIONS}
          />
        </Paper>
      )}
    </Stack>
  );
}
