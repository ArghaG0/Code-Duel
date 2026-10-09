import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { FaUserSecret, FaSearch, FaCopy, FaGamepad, FaCheckCircle, FaExclamationCircle } from 'react-icons/fa';
import socket from '../socket';

const LobbyPage = () => {
    const [user, setUser] = useState(null);
    const [isSearching, setIsSearching] = useState(false);
    const [status, setStatus] = useState("Ready to queue");
    const [customRoomCode, setCustomRoomCode] = useState('');
    const [isCustomMode, setIsCustomMode] = useState(false);
    const [notification, setNotification] = useState(null);
    const [, setLobbyCounts] = useState({ players: 0, spectators: 0 });
    
    const navigate = useNavigate();
    const location = useLocation();

    const showNotification = (message, type = 'success') => {
        setNotification({ message, type });
        setTimeout(() => setNotification(null), 3000);
    };

    useEffect(() => {
        if (location.state?.customRoomId) {
            setIsCustomMode(true);
            setCustomRoomCode(location.state.customRoomId);
            setStatus("Waiting for players to join...");
            setIsSearching(true);
        } else if (location.state?.joinCode) {
            setIsCustomMode(true);
            setStatus(`Joining Room ${location.state.joinCode}...`);
            setIsSearching(true);
        }

        const fetchUserProfile = async () => {
            const token = localStorage.getItem('token');
            if (!token) { navigate('/login'); return; }
            
            try {
                const config = { headers: { Authorization: `Bearer ${token}` } };
                const { data } = await axios.get('/api/auth/me', config);
                setUser(data);
            } catch (error) {
                console.error(error);
                navigate('/login');
            }
        };
        fetchUserProfile();

        if (!socket.connected) socket.connect();

        function onMatchFound(data) {
            setStatus(`Opponent Found: ${data.opponent.username || 'Player'}!`);
            setTimeout(() => {
                navigate('/battle', { state: { matchData: data } });
            }, 1500);
        }

        function onCustomRoomCreated(data) {
            setCustomRoomCode(data.roomId);
            setStatus("Waiting for friend to join...");
        }

        function onErrorJoining(data) {
            showNotification(data.message, 'error');
            setIsSearching(false);
            setIsCustomMode(false);
            setStatus("Ready to queue");
        }

        function onLobbyUpdate(data) {
            setLobbyCounts(data);
            setStatus(`Waiting... (${data.players}/2 Players, ${data.spectators} Spectators)`);
        }

        socket.on('match_found', onMatchFound);
        socket.on('custom_room_created', onCustomRoomCreated);
        socket.on('error_joining_room', onErrorJoining);
        socket.on('lobby_update', onLobbyUpdate);

        return () => {
            socket.off('match_found', onMatchFound);
            socket.off('custom_room_created', onCustomRoomCreated);
            socket.off('error_joining_room', onErrorJoining);
            socket.off('lobby_update', onLobbyUpdate);
        };
    }, [navigate, location.state]);

    const handleFindMatch = () => {
        if (!user) return;
        setIsSearching(true);
        setStatus("Searching for opponent...");
        socket.emit('find_match', { 
            userId: user._id,
            username: user.username, 
            rank: "Bronze" 
        });
    };

    const copyCode = () => {
        navigator.clipboard.writeText(customRoomCode);
        showNotification("Room Code Copied!");
    };

    const handleLeave = () => {
        socket.emit('leave_room');
        navigate('/');
    };

    return (
        <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-4 font-sans selection:bg-cyan-500/30 relative">
            
            {notification && (
                <div className={`fixed top-8 left-1/2 transform -translate-x-1/2 px-6 py-3 rounded-lg shadow-2xl flex items-center gap-3 z-50 animate-fadeIn ${
                    notification.type === 'error' ? 'bg-red-500 text-white' : 'bg-green-500 text-white'
                }`}>
                    {notification.type === 'error' ? <FaExclamationCircle /> : <FaCheckCircle />}
                    <span className="font-bold text-sm">{notification.message}</span>
                </div>
            )}

            <div className="max-w-md w-full bg-gray-900/50 border border-gray-800 rounded-xl p-8 text-center shadow-[0_0_50px_rgba(0,0,0,0.5)] backdrop-blur-sm">
                
                <div className="relative w-32 h-32 mx-auto mb-8 flex items-center justify-center">
                    {isSearching && (
                        <>
                            <div className={`absolute w-full h-full rounded-full animate-ping ${!isCustomMode ? 'bg-cyan-500/10' : 'bg-purple-500/10'}`}></div>
                            <div className={`absolute w-24 h-24 rounded-full animate-pulse ${!isCustomMode ? 'bg-cyan-500/20' : 'bg-purple-500/20'}`}></div>
                        </>
                    )}
                    {!isCustomMode ? (
                        <FaUserSecret className={`text-5xl relative z-10 transition-colors ${isSearching ? 'text-cyan-400' : 'text-gray-600'}`} />
                    ) : (
                        <FaGamepad className={`text-5xl relative z-10 transition-colors ${isSearching ? 'text-purple-400' : 'text-gray-600'}`} />
                    )}
                </div>

                <h2 className={`text-2xl font-bold tracking-widest uppercase mb-2 ${!isCustomMode ? 'text-cyan-400' : 'text-purple-400'}`}>
                    {!isCustomMode ? "Competitive Queue" : "Custom Lobby"}
                </h2>
                
                <p className="text-gray-400 font-mono text-sm mb-8 min-h-[20px]">
                    {status}
                </p>

                {user && (
                    <div className="inline-flex items-center justify-center gap-3 bg-gray-800/50 py-2 px-4 rounded-lg mb-8">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <span className="text-sm text-gray-300">{user.username} <span className="text-gray-600">|</span> Bronze</span>
                    </div>
                )}

                {!isCustomMode && (
                    !isSearching ? (
                        <button 
                            onClick={handleFindMatch}
                            className="w-full py-4 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded flex items-center justify-center gap-2 transition-all shadow-lg"
                        >
                            <FaSearch /> FIND MATCH
                        </button>
                    ) : (
                        <div className="text-cyan-500 font-mono animate-pulse">Scanning network...</div>
                    )
                )}

                {isCustomMode && customRoomCode && (
                    <div className="bg-gray-800 p-4 rounded border border-purple-500/50 mt-4">
                        <p className="text-gray-400 text-xs mb-2 uppercase tracking-wide">Share Room Code</p>
                        <div className="flex items-center justify-center gap-4">
                            <span className="text-3xl font-mono font-bold text-white">{customRoomCode}</span>
                            <button onClick={copyCode} className="text-gray-400 hover:text-white transition-colors">
                                <FaCopy />
                            </button>
                        </div>
                    </div>
                )}
            </div>
            
            <button onClick={handleLeave} className="mt-8 text-gray-500 hover:text-white text-sm transition">Return to Menu</button>
        </div>
    );
};

export default LobbyPage;
