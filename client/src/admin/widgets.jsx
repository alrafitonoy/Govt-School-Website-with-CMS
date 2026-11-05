import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Bold, Check, FileText, Film, Heading2, Heading3, ImagePlus, Images, Italic, Link as LinkIcon, List, ListOrdered, Plus, Quote, RemoveFormatting, Music, Trash2, Underline, Upload, X } from 'lucide-react';
import { api, asset } from '../lib/api.js';
import { Alert, Pagination, Spinner, useLoad } from '../lib/ui.jsx';

const ToastContext = createContext(() => {});
export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);
  const timer = useRef();
  const show = (message, isError = false) => {
    setToast({ message, isError });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), isError ? 6000 : 3000);
  };
  return (
    <ToastContext.Provider value={show}>
      {children}
      {toast && <div className={`toast ${toast.isError ? 'err' : ''}`} role="status">{toast.message}</div>}
    </ToastContext.Provider>
  );
}

// Wraps an async action with a success or error toast.
export function useAction() {
  const toast = useToast();
  return async (fn, successMessage) => {
    try {
      const result = await fn();
      if (successMessage) toast(successMessage);
      return result ?? true;
    } catch (err) {
      toast(err.message, true);
      return false;
    }
  };
}

export function Modal({ title, onClose, children, footer, wide }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="modal-wrap" role="dialog" aria-modal="true" aria-label={title}>
      <div className={`modal ${wide ? 'wide' : ''}`}>
        <div className="modal-head"><h2>{title}</h2><button type="button" className="icon-btn" aria-label="Close" onClick={onClose}><X size={18} /></button></div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function Switch({ checked, onChange, label, disabled }) {
  return (
    <label className="switch">
      <input type="checkbox" checked={Boolean(checked)} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <i />
      {label && <span>{label}</span>}
    </label>
  );
}

export function ConfirmDelete({ onConfirm, label = 'Delete', message = 'Delete this item? This cannot be undone.' }) {
  return (
    <button type="button" className="btn btn-danger btn-sm" onClick={() => window.confirm(message) && onConfirm()} aria-label={label}>
      <Trash2 size={14} />
    </button>
  );
}

// Accepts files dragged from the computer. Anything else being dragged is ignored.
export function DropZone({ onFiles, disabled, className = '', children }) {
  const [over, setOver] = useState(false);
  const hasFiles = (e) => [...(e.dataTransfer?.types || [])].includes('Files');
  return (
    <div
      className={`drop-zone ${over ? 'drag-over' : ''} ${className}`}
      onDragOver={(e) => { if (hasFiles(e) && !disabled) { e.preventDefault(); setOver(true); } }}
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setOver(false); }}
      onDrop={(e) => {
        if (!hasFiles(e)) return;
        e.preventDefault();
        setOver(false);
        if (!disabled) onFiles([...e.dataTransfer.files]);
      }}
    >
      {children}
    </div>
  );
}

const PURPOSE_KINDS = { image: 'image', logo: 'image', favicon: 'image,icon', notice: 'image,pdf', document: 'image,pdf', video: 'video', audio: 'audio' };
const fileSize = (n) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

