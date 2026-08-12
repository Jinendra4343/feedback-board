import { useEffect, useState } from 'react';
import { getSocket } from './socket.js';
import { api } from './api.js';

const STATUS_ORDER = ['pending', 'in_review', 'approved'];
const STATUS_LABEL = { pending: 'Pending', in_review: 'In review', approved: 'Approved' };

export default function Dashboard({ user, token, onOpenBoard, onLogout }) {
  const [boards, setBoards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [image, setImage] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api('/api/boards', { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load boards');
      setBoards(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const socket = getSocket();
    if (!socket) return;

    socket.on('status:change', ({ boardId, status }) => {
      setBoards((prev) => prev.map((b) => (b.id === boardId ? { ...b, status } : b)));
    });
    return () => {
      socket.off('status:change');
    };
  }, [token]);

  const createBoard = async (e) => {
    e.preventDefault();
    setError('');
    const form = new FormData();
    form.append('title', title);
    form.append('image', image);
    if (clientEmail) form.append('clientEmail', clientEmail);
    try {
      const res = await api('/api/boards', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create board');
      setBoards((prev) => [data, ...prev]);
      setShowCreate(false);
      setTitle('');
      setClientEmail('');
      setImage(null);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="app">
      <header className="topbar">
        <h1 className="logo small">Feedback<span>Board</span></h1>
        <div className="topbar-right">
          <span className="user-chip">{user.name} · {user.role}</span>
          {user.role === 'designer' && (
            <button className="primary" onClick={() => setShowCreate(true)}>+ New board</button>
          )}
          <button className="ghost" onClick={onLogout}>Log out</button>
        </div>
      </header>

      {error && <p className="error center">{error}</p>}
      {loading && <p className="muted center">Loading boards…</p>}

      {!loading && boards.length === 0 && (
        <div className="empty">
          <h2>No boards yet</h2>
          <p className="muted">
            {user.role === 'designer'
              ? 'Create a board and share it with a client to start collecting feedback.'
              : 'Your designer has not shared any boards with you yet.'}
          </p>
        </div>
      )}

      <div className="board-grid">
        {boards.map((b) => (
          <button key={b.id} className="board-card" onClick={() => onOpenBoard(b)}>
            <img src={b.image_url} alt={b.title} loading="lazy" />
            <div className="board-card-foot">
              <div>
                <h3>{b.title}</h3>
                <p className="muted">{STATUS_LABEL[b.status]}</p>
              </div>
              <span className={`badge ${b.status}`}>{STATUS_LABEL[b.status]}</span>
            </div>
          </button>
        ))}
      </div>

      {showCreate && (
        <div className="modal-backdrop" onClick={() => setShowCreate(false)}>
          <form className="modal" onSubmit={createBoard} onClick={(e) => e.stopPropagation()}>
            <h2>New feedback board</h2>
            <input placeholder="Board title" value={title} onChange={(e) => setTitle(e.target.value)} required />
            <input
              type="file"
              accept="image/*"
              required
              onChange={(e) => setImage(e.target.files[0])}
            />
            <input
              placeholder="Client email to share with (optional)"
              value={clientEmail}
              onChange={(e) => setClientEmail(e.target.value)}
            />
            {error && <p className="error">{error}</p>}
            <div className="modal-actions">
              <button type="button" className="ghost" onClick={() => setShowCreate(false)}>Cancel</button>
              <button className="primary">Create board</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

export { STATUS_ORDER, STATUS_LABEL };
