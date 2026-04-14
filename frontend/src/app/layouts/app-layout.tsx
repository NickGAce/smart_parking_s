import { Box, Container } from '@mui/material';
import { Outlet } from 'react-router-dom';

export function AppLayout() {
  return (
    <Box minHeight="100vh" sx={{ bgcolor: 'background.default', py: 6 }}>
      <Container>
        <Outlet />
      </Container>
    </Box>
  );
}
