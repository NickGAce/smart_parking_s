import { alpha, createTheme, darken, lighten } from '@mui/material/styles';
import type { PaletteMode } from '@mui/material';

const fontFamily = '"Inter", "Segoe UI", "Roboto", "Helvetica", "Arial", sans-serif';

function getDesignTokens(mode: PaletteMode) {
  const isLight = mode === 'light';

  const paletteTokens = {
    blue: {
      50: '#eff6ff',
      100: '#dbeafe',
      200: '#bfdbfe',
      500: '#2563eb',
      600: '#1d4ed8',
      700: '#1e40af',
      900: '#172554',
    },
    teal: {
      50: '#f0fdfa',
      100: '#ccfbf1',
      500: '#14b8a6',
      600: '#0d9488',
      700: '#0f766e',
      900: '#134e4a',
    },
    green: {
      50: '#f0fdf4',
      100: '#dcfce7',
      500: '#22c55e',
      600: '#16a34a',
      700: '#15803d',
    },
    amber: {
      50: '#fffbeb',
      100: '#fef3c7',
      500: '#f59e0b',
      600: '#d97706',
      700: '#b45309',
    },
    red: {
      50: '#fef2f2',
      100: '#fee2e2',
      500: '#ef4444',
      600: '#dc2626',
      700: '#b91c1c',
    },
    sky: {
      50: '#f0f9ff',
      100: '#e0f2fe',
      500: '#0ea5e9',
      600: '#0284c7',
      700: '#0369a1',
    },
    slate: {
      50: '#f8fafc',
      100: '#f1f5f9',
      200: '#e2e8f0',
      300: '#cbd5e1',
      400: '#94a3b8',
      500: '#64748b',
      600: '#475569',
      700: '#334155',
      800: '#1e293b',
      900: '#0f172a',
    },
  };

  const semantic = {
    primary: {
      main: paletteTokens.blue[600],
      light: paletteTokens.blue[500],
      dark: paletteTokens.blue[700],
      contrastText: '#ffffff',
    },
    secondary: {
      main: paletteTokens.teal[700],
      light: paletteTokens.teal[500],
      dark: paletteTokens.teal[900],
      contrastText: '#ffffff',
    },
    success: {
      main: paletteTokens.green[600],
      light: paletteTokens.green[500],
      dark: paletteTokens.green[700],
      contrastText: '#ffffff',
    },
    warning: {
      main: paletteTokens.amber[600],
      light: paletteTokens.amber[500],
      dark: paletteTokens.amber[700],
      contrastText: '#ffffff',
    },
    error: {
      main: paletteTokens.red[600],
      light: paletteTokens.red[500],
      dark: paletteTokens.red[700],
      contrastText: '#ffffff',
    },
    info: {
      main: paletteTokens.sky[600],
      light: paletteTokens.sky[500],
      dark: paletteTokens.sky[700],
      contrastText: '#ffffff',
    },
  };

  const textStrong = isLight ? paletteTokens.slate[900] : paletteTokens.slate[50];
  const textMuted = isLight ? paletteTokens.slate[600] : paletteTokens.slate[300];

  return {
    palette: {
      mode,
      ...semantic,
      background: {
        default: isLight ? '#f3f6fb' : '#0b1120',
        paper: isLight ? '#ffffff' : '#111827',
      },
      text: {
        primary: textStrong,
        secondary: textMuted,
      },
      divider: isLight ? paletteTokens.slate[200] : alpha('#ffffff', 0.12),
      surface: {
        page: isLight ? '#f3f6fb' : '#0b1120',
        raised: isLight ? '#ffffff' : '#111827',
        overlay: isLight ? '#f8fafc' : '#1f2937',
      },
      border: {
        subtle: isLight ? paletteTokens.slate[200] : alpha('#ffffff', 0.14),
        strong: isLight ? paletteTokens.slate[300] : alpha('#ffffff', 0.24),
        interactive: semantic.primary.main,
      },
      textTone: {
        strong: textStrong,
        muted: textMuted,
      },
      slate: paletteTokens.slate,
    },
    spacing: 4,
    shape: {
      borderRadius: 8,
    },
    foundation: {
      radius: {
        xs: 3,
        sm: 5,
        md: 7,
        lg: 8,
        xl: 10,
        pill: 999,
      },
      shadows: {
        xs: '0 1px 2px rgba(15, 23, 42, 0.06)',
        sm: '0 2px 8px rgba(15, 23, 42, 0.08)',
        md: '0 8px 24px rgba(15, 23, 42, 0.10)',
        lg: '0 12px 32px rgba(15, 23, 42, 0.14)',
      },
      borders: {
        subtle: `1px solid ${isLight ? paletteTokens.slate[200] : alpha('#ffffff', 0.14)}`,
        strong: `1px solid ${isLight ? paletteTokens.slate[300] : alpha('#ffffff', 0.24)}`,
        focus: `2px solid ${alpha(semantic.primary.main, 0.35)}`,
      },
      focusRing: {
        boxShadow: `0 0 0 3px ${alpha(semantic.primary.main, 0.24)}`,
        outline: `2px solid ${alpha(semantic.primary.main, 0.4)}`,
        outlineOffset: 1,
      },
      states: {
        hover: alpha(paletteTokens.slate[900], isLight ? 0.04 : 0.08),
        active: alpha(paletteTokens.slate[900], isLight ? 0.08 : 0.16),
        disabledBg: alpha(paletteTokens.slate[500], 0.12),
        disabledText: alpha(paletteTokens.slate[700], 0.45),
      },
    },
    typography: {
      fontFamily,
      h1: {
        fontSize: '2rem',
        fontWeight: 700,
        lineHeight: 1.2,
        letterSpacing: '-0.01em',
      },
      h2: {
        fontSize: '1.625rem',
        fontWeight: 700,
        lineHeight: 1.25,
      },
      h3: {
        fontSize: '1.375rem',
        fontWeight: 700,
        lineHeight: 1.3,
      },
      h4: {
        fontSize: '1.75rem',
        fontWeight: 700,
        lineHeight: 1.25,
      },
      h5: {
        fontSize: '1.375rem',
        fontWeight: 650,
        lineHeight: 1.3,
      },
      h6: {
        fontSize: '1.125rem',
        fontWeight: 650,
        lineHeight: 1.35,
      },
      body1: {
        fontSize: '0.95rem',
        lineHeight: 1.55,
      },
      body2: {
        fontSize: '0.875rem',
        lineHeight: 1.5,
      },
      caption: {
        fontSize: '0.75rem',
        lineHeight: 1.45,
        color: textMuted,
      },
      button: {
        fontSize: '0.875rem',
        fontWeight: 600,
        letterSpacing: '0.01em',
        textTransform: 'none' as const,
      },
      pageTitle: {
        fontSize: '1.75rem',
        fontWeight: 700,
        lineHeight: 1.25,
      },
      sectionTitle: {
        fontSize: '1.25rem',
        fontWeight: 650,
        lineHeight: 1.3,
      },
      cardTitle: {
        fontSize: '1rem',
        fontWeight: 650,
        lineHeight: 1.35,
      },
      tableLabel: {
        fontSize: '0.75rem',
        fontWeight: 700,
        lineHeight: 1.3,
        textTransform: 'uppercase' as const,
        letterSpacing: '0.04em',
      },
    },
  };
}

