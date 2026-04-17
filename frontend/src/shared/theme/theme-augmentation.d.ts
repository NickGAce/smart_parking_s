import '@mui/material/styles';

interface SurfacePalette {
  page: string;
  raised: string;
  overlay: string;
}

interface BorderPalette {
  subtle: string;
  strong: string;
  interactive: string;
}

interface TextTonePalette {
  strong: string;
  muted: string;
}

interface FoundationRadius {
  xs: number;
  sm: number;
  md: number;
  lg: number;
  xl: number;
  pill: number;
}

interface FoundationShadows {
  xs: string;
  sm: string;
  md: string;
  lg: string;
}

interface FoundationBorders {
  subtle: string;
  strong: string;
  focus: string;
}

interface FoundationFocusRing {
  boxShadow: string;
  outline: string;
  outlineOffset: number;
}

interface FoundationStates {
  hover: string;
  active: string;
  disabledBg: string;
  disabledText: string;
}

interface FoundationTokens {
  radius: FoundationRadius;
  shadows: FoundationShadows;
  borders: FoundationBorders;
  focusRing: FoundationFocusRing;
  states: FoundationStates;
}

interface SlateScale {
  50: string;
  100: string;
  200: string;
  300: string;
  400: string;
  500: string;
  600: string;
  700: string;
  800: string;
  900: string;
}

declare module '@mui/material/styles' {
  interface Palette {
    surface: SurfacePalette;
    border: BorderPalette;
    textTone: TextTonePalette;
    slate: SlateScale;
  }

  interface PaletteOptions {
    surface?: Partial<SurfacePalette>;
    border?: Partial<BorderPalette>;
    textTone?: Partial<TextTonePalette>;
    slate?: Partial<SlateScale>;
  }

  interface Theme {
    foundation: FoundationTokens;
  }

  interface ThemeOptions {
    foundation?: Partial<FoundationTokens>;
  }

  interface TypographyVariants {
    pageTitle: React.CSSProperties;
    sectionTitle: React.CSSProperties;
    cardTitle: React.CSSProperties;
    tableLabel: React.CSSProperties;
  }

  interface TypographyVariantsOptions {
    pageTitle?: React.CSSProperties;
    sectionTitle?: React.CSSProperties;
    cardTitle?: React.CSSProperties;
    tableLabel?: React.CSSProperties;
  }
}

declare module '@mui/material/Typography' {
  interface TypographyPropsVariantOverrides {
    pageTitle: true;
    sectionTitle: true;
    cardTitle: true;
    tableLabel: true;
  }
}
