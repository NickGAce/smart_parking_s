import HomeRoundedIcon from '@mui/icons-material/HomeRounded';
import { AppBar, Box, Container, IconButton, Toolbar, Tooltip, Typography } from '@mui/material';
import { Link as RouterLink, Outlet } from 'react-router-dom';

export function AppLayout() {
  return (
    <Box minHeight="100vh" sx={{ bgcolor: 'background.default' }}>
      <AppBar position="sticky" elevation={0}>
        <Toolbar>
          <Tooltip title="На главную">
            <IconButton color="inherit" component={RouterLink} to="/" edge="start" sx={{ mr: 1 }}>
              <HomeRoundedIcon />
            </IconButton>
          </Tooltip>
          <Typography variant="h6" component="div">
            Smart Parking SPA
          </Typography>
        </Toolbar>
      </AppBar>

      <Container sx={{ py: 4 }}>
        <Outlet />
      </Container>
    </Box>
  );
}
