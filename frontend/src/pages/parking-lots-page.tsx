import { Paper, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';

import { useParkingLotsQuery } from '../features/parking-lots/use-parking-lots-query';
import { PageState } from '../shared/ui/page-state';

export function ParkingLotsPage() {
  const { data, isLoading, error } = useParkingLotsQuery();

  return (
    <>
      <Typography variant="h4" gutterBottom>Parking lots</Typography>
      <PageState
        isLoading={isLoading}
        errorText={error ? 'Не удалось загрузить парковки.' : undefined}
        isEmpty={!isLoading && !error && (data?.items.length ?? 0) === 0}
        emptyText="Нет парковок для отображения."
      />
      {data && data.items.length > 0 && (
        <Paper>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>ID</TableCell><TableCell>Name</TableCell><TableCell>Access mode</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.items.map((lot) => (
                <TableRow key={lot.id}>
                  <TableCell>{lot.id}</TableCell><TableCell>{lot.name}</TableCell><TableCell>{lot.access_mode}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      )}
    </>
  );
}
