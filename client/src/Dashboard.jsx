import { useEffect, useState } from 'react';
import { getSocket } from './socket.js';
import { api } from './api.js';
import { toast } from './toast.js';

const STATUS_ORDER = ['pending', 'in_review', 'approved'];
const STATUS_LABEL = { pending: 'Pending', in_review: 'In review', approved: 'Approved' };

export default function Dashboard({ user, token, onOpenBoard, onLogout }) {
  const [boards, setBoards] = useState(null);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [image, setImage] = useState(null);
  const [creating, setCreating] = useState(false);

  const load = async () => {
    try {
      const res = await api('/api/boards', { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load boards');
      setBoards(data);
    } catch (err) {
      setError(err.message);
      toast(err.message, 'error');
    }
  };

  useEffect(() => {
    load();
    const socket = getSocket();
    if (!socket) return;

    socket.on('status:change', ({ boardId, status }) => {
      setBoards((prev) => prev && prev.map((b) => (b.id === boardId ? { ...b, status } : b)));
    });
    return () => {
      socket.off('status:change');
    };
  }, [token]);

  const createBoard = async (e) => {
    e.preventDefault();
    setCreating(true);
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
      setBoards((prev) => (prev ? [data, ...prev] : [data]));
      setShowCreate(false);
      setTitle('');
      setClientEmail('');
      setImage(null);
      toast('Board created and ready for feedback', 'success');
    } catch (err) {
      setError(err.message);
      toast(err.message, 'error');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="app">
      <header className="topbar">
        <h1 className="logo small">
          <span className="mark" aria-hidden="true" />
          Feedback<span>Board</span>
        </h1>
        <div className="topbar-right">
          <span className="user-chip">{user.name} · {user.role}</span>
          {user.role === 'designer' && (
            <button className="primary" onClick={() => setShowCreate(true)}>+ New board</button>
          )}
          <button className="ghost" onClick={onLogout}>Log out</button>
        </div>
      </header>

      {error && <p className="error center">{error}</p>}

      <div className="dash-head">
        <div>
          <h2>{user.role === 'designer' ? 'Your boards' : 'Shared with you'}</h2>
          <p>{user.role === 'designer' ? 'Create a board, share it, collect live feedback.' : 'Feedback your designer is waiting on.'}</p>
        </div>
      </div>

      {boards === null && (
        <div className="board-grid" aria-label="Loading boards">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div className="skeleton-card" key={i} aria-hidden="true">
              <div className="skeleton img" />
              <div className="skeleton line" />
              <div className="skeleton line short" />
            </div>
          ))}
        </div>
      )}

      {boards !== null && boards.length === 0 && (
        <div className="empty">
          <div className="empty-ill" aria-hidden="true">📍</div>
          <h2>{user.role === 'designer' ? 'Start your first board' : 'Nothing shared yet'}</h2>
          <p>
            {user.role === 'designer'
              ? 'Upload a design, share it with a client, and collect feedback pinned right on the image — live.'
              : 'When your designer shares a board with you, it will show up here.'}
          </p>
          {user.role === 'designer' ? (
            <>
              <div className="steps">
                <span>1 · Upload a design</span>
                <span>2 · Share with a client</span>
                <span>3 · Watch feedback arrive live</span>
              </div>
              <button className="primary" onClick={() => setShowCreate(true)}>+ Create your first board</button>
            </>
          ) : null}
        </div>
      )}

      {boards !== null && boards.length > 0 && (
        <div className="board-grid">
          {boards.map((b, i) => (
            <button key={b.id} className="board-card" style={{ '--i': i }} onClick={() => onOpenBoard(b)}>
              <div className="thumb">
                <img src={b.image_url} alt={`Design preview for ${b.title}`} loading="lazy" />
              </div>
              <div className="board-card-foot">
                <div>
                  <h3>{b.title}</h3>
                  <span className={`badge ${b.status}`}>{STATUS_LABEL[b.status]}</span>
                </div>
                <span className="muted small">Open →</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {showCreate && (
        <div className="modal-backdrop" onClick={() => setShowCreate(false)}>
          <form className="modal" onSubmit={createBoard} onClick={(e) => e.stopPropagation()}>
            <h2>New feedback board</h2>
            <p className="modal-sub">Share a design with a client and start collecting pinned feedback.</p>
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
              <button className="primary" disabled={creating}>{creating ? 'Creating…' : 'Create board'}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

export { STATUS_ORDER, STATUS_LABEL };
