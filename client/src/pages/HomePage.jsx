import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { FaCode, FaTrophy, FaBolt, FaUserSecret, FaGamepad } from 'react-icons/fa'; 
import io from 'socket.io-client';

const socket = io.connect(import.meta.env.DEV ? "http://localhost:5000" : undefined);

const features = [
    {
        icon: <FaBolt className="h-10 w-10 text-yellow-400" />,
        title: "Real-Time 1v1 Duels",
        description: "Face off against real players. Both get the same problem—first to solve it wins the round."
    },
    {
        icon: <FaTrophy className="h-10 w-10 text-purple-400" />,
        title: "Ranked Progression",
        description: "Climb the ladder from Bronze to Radiant. Win matches to gain RP and prove your skill."
    },
    {
        icon: <FaCode className="h-10 w-10 text-cyan-400" />,
        title: "Live Execution",
        description: "Write, run, and submit code in Python, C++, Java, or JS with instant feedback."
    },
    {
        icon: <FaGamepad className="h-10 w-10 text-red-400" />,
        title: "Custom Room",
        description: "Create private lobbies with custom rules, invite friends, or spectate live matches in real-time."
    }
];

const HomePage = () => {
    const [user, setUser] = useState(null);
    const [socketConnected, setSocketConnected] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        const fetchUserProfile = async () => {
            const token = localStorage.getItem('token');
            if (!token) {
                navigate('/login');
                return;
            }
            try {
                const config = { headers: { Authorization: `Bearer ${token}` } };
                const { data } = await axios.get('/api/auth/me', config);
                setUser(data);

                socket.emit("join_room", "global_lobby");
                setSocketConnected(true);

            } catch (error) {
                console.error('Failed to fetch user profile', error);
                localStorage.removeItem('token');
                navigate('/login');
            }
        };
        fetchUserProfile();
    }, [navigate]);

    if (!user) {
        return <div className="min-h-screen bg-black text-white flex items-center justify-center">Loading Arena...</div>;
    }

    return (
        <div className="bg-black text-white font-sans selection:bg-cyan-500/30">
            <div className="min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden">
                
                <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-cyan-900/10 to-black pointer-events-none"></div>

                <header className="absolute top-0 left-0 w-full p-6 flex justify-between items-center z-10">
                    <div className="flex items-center gap-2">
                        <img src="/logo.png" alt="Code Duel Logo" className="h-8 w-8 object-contain" />
                        <h1 className="text-xl font-bold tracking-wider">CODE DUEL</h1>
                    </div>
                    <div>
                        <Link to="/account" className="py-2 px-4 text-sm hover:text-cyan-400 transition">Profile</Link>
                    </div>
                </header>

                <main className="relative z-10 w-full max-w-4xl p-12 text-center bg-gray-900/60 rounded-2xl shadow-2xl border border-cyan-500/20 backdrop-blur-md">
                    <div className="absolute top-4 right-4">
                        <span className={`flex items-center gap-2 text-xs font-mono px-3 py-1 rounded-full border ${socketConnected ? 'border-green-500/30 bg-green-500/10 text-green-400' : 'border-red-500/30 bg-red-500/10 text-red-400'}`}>
                            <span className={`w-2 h-2 rounded-full ${socketConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></span>
                            {socketConnected ? "System Online" : "Disconnected"}
                        </span>
                    </div>

                    <span className="inline-block py-1 px-3 rounded bg-cyan-900/30 text-cyan-400 font-mono text-xs tracking-widest mb-6 border border-cyan-500/30">
                        SEASON 1: GENESIS
                    </span>
                    
                    <h2 className="text-5xl md:text-7xl font-extrabold mb-6 leading-tight tracking-tight">
                        PROVE YOUR <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-600">
                            CODING SKILL
                        </span>
                    </h2>
                    
                    <p className="text-lg text-gray-400 mb-10 max-w-2xl mx-auto">
                        Welcome, <span className="text-white font-semibold">{user.username}</span>. 
                        Enter the matchmaking queue, solve problems faster than your opponent, and climb the ranks to Immortal.
                    </p>
                    
                    <div className="flex flex-col sm:flex-row justify-center gap-4">
                        <Link to="/lobby" className="py-4 px-8 text-lg bg-cyan-500 text-black font-black tracking-wide rounded hover:bg-cyan-400 transition-transform hover:scale-105 shadow-[0_0_20px_rgba(6,182,212,0.5)] flex items-center justify-center gap-2">
                            <FaUserSecret /> PLAY NOW
                        </Link>
                        
                        <Link to="/custom" className="py-4 px-8 text-lg bg-cyan-500 text-black font-black tracking-wide rounded hover:bg-cyan-400 transition-transform hover:scale-105 shadow-[0_0_20px_rgba(6,182,212,0.5)] flex items-center justify-center gap-2">
                            <FaGamepad /> CUSTOM ROOMS
                        </Link>

                        <Link to="/leaderboard" className="py-4 px-8 text-lg bg-transparent text-white font-bold border border-gray-600 rounded hover:border-white hover:bg-white/5 transition-all flex items-center justify-center gap-2">
                            <FaTrophy /> LEADERBOARD
                        </Link>
                    </div>
                </main>
            </div>

            <section className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-b from-black to-gray-900">
                <div className="w-full max-w-6xl">
                    <div className="text-center mb-16">
                        <h3 className="text-3xl font-bold mb-4">GAME FEATURES</h3>
                        <div className="w-20 h-1 bg-cyan-500 mx-auto"></div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {features.map((feature, index) => (
                            <div key={index} className="group bg-gray-800/40 border border-gray-700 hover:border-cyan-500/50 rounded-xl p-8 flex items-start gap-6 transition-all hover:bg-gray-800/60">
                                <div className="p-4 bg-gray-900 rounded-lg group-hover:scale-110 transition-transform">
                                    {feature.icon}
                                </div>
                                <div className="text-left">
                                    <h3 className="text-xl font-bold text-white mb-2 group-hover:text-cyan-400 transition-colors">{feature.title}</h3>
                                    <p className="text-gray-400 leading-relaxed">{feature.description}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>
        </div>
    );
};

export default HomePage;
