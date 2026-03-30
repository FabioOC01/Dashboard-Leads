import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';

const socket = io(import.meta.env.VITE_API_URL);

export function useSocket() {
  const [ultimoEvento, setUltimoEvento] = useState(null);
  const [conectado, setConectado] = useState(socket.connected);

  useEffect(() => {
    socket.on('connect',               ()     => setConectado(true));
    socket.on('disconnect',            ()     => setConectado(false));
    socket.on('connect_error',         ()     => setConectado(false));
    socket.on('lead:nuevo',            (data) => setUltimoEvento({ tipo: 'nuevo', data }));
    socket.on('lead:actualizado',      (data) => setUltimoEvento({ tipo: 'actualizado', data }));
    socket.on('lead:cerrado',          (data) => setUltimoEvento({ tipo: 'cerrado', data }));
    socket.on('lead:alerta_inactividad',(data) => setUltimoEvento({ tipo: 'alerta', data }));

    return () => socket.removeAllListeners();
  }, []);

  return { ultimoEvento, conectado };
}
