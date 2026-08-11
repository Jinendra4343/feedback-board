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

  if (!token || !user) return <AuthPage onAuth={handleAuth} />;

  if (currentBoard) {
    return (
      <BoardView
        user={user}
        token={token}
        board={currentBoard}
        onBack={() => setCurrentBoard(null)}
      />
    );
  }

  return <Dashboard user={user} token={token} onOpenBoard={setCurrentBoard} onLogout={handleLogout} />;
}
