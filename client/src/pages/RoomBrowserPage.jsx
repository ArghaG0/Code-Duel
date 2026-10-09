import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { FaLock, FaUsers, FaEye, FaPlus, FaSearch, FaGamepad } from 'react-icons/fa';
import socket from '../socket';

const RoomBrowserPage = () => {
    const navigate = useNavigate();
    const [rooms, setRooms] = useState([]);
    const [user, setUser] = useState(null);
    const [joinId, setJoinId] = useState("");
    const [joinPassword, setJoinPassword] = useState("");

    useEffect(() => {
        if (!socket.connected) socket.connect();

        const fetchUser = async () => {
            const token = localStorage.getItem('token');
            if (!token) { navigate('/login'); return; }
            try {
                const config = { headers: { Authorization: `Bearer ${token}` } };
                const { data } = await axios.get('/api/auth/me', config);
                setUser(data);
                
                socket.emit('get_rooms');
            } catch {
                navigate('/login');
            }
        };
        fetchUser();

        socket.on('rooms_update', (roomList) => {
            setRooms(roomList);
        });

        socket.on('match_found', (data) => {
            navigate('/battle', { state: { matchData: data } });
        });

        socket.on('error_joining_room', (data) => {
            alert(data?.message || 'Failed to join room');
        });

        return () => {
            socket.off('rooms_update');
            socket.off('match_found');
            socket.off('error_joining_room');
        };
    }, [navigate]);

    const handleJoin = (roomId, needsPassword) => {
        if (!user) return;
        let password = "";
        if (needsPassword) {
            password = prompt("Enter Room Password:");
            if (password === null) return; // user cancelled
        }

        socket.emit('join_custom_room', {
            roomId,
            password: password || "",
            role: 'player',
            userData: { userId: user._id, username: user.username }
        });
    };

    const handleSpectate = (roomId) => {
        if (!user) return;
        socket.emit('join_custom_room', {
            roomId,
            password: "",
            role: 'spectator',
            userData: { userId: user._id, username: user.username }
        });
    };

    const handleManualJoin = (e) => {
        e.preventDefault();
        if (!joinId || !user) return;
        socket.emit('join_custom_room', {
            roomId: joinId.toUpperCase(),
            password: joinPassword,
            role: 'player',
            userData: { userId: user._id, username: user.username }
        });
    };

    return (
        <div className="min-h-screen bg-black text-gray-300 font-sans p-8">
            <header className="flex justify-between items-center mb-12">
                <div>
                    <h1 className="text-4xl font-black text-white tracking-tighter">CUSTOM LOBBY BROWSER</h1>
                    <p className="text-gray-500">Join active matches or create your own tournament.</p>
                </div>
                <div className="flex gap-4">
                    <button 
                        onClick={() => navigate('/')} 
                        className="px-6 py-2 bg-gray-800 hover:bg-gray-700 rounded font-bold transition"
                    >
                        BACK
                    </button>
                    <button 
                        onClick={() => navigate('/custom/create')} 
                        className="px-6 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded font-bold shadow-lg transition flex items-center gap-2"
                    >
                        <FaPlus /> CREATE ROOM
                    </button>
                </div>
            </header>

            <div className="grid grid-cols-3 gap-8">
                <div className="col-span-2 space-y-4">
                    <div className="flex items-center gap-4 bg-gray-900/50 p-4 rounded-lg border border-gray-800">
                        <FaSearch className="text-gray-500" />
                        <input 
                            type="text" 
                            placeholder="Search by Host Name..." 
                            className="bg-transparent outline-none w-full text-white"
                        />
                    </div>

                    <div className="space-y-2">
                        {rooms.length === 0 ? (
                            <div className="text-center py-20 text-gray-600 border border-gray-800 rounded-xl bg-gray-900/20">
                                <FaGamepad className="mx-auto text-4xl mb-4 opacity-50" />
                                <p>No active rooms found.</p>
                                <p className="text-sm">Be the first to host a match!</p>
                            </div>
                        ) : (
                            rooms.map((room) => (
                                <div key={room.roomId} className="bg-[#111] border border-gray-800 p-6 rounded-xl flex items-center justify-between hover:border-purple-500/30 transition group">
                                    <div>
                                        <div className="flex items-center gap-3 mb-1">
                                            <h3 className="text-lg font-bold text-white group-hover:text-purple-400 transition">{room.name}</h3>
                                            {(room.hasPassword || room.password) && <FaLock className="text-xs text-red-500" title="Password protected" />}
                                            <span className="text-xs bg-gray-800 px-2 py-0.5 rounded text-gray-400">{room.rounds} Rounds</span>
                                        </div>
                                        <p className="text-sm text-gray-500">Host: {room.host}</p>
                                    </div>
                                    
                                    <div className="flex items-center gap-6">
                                        <div className="text-right">
                                            <div className="flex items-center gap-2 justify-end text-gray-400">
                                                <FaUsers /> {room.players}/2
                                            </div>
                                            <div className="text-xs text-gray-600">{room.spectators} Spectators</div>
                                        </div>
                                        
                                        <div className="flex gap-2">
                                            {room.players < 2 ? (
                                                <button 
                                                    onClick={() => handleJoin(room.roomId, !!(room.hasPassword || room.password))}
                                                    className="px-6 py-2 bg-cyan-600/20 text-cyan-400 border border-cyan-500/50 rounded font-bold hover:bg-cyan-600 hover:text-white transition"
                                                >
                                                    JOIN
                                                </button>
                                            ) : (
                                                <button 
                                                    onClick={() => handleSpectate(room.roomId)}
                                                    className="px-6 py-2 bg-gray-800 text-gray-400 border border-gray-700 rounded font-bold hover:bg-gray-700 hover:text-white transition flex items-center gap-2"
                                                >
                                                    <FaEye /> WATCH
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                <div className="bg-[#111] border border-gray-800 rounded-xl p-6 h-fit sticky top-8">
                    <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                        <FaLock className="text-purple-500" /> Direct Connect
                    </h2>
                    <form onSubmit={handleManualJoin} className="space-y-4">
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase">Room ID</label>
                            <input 
                                type="text" 
                                value={joinId}
                                onChange={(e) => setJoinId(e.target.value)}
                                className="w-full bg-black border border-gray-700 rounded p-3 text-white font-mono mt-1 focus:border-purple-500 outline-none uppercase tracking-widest"
                                placeholder="XXXXXX"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase">Password</label>
                            <input 
                                type="password" 
                                value={joinPassword}
                                onChange={(e) => setJoinPassword(e.target.value)}
                                className="w-full bg-black border border-gray-700 rounded p-3 text-white mt-1 focus:border-purple-500 outline-none"
                                placeholder="Optional"
                            />
                        </div>
                        <button type="submit" className="w-full py-3 bg-white text-black font-bold rounded hover:bg-gray-200 transition shadow-lg">
                            CONNECT TO ROOM
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default RoomBrowserPage;
