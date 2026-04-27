import AccountCircleRoundedIcon from '@mui/icons-material/AccountCircleRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import DashboardRoundedIcon from '@mui/icons-material/DashboardRounded';
import CameraAltRoundedIcon from '@mui/icons-material/CameraAltRounded';
import DirectionsCarFilledRoundedIcon from '@mui/icons-material/DirectionsCarFilledRounded';
import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded';
import InsightsRoundedIcon from '@mui/icons-material/InsightsRounded';
import LocalParkingRoundedIcon from '@mui/icons-material/LocalParkingRounded';
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded';
import MenuRoundedIcon from '@mui/icons-material/MenuRounded';
import SecurityRoundedIcon from '@mui/icons-material/SecurityRounded';
import NotificationsRoundedIcon from '@mui/icons-material/NotificationsRounded';
import PlaceRoundedIcon from '@mui/icons-material/PlaceRounded';
import { alpha } from '@mui/material/styles';
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
  ListItemIcon,
  ListItemText,
  Stack,
  Tooltip,
  Typography,
  Toolbar,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { type ReactNode, useMemo, useState } from 'react';
import { Link as RouterLink, Outlet, useLocation, useNavigate } from 'react-router-dom';

import { findRouteByPathname, getMenuByRole } from '../../app/router/route-config';
import { useAuth } from '../../features/auth/use-auth';
import { useUnreadNotificationsCountQuery } from '../../features/notifications/use-notifications-query';
import { userRoleLabels } from '../../shared/config/display-labels';
import { PageHeader } from '../../shared/ui/page-header';

const drawerWidth = 288;

type NavSectionKey = 'main' | 'operations' | 'platform';

const navSectionTitles: Record<NavSectionKey, string> = {
  main: 'Демо-сценарий',
  operations: 'Справочники и операции',
  platform: 'Платформа',
};

const navSectionByPath: Record<string, NavSectionKey> = {
  '/dashboard': 'main',
  '/analytics': 'main',
  '/bookings/new': 'main',
  '/my-bookings': 'main',
  '/booking-management': 'main',
  '/parking-lots': 'operations',
  '/parking-spots': 'operations',
  '/notifications': 'platform',
  '/access-control': 'main',
  '/admin': 'platform',
  '/admin-users': 'platform',
  '/audit-logs': 'platform',
};

const navIconByPath: Record<string, ReactNode> = {
  '/dashboard': <DashboardRoundedIcon fontSize="small" />,
  '/analytics': <InsightsRoundedIcon fontSize="small" />,
  '/parking-lots': <LocalParkingRoundedIcon fontSize="small" />,
  '/parking-spots': <PlaceRoundedIcon fontSize="small" />,
  '/my-bookings': <DirectionsCarFilledRoundedIcon fontSize="small" />,
  '/bookings/new': <AddRoundedIcon fontSize="small" />,
  '/booking-management': <ChevronRightRoundedIcon fontSize="small" />,
  '/notifications': <NotificationsRoundedIcon fontSize="small" />,
  '/access-control': <CameraAltRoundedIcon fontSize="small" />,
  '/admin': <SecurityRoundedIcon fontSize="small" />,
  '/admin-users': <AccountCircleRoundedIcon fontSize="small" />,
  '/audit-logs': <HistoryRoundedIcon fontSize="small" />,
};