// Choose files already in the media library, or add new ones right here.
export function MediaPicker({ purpose = 'image', multiple = false, onPick, onClose }) {
  const [page, setPage] = useState(1);
  const [chosen, setChosen] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const kinds = PURPOSE_KINDS[purpose] || 'image';
  const { data, loading, reload } = useLoad(`/admin/media?kind=${kinds}&page=${page}&limit=24`);

  const toggle = (m) => setChosen((list) => {
    if (list.some((x) => x.id === m.id)) return list.filter((x) => x.id !== m.id);
    return multiple ? [...list, m] : [m];
  });

  const add = async (files) => {
    setBusy(true);
    setError('');
    const added = [];
    for (const file of files) {
      try {
        added.push(await api.upload(file, purpose));
      } catch (err) {
        setError(`${file.name}: ${err.message}`);
      }
    }
    setBusy(false);
    if (added.length) {
      setChosen((list) => (multiple ? [...list, ...added] : [added[0]]));
      setPage(1);
      reload();
    }
  };

  return (
    <Modal
      wide
      title="Media Library"
      onClose={onClose}
      footer={<>
        <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button type="button" className="btn btn-primary" disabled={!chosen.length} onClick={() => onPick(chosen)}>{multiple && chosen.length ? `Use ${chosen.length} selected` : 'Use selected'}</button>
      </>}
    >
      <DropZone onFiles={add} disabled={busy} className="picker-drop">
        <Upload size={20} aria-hidden="true" />
        <span>{busy ? 'Uploading...' : 'Drag files here, or'}</span>
        {!busy && (
          <span className="btn btn-ghost btn-sm file-btn">
            Upload new
            <input type="file" multiple={multiple} onChange={(e) => { const f = [...e.target.files]; e.target.value = ''; add(f); }} aria-label="Upload new files" />
          </span>
        )}
      </DropZone>
      {error && <div style={{ marginBlock: 10 }}><Alert>{error}</Alert></div>}
      {loading && !data && <Spinner />}
      {data && data.items.length === 0 && <div className="empty">Nothing here yet. Upload the first file above.</div>}
      {data && data.items.length > 0 && (
        <div className="picker-grid" role="listbox" aria-multiselectable={multiple} aria-label="Files">
          {data.items.map((m) => {
            const selected = chosen.some((x) => x.id === m.id);
            return (
              <button
                type="button"
                key={m.id}
                role="option"
                aria-selected={selected}
                className={`picker-item ${selected ? 'selected' : ''}`}
                title={m.original_name}
                onClick={() => toggle(m)}
                onDoubleClick={() => onPick(multiple ? [...chosen.filter((x) => x.id !== m.id), m] : [m])}
              >
                <span className="thumb">
                  {m.kind === 'image' || m.kind === 'icon' ? <img src={asset(m.thumb_url || m.url)} alt="" loading="lazy" />
                    : m.kind === 'pdf' ? <FileText size={30} /> : m.kind === 'audio' ? <Music size={30} /> : <Film size={30} />}
                </span>
                {selected && <span className="tick"><Check size={15} /></span>}
                <span className="name">{m.original_name}</span>
                <span className="size">{fileSize(m.size)}</span>
              </button>
            );
          })}
        </div>
      )}
      {data && <Pagination page={data.page} total={data.total} limit={data.limit} onPage={setPage} />}
    </Modal>
  );
}

export function Upload_({ value, purpose = 'image', onChange, kindLabel }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [picking, setPicking] = useState(false);
  const send = async (file) => {
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      const m = await api.upload(file, purpose);
      onChange(m.url, m);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };
  const isImage = value && /\.(webp|png|jpe?g|ico)$/i.test(value);
  return (
    <div>
      <DropZone onFiles={(files) => send(files[0])} disabled={busy} className="upload">
        {isImage && <img src={asset(value)} alt="" />}
        {value && !isImage && <span className="upload-name">{value}</span>}
        <span className="btn btn-ghost btn-sm file-btn">
          <Upload size={14} /> {busy ? 'Uploading...' : value ? 'Replace' : kindLabel || 'Upload'}
          <input type="file" onChange={(e) => { const f = e.target.files[0]; e.target.value = ''; send(f); }} disabled={busy} aria-label={kindLabel || 'Upload file'} />
        </span>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPicking(true)}><Images size={14} /> Choose from media</button>
        {value && <button type="button" className="btn btn-ghost btn-sm" onClick={() => onChange('')}>Remove</button>}
        <span className="drop-hint">or drag a file here</span>
      </DropZone>
      {error && <span className="err">{error}</span>}
      {picking && <MediaPicker purpose={purpose} onClose={() => setPicking(false)} onPick={([m]) => { onChange(m.url, m); setPicking(false); }} />}
    </div>
  );
}

