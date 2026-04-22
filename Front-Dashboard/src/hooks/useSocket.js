import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';

const socket = io(import.meta.env.VITE_API_URL);

export function emitTestAudio(tipo) {
  socket.emit('admin:test_audio', { tipo });
}

export function emitForceReload() {
  socket.emit('admin:force_reload');
}

export function useSocket() {
  const [ultimoEvento, setUltimoEvento] = useState(null);
  const [conectado, setConectado] = useState(socket.connected);
  const [testAudio, setTestAudio] = useState(null);

  useEffect(() => {
    // Sincronizar estado al montar (por si el socket ya conectó antes)
    setConectado(socket.connected);

    const onConnect      = () => setConectado(true);
    const onDisconnect   = () => setConectado(false);
    const onConnectError = () => setConectado(false);
    const onNuevo        = (data) => setUltimoEvento({ tipo: 'nuevo', data });
    const onActualizado  = (data) => setUltimoEvento({ tipo: 'actualizado', data });
    const onVenta        = (data) => setUltimoEvento({ tipo: 'venta_efectiva', data });
    const onCerrado      = (data) => setUltimoEvento({ tipo: 'cerrado', data });
    const onAlerta       = (data) => setUltimoEvento({ tipo: 'alerta', data });
    const onTestAudio    = (data) => setTestAudio({ ...data, _t: Date.now() });
    const onForceReload  = () => setTimeout(() => window.location.reload(), 300);

    socket.on('connect',                onConnect);
    socket.on('disconnect',             onDisconnect);
    socket.on('connect_error',          onConnectError);
    socket.on('lead:nuevo',             onNuevo);
    socket.on('lead:actualizado',       onActualizado);
    socket.on('lead:venta_efectiva',    onVenta);
    socket.on('lead:cerrado',           onCerrado);
    socket.on('lead:alerta_inactividad',onAlerta);
    socket.on('test:audio',             onTestAudio);
    socket.on('force:reload',           onForceReload);

    // Fallback: verificar estado cada 3s por si algún evento se perdió
    const iv = setInterval(() => setConectado(socket.connected), 3000);

    return () => {
      clearInterval(iv);
      socket.off('connect',                onConnect);
      socket.off('disconnect',             onDisconnect);
      socket.off('connect_error',          onConnectError);
      socket.off('lead:nuevo',             onNuevo);
      socket.off('lead:actualizado',       onActualizado);
      socket.off('lead:venta_efectiva',    onVenta);
      socket.off('lead:cerrado',           onCerrado);
      socket.off('lead:alerta_inactividad',onAlerta);
      socket.off('test:audio',             onTestAudio);
      socket.off('force:reload',           onForceReload);
    };
  }, []);

  return { ultimoEvento, conectado, testAudio };
}
