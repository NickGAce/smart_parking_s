import { Chip, Paper, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';

import { useParkingSpotsQuery } from '../features/parking-spots/use-parking-spots-query';
import { PageState } from '../shared/ui/page-state';

export function ParkingSpotsPage() {
  const { data, isLoading, error } = useParkingSpotsQuery();

  return (
    <>
      <Typography variant="h4" gutterBottom>Parking spots</Typography>
      <PageState
        isLoading={isLoading}
        errorText={error ? 'Не удалось загрузить парковочные места.' : undefined}
        isEmpty={!isLoading && !error && (data?.items.length ?? 0) === 0}
        emptyText="Нет доступных мест."
      />
      {data && data.items.length > 0 && (
        <Paper>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>#</TableCell><TableCell>Lot</TableCell><TableCell>Type</TableCell><TableCell>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.items.map((spot) => (
                <TableRow key={spot.id}>
                  <TableCell>{spot.spot_number}</TableCell>
                  <TableCell>{spot.parking_lot_id}</TableCell>
                  <TableCell>{spot.spot_type}</TableCell>
                  <TableCell><Chip label={spot.effective_status} size="small" /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      )}
    </>
  );
}
