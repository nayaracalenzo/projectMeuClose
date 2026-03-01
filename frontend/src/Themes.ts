import { createTheme } from "@mui/material";
import { ptBR } from "@mui/x-data-grid/locales";

export const LightTheme = createTheme(
  {
    palette: {
      mode: "light",

      primary: {
        main: "#e44453", // brand-primary
        light: "#cbefbe", // brand-primary-light
        dark: "#c83745",
        contrastText: "#ffffff",
      },

      secondary: {
        main: "#9a4d6a", // text-secondary como apoio
        light: "#fde4f0", // brand-primary-soft
        dark: "#7a3d55",
        contrastText: "#ffffff",
      },

      error: {
        main: "#fc3441", // action-strong
      },

      background: {
        default: "#fcf3fa", // surface-base
        paper: "#fefefe", // surface-raised
      },

      text: {
        primary: "#2E1E1E",
        secondary: "#9a4d6a",
      },

      divider: "#E8CFCF", // border-subtle
    },

    typography: {
      fontFamily: "Exo, sans-serif",

      h3: {
        fontSize: "1rem",
        fontWeight: 700,
        color: "#e44453",
      },
    },

    components: {
      MuiButton: {
        styleOverrides: {
          root: {
            padding: "1rem",
            margin: "0.5em",
            height: "2.45rem",
            borderRadius: "0.75rem",
            textTransform: "none",
            fontWeight: 600,
          },

          containedPrimary: {
            backgroundColor: "#f95191",
            color: "#ffffff",
            "&:hover": {
              backgroundColor: "#fc3441",
            },
          },

          outlinedPrimary: {
            borderColor: "#e44453",
            color: "#e44453",
            "&:hover": {
              backgroundColor: "#fde4f0",
              borderColor: "#e44453",
            },
          },
        },
      },

      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundColor: "#fefefe",
          },
        },
      },

      MuiTextField: {
        styleOverrides: {
          root: {
            backgroundColor: "#fefefe",
          },
        },
      },

      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            "& fieldset": {
              borderColor: "#E8CFCF",
            },
            "&:hover fieldset": {
              borderColor: "#ecbfbe",
            },
            "&.Mui-focused fieldset": {
              borderColor: "#e44453",
            },
          },
        },
      },

      MuiDataGrid: {
        styleOverrides: {
          root: {
            borderColor: "#E8CFCF",

            "& .MuiDataGrid-columnHeader": {
              backgroundColor: "#ffe1e2",
            },
            "& .MuiDataGrid-columnHeaderTitle": {
              fontWeight: 600,
            },
            "& .MuiDataGrid-footerContainer": {
              backgroundColor: "#ffe1e2",
            },

            "& .MuiDataGrid-cell": {
              borderColor: "#ffebf6",
            },
          },
        },
      },
    },
  },
  ptBR,
);
