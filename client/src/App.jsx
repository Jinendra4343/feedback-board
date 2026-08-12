import { useEffect, useState } from 'react';
import AuthPage from './AuthPage.jsx';
import Dashboard from './Dashboard.jsx';
import BoardView from './BoardView.jsx';
import { connectSocket, disconnectSocket } from './socket.js';

const TOKEN_KEY = 'fb_token';
const USER_KEY = 'fb_user';

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(USER_KEY));
    } catch {
      return null;
    }
  });
  const [currentBoard, setCurrentBoard] = useState(null);
  const [toasts, setToasts] = useState([]);

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
    localStorage.setItem(TOKEN_KEY, data.token);
    localStorage.setItem(USER_KEY, JSON.stringify(data.user));
    setToken(data.token);
    setUser(data.user);
  };

  const handleLogout = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setToken(null);
    setUser(null);
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
