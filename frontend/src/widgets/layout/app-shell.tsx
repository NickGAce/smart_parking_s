import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded';
import MenuRoundedIcon from '@mui/icons-material/MenuRounded';
import {
  AppBar,
  Avatar,
  Badge,
  Box,
  Button,
  Chip,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Stack,
  Typography,
  Toolbar,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { useMemo, useState } from 'react';
import { Link as RouterLink, Outlet, useLocation, useNavigate } from 'react-router-dom';

import { getMenuByRole } from '../../app/router/route-config';
import { useAuth } from '../../features/auth/use-auth';
import { useUnreadNotificationsCountQuery } from '../../features/notifications/use-notifications-query';
import { userRoleLabels } from '../../shared/config/display-labels';
import { PageHeader } from '../../shared/ui/page-header';
import { findRouteByPathname } from '../../app/router/route-config';

const drawerWidth = 260;

export function AppShell() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
  const unreadCountQuery = useUnreadNotificationsCountQuery();

  const links = user ? getMenuByRole(user.role) : [];
  const routeMeta = findRouteByPathname(location.pathname);

  const breadcrumbs = useMemo(() => {
    if (!routeMeta) {
      return [{ label: 'Главная', to: '/' }, { label: 'Неизвестная страница' }];
    }

    if (routeMeta.path === '/dashboard') {
      return [{ label: 'Панель проекта' }];
    }

    return [{ label: 'Панель проекта', to: '/dashboard' }, { label: routeMeta.title }];
  }, [routeMeta]);

  if (!user) {
    return null;
  }

  const drawerContent = (
    <>
      <Toolbar />
      <Box sx={{ px: 2, py: 3 }}>
        <Stack spacing={1}>
          <Avatar sx={{ bgcolor: 'primary.main' }}>{user.email[0]?.toUpperCase() ?? 'П'}</Avatar>
          <Box sx={{ wordBreak: 'break-all', fontSize: 13 }}>{user.email}</Box>
          <Chip size="small" label={`Роль: ${userRoleLabels[user.role]}`} />
        </Stack>
      </Box>
      <Divider />
      <List>
        {links.map((link) => (
          <ListItemButton
            key={link.path}
            component={RouterLink}
            to={link.path}
            selected={location.pathname.startsWith(link.path)}
            onClick={() => setMobileOpen(false)}
          >
            <ListItemText
              primary={
                link.path === '/notifications' ? (
                  <Badge
                    color="error"
                    badgeContent={unreadCountQuery.data ?? 0}
                    max={99}
                    invisible={!unreadCountQuery.data}
                  >
                    {link.menuLabel}
                  </Badge>
                ) : (
                  link.menuLabel
                )
              }
            />
          </ListItemButton>
        ))}
      </List>
    </>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppBar position="fixed" color="inherit" sx={{ zIndex: (t) => t.zIndex.drawer + 1 }}>
        <Toolbar sx={{ justifyContent: 'space-between' }}>
          <Stack direction="row" spacing={1} alignItems="center">
            {!isDesktop && (
              <IconButton color="primary" onClick={() => setMobileOpen(true)} aria-label="Открыть меню">
                <MenuRoundedIcon />
              </IconButton>
            )}
            <Typography variant="subtitle1" fontWeight={700} color="text.primary">
              Smart Parking
            </Typography>
          </Stack>
          <Button
            color="primary"
            startIcon={<LogoutRoundedIcon />}
            onClick={() => {
              logout();
              navigate('/login');
            }}
          >
            Выйти
          </Button>
        </Toolbar>
      </AppBar>

      <Box component="nav" sx={{ width: { md: drawerWidth }, flexShrink: { md: 0 } }}>
        <Drawer
          variant="temporary"
          open={!isDesktop && mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{ display: { xs: 'block', md: 'none' }, '& .MuiDrawer-paper': { width: drawerWidth } }}
        >
          {drawerContent}
        </Drawer>
        <Drawer
          variant="permanent"
          open
          sx={{
            display: { xs: 'none', md: 'block' },
            '& .MuiDrawer-paper': { width: drawerWidth, boxSizing: 'border-box' },
          }}
        >
          {drawerContent}
        </Drawer>
      </Box>

      <Box component="main" sx={{ flexGrow: 1, p: 3 }}>
        <Toolbar />
        <PageHeader title={routeMeta?.title ?? 'Страница'} breadcrumbs={breadcrumbs} />
        <Box sx={{ maxWidth: 1280 }}>
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
}
