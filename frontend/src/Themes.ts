import { createTheme } from '@mui/material';
import { ptBR } from '@mui/x-data-grid/locales';

export const LightTheme = createTheme(
  {
    palette: {
      mode: 'light',
      primary: {
        main: '#1A1A1A',
        light: '#2C2C2C',
        dark: '#000000',
        contrastText: '#FFFFFF',
      },
      secondary: {
        main: '#E8C2CA',
        light: '#F5DCE1',
        dark: '#CFA8B1',
        contrastText: '#1A1A1A',
      },
      error: {
        main: '#BA1A1A',
      },
      background: {
        default: '#FCFCFC',
        paper: '#FFFFFF',
      },
      text: {
        primary: '#1A1A1A',
        secondary: '#8E8D8A',
      },
      divider: 'rgba(116, 120, 120, 0.2)',
    },
    typography: {
      fontFamily: '"Work Sans", "Montserrat", sans-serif',
      h1: {
        fontFamily: '"Cormorant Garamond", serif',
        fontWeight: 600,
        letterSpacing: '-0.02em',
      },
      h2: {
        fontFamily: '"Cormorant Garamond", serif',
        fontWeight: 600,
      },
      h3: {
        fontFamily: '"Cormorant Garamond", serif',
        fontWeight: 600,
      },
      button: {
        textTransform: 'none',
        fontWeight: 600,
        letterSpacing: '0.01em',
      },
      caption: {
        fontSize: '0.6875rem',
        textTransform: 'uppercase',
        letterSpacing: '0.12em',
      },
    },
    shape: {
      borderRadius: 2,
    },
    components: {
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: 0,
            paddingInline: '1.4rem',
            minHeight: '2.6rem',
          },
          containedPrimary: {
            background: 'linear-gradient(120deg, #000000 0%, #1C1B1B 100%)',
            color: '#FFFFFF',
            '&:hover': {
              background: 'linear-gradient(120deg, #1A1A1A 0%, #000000 100%)',
            },
          },
          outlinedPrimary: {
            borderColor: 'rgba(116, 120, 120, 0.4)',
            color: '#1A1A1A',
            '&:hover': {
              borderColor: '#1A1A1A',
              backgroundColor: 'rgba(244, 243, 241, 0.8)',
            },
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            boxShadow: 'none',
            borderRadius: 2,
          },
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            borderRadius: 2,
            '& fieldset': {
              borderColor: 'rgba(116, 120, 120, 0.2)',
            },
            '&:hover fieldset': {
              borderColor: 'rgba(116, 120, 120, 0.4)',
            },
            '&.Mui-focused fieldset': {
              borderColor: '#1A1A1A',
            },
          },
        },
      },
    },
  },
  ptBR,
);
