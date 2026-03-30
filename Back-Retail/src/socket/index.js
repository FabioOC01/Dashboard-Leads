module.exports = (io) => {
    io.on('connection', (socket) => {
        console.log(`[SOCKET] Cliente conectado: ${socket.id}`);

        socket.on('disconnect', () => {
            console.log(`[SOCKET] Cliente desconectado: ${socket.id}`);
        });
    });
};