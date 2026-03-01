import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { ThemeProvider } from '@mui/material/styles'
import { LightTheme } from './Themes.ts';

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider theme={LightTheme}>
      <App />
    </ThemeProvider>
  </StrictMode>,
);