export const appTheme = (() => {
  const baseTheme = createTheme(getDesignTokens('light'));

  return createTheme(baseTheme, {
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            color: baseTheme.palette.text.primary,
            backgroundColor: baseTheme.palette.background.default,
            textRendering: 'optimizeLegibility',
          },
          '#root': {
            minHeight: '100vh',
          },
          a: {
            color: 'inherit',
          },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            boxShadow: baseTheme.foundation.shadows.xs,
            backgroundImage: 'none',
            borderBottom: baseTheme.foundation.borders.subtle,
          },
        },
      },
      MuiPaper: {
        defaultProps: {
          elevation: 0,
        },
        styleOverrides: {
          root: {
            border: baseTheme.foundation.borders.subtle,
            backgroundImage: 'none',
            borderRadius: baseTheme.foundation.radius.md,
            backgroundColor: baseTheme.palette.surface.raised,
          },
        },
      },
      MuiCard: {
        defaultProps: {
          elevation: 0,
        },
        styleOverrides: {
          root: {
            border: baseTheme.foundation.borders.subtle,
            borderRadius: baseTheme.foundation.radius.md,
            boxShadow: baseTheme.foundation.shadows.sm,
            transition: 'box-shadow 150ms ease, border-color 150ms ease, transform 150ms ease',
            '&:hover': {
              boxShadow: baseTheme.foundation.shadows.md,
              borderColor: baseTheme.palette.border.strong,
            },
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: baseTheme.foundation.radius.sm,
            textTransform: 'none',
            fontWeight: 600,
            whiteSpace: 'normal',
            textAlign: 'center',
            maxWidth: '100%',
            boxShadow: 'none',
            '&:focus-visible': {
              boxShadow: baseTheme.foundation.focusRing.boxShadow,
              outline: 'none',
            },
            '&:disabled': {
              backgroundColor: baseTheme.foundation.states.disabledBg,
              color: baseTheme.foundation.states.disabledText,
            },
          },
          containedPrimary: {
            '&:hover': {
              backgroundColor: darken(baseTheme.palette.primary.main, 0.05),
            },
            '&:active': {
              backgroundColor: darken(baseTheme.palette.primary.main, 0.12),
            },
          },
          outlined: {
            borderColor: baseTheme.palette.border.strong,
            '&:hover': {
              backgroundColor: baseTheme.foundation.states.hover,
            },
            '&:active': {
              backgroundColor: baseTheme.foundation.states.active,
            },
          },
          text: {
            '&:hover': {
              backgroundColor: baseTheme.foundation.states.hover,
            },
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            borderRadius: baseTheme.foundation.radius.pill,
            fontWeight: 600,
          },
          outlined: {
            borderColor: baseTheme.palette.border.strong,
          },
        },
      },
      MuiAlert: {
        styleOverrides: {
          root: {
            borderRadius: baseTheme.foundation.radius.sm,
            border: baseTheme.foundation.borders.subtle,
          },
          standardSuccess: {
            backgroundColor: alpha(baseTheme.palette.success.main, 0.08),
          },
          standardWarning: {
            backgroundColor: alpha(baseTheme.palette.warning.main, 0.1),
          },
          standardError: {
            backgroundColor: alpha(baseTheme.palette.error.main, 0.08),
          },
          standardInfo: {
            backgroundColor: alpha(baseTheme.palette.info.main, 0.08),
          },
        },
      },
      MuiTextField: {
        defaultProps: {
          size: 'small',
          variant: 'outlined',
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            borderRadius: baseTheme.foundation.radius.sm,
            backgroundColor: alpha(baseTheme.palette.surface.overlay, 0.45),
            '& .MuiOutlinedInput-notchedOutline': {
              borderColor: baseTheme.palette.border.subtle,
            },
            '&:hover .MuiOutlinedInput-notchedOutline': {
              borderColor: baseTheme.palette.border.strong,
            },
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
              borderColor: baseTheme.palette.primary.main,
              borderWidth: 1,
            },
            '&.Mui-focused': {
              boxShadow: baseTheme.foundation.focusRing.boxShadow,
            },
            '&.Mui-disabled': {
              backgroundColor: baseTheme.foundation.states.disabledBg,
            },
          },
        },
      },
      MuiSelect: {
        defaultProps: {
          size: 'small',
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: {
            borderRadius: baseTheme.foundation.radius.md,
            border: baseTheme.foundation.borders.subtle,
            boxShadow: baseTheme.foundation.shadows.lg,
          },
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            borderRight: baseTheme.foundation.borders.subtle,
            backgroundImage: 'none',
          },
        },
      },
      MuiTable: {
        styleOverrides: {
          root: {
            borderCollapse: 'separate',
            borderSpacing: 0,
          },
        },
      },
      MuiTableCell: {
        styleOverrides: {
          root: {
            borderColor: baseTheme.palette.border.subtle,
            overflowWrap: 'anywhere',
            wordBreak: 'break-word',
          },
          head: {
            ...baseTheme.typography.tableLabel,
            color: baseTheme.palette.textTone.muted,
            backgroundColor: lighten(baseTheme.palette.surface.overlay, 0.02),
          },
        },
      },
      MuiTabs: {
        styleOverrides: {
          indicator: {
            height: 3,
            borderRadius: 99,
            backgroundColor: baseTheme.palette.primary.main,
          },
        },
      },
      MuiTab: {
        styleOverrides: {
          root: {
            textTransform: 'none',
            minHeight: 40,
            fontWeight: 600,
            color: baseTheme.palette.textTone.muted,
            '&.Mui-selected': {
              color: baseTheme.palette.textTone.strong,
            },
          },
        },
      },
      MuiTooltip: {
        styleOverrides: {
          tooltip: {
            borderRadius: baseTheme.foundation.radius.xs,
            backgroundColor: alpha(baseTheme.palette.slate[900], 0.94),
            fontSize: '0.75rem',
          },
          arrow: {
            color: alpha(baseTheme.palette.slate[900], 0.94),
          },
        },
      },
      MuiBreadcrumbs: {
        styleOverrides: {
          separator: {
            color: baseTheme.palette.textTone.muted,
          },
          li: {
            ...baseTheme.typography.caption,
          },
        },
      },
      MuiListItemButton: {
        styleOverrides: {
          root: {
            borderRadius: baseTheme.foundation.radius.sm,
            marginInline: baseTheme.spacing(2),
            marginBlock: baseTheme.spacing(0.5),
            '&:hover': {
              backgroundColor: baseTheme.foundation.states.hover,
            },
            '&.Mui-selected': {
              backgroundColor: alpha(baseTheme.palette.primary.main, 0.12),
              color: baseTheme.palette.primary.dark,
            },
            '&.Mui-selected:hover': {
              backgroundColor: alpha(baseTheme.palette.primary.main, 0.2),
            },
          },
        },
      },
    },
  });
})();
