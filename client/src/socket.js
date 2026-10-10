import io from 'socket.io-client';

// Create a single connection instance
const socket = io(import.meta.env.DEV ? "http://localhost:5000" : undefined, {
    autoConnect: false // We will connect manually
});

export default socket;
