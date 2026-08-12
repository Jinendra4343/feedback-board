import { useEffect, useRef, useState } from 'react';
import { getSocket } from './socket.js';
import { api } from './api.js';
import { toast } from './toast.js';
import { STATUS_ORDER, STATUS_LABEL } from './Dashboard.jsx';

export default function BoardView({ user, token, board, onBack }) {
  const [comments, setComments] = useState(null);
  const [nextCursor, setNextCursor] = useState(null);
  const [activity, setActivity] = useState([]);
  const [status, setStatus] = useState(board.status);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState(null);
  const [draftText, setDraftText] = useState('');
  const [latestId, setLatestId] = useState(null);
  const imgRef = useRef(null);

  const loadActivity = () => {
    api(`/api/boards/${board.id}/activity`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => setActivity(data))
      .catch(() => {});
  };

  useEffect(() => {
    let alive = true;
    api(`/api/boards/${board.id}/comments?limit=50`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (!alive) return;
        setComments(data.items || data);
        setNextCursor(data.nextCursor ?? null);
        setLatestId((data.items || data).length ? (data.items || data)[(data.items || data).length - 1].id : null);
      })
      .catch((err) => alive && setError(err.message));

    loadActivity();

    const socket = getSocket();
    if (!socket) return () => { alive = false; };

    socket.on('comment:new', ({ boardId, comment }) => {
      if (boardId !== board.id) return;
      setComments((prev) => (prev ? [...prev, comment] : [comment]));
      setLatestId(comment.id);
    });
    socket.on('status:change', ({ boardId, status: s }) => {
      if (boardId === board.id) {
        setStatus(s);
        loadActivity();
        toast(`Board moved to ${STATUS_LABEL[s]}`, 'success');
      }
    });

    return () => {
      alive = false;
      socket.off('comment:new');
      socket.off('status:change');
    };
  }, [board.id, token]);

  const loadMore = async () => {
    try {
      const res = await api(`/api/boards/${board.id}/comments?limit=50&cursor=${nextCursor}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setComments((prev) => [...(prev || []), ...(data.items || [])]);
      setNextCursor(data.nextCursor ?? null);
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const handleImageClick = (e) => {
    if (e.target.closest('.pin')) return;
    const rect = imgRef.current.getBoundingClientRect();
    setDraft({ x: ((e.clientX - rect.left) / rect.width) * 100, y: ((e.clientY - rect.top) / rect.height) * 100 });
    setDraftText('');
  };

  const submitDraft = async () => {
    if (!draftText.trim()) return;
    setError('');
    try {
      const res = await api(`/api/boards/${board.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ text: draftText.trim(), x: draft.x, y: draft.y }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add feedback');
      setComments((prev) => [...(prev || []), data]);
      setLatestId(data.id);
      setDraft(null);
      setDraftText('');
      toast('Feedback pinned', 'success');
    } catch (err) {
      setError(err.message);
      toast(err.message, 'error');
    }
  };

  const changeStatus = async (next) => {
    setError('');
    try {
      const res = await api(`/api/boards/${board.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: next }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update status');
      setStatus(data.status);
      toast(`Board moved to ${STATUS_LABEL[data.status]}`, 'success');
    } catch (err) {
      setError(err.message);
      toast(err.message, 'error');
    }
  };

  const stepIndex = STATUS_ORDER.indexOf(status);
  const isDesigner = user.role === 'designer';

  return (
    <div className="app">
      <header className="topbar">
        <button className="ghost" onClick={onBack}>← Boards</button>
        <h1 className="page-title">{board.title}</h1>
        <div className="topbar-right">
          {isDesigner ? (
            <div className="stepper" role="group" aria-label="Board status">
              {STATUS_ORDER.map((s, i) => (
                <button
                  key={s}
                  className={`step ${i === stepIndex ? 'current' : ''} ${i < stepIndex ? 'passed' : ''}`}
                  onClick={() => changeStatus(s)}
                  aria-current={i === stepIndex ? 'step' : undefined}
                >
                  {STATUS_LABEL[s]}
                </button>
              ))}
            </div>
          ) : (
            <span className={`badge ${status}`}>{STATUS_LABEL[status]}</span>
          )}
        </div>
      </header>

      {error && <p className="error center">{error}</p>}

      <div className="board-layout">
        <div className="canvas-wrap">
          <div className="canvas">
            <img
              ref={imgRef}
              src={board.image_url}
              alt={`Design under review: ${board.title}`}
              onClick={handleImageClick}
              draggable={false}
            />
            <span className="zoom-hint">Click design to pin</span>
            {comments &&
              comments.map((c, i) => (
                <div
                  key={c.id}
                  className={`pin ${c.user_id === user.id ? 'mine' : ''} ${c.id === latestId ? 'new' : ''}`}
                  style={{ left: `${c.x}%`, top: `${c.y}%` }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {i + 1}
                  <span className="pin-label">{c.name}</span>
                </div>
              ))}
            {draft && (
              <div className="pin draft" style={{ left: `${draft.x}%`, top: `${draft.y}%` }} aria-hidden="true">
                ?
              </div>
            )}
          </div>
          <p className="hint">Click anywhere on the design to drop a numbered feedback pin — everyone sees it live.</p>
        </div>

        <aside className="comments-panel">
          <h2>
            Feedback
            <span className="count">{comments ? comments.length : '…'}</span>
          </h2>
          <div className="comment-list">
            {comments === null &&
              [0, 1, 2].map((i) => (
                <div className="skeleton line" key={i} style={{ height: 54 }} />
              ))}
            {comments !== null && comments.length === 0 && (
              <p className="muted small">
                No feedback yet. Click the design on the left to drop the first pin.
              </p>
            )}
            {comments &&
              comments.map((c, i) => (
                <div key={c.id} className={`comment ${c.user_id === user.id ? 'mine' : ''}`} style={{ '--i': i }}>
                  <div className="comment-head">
                    <strong>{c.name}</strong>
                    <span className={`badge tiny ${c.role}`}>{c.role}</span>
                  </div>
                  <p>{c.text}</p>
                  <span className="meta">at ({c.x.toFixed(1)}%, {c.y.toFixed(1)}%)</span>
                </div>
              ))}
            {nextCursor && (
              <button className="ghost small" style={{ margin: '0 auto', display: 'block' }} onClick={loadMore}>
                Load more feedback
              </button>
            )}
          </div>

          {activity.length > 0 && (
            <div className="activity">
              <h3>Recent activity</h3>
              {activity.map((a) => (
                <p key={a.id} className="small">
                  <strong>{a.name}</strong> {a.action.replace('status:', 'moved status to ')}
                </p>
              ))}
            </div>
          )}

          {draft && (
            <div className="draft-box">
              <p className="muted small" style={{ marginBottom: 4 }}>
                Pinning at ({draft.x.toFixed(1)}%, {draft.y.toFixed(1)}%)
              </p>
              <textarea
                placeholder="Write your feedback…"
                value={draftText}
                onChange={(e) => setDraftText(e.target.value)}
                autoFocus
              />
              <div className="modal-actions">
                <button className="ghost small" onClick={() => setDraft(null)}>Cancel</button>
                <button className="primary small" onClick={submitDraft}>Pin feedback</button>
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
