import io from 'socket.io-client';

// Create a single connection instance
const socket = io("http://localhost:5000", {
    autoConnect: false // We will connect manually
});

export default socket;