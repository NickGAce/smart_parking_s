import { Card, CardContent, Grid, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';

import { analyticsApi } from '../entities/analytics/api';
import { PageState } from '../shared/ui/page-state';

export function DashboardPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['analytics-summary'],
    queryFn: analyticsApi.getSummary,
  });

  return (
    <>
      <Typography variant="h4" gutterBottom>
        Analytics dashboard
      </Typography>
      <PageState isLoading={isLoading} errorText={error ? 'Не удалось загрузить аналитику.' : undefined} />
      {data && (
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 4 }}>
            <Card><CardContent><Typography>Occupancy: {(data.occupancy_rate * 100).toFixed(1)}%</Typography></CardContent></Card>
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <Card><CardContent><Typography>Bookings: {data.bookings_count}</Typography></CardContent></Card>
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <Card><CardContent><Typography>No-show: {(data.no_show_rate * 100).toFixed(1)}%</Typography></CardContent></Card>
          </Grid>
        </Grid>
      )}
    </>
  );
}
