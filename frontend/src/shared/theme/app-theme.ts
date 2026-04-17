import { alpha, createTheme } from '@mui/material/styles';

export const appTheme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1d4ed8',
      light: '#3b82f6',
      dark: '#1e40af',
    },
    secondary: {
      main: '#0f766e',
      light: '#14b8a6',
      dark: '#115e59',
    },
    background: {
      default: '#f4f7fb',
      paper: '#ffffff',
    },
    divider: '#e2e8f0',
    text: {
      primary: '#0f172a',
      secondary: '#475569',
    },
  },
  shape: {
    borderRadius: 12,
  },
  typography: {
    fontFamily: '"Inter", "Segoe UI", "Roboto", "Helvetica", "Arial", sans-serif',
    h4: {
      fontSize: '1.7rem',
      fontWeight: 700,
      lineHeight: 1.25,
    },
    h5: {
      fontSize: '1.3rem',
      fontWeight: 650,
      lineHeight: 1.3,
    },
    body2: {
      lineHeight: 1.45,
    },
  },
  components: {
    MuiAppBar: {
      styleOverrides: {
        root: {
          boxShadow: '0 1px 2px rgba(15, 23, 42, 0.08)',
          backgroundImage: 'none',
        },
      },
    },
    MuiPaper: {
      defaultProps: {
        elevation: 0,
      },
      styleOverrides: {
        root: {
          border: '1px solid #e2e8f0',
          backgroundImage: 'none',
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          border: '1px solid #e2e8f0',
          boxShadow: '0 2px 8px rgba(15, 23, 42, 0.04)',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          textTransform: 'none',
          fontWeight: 600,
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        head: {
          fontWeight: 700,
          color: '#334155',
          backgroundColor: '#f8fafc',
        },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          marginInline: 8,
          marginBlock: 2,
          '&.Mui-selected': {
            backgroundColor: alpha('#1d4ed8', 0.12),
            color: '#1e3a8a',
          },
        },
      },
    },
  },
});
