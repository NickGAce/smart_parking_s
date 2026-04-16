import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Paper,
  Typography,
} from '@mui/material';
import { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';

import { parkingApiErrorMessage } from '../features/parking-lots/error-messages';
import { useCreateParkingLotMutation, useParkingLotsQuery } from '../features/parking-lots/hooks';
import { ParkingLotForm } from '../features/parking-lots/parking-lot-form';
import { useCurrentUser } from '../features/auth/use-current-user';
import { FiltersToolbar } from '../shared/ui/filters-toolbar';
import { LoadingState } from '../shared/ui/loading-state';
import { PaginationControls } from '../shared/ui/pagination-controls';
import { StatusChip } from '../shared/ui/status-chip';
import type { SortOrder } from '../shared/types/common';
import type { ParkingLotsQuery } from '../shared/types/parking';

const sortByOptions: NonNullable<ParkingLotsQuery['sort_by']>[] = ['id', 'name', 'total_spots'];

export function ParkingLotsPage() {
  const { role } = useCurrentUser();
  const [query, setQuery] = useState<ParkingLotsQuery>({ limit: 10, offset: 0, sort_by: 'name', sort_order: 'asc' });
  const [createOpen, setCreateOpen] = useState(false);

  const canManage = role === 'admin' || role === 'owner';
  const lotsQuery = useParkingLotsQuery(query);
  const createMutation = useCreateParkingLotMutation();

  return (
    <Stack spacing={2}>
      {!canManage && (
        <Alert severity="info">Режим только чтение для вашей роли. Просмотр разрешен, управление отключено.</Alert>
      )}

      <FiltersToolbar
        actions={(
          <Button startIcon={<AddCircleOutlineIcon />} variant="contained" disabled={!canManage} onClick={() => setCreateOpen(true)}>
            Создать парковку
          </Button>
        )}
      >
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={2}>
          <Stack direction="row" spacing={2}>
            <FormControl size="small" sx={{ minWidth: 140 }}>
              <InputLabel id="sort-by-label">Sort by</InputLabel>
              <Select
                labelId="sort-by-label"
                label="Sort by"
                value={query.sort_by ?? 'name'}
                onChange={(e) => setQuery((prev) => ({ ...prev, sort_by: e.target.value as ParkingLotsQuery['sort_by'], offset: 0 }))}
              >
                {sortByOptions.map((option) => <MenuItem key={option} value={option}>{option}</MenuItem>)}
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 140 }}>
              <InputLabel id="sort-order-label">Sort order</InputLabel>
              <Select
                labelId="sort-order-label"
                label="Sort order"
                value={query.sort_order ?? 'asc'}
                onChange={(e) => setQuery((prev) => ({ ...prev, sort_order: e.target.value as SortOrder, offset: 0 }))}
              >
                <MenuItem value="asc">asc</MenuItem>
                <MenuItem value="desc">desc</MenuItem>
              </Select>
            </FormControl>
          </Stack>
        </Stack>
      </FiltersToolbar>

      {lotsQuery.isLoading && <LoadingState message="Загрузка парковок..." />}
      {lotsQuery.isError && <Alert severity="error">{parkingApiErrorMessage(lotsQuery.error, 'Не удалось загрузить список парковок.')}</Alert>}

      {lotsQuery.data && lotsQuery.data.items.length === 0 && (
        <Paper sx={{ p: 4 }}>
          <Typography variant="h6">Парковки не найдены</Typography>
          <Typography color="text.secondary">Создайте первую парковку или измените параметры списка.</Typography>
        </Paper>
      )}

      {lotsQuery.data && lotsQuery.data.items.length > 0 && (
        <>
          <Paper sx={{ display: { xs: 'none', md: 'block' } }}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>ID</TableCell>
                  <TableCell>Название</TableCell>
                  <TableCell>Адрес</TableCell>
                  <TableCell>Мест</TableCell>
                  <TableCell>Access mode</TableCell>
                  <TableCell align="right">Действия</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {lotsQuery.data.items.map((lot) => (
                  <TableRow key={lot.id}>
                    <TableCell>{lot.id}</TableCell>
                    <TableCell>{lot.name}</TableCell>
                    <TableCell>{lot.address}</TableCell>
                    <TableCell>{lot.total_spots}</TableCell>
                    <TableCell><StatusChip status={lot.access_mode} mapping={{ [lot.access_mode]: { label: lot.access_mode, color: 'default' } }} /></TableCell>
                    <TableCell align="right">
                      <Button component={RouterLink} to={`/parking-lots/${lot.id}`} startIcon={<VisibilityOutlinedIcon />} size="small">Открыть</Button>
                      <Button component={RouterLink} to={`/parking-lots/${lot.id}?mode=edit`} startIcon={<EditOutlinedIcon />} size="small" disabled={!canManage}>Редактировать</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <PaginationControls
              count={lotsQuery.data.meta.total}
              page={Math.floor(lotsQuery.data.meta.offset / lotsQuery.data.meta.limit)}
              rowsPerPage={lotsQuery.data.meta.limit}
              onPageChange={(page) => setQuery((prev) => ({ ...prev, offset: page * (prev.limit ?? 10) }))}
              onRowsPerPageChange={(rowsPerPage) => setQuery((prev) => ({ ...prev, limit: rowsPerPage, offset: 0 }))}
            />
          </Paper>

          <Stack sx={{ display: { xs: 'flex', md: 'none' } }} spacing={1.5}>
            {lotsQuery.data.items.map((lot) => (
              <Card key={lot.id}>
                <CardContent>
                  <Stack spacing={1}>
                    <Typography variant="h6">{lot.name}</Typography>
                    <Typography variant="body2" color="text.secondary">{lot.address}</Typography>
                    <Typography variant="body2">Мест: {lot.total_spots}</Typography>
                    <StatusChip status={lot.access_mode} mapping={{ [lot.access_mode]: { label: lot.access_mode, color: 'default' } }} />
                    <Stack direction="row" spacing={1}>
                      <Button component={RouterLink} to={`/parking-lots/${lot.id}`} size="small">Открыть</Button>
                      <Button component={RouterLink} to={`/parking-lots/${lot.id}?mode=edit`} size="small" disabled={!canManage}>Редактировать</Button>
                    </Stack>
                  </Stack>
                </CardContent>
              </Card>
            ))}
          </Stack>
        </>
      )}

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Создание парковки</DialogTitle>
        <DialogContent>
          <Box mt={1}>
            <ParkingLotForm
              title="Новая парковка"
              submitLabel="Создать"
              disabled={createMutation.isPending}
              readOnly={!canManage}
              serverError={createMutation.isError ? parkingApiErrorMessage(createMutation.error, 'Не удалось создать парковку.') : null}
              onSubmit={(payload) => createMutation.mutate(payload, { onSuccess: () => setCreateOpen(false) })}
            />
          </Box>
        </DialogContent>
      </Dialog>
    </Stack>
  );
}
