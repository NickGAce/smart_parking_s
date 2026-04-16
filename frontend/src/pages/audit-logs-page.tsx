import {
  Alert,
  Box,
  Chip,
  Grid,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { useMemo, useState } from 'react';

import { useAuditLogsQuery } from '../features/audit/use-audit-logs-query';
import { ApiErrorAlert } from '../shared/ui/api-error-alert';
import { FiltersToolbar } from '../shared/ui/filters-toolbar';
import { LoadingState } from '../shared/ui/loading-state';
import { PaginationControls } from '../shared/ui/pagination-controls';
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
  return new Date(dateTime).toLocaleString();
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

  const query = useMemo<AuditLogsQuery>(() => ({
    actor_user_id: actor ? Number(actor) : undefined,
    action_type: cleanString(action),
    entity_type: cleanString(entity),
    from: cleanString(from),
    to: cleanString(to),
    limit: rowsPerPage,
    offset: page * rowsPerPage,
  }), [action, actor, entity, from, page, rowsPerPage, to]);

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
      <Alert severity="info">
        Админ-экран интегрирован напрямую с <code>GET /audit-logs</code>: фильтры actor/action/entity,
        time range и пагинация выполняются сервером.
      </Alert>

      <FiltersToolbar onReset={clearFilters}>
        <Grid container spacing={2}>
          <Grid item xs={12} md={2}>
            <TextField
              label="Actor (user_id)"
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
              label="Action"
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
              label="Entity"
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
              label="From"
              type="datetime-local"
              size="small"
              fullWidth
              value={from}
              onChange={(event) => {
                setFrom(event.target.value);
                setPage(0);
              }}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={12} md={2}>
            <TextField
              label="To"
              type="datetime-local"
              size="small"
              fullWidth
              value={to}
              onChange={(event) => {
                setTo(event.target.value);
                setPage(0);
              }}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
        </Grid>
      </FiltersToolbar>

      {listQuery.isError && (
        <ApiErrorAlert message="Не удалось загрузить audit logs. Проверьте фильтры и права admin." />
      )}

      {listQuery.isLoading && (
        <LoadingState message="Загрузка audit logs..." />
      )}

      {listQuery.data && (
        <Paper>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>ID</TableCell>
                <TableCell>Timestamp</TableCell>
                <TableCell>Actor</TableCell>
                <TableCell>Action</TableCell>
                <TableCell>Entity</TableCell>
                <TableCell>Changes</TableCell>
                <TableCell>Metadata</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {listQuery.data.items.map((log) => (
                <TableRow key={log.id} hover>
                  <TableCell>{log.id}</TableCell>
                  <TableCell>{formatTimestamp(log.timestamp)}</TableCell>
                  <TableCell>{log.actor_user_id ?? 'system'}</TableCell>
                  <TableCell>
                    <Chip label={log.action_type} size="small" color={actionTone(log.action_type)} />
                  </TableCell>
                  <TableCell>
                    <Stack spacing={0.5}>
                      <Typography variant="body2">{log.entity_type}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        entity_id: {log.entity_id ?? '—'}
                      </Typography>
                    </Stack>
                  </TableCell>
                  <TableCell sx={{ maxWidth: 280 }}>
                    <Stack spacing={1}>
                      <Box>
                        <Typography variant="caption" color="text.secondary">old_values</Typography>
                        <Box
                          component="pre"
                          sx={{ m: 0, mt: 0.5, p: 1, bgcolor: 'grey.100', borderRadius: 1, overflowX: 'auto' }}
                        >
                          {formatValue(log.old_values)}
                        </Box>
                      </Box>
                      <Box>
                        <Typography variant="caption" color="text.secondary">new_values</Typography>
                        <Box
                          component="pre"
                          sx={{ m: 0, mt: 0.5, p: 1, bgcolor: 'grey.100', borderRadius: 1, overflowX: 'auto' }}
                        >
                          {formatValue(log.new_values)}
                        </Box>
                      </Box>
                    </Stack>
                  </TableCell>
                  <TableCell sx={{ maxWidth: 220 }}>
                    <Box
                      component="pre"
                      sx={{ m: 0, p: 1, bgcolor: 'grey.100', borderRadius: 1, overflowX: 'auto' }}
                    >
                      {formatValue(log.source_metadata)}
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

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
