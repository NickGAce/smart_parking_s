import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded';
import {
  AppBar,
  Avatar,
  Box,
  Button,
  Chip,
  Divider,
  Drawer,
  List,
  ListItemButton,
  ListItemText,
  Stack,
  Toolbar,
  Typography,
} from '@mui/material';
import { Link as RouterLink, Outlet, useLocation, useNavigate } from 'react-router-dom';

import { DEFAULT_ROLE_ROUTE } from '../../app/router/route-guards';
import { useAuth } from '../../features/auth/use-auth';
import type { UserRole } from '../../shared/types/common';

const drawerWidth = 250;

const roleNavigation: Record<UserRole, Array<{ to: string; label: string }>> = {
  admin: [
    { to: '/dashboard', label: 'Dashboard' },
    { to: '/parking-lots', label: 'Parking lots' },
    { to: '/parking-spots', label: 'Parking spots' },
    { to: '/bookings', label: 'Bookings' },
    { to: '/notifications', label: 'Notifications' },
    { to: '/analytics', label: 'Analytics' },
    { to: '/admin', label: 'Admin' },
  ],
  owner: [
    { to: '/dashboard', label: 'Dashboard' },
    { to: '/parking-lots', label: 'Parking lots' },
    { to: '/parking-spots', label: 'Parking spots' },
    { to: '/bookings', label: 'Bookings' },
    { to: '/notifications', label: 'Notifications' },
    { to: '/analytics', label: 'Analytics' },
  ],
  tenant: [
    { to: '/dashboard', label: 'Dashboard' },
    { to: '/bookings', label: 'Bookings' },
    { to: '/notifications', label: 'Notifications' },
  ],
  guard: [
    { to: '/dashboard', label: 'Dashboard' },
    { to: '/parking-spots', label: 'Parking spots' },
    { to: '/notifications', label: 'Notifications' },
  ],
  uk: [
    { to: '/dashboard', label: 'Dashboard' },
    { to: '/notifications', label: 'Notifications' },
  ],
};

export function AppShell() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  if (!user) {
    return null;
  }

  const links = roleNavigation[user.role];

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
        <Toolbar sx={{ justifyContent: 'space-between' }}>
          <Typography variant="h6" noWrap>
            Smart Parking SPA
          </Typography>
          <Button
            color="inherit"
            startIcon={<LogoutRoundedIcon />}
            onClick={() => {
              logout();
              navigate('/login');
            }}
          >
            Logout
          </Button>
        </Toolbar>
      </AppBar>

      <Drawer
        variant="permanent"
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          '& .MuiDrawer-paper': { width: drawerWidth, boxSizing: 'border-box' },
        }}
      >
        <Toolbar />
        <Box sx={{ px: 2, py: 3 }}>
          <Stack spacing={1}>
            <Avatar>{user.email[0]?.toUpperCase() ?? 'U'}</Avatar>
            <Typography variant="body2" sx={{ wordBreak: 'break-all' }}>
              {user.email}
            </Typography>
            <Chip size="small" label={`role: ${user.role}`} />
          </Stack>
        </Box>
        <Divider />
        <List>
          {links.map((link) => (
            <ListItemButton
              key={link.to}
              component={RouterLink}
              to={link.to}
              selected={location.pathname.startsWith(link.to)}
            >
              <ListItemText primary={link.label} />
            </ListItemButton>
          ))}
        </List>
      </Drawer>

      <Box component="main" sx={{ flexGrow: 1, p: 3 }}>
        <Toolbar />
        <Outlet />
      </Box>
    </Box>
  );
}

export const roleNavigationConfig = roleNavigation;
export { DEFAULT_ROLE_ROUTE };
