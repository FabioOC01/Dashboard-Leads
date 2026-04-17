import { useState, useEffect } from 'react';
import { getVendedores, createVendedor, updateVendedor, deleteVendedor } from '../api/leads';

const ROLES = ['vendedor', 'tecnico'];

const VACIO = { nombre: '', email: '', whatsapp: '', rol: 'vendedor' };

export default function ModalVendedores({ onClose }) {
  const [vendedores, setVendedores] = useState([]);
  const [editando, setEditando] = useState(null); // { id } o null para nuevo
  const [form, setForm] = useState(VACIO);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  const cargar = () => getVendedores().then(setVendedores);

  useEffect(() => { cargar(); }, []);

  const abrirNuevo = () => {
    setEditando('nuevo');
    setForm(VACIO);
    setError('');
  };

  const abrirEditar = (v) => {
    setEditando(v.id);
    setForm({ nombre: v.nombre || '', email: v.email || '', whatsapp: v.whatsapp || '', rol: v.rol || 'vendedor' });
    setError('');
  };

  const cancelar = () => {
    setEditando(null);
    setForm(VACIO);
    setError('');
  };

  const guardar = async (e) => {
    e.preventDefault();
    if (!form.nombre.trim()) { setError('El nombre es obligatorio'); return; }
    setGuardando(true);
    try {
      if (editando === 'nuevo') {
        await createVendedor(form);
      } else {
        await updateVendedor(editando, form);
      }
      await cargar();
      cancelar();
    } catch (err) {
      setError(err.response?.data?.error || 'Error al guardar');
    } finally {
      setGuardando(false);
    }
  };

  const desactivar = async (v) => {
    if (!window.confirm(`¿Desactivar a ${v.nombre}? Ya no aparecerá en los selects.`)) return;
    await deleteVendedor(v.id);
    await cargar();
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#fff', borderRadius: 14, width: 560, maxHeight: '85vh',
          display: 'flex', flexDirection: 'column',
          boxShadow: '0 12px 40px rgba(0,0,0,0.25)',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '20px 24px', borderBottom: '1px solid #eee',
        }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: '#1e2a3b' }}>👥 Gestionar Vendedores</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#999' }}>✕</button>
        </div>

        {/* Formulario edición / nuevo */}
        {editando !== null && (
          <form onSubmit={guardar} style={{ padding: '16px 24px', borderBottom: '1px solid #eee', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#555', marginBottom: 2 }}>
              {editando === 'nuevo' ? 'Nuevo vendedor' : 'Editar vendedor'}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <input
                placeholder="Nombre *"
                value={form.nombre}
                onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                style={inputStyle}
              />
              <select
                value={form.rol}
                onChange={e => setForm(f => ({ ...f, rol: e.target.value }))}
                style={inputStyle}
              >
                {ROLES.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
              </select>
              <input
                placeholder="Email"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                style={inputStyle}
              />
              <input
                placeholder="WhatsApp"
                value={form.whatsapp}
                onChange={e => setForm(f => ({ ...f, whatsapp: e.target.value }))}
                style={inputStyle}
              />
            </div>
            {error && <div style={{ color: '#E74C3C', fontSize: 12 }}>{error}</div>}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" onClick={cancelar} style={btnSecundario}>Cancelar</button>
              <button type="submit" disabled={guardando} style={btnPrimario}>
                {guardando ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </form>
        )}

        {/* Lista */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 24px 16px' }}>
          {vendedores.map(v => (
            <div key={v.id} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '10px 0', borderBottom: '1px solid #f0f0f0',
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: '#1e2a3b' }}>{v.nombre}</div>
                <div style={{ fontSize: 12, color: '#888' }}>
                  {v.rol} {v.email ? `· ${v.email}` : ''} {v.whatsapp ? `· ${v.whatsapp}` : ''}
                </div>
              </div>
              <button
                onClick={() => abrirEditar(v)}
                style={{ background: '#EBF5FB', border: 'none', borderRadius: 6, padding: '5px 10px', cursor: 'pointer', fontSize: 13, color: '#2f6fd4', fontWeight: 600 }}
              >
                Editar
              </button>
              <button
                onClick={() => desactivar(v)}
                title="Desactivar"
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, opacity: 0.4, padding: 4 }}
                onMouseEnter={e => e.currentTarget.style.opacity = 1}
                onMouseLeave={e => e.currentTarget.style.opacity = 0.4}
              >
                🗑️
              </button>
            </div>
          ))}
          {vendedores.length === 0 && (
            <div style={{ color: '#bbb', textAlign: 'center', padding: 24 }}>Sin vendedores activos</div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 24px', borderTop: '1px solid #eee' }}>
          <button onClick={abrirNuevo} style={{ ...btnPrimario, width: '100%' }}>+ Agregar vendedor</button>
        </div>
      </div>
    </div>
  );
}

const inputStyle = {
  padding: '9px 12px', borderRadius: 8, border: '1.5px solid #ddd',
  fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box',
};

const btnPrimario = {
  padding: '9px 20px', borderRadius: 8, border: 'none',
  background: '#2f6fd4', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600,
};

const btnSecundario = {
  padding: '9px 20px', borderRadius: 8, border: '1.5px solid #ddd',
  background: '#fff', color: '#555', cursor: 'pointer', fontSize: 13,
};
