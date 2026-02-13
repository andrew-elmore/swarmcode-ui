import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Provider } from 'react-redux'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { CssBaseline, ThemeProvider, createTheme } from '@mui/material'
import store from './store'
import './index.css'
import App from './App.jsx'
import LoginPage from './pages/LoginPage.jsx'
import PairPage from './pages/PairPage.jsx'
import AuthGate from './components/AuthGate.jsx'

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: '#f44336' },
    secondary: { main: '#9c27b0' },
  },
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Provider store={store}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/pair" element={<AuthGate><PairPage /></AuthGate>} />
            <Route path="/*" element={<AuthGate><App /></AuthGate>} />
          </Routes>
        </BrowserRouter>
      </ThemeProvider>
    </Provider>
  </StrictMode>,
)

// Register service worker in production
if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
  })
}
