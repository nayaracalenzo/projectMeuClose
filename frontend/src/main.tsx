import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { MutationLoadingProvider } from "./contexts/MutationLoadingContext.tsx";
import { ThemeProvider } from '@mui/material/styles'
import { LightTheme } from './Themes.ts';

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider theme={LightTheme}>
      <MutationLoadingProvider>
        <App />
      </MutationLoadingProvider>
    </ThemeProvider>
  </StrictMode>,
);