// The photos of an album: upload many at once, drag them in, or pick from the library.
function GalleryField({ value = [], onChange }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [picking, setPicking] = useState(false);
  const latest = useRef(value);
  latest.current = value;
  const set = (next) => { latest.current = next; onChange(next); };
  const toPhoto = (m) => ({ url: m.url, thumb: m.thumb_url || null, caption: '' });

  const addFiles = async (files) => {
    setBusy(true);
    setError('');
    for (const file of files) {
      try {
        set([...latest.current, toPhoto(await api.upload(file, 'image'))]);
      } catch (err) {
        setError(`${file.name}: ${err.message}`);
      }
    }
    setBusy(false);
  };
  const move = (i, d) => {
    const next = [...value];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    set(next);
  };

  return (
    <div>
      <DropZone onFiles={addFiles} disabled={busy} className="picker-drop">
        <Upload size={20} aria-hidden="true" />
        <span>{busy ? 'Uploading...' : 'Drag photos here, or'}</span>
        <span className="btn btn-ghost btn-sm file-btn">
          Upload photos
          <input type="file" multiple accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={(e) => { const f = [...e.target.files]; e.target.value = ''; addFiles(f); }} aria-label="Upload photos" />
        </span>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPicking(true)}><Images size={14} /> Choose from media</button>
      </DropZone>
      {error && <p className="err" style={{ marginTop: 6 }}>{error}</p>}
      {value.length > 0 && (
        <div className="album-photos">
          {value.map((p, i) => (
            <div className="album-photo" key={`${p.url}${i}`}>
              <img src={asset(p.thumb || p.url)} alt="" loading="lazy" />
              <input aria-label={`Caption for photo ${i + 1}`} placeholder="Caption" value={p.caption || ''} onChange={(e) => set(value.map((x, n) => (n === i ? { ...x, caption: e.target.value } : x)))} />
              <div className="album-photo-actions">
                <button type="button" className="icon-btn" aria-label="Move earlier" disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp size={14} /></button>
                <button type="button" className="icon-btn" aria-label="Move later" disabled={i === value.length - 1} onClick={() => move(i, 1)}><ArrowDown size={14} /></button>
                <button type="button" className="icon-btn" aria-label="Remove photo" onClick={() => set(value.filter((_, n) => n !== i))}><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
      {picking && <MediaPicker multiple purpose="image" onClose={() => setPicking(false)} onPick={(items) => { set([...latest.current, ...items.map(toPhoto)]); setPicking(false); }} />}
    </div>
  );
}

const ICON = 16;
export function RichEditor({ value, onChange }) {
  const area = useRef(null);
  const savedRange = useRef(null);
  const [picking, setPicking] = useState(false);
  const initial = useRef(value);
  useEffect(() => {
    // Saved HTML was sanitised by the server, and is sanitised again when this editor saves.
    if (area.current) area.current.innerHTML = initial.current || '';
    document.execCommand('defaultParagraphSeparator', false, 'p');
  }, []);
  const emit = () => onChange(area.current.innerHTML);
  const cmd = (name, arg) => {
    area.current.focus();
    document.execCommand(name, false, arg);
    emit();
  };
  const addLink = () => {
    const url = window.prompt('Link address (https://...)');
    if (url) cmd('createLink', url);
  };
  const openPicker = () => {
    const sel = window.getSelection();
    savedRange.current = sel.rangeCount && area.current.contains(sel.anchorNode) ? sel.getRangeAt(0).cloneRange() : null;
    setPicking(true);
  };
  const insertImage = (url) => {
    setPicking(false);
    area.current.focus();
    if (savedRange.current) {
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(savedRange.current);
    }
    cmd('insertImage', url);
  };
  const B = ({ label, onClick, children }) => (
    <button type="button" aria-label={label} title={label} onMouseDown={(e) => e.preventDefault()} onClick={onClick}>{children}</button>
  );
  return (
    <div className="rte">
      <div className="rte-bar">
        <B label="Bold" onClick={() => cmd('bold')}><Bold size={ICON} /></B>
        <B label="Italic" onClick={() => cmd('italic')}><Italic size={ICON} /></B>
        <B label="Underline" onClick={() => cmd('underline')}><Underline size={ICON} /></B>
        <B label="Large heading" onClick={() => cmd('formatBlock', 'H2')}><Heading2 size={ICON} /></B>
        <B label="Small heading" onClick={() => cmd('formatBlock', 'H3')}><Heading3 size={ICON} /></B>
        <B label="Paragraph" onClick={() => cmd('formatBlock', 'P')}>P</B>
        <B label="Bulleted list" onClick={() => cmd('insertUnorderedList')}><List size={ICON} /></B>
        <B label="Numbered list" onClick={() => cmd('insertOrderedList')}><ListOrdered size={ICON} /></B>
        <B label="Quote" onClick={() => cmd('formatBlock', 'BLOCKQUOTE')}><Quote size={ICON} /></B>
        <B label="Link" onClick={addLink}><LinkIcon size={ICON} /></B>
        <B label="Image" onClick={openPicker}><ImagePlus size={ICON} /></B>
        <B label="Clear formatting" onClick={() => cmd('removeFormat')}><RemoveFormatting size={ICON} /></B>
      </div>
      <div ref={area} className="rte-area prose" contentEditable suppressContentEditableWarning onInput={emit} onBlur={emit} role="textbox" aria-multiline="true" />
      {picking && <MediaPicker onClose={() => setPicking(false)} onPick={([m]) => insertImage(m.url)} />}
    </div>
  );
}

function AttachmentsField({ value = [], onChange, purpose = 'notice' }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [picking, setPicking] = useState(false);
  const latest = useRef(value);
  latest.current = value;
  const toAttachment = (m) => ({ url: m.url, kind: m.kind, name: m.original_name, thumb: m.thumb_url });
  const addFiles = async (list) => {
    setBusy(true);
    setError('');
    for (const file of list) {
      try {
        const next = [...latest.current, toAttachment(await api.upload(file, purpose))];
        latest.current = next;
        onChange(next);
      } catch (err) {
        setError(`${file.name}: ${err.message}`);
      }
    }
    setBusy(false);
  };
  return (
    <div>
      <DropZone onFiles={addFiles} disabled={busy} className="upload">
        <span className="btn btn-ghost btn-sm file-btn">
          <Upload size={14} /> {busy ? 'Uploading...' : 'Attach PDF, JPG, JPEG or PNG'}
          <input type="file" multiple accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" onChange={(e) => { const f = [...e.target.files]; e.target.value = ''; addFiles(f); }} disabled={busy} aria-label="Attach files" />
        </span>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPicking(true)}><Images size={14} /> Choose from media</button>
        <span className="drop-hint">or drag files here</span>
      </DropZone>
      {error && <p className="err" style={{ marginTop: 6 }}>{error}</p>}
      {value.map((a, i) => (
        <div className="attach-row" key={a.url}>
          <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center', minWidth: 0 }}><FileText size={15} style={{ flex: 'none' }} /> {a.name || a.url}</span>
          <button type="button" className="icon-btn" aria-label="Remove attachment" onClick={() => onChange(value.filter((_, x) => x !== i))}><X size={14} /></button>
        </div>
      ))}
      {picking && <MediaPicker multiple purpose={purpose} onClose={() => setPicking(false)} onPick={(items) => { onChange([...value, ...items.filter((m) => !value.some((v) => v.url === m.url)).map(toAttachment)]); setPicking(false); }} />}
    </div>
  );
}

function ListField({ field, value = [], onChange, ctx }) {
  const move = (i, d) => {
    const next = [...value];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    onChange(next);
  };
  return (
    <div>
      {value.map((item, i) => (
        <div className="list-item" key={i}>
          <div className="list-item-head">
            <button type="button" className="icon-btn" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp size={14} /></button>
            <button type="button" className="icon-btn" aria-label="Move down" disabled={i === value.length - 1} onClick={() => move(i, 1)}><ArrowDown size={14} /></button>
            <button type="button" className="icon-btn" aria-label="Remove" onClick={() => onChange(value.filter((_, x) => x !== i))}><Trash2 size={14} /></button>
          </div>
          <SchemaFields fields={field.fields} value={item} onChange={(v) => onChange(value.map((x, n) => (n === i ? v : x)))} ctx={ctx} idPrefix={`${field.key}-${i}-`} />
        </div>
      ))}
      <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: 8 }} onClick={() => onChange([...value, {}])}><Plus size={14} /> Add</button>
    </div>
  );
}

function FieldControl({ field, id, value, set, whole, ctx }) {
  switch (field.type) {
    case 'textarea':
      return <textarea id={id} value={value ?? ''} onChange={(e) => set(e.target.value)} />;
    case 'html':
      return <RichEditor value={value} onChange={set} />;
    case 'image':
    case 'upload':
      return <Upload_ value={value} purpose={typeof field.purpose === 'function' ? field.purpose(whole) : field.purpose || 'image'} onChange={(url, media) => { field.onUpload ? field.onUpload(url, media, set, whole, ctx) : set(url); }} />;
    case 'attachments':
      return <AttachmentsField value={value} onChange={set} />;
    case 'gallery':
      return <GalleryField value={value} onChange={set} />;
    case 'number':
      return <input id={id} type="number" min={field.min} max={field.max} step="any" value={value ?? ''} onChange={(e) => set(e.target.value)} />;
    case 'date':
      return <input id={id} type="date" value={value ?? ''} onChange={(e) => set(e.target.value)} />;
    case 'color':
      return <input id={id} type="color" value={value || (field.key === 'secondary_color' ? '#0a5fd6' : '#000080')} style={{ padding: 4, width: 72 }} onChange={(e) => set(e.target.value)} />;
    case 'select':
      return (
        <select id={id} value={value ?? ''} onChange={(e) => set(e.target.value)}>
          {field.placeholder !== false && !field.options?.some((o) => (o.value ?? o) === '') && <option value="">{field.placeholder || 'Select'}</option>}
          {(field.options || []).map((o) => <option key={o.value ?? o} value={o.value ?? o}>{o.label ?? o}</option>)}
        </select>
      );
    case 'secret':
      return (
        <div>
          <input id={id} type="password" autoComplete="new-password" placeholder={whole[`${field.key}__set`] ? 'Saved. Leave empty to keep it.' : ''} value={value ?? ''} onChange={(e) => set(e.target.value)} />
        </div>
      );
    case 'classes': {
      const list = ctx?.classes || [];
      const chosen = value || [];
      return (
        <div className="perm-grid">
          {list.map((c) => (
            <label className="check" key={c.id}>
              <input type="checkbox" checked={chosen.includes(c.id)} onChange={(e) => set(e.target.checked ? [...chosen, c.id] : chosen.filter((x) => x !== c.id))} /> {c.name}
            </label>
          ))}
        </div>
      );
    }
    case 'class_fees': {
      const list = ctx?.classes || [];
      const fees = value || {};
      return (
        <div className="perm-grid">
          {list.map((c) => (
            <div className="field" key={c.id}>
              <label htmlFor={`${id}-${c.id}`}>{c.name}</label>
              <input id={`${id}-${c.id}`} type="number" min="0" value={fees[c.id] ?? ''} onChange={(e) => set({ ...fees, [c.id]: e.target.value })} />
            </div>
          ))}
        </div>
      );
    }
    case 'list':
      return <ListField field={field} value={value} onChange={set} ctx={ctx} />;
    default:
      return <input id={id} type="text" value={value ?? ''} onChange={(e) => set(e.target.value)} />;
  }
}

const FULL_WIDTH = ['html', 'textarea', 'list', 'attachments', 'gallery', 'classes', 'class_fees'];

export function SchemaFields({ fields, value, onChange, ctx, idPrefix = '' }) {
  return (
    <div className="grid-2">
      {fields.filter((f) => !f.visible || f.visible(value)).map((f) => {
        const id = `${idPrefix}${f.key}`;
        const set = (v) => onChange({ ...value, [f.key]: v });
        if (f.type === 'switch') {
          return <div key={f.key} className="field full"><Switch checked={value[f.key]} onChange={set} label={f.label} />{f.help && <span className="help">{f.help}</span>}</div>;
        }
        return (
          <div key={f.key} className={`field ${FULL_WIDTH.includes(f.type) || f.full ? 'full' : ''}`}>
            <label htmlFor={id}>{f.label} {f.required && <span className="req">*</span>}</label>
            <FieldControl field={f} id={id} value={value[f.key]} set={set} whole={value} ctx={ctx} />
            {f.help && <span className="help">{f.help}</span>}
          </div>
        );
      })}
    </div>
  );
}

// Renders fields grouped by their `section`, for settings pages.
export function SchemaForm({ fields, value, onChange, ctx }) {
  const groups = [];
  for (const f of fields) {
    const name = f.section || '';
    let g = groups.find((x) => x.name === name);
    if (!g) groups.push((g = { name, fields: [] }));
    g.fields.push(f);
  }
  return (
    <div className="stack">
      {groups.map((g) => (
        <div key={g.name}>
          {g.name && <h3 style={{ fontSize: '.95rem', marginBottom: 12 }}>{g.name}</h3>}
          <SchemaFields fields={g.fields} value={value} onChange={onChange} ctx={ctx} />
        </div>
      ))}
    </div>
  );
}

export function PageHead({ title, intro, children }) {
  return (
    <div className="ad-head">
      <div><h1>{title}</h1>{intro && <p>{intro}</p>}</div>
      {children && <div className="ad-actions">{children}</div>}
    </div>
  );
}

// Add, edit and delete screen for one kind of record, described by columns and fields.
export function Manager({ title, intro, url, columns, fields, blank, addLabel = 'Add', headerExtra, note, normalize, wide }) {
  const [state, setState] = useState({ items: null, error: null });
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const run = useAction();

  const load = () => api.get(`${url}?limit=200`).then((d) => setState({ items: d.items, error: null })).catch((e) => setState({ items: [], error: e.message }));
  useEffect(() => { load(); }, [url]);

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      if (editing.id) await api.put(`${url}/${editing.id}`, editing);
      else await api.post(url, editing);
      setEditing(null);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHead title={title} intro={intro}>
        {headerExtra}
        <button className="btn btn-primary" onClick={() => { setError(''); setEditing(typeof blank === 'function' ? blank() : { ...blank }); }}><Plus size={16} /> {addLabel}</button>
      </PageHead>
      {note}
      {state.error && <Alert>{state.error}</Alert>}
      {state.items && state.items.length === 0 && !state.error && <div className="box empty">Nothing here yet.</div>}
      {state.items && state.items.length > 0 && (
        <div className="scroll">
          <table className="ad-table">
            <thead><tr>{columns.map((c) => <th key={c.label}>{c.label}</th>)}<th /></tr></thead>
            <tbody>
              {state.items.map((row) => (
                <tr key={row.id}>
                  {columns.map((c) => <td key={c.label}>{c.render ? c.render(row) : row[c.key]}</td>)}
                  <td className="actions">
                    <button className="btn btn-ghost btn-sm" onClick={() => { setError(''); setEditing(normalize ? normalize(row) : row); }}>Edit</button>
                    <ConfirmDelete onConfirm={() => run(async () => { await api.del(`${url}/${row.id}`); load(); }, 'Deleted')} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editing && (
        <Modal
          wide={wide}
          title={editing.id ? `Edit` : addLabel}
          onClose={() => setEditing(null)}
          footer={<><button className="btn btn-ghost" onClick={() => setEditing(null)}>Cancel</button><button className="btn btn-primary" disabled={saving} onClick={save}>{saving ? 'Saving...' : 'Save'}</button></>}
        >
          {error && <div style={{ marginBottom: 14 }}><Alert>{error}</Alert></div>}
          <SchemaFields fields={fields} value={editing} onChange={setEditing} />
        </Modal>
      )}
    </>
  );
}

export const YesNo = ({ value, yes = 'Published', no = 'Hidden' }) => <span className={`badge ${value ? 'badge-good' : ''}`}>{value ? yes : no}</span>;
