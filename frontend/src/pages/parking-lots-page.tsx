import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import {
  Alert,
  Box,
  Button,
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
  Typography,
} from '@mui/material';
import { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';

import { useCurrentUser } from '../features/auth/use-current-user';
import { parkingApiErrorMessage } from '../features/parking-lots/error-messages';
import { useCreateParkingLotMutation, useParkingLotsQuery } from '../features/parking-lots/hooks';
import { ParkingLotForm } from '../features/parking-lots/parking-lot-form';
import { accessModeLabels } from '../shared/config/display-labels';
import { MANAGEMENT_ROLES, hasRole } from '../shared/config/roles';
import { EmptyState } from '../shared/ui/empty-state';
import { FiltersToolbar } from '../shared/ui/filters-toolbar';
import { LoadingState } from '../shared/ui/loading-state';
import { PageContentLayout } from '../shared/ui/page-content-layout';
import { PaginationControls } from '../shared/ui/pagination-controls';
import { PageSection } from '../shared/ui/page-section';
import { StatusChip } from '../shared/ui/status-chip';
import type { SortOrder } from '../shared/types/common';
import type { ParkingLotsQuery } from '../shared/types/parking';

const sortByOptions: NonNullable<ParkingLotsQuery['sort_by']>[] = ['id', 'name', 'total_spots'];
const sortByLabels: Record<(typeof sortByOptions)[number], string> = {
  id: 'Идентификатор',
  name: 'Название',
  total_spots: 'Количество мест',
};

export function ParkingLotsPage() {
  const { role } = useCurrentUser();
  const [query, setQuery] = useState<ParkingLotsQuery>({ limit: 10, offset: 0, sort_by: 'name', sort_order: 'asc' });
  const [createOpen, setCreateOpen] = useState(false);

  const canManage = hasRole(role, MANAGEMENT_ROLES);
  const lotsQuery = useParkingLotsQuery(query);
  const createMutation = useCreateParkingLotMutation();

  return (
    <PageContentLayout>
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
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel id="sort-by-label">Сортировать по</InputLabel>
            <Select
              labelId="sort-by-label"
              label="Сортировать по"
              value={query.sort_by ?? 'name'}
              onChange={(e) => setQuery((prev) => ({ ...prev, sort_by: e.target.value as ParkingLotsQuery['sort_by'], offset: 0 }))}
            >
              {sortByOptions.map((option) => (
                <MenuItem key={option} value={option}>
                  {sortByLabels[option]}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel id="sort-order-label">Порядок</InputLabel>
            <Select
              labelId="sort-order-label"
              label="Порядок"
              value={query.sort_order ?? 'asc'}
              onChange={(e) => setQuery((prev) => ({ ...prev, sort_order: e.target.value as SortOrder, offset: 0 }))}
            >
              <MenuItem value="asc">По возрастанию</MenuItem>
              <MenuItem value="desc">По убыванию</MenuItem>
            </Select>
          </FormControl>
        </Stack>
      </FiltersToolbar>

      {lotsQuery.isLoading && <LoadingState message="Загрузка парковок..." />}
      {lotsQuery.isError && <Alert severity="error">{parkingApiErrorMessage(lotsQuery.error, 'Не удалось загрузить список парковок.')}</Alert>}

      {lotsQuery.data && lotsQuery.data.items.length === 0 && (
        <PageSection>
          <EmptyState title="Парковки не найдены" description="Создайте первую парковку или измените параметры списка." />
        </PageSection>
      )}

      {lotsQuery.data && lotsQuery.data.items.length > 0 && (
        <PageSection title="Список парковок" subtitle="Операционный список с быстрым доступом к просмотру и редактированию.">
          <Box sx={{ display: { xs: 'none', md: 'block' } }}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>ID</TableCell>
                  <TableCell>Название</TableCell>
                  <TableCell>Адрес</TableCell>
                  <TableCell>Мест</TableCell>
                  <TableCell>Режим доступа</TableCell>
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
                    <TableCell>
                      <StatusChip
                        status={lot.access_mode}
                        mapping={{ [lot.access_mode]: { label: accessModeLabels[lot.access_mode], color: 'default' } }}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Button component={RouterLink} to={`/parking-lots/${lot.id}`} startIcon={<VisibilityOutlinedIcon />} size="small">
                        Открыть
                      </Button>
                      <Button
                        component={RouterLink}
                        to={`/parking-lots/${lot.id}?mode=edit`}
                        startIcon={<EditOutlinedIcon />}
                        size="small"
                        disabled={!canManage}
                      >
                        Редактировать
                      </Button>
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
          </Box>

          <Stack sx={{ display: { xs: 'flex', md: 'none' } }} spacing={1.5}>
            {lotsQuery.data.items.map((lot) => (
              <Box key={lot.id} sx={{ border: 1, borderColor: 'border.subtle', borderRadius: 3, p: 2, bgcolor: 'background.paper' }}>
                <Stack spacing={1}>
                  <Typography variant="h6">{lot.name}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {lot.address}
                  </Typography>
                  <Typography variant="body2">Мест: {lot.total_spots}</Typography>
                  <StatusChip
                    status={lot.access_mode}
                    mapping={{ [lot.access_mode]: { label: accessModeLabels[lot.access_mode], color: 'default' } }}
                  />
                  <Stack direction="row" spacing={1}>
                    <Button component={RouterLink} to={`/parking-lots/${lot.id}`} size="small">
                      Открыть
                    </Button>
                    <Button component={RouterLink} to={`/parking-lots/${lot.id}?mode=edit`} size="small" disabled={!canManage}>
                      Редактировать
                    </Button>
                  </Stack>
                </Stack>
              </Box>
            ))}
          </Stack>
        </PageSection>
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
    </PageContentLayout>
  );
}
