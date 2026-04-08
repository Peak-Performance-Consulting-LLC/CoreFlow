import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'sonner';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import './index.css';

ReactDOM.createRoot(document.getElementById('app')!).render(
  <React.StrictMode>
    <AuthProvider>
      <BrowserRouter>
        <App />
        <Toaster
          expand
          position="top-right"
          richColors
          theme="dark"
          toastOptions={{
            classNames: {
              toast:
                'border border-white/10 bg-slate-950/95 text-slate-100 shadow-2xl shadow-cyan-500/10',
            },
          }}
        />
      </BrowserRouter>
    </AuthProvider>
  </React.StrictMode>,
);
