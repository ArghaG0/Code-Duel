import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';

// ✅ FIXED: correct icon package
import { FiLogOut, FiUser, FiActivity } from 'react-icons/fi';

const AccountPage = () => {
    const [user, setUser] = useState(null);
    const [username, setUsername] = useState('');
    const [message, setMessage] = useState('');
    const [activeTab, setActiveTab] = useState('profile');
    const [matchHistory, setMatchHistory] = useState([]);

    const navigate = useNavigate();

    // ===================== FETCH USER DATA =====================
    useEffect(() => {
        const fetchUserData = async () => {
            const token = localStorage.getItem('token');
            if (!token) {
                navigate('/login');
                return;
            }

            const config = {
                headers: { Authorization: `Bearer ${token}` }
            };

            try {
                const userRes = await axios.get('/api/auth/me', config);
                if (!userRes?.data) throw new Error('No user data');

                setUser(userRes.data);
                setUsername(userRes.data.username || '');

                try {
                    const historyRes = await axios.get('/api/matches/history', config);
                    setMatchHistory(
                        Array.isArray(historyRes?.data) ? historyRes.data : []
                    );
                } catch {
                    setMatchHistory([]);
                }

            } catch (err) {
                console.error(err);
                localStorage.removeItem('token');
                navigate('/login');
            }
        };

        fetchUserData();
    }, [navigate]);

    // ===================== UPDATE PROFILE =====================
    const handleSubmit = async (e) => {
        e.preventDefault();
        setMessage('');

        try {
            const token = localStorage.getItem('token');
            const config = {
                headers: { Authorization: `Bearer ${token}` }
            };

            const { data } = await axios.put(
                '/api/users/profile',
                { username },
                config
            );

            setUser(data);
            setMessage('Profile updated successfully!');
        } catch {
            setMessage('Failed to update profile.');
        }
    };

    // ===================== LOGOUT =====================
    const handleLogout = () => {
        localStorage.removeItem('token');
        navigate('/login');
    };

    // ===================== LOADING STATE =====================
    if (!user) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center text-white">
                Loading...
            </div>
        );
    }

    const userIdStr = String(user._id);

    return (
        <div className="min-h-screen bg-black text-gray-300 flex flex-col font-sans">
            {/* ================= HEADER ================= */}
            <header className="bg-gray-900/50 border-b border-gray-800 p-4 flex justify-between items-center">
                <h1 className="text-xl font-bold text-white tracking-widest">
                    COMMAND CENTER
                </h1>
                <Link
                    to="/"
                    className="py-2 px-4 text-sm bg-gray-800 rounded hover:bg-gray-700 text-white transition"
                >
                    ← Dashboard
                </Link>
            </header>

            <div className="flex flex-grow">
                {/* ================= SIDEBAR ================= */}
                <aside className="w-64 bg-gray-900/30 border-r border-gray-800 p-6 flex flex-col justify-between">
                    <nav className="space-y-2">
                        <button
                            onClick={() => setActiveTab('profile')}
                            className={`w-full flex items-center px-4 py-3 rounded text-sm font-bold transition ${
                                activeTab === 'profile'
                                    ? 'bg-cyan-900/30 text-cyan-400 border border-cyan-500/30'
                                    : 'hover:bg-gray-800 text-gray-400'
                            }`}
                        >
                            <FiUser className="mr-3" />
                            PROFILE
                        </button>

                        <button
                            onClick={() => setActiveTab('history')}
                            className={`w-full flex items-center px-4 py-3 rounded text-sm font-bold transition ${
                                activeTab === 'history'
                                    ? 'bg-cyan-900/30 text-cyan-400 border border-cyan-500/30'
                                    : 'hover:bg-gray-800 text-gray-400'
                            }`}
                        >
                            <FiActivity className="mr-3" />
                            MATCH HISTORY
                        </button>
                    </nav>

                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 text-xs font-bold text-red-400 border border-red-900/30 rounded hover:bg-red-900/20 transition"
                    >
                        <FiLogOut />
                        LOGOUT
                    </button>
                </aside>

                {/* ================= MAIN ================= */}
                <main className="flex-grow p-10 overflow-y-auto">
                    {activeTab === 'profile' && (
                        <div className="max-w-xl">
                            <h2 className="text-2xl font-bold mb-8 text-white">
                                Pilot Profile
                            </h2>

                            <form onSubmit={handleSubmit} className="space-y-8">
                                <div className="flex items-center gap-6 pb-6 border-b border-gray-800">
                                    <img
                                        src={`https://api.dicebear.com/8.x/bottts/svg?seed=${user.username}`}
                                        alt="avatar"
                                        className="w-20 h-20 rounded bg-gray-800"
                                    />
                                    <div>
                                        <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">
                                            Rank
                                        </p>
                                        <p className="text-xl font-mono text-yellow-400 font-bold">
                                            BRONZE I
                                        </p>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">
                                        Display Name
                                    </label>
                                    <input
                                        type="text"
                                        value={username}
                                        onChange={(e) => setUsername(e.target.value)}
                                        className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded text-white focus:border-cyan-500 outline-none transition"
                                    />
                                </div>

                                <div className="flex justify-end items-center gap-4">
                                    {message && (
                                        <p className="text-sm text-cyan-400">
                                            {message}
                                        </p>
                                    )}
                                    <button
                                        type="submit"
                                        className="py-3 px-8 bg-white text-black font-bold rounded hover:bg-gray-200 transition"
                                    >
                                        SAVE CHANGES
                                    </button>
                                </div>
                            </form>
                        </div>
                    )}

                    {activeTab === 'history' && (
                        <div className="max-w-4xl">
                            <h2 className="text-2xl font-bold mb-8 text-white">
                                Combat Log
                            </h2>

                            {matchHistory.length === 0 ? (
                                <p className="text-gray-500 italic">
                                    No matches recorded yet. Go fight!
                                </p>
                            ) : (
                                <div className="space-y-2">
                                    {matchHistory.map((match, index) => {
                                        if (!match || !Array.isArray(match.players))
                                            return null;

                                        const myPlayer =
                                            match.players.find(
                                                p => String(p?.userId) === userIdStr
                                            ) || { score: 0, result: 'draw' };

                                        const opponent =
                                            match.players.find(
                                                p => String(p?.userId) !== userIdStr
                                            ) || { score: 0, username: 'Unknown' };

                                        const isWin = myPlayer.result === 'win';
                                        const isDQ = match?.endReason?.includes('Disqualif');

                                        const date = match?.playedAt
                                            ? new Date(match.playedAt).toLocaleString()
                                            : 'Unknown Date';

                                        let resultText = isWin ? 'VICTORY' : 'DEFEAT';
                                        let resultColor = isWin
                                            ? 'text-green-400'
                                            : 'text-red-400';

                                        if (isDQ && !isWin) {
                                            resultText = 'DISQUALIFIED';
                                            resultColor = 'text-red-500 font-black';
                                        }

                                        return (
                                            <div
                                                key={match._id || index}
                                                className="bg-gray-900/50 border border-gray-800 p-4 rounded flex justify-between items-center hover:border-cyan-900/50 transition"
                                            >
                                                <div className="flex items-center gap-6">
                                                    <span className={`text-lg font-bold w-36 ${resultColor}`}>
                                                        {resultText}
                                                    </span>
                                                    <div className="flex flex-col">
                                                        <span className="font-bold text-white">
                                                            vs {opponent.username}
                                                        </span>
                                                        <span className="text-xs text-gray-500 font-mono">
                                                            {match?.endReason || 'Ranked'} • {date}
                                                        </span>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-4 font-mono">
                                                    <span className="text-lg font-bold text-cyan-400">
                                                        {myPlayer.score}
                                                    </span>
                                                    <span className="text-gray-600">-</span>
                                                    <span className="text-lg font-bold text-gray-400">
                                                        {opponent.score}
                                                    </span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
};

export default AccountPage;