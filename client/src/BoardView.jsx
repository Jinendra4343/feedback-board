import { useEffect, useRef, useState } from 'react';
import { getSocket } from './socket.js';
import { STATUS_ORDER, STATUS_LABEL } from './Dashboard.jsx';

export default function BoardView({ user, token, board, onBack }) {
  const [comments, setComments] = useState([]);
  const [status, setStatus] = useState(board.status);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState(null);
  const [draftText, setDraftText] = useState('');
  const [imageSize, setImageSize] = useState({ w: 1, h: 1 });
  const imgRef = useRef(null);

  useEffect(() => {
    let alive = true;
    fetch(`/api/boards/${board.id}/comments`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => alive && setComments(data))
      .catch((err) => alive && setError(err.message));

    const socket = getSocket();
    if (!socket) return () => { alive = false; };

    socket.on('comment:new', ({ boardId, comment }) => {
      if (boardId === board.id) setComments((prev) => [...prev, comment]);
    });
    socket.on('status:change', ({ boardId, status: s }) => {
      if (boardId === board.id) setStatus(s);
    });

    return () => {
      alive = false;
      socket.off('comment:new');
      socket.off('status:change');
    };
  }, [board.id, token]);

  const handleImageClick = (e) => {
    const rect = imgRef.current.getBoundingClientRect();
    setDraft({ x: ((e.clientX - rect.left) / rect.width) * 100, y: ((e.clientY - rect.top) / rect.height) * 100 });
    setDraftText('');
  };

  const submitDraft = async () => {
    if (!draftText.trim()) return;
    setError('');
    try {
      const res = await fetch(`/api/boards/${board.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ text: draftText.trim(), x: draft.x, y: draft.y }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add comment');
      setComments((prev) => [...prev, data]);
      setDraft(null);
      setDraftText('');
    } catch (err) {
      setError(err.message);
    }
  };

  const changeStatus = async (next) => {
    setError('');
    try {
      const res = await fetch(`/api/boards/${board.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: next }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update status');
      setStatus(data.status);
    } catch (err) {
      setError(err.message);
    }
  };

  const nextStatus = STATUS_ORDER[(STATUS_ORDER.indexOf(status) + 1) % STATUS_ORDER.length];

  return (
    <div className="app">
      <header className="topbar">
        <button className="ghost" onClick={onBack}>← Boards</button>
        <h1 className="page-title">{board.title}</h1>
        <div className="topbar-right">
          <span className={`badge ${status}`}>{STATUS_LABEL[status]}</span>
          {user.role === 'designer' && (
            <button className="primary small" onClick={() => changeStatus(nextStatus)}>
              Move to {STATUS_LABEL[nextStatus]} →
            </button>
          )}
        </div>
      </header>

      {error && <p className="error center">{error}</p>}

      <div className="board-layout">
        <div className="canvas-wrap">
          <div className="canvas" style={{ aspectRatio: `${imageSize.w} / ${imageSize.h}` }}>
            <img
              ref={imgRef}
              src={board.image_url}
              alt={board.title}
              onClick={handleImageClick}
              onLoad={(e) => {
                const img = e.target;
                setImageSize({ w: img.naturalWidth, h: img.naturalHeight });
              }}
            />
            {comments.map((c) => (
              <div
                key={c.id}
                className={`pin ${c.user_id === user.id ? 'mine' : ''}`}
                style={{ left: `${c.x}%`, top: `${c.y}%` }}
                title={`${c.name}: ${c.text}`}
              >
                {c.text.slice(0, 1).toUpperCase()}
                <span className="pin-label">{c.name}</span>
              </div>
            ))}
            {draft && (
              <div className="pin draft" style={{ left: `${draft.x}%`, top: `${draft.y}%` }}>
                ?
              </div>
            )}
          </div>
          <p className="muted hint">Click anywhere on the design to drop a feedback pin.</p>
        </div>

        <aside className="comments-panel">
          <h2>Feedback ({comments.length})</h2>
          <div className="comment-list">
            {comments.length === 0 && <p className="muted">No feedback yet. Click the design to add the first pin.</p>}
            {comments.map((c) => (
              <div key={c.id} className={`comment ${c.user_id === user.id ? 'mine' : ''}`}>
                <div className="comment-head">
                  <strong>{c.name}</strong>
                  <span className={`badge tiny ${c.role}`}>{c.role}</span>
                </div>
                <p>{c.text}</p>
                <span className="muted small">at ({c.x.toFixed(1)}%, {c.y.toFixed(1)}%)</span>
              </div>
            ))}
          </div>

          {draft && (
            <div className="draft-box">
              <p className="muted small">Dropping pin at ({draft.x.toFixed(1)}%, {draft.y.toFixed(1)}%)</p>
              <textarea
                placeholder="Write your feedback…"
                value={draftText}
                onChange={(e) => setDraftText(e.target.value)}
                autoFocus
              />
              <div className="modal-actions">
                <button className="ghost small" onClick={() => setDraft(null)}>Cancel</button>
                <button className="primary small" onClick={submitDraft}>Add feedback</button>
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
