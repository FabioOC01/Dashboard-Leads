module.exports = (io) => {
    io.on('connection', (socket) => {
        console.log(`[SOCKET] Cliente conectado: ${socket.id}`);

        socket.on('admin:test_audio', ({ tipo } = {}) => {
            console.log(`[SOCKET] Test audio global: ${tipo}`);
            socket.broadcast.emit('test:audio', { tipo });
        });

        socket.on('disconnect', () => {
            console.log(`[SOCKET] Cliente desconectado: ${socket.id}`);
        });
    });
};