export function AppShell() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('lg'));
  const unreadCountQuery = useUnreadNotificationsCountQuery();

  const links = useMemo(() => (user ? getMenuByRole(user.role) : []), [user]);
  const routeMeta = findRouteByPathname(location.pathname);

  const breadcrumbs = useMemo(() => {
    if (!routeMeta) {
      return [{ label: 'Главная', to: '/dashboard' }, { label: 'Неизвестная страница' }];
    }

    if (routeMeta.path === '/dashboard') {
      return [{ label: 'Панель управления' }];
    }

    return [{ label: 'Панель управления', to: '/dashboard' }, { label: routeMeta.title }];
  }, [routeMeta]);

  const groupedLinks = useMemo(() => {
    return links.reduce<Record<NavSectionKey, typeof links>>(
      (acc, link) => {
        const section = navSectionByPath[link.path] ?? 'operations';
        acc[section].push(link);
        return acc;
      },
      { main: [], operations: [], platform: [] },
    );
  }, [links]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  if (!user) {
    return null;
  }

  const drawerContent = (
    <Stack sx={{ height: '100%' }}>
      <Box
        sx={{
          px: 3,
          pt: 3,
          pb: 2.5,
          borderBottom: `1px solid ${theme.palette.border.subtle}`,
          background: `linear-gradient(160deg, ${alpha(theme.palette.primary.main, 0.12)} 0%, ${theme.palette.surface.raised} 85%)`,
        }}
      >
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Avatar
            variant="rounded"
            sx={{
              bgcolor: 'primary.main',
              width: 40,
              height: 40,
              borderRadius: 2,
              fontWeight: 700,
            }}
          >
            SP
          </Avatar>
          <Box>
            <Typography variant="subtitle2" fontWeight={700} color="text.primary">
              Smart Parking
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Система управления парковками
            </Typography>
          </Box>
        </Stack>
      </Box>

      <Box sx={{ px: 2.5, py: 2 }}>
        <Stack spacing={1.25}>
          <Stack direction="row" spacing={1.25} alignItems="center">
            <Avatar sx={{ width: 32, height: 32, bgcolor: 'secondary.main', fontSize: 13 }}>
              {user.email[0]?.toUpperCase() ?? 'П'}
            </Avatar>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="body2" fontWeight={600} noWrap>
                {user.email}
              </Typography>
              <Typography variant="caption" color="text.secondary">Демо-сессия</Typography>
            </Box>
          </Stack>
          <Chip size="small" variant="outlined" label={userRoleLabels[user.role]} sx={{ alignSelf: 'flex-start' }} />
        </Stack>
      </Box>

      <Divider />

      <Box sx={{ flexGrow: 1, overflowY: 'auto', py: 1.5 }}>
        {(['main', 'operations', 'platform'] as NavSectionKey[]).map((sectionKey) => {
          const sectionLinks = groupedLinks[sectionKey];
          if (!sectionLinks.length) {
            return null;
          }

          return (
            <Box key={sectionKey} sx={{ mb: 1.5 }}>
              <Typography variant="caption" sx={{ px: 3, color: 'text.secondary', fontWeight: 700 }}>
                {navSectionTitles[sectionKey]}
              </Typography>
              <List disablePadding sx={{ mt: 0.5 }}>
                {sectionLinks.map((link) => {
                  const isActive = location.pathname.startsWith(link.path);

                  return (
                    <ListItemButton
                      key={link.path}
                      component={RouterLink}
                      to={link.path}
                      selected={isActive}
                      onClick={() => setMobileOpen(false)}
                      aria-current={isActive ? 'page' : undefined}
                      sx={{
                        '&:focus-visible': {
                          outline: 'none',
                          boxShadow: theme.foundation.focusRing.boxShadow,
                        },
                      }}
                    >
                      <ListItemIcon sx={{ minWidth: 34, color: isActive ? 'primary.main' : 'text.secondary' }}>
                        {navIconByPath[link.path] ?? <ChevronRightRoundedIcon fontSize="small" />}
                      </ListItemIcon>
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
                        primaryTypographyProps={{ fontWeight: isActive ? 700 : 500 }}
                      />
                    </ListItemButton>
                  );
                })}
              </List>
            </Box>
          );
        })}
      </Box>

      <Box sx={{ p: 2.5, borderTop: `1px solid ${theme.palette.border.subtle}` }}>
        <Button fullWidth color="inherit" startIcon={<LogoutRoundedIcon />} onClick={handleLogout}>
          Выйти из системы
        </Button>
      </Box>
    </Stack>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppBar
        position="fixed"
        color="inherit"
        sx={{
          zIndex: (t) => t.zIndex.drawer + 1,
          width: { lg: `calc(100% - ${drawerWidth}px)` },
          ml: { lg: `${drawerWidth}px` },
        }}
      >
        <Toolbar sx={{ justifyContent: 'space-between', gap: 2, minHeight: { xs: 64, md: 72 } }}>
          <Stack direction="row" spacing={1.25} alignItems="center" sx={{ minWidth: 0 }}>
            {!isDesktop && (
              <IconButton color="primary" onClick={() => setMobileOpen(true)} aria-label="Открыть меню навигации">
                <MenuRoundedIcon />
              </IconButton>
            )}
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="caption" color="text.secondary">
                Текущий раздел
              </Typography>
              <Typography variant="h6" sx={{ fontSize: '1.02rem' }} noWrap>
                {routeMeta?.title ?? 'Раздел'}
              </Typography>
            </Box>
          </Stack>

          <Stack direction="row" spacing={1} alignItems="center">
            {links.some((link) => link.path === '/bookings/new') && (
              <Button component={RouterLink} to="/bookings/new" variant="outlined" startIcon={<AddRoundedIcon />}>
                Новая бронь
              </Button>
            )}

            <Tooltip title={user.email}>
              <Chip
                avatar={<Avatar sx={{ bgcolor: 'primary.main' }}>{user.email[0]?.toUpperCase() ?? 'П'}</Avatar>}
                label={userRoleLabels[user.role]}
                variant="outlined"
              />
            </Tooltip>
          </Stack>
        </Toolbar>
      </AppBar>

      <Box component="nav" sx={{ width: { lg: drawerWidth }, flexShrink: { lg: 0 } }} aria-label="Глобальная навигация">
        <Drawer
          variant="temporary"
          open={!isDesktop && mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: 'block', lg: 'none' },
            '& .MuiDrawer-paper': { width: drawerWidth, boxSizing: 'border-box' },
          }}
        >
          {drawerContent}
        </Drawer>

        <Drawer
          variant="permanent"
          open
          sx={{
            display: { xs: 'none', lg: 'block' },
            '& .MuiDrawer-paper': { width: drawerWidth, boxSizing: 'border-box' },
          }}
        >
          {drawerContent}
        </Drawer>
      </Box>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          px: { xs: 2, md: 3.5 },
          pb: { xs: 3, md: 4 },
          width: { lg: `calc(100% - ${drawerWidth}px)` },
        }}
      >
        <Toolbar sx={{ minHeight: { xs: 64, md: 72 } }} />
        <PageHeader title={routeMeta?.title ?? 'Страница'} breadcrumbs={breadcrumbs} />
        <Box sx={{ width: '100%' }}>
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
}
