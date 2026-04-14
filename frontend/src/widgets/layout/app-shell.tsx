import { AppBar, Box, Button, Container, Stack, Toolbar, Typography } from '@mui/material';
import { Link as RouterLink, Outlet } from 'react-router-dom';

import { useAuth } from '../../app/providers/auth-provider';

const links = [
  { to: '/', label: 'Dashboard' },
  { to: '/parking/lots', label: 'Parking Lots' },
  { to: '/parking/spots', label: 'Parking Spots' },
  { to: '/bookings/my', label: 'My Bookings' },
  { to: '/notifications', label: 'Notifications' },
  { to: '/admin/users', label: 'Admin Users' },
];

export function AppShell() {
  const { user, logout } = useAuth();

  return (
    <Box>
      <AppBar position="static">
        <Toolbar sx={{ gap: 2 }}>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            Smart Parking
          </Typography>
          <Stack direction="row" spacing={1}>
            {links.map((link) => (
              <Button key={link.to} color="inherit" component={RouterLink} to={link.to}>
                {link.label}
              </Button>
            ))}
          </Stack>
          <Typography variant="body2">{user?.email}</Typography>
          <Button color="inherit" onClick={logout}>
            Logout
          </Button>
        </Toolbar>
      </AppBar>
      <Container sx={{ py: 3 }}>
        <Outlet />
      </Container>
    </Box>
  );
}
