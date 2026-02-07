import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Editor from "@monaco-editor/react";
import { FaPlay, FaCheck, FaTerminal, FaCheckCircle, FaTimesCircle, FaCode, FaBolt, FaKeyboard, FaMoon, FaTrophy, FaSkull, FaExclamationTriangle, FaEye } from 'react-icons/fa';
import axios from 'axios';
import socket from '../socket';

const BattleArenaPage = () => {
    const navigate = useNavigate();
    const location = useLocation();

    const [matchData, setMatchData] = useState(null);
    const [problem, setProblem] = useState(null);
    
    const [code, setCode] = useState("");
    const [output, setOutput] = useState("Ready to code...");
    const [testResults, setTestResults] = useState(null);
    
    const [myScore, setMyScore] = useState(0);
    const [opponentScore, setOpponentScore] = useState(0);
    const [timer, setTimer] = useState(300);
    const [statusMessage, setStatusMessage] = useState("");
    
    const [opponentStructure, setOpponentStructure] = useState([{ indent: 0, length: 20 }]);
    const [opponentIsTyping, setOpponentIsTyping] = useState(false);
    
    const [showGameOverModal, setShowGameOverModal] = useState(false);
    const [finalResult, setFinalResult] = useState(null);
    const [disqualified, setDisqualified] = useState(false);
    const [disqualificationReason, setDisqualificationReason] = useState("");

    const [spectatorView, setSpectatorView] = useState({}); 

    const typingTimeoutRef = useRef(null);
    const lastKeyTime = useRef(Date.now());
    const lastCodeLength = useRef(0);

    useEffect(() => {
        const data = location.state?.matchData;
        if (!data) { navigate('/lobby'); return; }

        setMatchData(data);

        if (data.problem) {
            setProblem(data.problem);
            setCode(data.problem.starterCode);
            lastCodeLength.current = data.problem.starterCode.length;
        }

        if (!socket.connected) socket.connect();
        socket.emit('join_match_room', data.roomId);

        socket.on('round_update', (roundData) => {
            if (roundData.winnerId === socket.id) {
                setMyScore(prev => prev + 1);
                setStatusMessage("🎉 Round Won! Next Problem...");
            } else if (!data.isSpectator) { 
                setOpponentScore(prev => prev + 1);
                setStatusMessage("❌ Round Lost. Opponent was faster.");
            } else {
                setStatusMessage("Round Over. Switching Problem...");
            }

            setTimeout(() => {
                setStatusMessage("");
                setProblem(roundData.problem);
                setCode(roundData.problem.starterCode);
                lastCodeLength.current = roundData.problem.starterCode.length;
                setTestResults(null);
                setOutput("New round started.");
                setOpponentStructure([{ indent: 0, length: 20 }]);
                setSpectatorView({}); 
            }, 3000);
        });

        socket.on('opponent_progress', (data) => {
            if (data.structure) setOpponentStructure(data.structure);
            setOpponentIsTyping(data.isTyping);
        });

        socket.on('spectator_feed', (feedData) => {
            setSpectatorView(prev => ({
                ...prev,
                [feedData.username]: {
                    code: feedData.code,
                    isTyping: feedData.isTyping
                }
            }));
        });

        socket.on('match_over', (finalData) => {
            const isWinner = finalData.winnerId === socket.id;
            const scores = finalData.scores || {};
            const p1Socket = finalData.player1SocketId;
            const p2Socket = finalData.player2SocketId;

            if (data.isSpectator) {
                setMyScore(scores.player1 ?? 0);
                setOpponentScore(scores.player2 ?? 0);
            } else if (scores.player1 !== undefined && scores.player2 !== undefined && (p1Socket || p2Socket)) {
                const my = socket.id === p1Socket ? scores.player1 : scores.player2;
                const opp = socket.id === p1Socket ? scores.player2 : scores.player1;
                setMyScore(my);
                setOpponentScore(opp);
            } else if (isWinner) {
                setMyScore(s => s + 1);
            } else {
                setOpponentScore(s => s + 1);
            }

            if (data.isSpectator) {
                setFinalResult("MATCH OVER");
            } else {
                setFinalResult(isWinner ? "VICTORY" : "DEFEAT");
            }
            
            if (finalData.reason === 'Opponent Disqualified') {
                 if (isWinner) {
                    setDisqualificationReason("Opponent was disqualified for suspicious activity.");
                 } else if (!data.isSpectator) {
                    setDisqualificationReason("You were disqualified for suspicious activity.");
                    setDisqualified(true); 
                 }
            }
            
            setShowGameOverModal(true);
        });

        return () => {
            socket.off('join_match_room');
            socket.off('round_update');
            socket.off('match_over');
            socket.off('opponent_progress');
            socket.off('spectator_feed');
        };
    }, [location, navigate]);

    useEffect(() => {
        const interval = setInterval(() => {
            setTimer((prev) => (prev > 0 ? prev - 1 : 0));
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (!matchData || showGameOverModal || disqualified || matchData.isSpectator) return;

        const handleViolation = () => {
            if (disqualified) return;
            socket.emit('forfeit_match', matchData.roomId);
            setDisqualified(true);
        };

        const onVisibilityChange = () => {
            if (document.hidden) handleViolation();
        };

        const onBlur = () => {
            handleViolation();
        };

        document.addEventListener("visibilitychange", onVisibilityChange);
        window.addEventListener("blur", onBlur);
        
        document.documentElement.requestFullscreen().catch(() => {});

        return () => {
            document.removeEventListener("visibilitychange", onVisibilityChange);
            window.removeEventListener("blur", onBlur);
            if (document.fullscreenElement) {
                document.exitFullscreen().catch(() => {});
            }
        };
    }, [matchData, showGameOverModal, disqualified]);

    const analyzeCodeStructure = (codeText) => {
        return codeText.split('\n').map(line => {
            const content = line.trim();
            const length = content.length;
            const indent = line.search(/\S|$/); 
            return { indent, length: Math.min(length, 50) };
        });
    };

    const handleEditorChange = (value) => {
        if (disqualified || matchData?.isSpectator) return;

        const now = Date.now();
        const lenDiff = value.length - lastCodeLength.current;
        const timeDiff = now - lastKeyTime.current;

        if (lenDiff > 50 || (lenDiff > 10 && timeDiff < 50)) {
            socket.emit('forfeit_match', matchData.roomId);
            setDisqualified(true);
            return;
        }

        lastCodeLength.current = value.length;
        lastKeyTime.current = now;

        setCode(value);
        const structure = analyzeCodeStructure(value);
        
        if (matchData?.roomId) {
            socket.emit('code_progress', { 
                roomId: matchData.roomId, 
                structure: structure,
                isTyping: true,
                code: value 
            });
        }

        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        
        typingTimeoutRef.current = setTimeout(() => {
            if (matchData?.roomId) {
                socket.emit('code_progress', { 
                    roomId: matchData.roomId, 
                    structure: structure,
                    isTyping: false,
                    code: value 
                });
            }
        }, 1000);
    };

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    };

    const handleRunCode = async () => {
        if (disqualified) return;
        setOutput("Executing code...");
        setTestResults(null); 
        try {
            const { data } = await axios.post('/api/code/execute', {
                code: code,
                language: 'javascript'
            });
            setOutput(data.output || "No output returned.");
        } catch (err) {
            setOutput("Error: " + (err.response?.data?.output || err.message));
        }
    };

    const handleSubmit = async () => {
        if (!problem || disqualified) return;
        
        setOutput("Submitting solution...");
        setTestResults(null); 

        try {
            const { data } = await axios.post('/api/code/submit', {
                code: code,
                language: 'javascript',
                problemId: problem._id
            });

            setTestResults(data.results); 

            if (data.success) {
                setOutput("🏆 Correct! Syncing with server...");
                socket.emit('round_won', matchData.roomId);
            } else {
                setOutput("❌ Solution failed some test cases.");
            }
        } catch (err) {
            setOutput("Error submitting code.");
            console.error(err);
        }
    };

    const handleReturnToLobby = () => {
        if (document.fullscreenElement) {
            document.exitFullscreen().catch(err => console.log(err));
        }
        
        if (matchData && matchData.roomId && matchData.roomId.startsWith('custom_')) {
            navigate('/custom');
        } else {
            navigate('/lobby');
        }
    };

    if (!matchData || !problem) return <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center font-mono">Initialize System...</div>;

    // --- SPECTATOR VIEW ---
    if (matchData.isSpectator) {
        return (
            <div className="min-h-screen bg-[#050505] text-gray-300 flex flex-col overflow-hidden font-sans selection:bg-purple-500/30">
                <header className="h-16 bg-[#0a0a0a] border-b border-white/10 flex items-center justify-between px-6 shrink-0 z-20">
                    <div className="flex items-center gap-2 text-cyan-400 font-bold">
                        <FaEye /> SPECTATOR MODE
                    </div>
                    <div className="text-center w-1/3">
                        <div className="text-3xl font-mono font-bold text-white tracking-widest">{formatTime(timer)}</div>
                    </div>
                    <button onClick={handleReturnToLobby} className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded font-bold text-xs text-white">LEAVE</button>
                </header>
                <main className="flex-grow flex overflow-hidden">
                    <section className="w-1/4 bg-[#0a0a0a] border-r border-white/5 flex flex-col p-6 overflow-y-auto">
                        <h1 className="text-xl font-bold text-white mb-4">{problem.title}</h1>
                        <div className="space-y-5 text-sm text-gray-400 font-mono whitespace-pre-wrap">{problem.description}</div>
                    </section>
                    <section className="flex-1 flex bg-[#0f0f0f]">
                        {Object.entries(spectatorView).length === 0 ? (
                            <div className="w-full flex items-center justify-center text-gray-600">Waiting for players to type...</div>
                        ) : (
                            Object.entries(spectatorView).map(([username, state], idx) => (
                                <div key={username} className={`flex-1 flex flex-col border-r border-white/5 ${idx === 0 ? 'bg-[#0f0f0f]' : 'bg-[#0a0a0a]'}`}>
                                    <div className="h-10 border-b border-white/10 flex items-center justify-between px-4">
                                        <span className={`font-bold ${idx === 0 ? 'text-cyan-400' : 'text-rose-500'}`}>{username}</span>
                                        <span className="text-[10px] text-gray-500">{state.isTyping ? "TYPING..." : "IDLE"}</span>
                                    </div>
                                    <div className="flex-grow relative">
                                        <Editor
                                            height="100%"
                                            defaultLanguage="javascript"
                                            theme="vs-dark"
                                            value={state.code || ""}
                                            options={{ readOnly: true, minimap: { enabled: false }, fontSize: 12, scrollBeyondLastLine: false, fontFamily: "'Fira Code', monospace" }}
                                        />
                                    </div>
                                </div>
                            ))
                        )}
                    </section>
                </main>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#050505] text-gray-300 flex flex-col overflow-hidden font-sans selection:bg-cyan-500/30 relative">
            
            {disqualified && !showGameOverModal && (
                 <div className="absolute inset-0 bg-red-900/90 backdrop-blur-md z-[100] flex items-center justify-center">
                    <div className="text-center text-white p-8 border-4 border-white/20 rounded-xl">
                        <FaExclamationTriangle size={64} className="mx-auto mb-4 animate-pulse text-yellow-400" />
                        <h1 className="text-5xl font-black mb-2">SECURITY VIOLATION</h1>
                        <p className="text-xl font-mono text-red-200">Suspicious activity detected.</p>
                        <div className="mt-4 text-sm bg-black/30 p-2 rounded">
                            <p>Reason: Tab Switch / Focus Loss / Bot Behavior</p>
                        </div>
                    </div>
                </div>
            )}

            {statusMessage && !showGameOverModal && !disqualified && (
                <div className="absolute inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center animate-fadeIn">
                    <div className="text-center">
                        <h1 className={`text-5xl font-black tracking-tighter mb-2 ${statusMessage.includes("Won") ? "text-cyan-400 drop-shadow-[0_0_15px_rgba(34,211,238,0.8)]" : "text-rose-500 drop-shadow-[0_0_15px_rgba(244,63,94,0.8)]"}`}>
                            {statusMessage.includes("Won") ? "ROUND SECURED" : "ROUND LOST"}
                        </h1>
                        <p className="text-gray-400 font-mono">Syncing next protocol...</p>
                    </div>
                </div>
            )}

            {showGameOverModal && (
                <div className="absolute inset-0 bg-black/95 backdrop-blur-md z-[60] flex items-center justify-center animate-fadeIn">
                    <div className="bg-[#111] border border-white/10 p-12 rounded-2xl text-center max-w-lg w-full shadow-2xl relative overflow-hidden">
                        <div className={`absolute top-0 left-0 w-full h-2 ${finalResult === "VICTORY" ? "bg-cyan-500 shadow-[0_0_20px_rgba(34,211,238,0.8)]" : "bg-rose-600 shadow-[0_0_20px_rgba(244,63,94,0.8)]"}`}></div>
                        
                        <div className="mb-6 flex justify-center">
                            {finalResult === "VICTORY" ? (
                                <FaTrophy className="text-cyan-400 text-7xl drop-shadow-[0_0_15px_rgba(34,211,238,0.6)] animate-bounce" />
                            ) : (
                                <FaSkull className="text-rose-500 text-7xl drop-shadow-[0_0_15px_rgba(244,63,94,0.6)]" />
                            )}
                        </div>

                        <h1 className={`text-6xl font-black tracking-tighter mb-2 ${finalResult === "VICTORY" ? "text-white" : "text-gray-400"}`}>
                            {finalResult}
                        </h1>
                        
                        <div className="text-2xl font-mono mb-8 text-gray-500">
                            <span className="text-cyan-400">{myScore}</span> - <span className="text-rose-500">{opponentScore}</span>
                        </div>

                        {disqualificationReason && (
                            <div className="mb-8 p-4 bg-red-900/20 border border-red-500/30 rounded text-red-300 text-sm font-mono">
                                {disqualificationReason}
                            </div>
                        )}

                        <button 
                            onClick={handleReturnToLobby}
                            className={`w-full py-4 text-lg font-bold text-black rounded transition-transform hover:scale-[1.02] active:scale-[0.98] ${finalResult === "VICTORY" ? "bg-cyan-500 hover:bg-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.4)]" : "bg-gray-200 hover:bg-white"}`}
                        >
                            {matchData?.roomId?.startsWith('custom_') ? 'RETURN TO BROWSER' : 'RETURN TO LOBBY'}
                        </button>
                    </div>
                </div>
            )}

            <header className="h-16 bg-[#0a0a0a] border-b border-white/10 flex items-center justify-between px-6 shrink-0 z-20 relative">
                <div className="absolute bottom-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-cyan-900 to-transparent opacity-50"></div>
                
                <div className="flex items-center gap-5 w-1/3">
                    <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-lg flex items-center justify-center font-black text-black shadow-[0_0_15px_rgba(6,182,212,0.3)] text-sm">ME</div>
                    <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-cyan-500/70 uppercase tracking-widest">Score</span>
                        <div className="flex gap-1 mt-1">
                            {[...Array(5)].map((_, i) => (
                                <div key={i} className={`w-8 h-1.5 rounded-full transition-all duration-500 ${i < myScore ? 'bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)]' : 'bg-white/10'}`}></div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="text-center w-1/3 relative">
                    <div className={`text-3xl font-mono font-bold tracking-widest tabular-nums ${timer < 60 ? 'text-rose-500 drop-shadow-[0_0_8px_rgba(244,63,94,0.5)] animate-pulse' : 'text-white'}`}>
                        {formatTime(timer)}
                    </div>
                    <div className="text-[10px] text-gray-600 uppercase tracking-[0.2em] mt-1">Time Remaining</div>
                </div>

                <div className="flex items-center gap-5 w-1/3 justify-end text-right">
                    <div className="flex flex-col items-end">
                        <span className="text-[10px] font-bold text-rose-500/70 uppercase tracking-widest">Opponent</span>
                        <div className="flex gap-1 mt-1">
                            {[...Array(5)].map((_, i) => (
                                <div key={i} className={`w-8 h-1.5 rounded-full transition-all duration-500 ${i < opponentScore ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)]' : 'bg-white/10'}`}></div>
                            ))}
                        </div>
                        <span className="text-xs font-bold text-gray-400 mt-1">{matchData.opponent.username}</span>
                    </div>
                    <div className="w-10 h-10 bg-gradient-to-br from-rose-500 to-red-700 rounded-lg flex items-center justify-center font-black text-white shadow-[0_0_15px_rgba(244,63,94,0.3)] text-sm">OP</div>
                </div>
            </header>

            <main className="flex-grow flex overflow-hidden">
                
                <section className="flex-1 flex flex-col border-r border-white/5 min-w-0 bg-[#0f0f0f]">
                    <div className="h-9 bg-[#151515] flex items-center px-4 border-b border-white/5 justify-between">
                        <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-2">
                            <FaCode /> Code Editor
                        </span>
                        <span className="text-[10px] text-gray-600">JavaScript (Node)</span>
                    </div>
                    <div className="flex-grow relative">
                        <Editor
                            height="100%"
                            defaultLanguage="javascript"
                            theme="vs-dark"
                            value={code}
                            onChange={handleEditorChange}
                            options={{ 
                                minimap: { enabled: false }, 
                                fontSize: 14, 
                                automaticLayout: true,
                                fontFamily: "'Fira Code', monospace",
                                padding: { top: 16 },
                                scrollBeyondLastLine: false,
                                readOnly: disqualified
                            }}
                        />
                    </div>
                    <div className="h-48 bg-[#0a0a0a] border-t border-white/10 flex flex-col shrink-0">
                        <div className="h-8 bg-[#111] flex items-center px-4 border-b border-white/5">
                            <FaTerminal className="text-gray-500 mr-2 text-[10px]" />
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">System Output</span>
                        </div>
                        
                        <div className="flex-grow p-3 font-mono text-xs overflow-y-auto custom-scrollbar bg-[#080808]">
                            {testResults ? (
                                <div className="space-y-1.5">
                                    {testResults.map((res, idx) => (
                                        <div key={idx} className={`flex flex-col p-2.5 rounded border-l-2 ${res.passed ? 'bg-green-900/10 border-green-500/50' : 'bg-rose-900/10 border-rose-500/50'}`}>
                                            <div className="flex items-center justify-between mb-1">
                                                <div className="flex items-center gap-2">
                                                    {res.passed ? <FaCheckCircle className="text-green-500" size={12} /> : <FaTimesCircle className="text-rose-500" size={12} />}
                                                    <span className={`font-bold ${res.passed ? 'text-green-400' : 'text-rose-400'}`}>Test Case {res.id}</span>
                                                </div>
                                                <span className="text-[10px] text-gray-500 uppercase">{res.passed ? 'Passed' : 'Failed'}</span>
                                            </div>
                                            {!res.passed && (
                                                <div className="grid grid-cols-2 gap-2 mt-1 pl-5 text-[10px] font-mono opacity-80">
                                                    <div><span className="text-gray-500">Exp:</span> <span className="text-green-300">{res.expected}</span></div>
                                                    <div><span className="text-gray-500">Got:</span> <span className="text-rose-300">{res.actual}</span></div>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <pre className="text-gray-500 whitespace-pre-wrap">{output}</pre>
                            )}
                        </div>
                        <div className="p-3 border-t border-white/5 flex justify-between items-center bg-[#0f0f0f]">
                            <div className="text-[10px] text-gray-600">Ready</div>
                            <div className="flex gap-3">
                                <button onClick={handleRunCode} disabled={disqualified} className={`px-4 py-1.5 bg-gray-800 text-gray-300 text-xs font-bold rounded flex items-center gap-2 transition-colors border border-white/5 ${disqualified ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-700 hover:text-white'}`}>
                                    <FaPlay size={8} /> RUN
                                </button>
                                <button onClick={handleSubmit} disabled={disqualified} className={`px-6 py-1.5 bg-cyan-600 text-white text-xs font-bold rounded flex items-center gap-2 shadow-[0_0_10px_rgba(8,145,178,0.3)] transition-all border border-transparent ${disqualified ? 'opacity-50 cursor-not-allowed' : 'hover:bg-cyan-500 hover:shadow-[0_0_15px_rgba(34,211,238,0.5)]'}`}>
                                    <FaCheck size={10} /> SUBMIT SOLUTION
                                </button>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="w-[400px] bg-[#0a0a0a] border-r border-white/5 flex flex-col shrink-0 z-10 shadow-2xl relative">
                    <div className="absolute top-0 right-0 w-[1px] h-full bg-white/5"></div>
                    <div className="p-8 overflow-y-auto custom-scrollbar flex-grow">
                        <div className="flex items-center justify-between mb-6">
                            <span className={`px-3 py-1 text-[10px] font-black uppercase tracking-widest rounded border ${
                                (problem.difficulty || 'Custom') === 'Easy' ? 'border-green-500/30 text-green-400 bg-green-500/10' :
                                (problem.difficulty || 'Custom') === 'Medium' ? 'border-yellow-500/30 text-yellow-400 bg-yellow-500/10' :
                                (problem.difficulty || 'Custom') === 'Hard' ? 'border-rose-500/30 text-rose-400 bg-rose-500/10' :
                                'border-purple-500/30 text-purple-400 bg-purple-500/10'
                            }`}>
                                {problem.difficulty || 'Custom'}
                            </span>
                            <span className="text-[10px] text-gray-500 font-mono">ID: {(problem._id && problem._id.slice(-4)) || '----'}</span>
                        </div>
                        
                        <h1 className="text-2xl font-black text-white mb-6 leading-tight">{problem.title}</h1>
                        
                        <div className="space-y-5 text-sm text-gray-400 leading-7 font-sans">
                            {problem.description}
                        </div>

                        {problem.testCases && problem.testCases.length > 0 && (
                            <div className="mt-8 space-y-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <FaBolt className="text-yellow-500" size={12} />
                                    <span className="text-xs font-bold text-gray-300 uppercase tracking-wider">Example Case</span>
                                </div>
                                <div className="bg-[#111] p-4 rounded border border-white/5 font-mono text-xs relative overflow-hidden group">
                                    <div className="absolute top-0 left-0 w-1 h-full bg-gray-700 group-hover:bg-cyan-500 transition-colors"></div>
                                    <div className="grid grid-cols-[40px_1fr] gap-y-2">
                                        <span className="text-gray-600 font-bold">IN:</span>
                                        <span className="text-cyan-100">{problem.testCases[0].input}</span>
                                        <span className="text-gray-600 font-bold">OUT:</span>
                                        <span className="text-green-100">{problem.testCases[0].output}</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </section>

                <section className="flex-1 flex flex-col bg-black min-w-0 relative border-l border-white/5">
                    <div className="h-9 bg-[#050505] flex items-center px-4 border-b border-white/5 justify-between">
                        <span className="text-[10px] font-bold text-rose-500 uppercase tracking-wider">Opponent Stream</span>
                        <div className="flex items-center gap-2">
                            <div className={`w-1.5 h-1.5 rounded-full ${opponentIsTyping ? 'bg-green-500 animate-pulse' : 'bg-gray-600'}`}></div>
                            <span className={`text-[10px] font-mono ${opponentIsTyping ? 'text-green-500' : 'text-gray-600'}`}>
                                {opponentIsTyping ? "ACTIVE" : "IDLE"}
                            </span>
                        </div>
                    </div>
                    
                    <div className="flex-grow p-6 overflow-hidden relative">
                        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(#333 1px, transparent 1px), linear-gradient(90deg, #333 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
                        
                        <div className="space-y-3 transition-all duration-300 ease-out">
                            {opponentStructure.map((line, i) => (
                                <div 
                                    key={i} 
                                    className="h-2.5 bg-gray-800/50 rounded-sm flex items-center"
                                    style={{ 
                                        marginLeft: `${line.indent * 8}px`, 
                                        width: `${line.length * 8}px`, 
                                        minWidth: '20px', 
                                        maxWidth: '100%',
                                        opacity: 1 - (i * 0.02) 
                                    }}
                                >
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="h-12 bg-[#050505] border-t border-white/5 flex items-center px-6 gap-3">
                        <div className="w-8 h-8 rounded bg-gray-900 flex items-center justify-center border border-white/5 text-gray-600">
                            {opponentIsTyping ? <FaKeyboard className="animate-bounce text-cyan-500" size={12} /> : <FaMoon size={12} />}
                        </div>
                        <div className="flex flex-col">
                            <span className="text-xs text-gray-300 font-bold">{matchData.opponent.username}</span>
                            <span className="text-[10px] text-gray-600">
                                {opponentIsTyping ? "is typing solution..." : "is thinking..."}
                            </span>
                        </div>
                    </div>
                </section>

            </main>
        </div>
    );
};

export default BattleArenaPage;