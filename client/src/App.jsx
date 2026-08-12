import { useEffect, useState } from 'react';
import AuthPage from './AuthPage.jsx';
import Dashboard from './Dashboard.jsx';
import BoardView from './BoardView.jsx';
import { connectSocket, disconnectSocket } from './socket.js';
import { getAccessToken, getCurrentUser, saveSession, clearSession, subscribe } from './auth.js';
import { api } from './api.js';

export default function App() {
  const [token, setToken] = useState(getAccessToken);
  const [user, setUser] = useState(getCurrentUser);
  const [currentBoard, setCurrentBoard] = useState(null);
  const [toasts, setToasts] = useState([]);

  useEffect(() => subscribe((state) => {
    setToken(state?.token ?? null);
    setUser(state?.user ?? null);
  }), []);

  useEffect(() => {
    const onToast = (e) => {
      const id = Date.now() + Math.random();
      setToasts((prev) => [...prev, { id, ...e.detail }]);
      setTimeout(() => {
        setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
        setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 280);
      }, 3600);
    };
    window.addEventListener('fb:toast', onToast);
    return () => window.removeEventListener('fb:toast', onToast);
  }, []);

  useEffect(() => {
    if (token) {
      connectSocket(token);
      return () => disconnectSocket();
    }
  }, [token]);

  const handleAuth = (data) => {
    saveSession(data);
    setToken(data.accessToken);
    setUser(data.user);
  };

  const handleLogout = async () => {
    try {
      await api('/api/auth/logout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refreshToken: localStorage.getItem('fb_refresh') }) });
    } catch {
      // best-effort revocation; session clears regardless
    }
    clearSession();
    setCurrentBoard(null);
  };

  if (!token || !user) {
    return (
      <>
        <a className="skip-link" href="#root">Skip to content</a>
        <AuthPage onAuth={handleAuth} />
        <ToastStack toasts={toasts} />
      </>
    );
  }

  if (currentBoard) {
    return (
      <>
        <a className="skip-link" href="#root">Skip to content</a>
        <BoardView
          user={user}
          token={token}
          board={currentBoard}
          onBack={() => setCurrentBoard(null)}
        />
        <ToastStack toasts={toasts} />
      </>
    );
  }

  return (
    <>
      <a className="skip-link" href="#root">Skip to content</a>
      <Dashboard user={user} token={token} onOpenBoard={setCurrentBoard} onLogout={handleLogout} />
      <ToastStack toasts={toasts} />
    </>
  );
}

function ToastStack({ toasts }) {
  if (toasts.length === 0) return null;
  return (
    <div className="toast-stack" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.type}${t.leaving ? ' leaving' : ''}`}>
          {t.message}
        </div>
      ))}
    </div>
  );
}
