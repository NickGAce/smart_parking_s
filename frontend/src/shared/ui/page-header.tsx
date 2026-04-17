import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import { Breadcrumbs, Stack, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';

interface Crumb {
  label: string;
  to?: string;
}

export function PageHeader({ title, breadcrumbs }: { title: string; breadcrumbs: Crumb[] }) {
  return (
    <Stack spacing={1.5} mb={3}>
      <Breadcrumbs separator={<NavigateNextIcon fontSize="small" />} aria-label="Навигация по разделам">
        {breadcrumbs.map((crumb) =>
          crumb.to ? (
            <Typography
              key={`${crumb.label}-${crumb.to}`}
              component={RouterLink}
              to={crumb.to}
              variant="body2"
              color="text.secondary"
              sx={{ textDecoration: 'none' }}
            >
              {crumb.label}
            </Typography>
          ) : (
            <Typography key={crumb.label} variant="body2" color="text.primary">
              {crumb.label}
            </Typography>
          ),
        )}
      </Breadcrumbs>
      <Typography variant="h4">{title}</Typography>
    </Stack>
  );
}
