import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { FaPlus, FaGamepad, FaLock, FaPlay, FaSave, FaList, FaTrash, FaCode, FaBolt, FaTimes, FaCheckCircle, FaExclamationCircle, FaEdit } from 'react-icons/fa';
import socket from '../socket';

const DEFAULT_PROBLEM = {
    title: '',
    description: '',
    starterCode: 'function solution(input) {\n  return input;\n}',
    testCases: [{ input: '', output: '' }]
};

const DEFAULT_TEMPLATE = {
    name: '',
    password: '',
    rounds: 1,
    timeLimit: 300,
    description: '',
    problems: []
};

const CustomRoomDashboard = () => {
    const navigate = useNavigate();

    const [activeTab, setActiveTab] = useState('templates');
    const [templates, setTemplates] = useState([]);
    const [newTemplate, setNewTemplate] = useState(DEFAULT_TEMPLATE);
    const [currentProblem, setCurrentProblem] = useState(DEFAULT_PROBLEM);
    const [user, setUser] = useState(null);
    const [editingTemplateId, setEditingTemplateId] = useState(null);
    
    const [notification, setNotification] = useState(null);
    const [templateToDelete, setTemplateToDelete] = useState(null);

    const showNotification = (message, type = 'success') => {
        setNotification({ message, type });
        setTimeout(() => setNotification(null), 3000);
    };

    const getAuthConfig = () => ({
        headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`
        }
    });

    const fetchTemplates = async () => {
        try {
            const { data } = await axios.get(
                '/api/custom/templates',
                getAuthConfig()
            );
            setTemplates(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error('Failed to fetch templates', err);
        }
    };

    useEffect(() => {
        const fetchUser = async () => {
            const token = localStorage.getItem('token');
            if (!token) { navigate('/login'); return; }
            try {
                const config = { headers: { Authorization: `Bearer ${token}` } };
                const { data } = await axios.get('/api/auth/me', config);
                setUser(data);
            } catch (err) {
                console.error(err);
                navigate('/login');
            }
        };
        fetchUser();

        if (!socket.connected) socket.connect();

        const handleRoomCreated = ({ roomId }) => {
            navigate('/lobby', {
                state: { customRoomId: roomId, isHost: true }
            });
        };

        const handleError = (err) => {
            showNotification(err?.message || 'Socket error', 'error');
        };

        socket.on('custom_room_created', handleRoomCreated);
        socket.on('error_joining_room', handleError);

        fetchTemplates();

        return () => {
            socket.off('custom_room_created', handleRoomCreated);
            socket.off('error_joining_room', handleError);
        };
    }, [navigate]);

    const handleAddTestCase = () => {
        setCurrentProblem(prev => ({
            ...prev,
            testCases: [...prev.testCases, { input: '', output: '' }]
        }));
    };

    const handleRemoveTestCase = (index) => {
        if (currentProblem.testCases.length <= 1) return;
        const updatedCases = currentProblem.testCases.filter((_, i) => i !== index);
        setCurrentProblem(prev => ({ ...prev, testCases: updatedCases }));
    };

    const handleTestCaseChange = (index, field, value) => {
        const updatedCases = [...currentProblem.testCases];
        updatedCases[index][field] = value;
        setCurrentProblem(prev => ({ ...prev, testCases: updatedCases }));
    };

    const handleAddProblem = () => {
        if (!currentProblem.title || !currentProblem.description) {
            showNotification('Problem title and description are required.', 'error');
            return;
        }

        const isValid = currentProblem.testCases.every(tc => tc.input && tc.output);
        if (!isValid) {
            showNotification('All test cases must have input and output.', 'error');
            return;
        }

        if (newTemplate.problems.length >= newTemplate.rounds) {
            showNotification(`Cannot add more questions than rounds (${newTemplate.rounds}).`, 'error');
            return;
        }

        setNewTemplate(prev => ({
            ...prev,
            problems: [...prev.problems, currentProblem]
        }));

        setCurrentProblem(DEFAULT_PROBLEM);
        showNotification('Problem added to queue!', 'success');
    };

    const handleRemoveProblemFromQueue = (index) => {
        const updatedProblems = newTemplate.problems.filter((_, i) => i !== index);
        setNewTemplate({ ...newTemplate, problems: updatedProblems });
    };

    const handleEditProblemInQueue = (index) => {
        const problemToEdit = newTemplate.problems[index];
        setCurrentProblem(problemToEdit);
        handleRemoveProblemFromQueue(index);
    };

    const handleCreateOrUpdateTemplate = async () => {
        if (newTemplate.problems.length < newTemplate.rounds) {
            showNotification(`Need ${newTemplate.rounds} problems for ${newTemplate.rounds} rounds.`, 'error');
            return;
        }

        try {
            const problemIds = [];
            for (const prob of newTemplate.problems) {
                const res = await axios.post('/api/custom/problem', prob, getAuthConfig());
                problemIds.push(res.data._id);
            }

            if (editingTemplateId) {
                await axios.put(`/api/custom/template/${editingTemplateId}`, {
                    ...newTemplate,
                    problemIds 
                }, getAuthConfig());
                showNotification('Template updated successfully!', 'success');
            } else {
                await axios.post('/api/custom/template', {
                    ...newTemplate,
                    problemIds
                }, getAuthConfig());
                showNotification('Template created successfully!', 'success');
            }

            setNewTemplate(DEFAULT_TEMPLATE);
            setEditingTemplateId(null);
            setActiveTab('templates');
            fetchTemplates();

        } catch (err) {
            console.error(err);
            showNotification('Failed to save template.', 'error');
        }
    };

    const handleEditTemplate = (tpl) => {
        setEditingTemplateId(tpl._id);
        setNewTemplate({
            name: tpl.name,
            password: tpl.password || '',
            rounds: tpl.rounds,
            timeLimit: tpl.timeLimit,
            description: tpl.description || '',
            problems: (tpl.problems || []).filter(p => p !== null)
        });
        setActiveTab('new');
    };

    const handleDeleteClick = (id) => {
        setTemplateToDelete(id);
    };

    const confirmDelete = async () => {
        if (!templateToDelete) return;
        try {
            await axios.delete(`/api/custom/template/${templateToDelete}`, getAuthConfig());
            showNotification('Template deleted.', 'success');
            fetchTemplates();
        } catch (err) {
            showNotification('Failed to delete template.', 'error');
        } finally {
            setTemplateToDelete(null);
        }
    };

    const handleLaunchRoom = (templateId) => {
        if (!user) return;
        const template = templates.find(t => t._id === templateId);
        if (!template) return;
        
        socket.emit('create_custom_room', { 
            templateId,
            isPublic: !template.password,
            name: template.name,
            userData: { userId: user._id, username: user.username }
        });
    };

    if (!user) return <div className="min-h-screen bg-black text-white flex items-center justify-center">Loading...</div>;

    const isQueueFull = newTemplate.problems.length >= newTemplate.rounds;

    return (
        <div className="min-h-screen bg-[#050505] text-gray-300 font-sans selection:bg-purple-500/30 p-8 flex flex-col items-center relative">
            
            {notification && (
                <div className={`fixed top-8 left-1/2 transform -translate-x-1/2 px-6 py-3 rounded-lg shadow-2xl flex items-center gap-3 z-50 animate-fadeIn ${
                    notification.type === 'error' ? 'bg-red-500 text-white' : 'bg-green-500 text-white'
                }`}>
                    {notification.type === 'error' ? <FaExclamationCircle /> : <FaCheckCircle />}
                    <span className="font-bold text-sm">{notification.message}</span>
                </div>
            )}

            {templateToDelete && (
                <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center backdrop-blur-sm animate-fadeIn">
                    <div className="bg-[#111] border border-red-500/30 p-8 rounded-xl max-w-sm w-full text-center shadow-2xl">
                        <FaExclamationCircle className="text-red-500 text-5xl mx-auto mb-4" />
                        <h2 className="text-xl font-bold text-white mb-2">Delete Template?</h2>
                        <p className="text-gray-400 text-sm mb-6">This action cannot be undone.</p>
                        <div className="flex gap-3 justify-center">
                            <button 
                                onClick={() => setTemplateToDelete(null)}
                                className="px-6 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded font-bold transition"
                            >
                                CANCEL
                            </button>
                            <button 
                                onClick={confirmDelete}
                                className="px-6 py-2 bg-red-600 hover:bg-red-500 text-white rounded font-bold transition shadow-lg shadow-red-900/20"
                            >
                                DELETE
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <header className="w-full max-w-6xl flex justify-between items-center mb-12">
                <div>
                    <h1 className="text-4xl font-black text-white tracking-tighter">
                        ROOM <span className="text-purple-500">CREATOR</span>
                    </h1>
                    <p className="text-gray-500 font-mono text-sm mt-2">
                        Design custom tournaments and challenge your friends.
                    </p>
                </div>
                <button
                    onClick={() => navigate('/custom')}
                    className="px-6 py-2 bg-[#111] border border-white/10 hover:bg-gray-800 hover:border-white/30 rounded font-bold text-white transition text-xs tracking-widest"
                >
                    BACK TO BROWSER
                </button>
            </header>

            <div className="flex gap-2 mb-8 bg-[#111] p-1.5 rounded-xl border border-white/10">
                <button
                    onClick={() => { setActiveTab('templates'); setEditingTemplateId(null); setNewTemplate(DEFAULT_TEMPLATE); }}
                    className={`px-8 py-2.5 rounded-lg font-bold text-xs tracking-widest transition-all flex items-center gap-2 ${
                        activeTab === 'templates'
                            ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/20'
                            : 'text-gray-500 hover:text-white hover:bg-white/5'
                    }`}
                >
                    <FaList /> MY TEMPLATES
                </button>
                <button
                    onClick={() => { setActiveTab('new'); setEditingTemplateId(null); setNewTemplate(DEFAULT_TEMPLATE); }}
                    className={`px-8 py-2.5 rounded-lg font-bold text-xs tracking-widest transition-all flex items-center gap-2 ${
                        activeTab === 'new'
                            ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/20'
                            : 'text-gray-500 hover:text-white hover:bg-white/5'
                    }`}
                >
                    <FaPlus /> {editingTemplateId ? 'EDIT TEMPLATE' : 'CREATE NEW'}
                </button>
            </div>

            <div className="w-full max-w-6xl bg-[#0a0a0a] border border-white/10 rounded-2xl p-8 shadow-2xl min-h-[500px] relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-600 to-blue-600 opacity-50"></div>

                {activeTab === 'templates' && (
                    <div className="animate-fadeIn">
                        <div className="flex items-center justify-between mb-8">
                            <h2 className="text-xl font-bold text-white flex items-center gap-3">
                                <FaLock className="text-purple-500" /> Saved Presets
                            </h2>
                            <span className="text-xs font-mono text-gray-600">{templates.length} TEMPLATES FOUND</span>
                        </div>
                        
                        {templates.length === 0 ? (
                            <div className="text-center py-32 border-2 border-dashed border-white/5 rounded-xl bg-white/[0.02]">
                                <FaGamepad className="mx-auto text-4xl text-gray-700 mb-4" />
                                <p className="text-gray-500">No templates found.</p>
                                <button onClick={() => setActiveTab('new')} className="mt-4 text-purple-400 font-bold hover:text-purple-300 text-sm tracking-wide border-b border-purple-500/30 hover:border-purple-400">
                                    CREATE YOUR FIRST TEMPLATE
                                </button>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {templates.map((tpl) => (
                                    <div key={tpl._id} className="bg-[#111] border border-white/5 p-6 rounded-xl flex items-center justify-between group hover:border-purple-500/40 hover:bg-[#151515] transition-all duration-300">
                                        <div>
                                            <h3 className="text-lg font-bold text-white group-hover:text-purple-400 transition-colors mb-2">{tpl.name}</h3>
                                            <div className="flex gap-4 text-xs font-mono text-gray-500">
                                                <span className="bg-black px-2 py-1 rounded border border-white/5 text-gray-400">{tpl.rounds} Rounds</span>
                                                <span className="bg-black px-2 py-1 rounded border border-white/5 text-gray-400">{tpl.problems?.length || 0} Problems</span>
                                                {tpl.password && <span className="text-red-400 flex items-center gap-1"><FaLock size={10}/> Private</span>}
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <button 
                                                onClick={() => handleEditTemplate(tpl)}
                                                className="p-3 bg-gray-800 text-gray-400 font-bold rounded hover:bg-gray-700 hover:text-white transition"
                                                title="Edit"
                                            >
                                                <FaEdit />
                                            </button>
                                            <button 
                                                onClick={() => handleDeleteClick(tpl._id)}
                                                className="p-3 bg-gray-800 text-red-500 font-bold rounded hover:bg-red-900/30 transition"
                                                title="Delete"
                                            >
                                                <FaTrash />
                                            </button>
                                            <button 
                                                onClick={() => handleLaunchRoom(tpl._id)}
                                                className="px-6 py-3 bg-white text-black font-black text-xs tracking-wider rounded hover:bg-purple-400 hover:shadow-[0_0_15px_rgba(168,85,247,0.4)] flex items-center gap-2 transition-all transform hover:scale-105"
                                            >
                                                <FaPlay /> HOST
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'new' && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 animate-fadeIn">
                        
                        <div className="space-y-6">
                            <div className="pb-4 border-b border-white/5">
                                <h2 className="text-lg font-bold text-white mb-1">1. Configuration</h2>
                                <p className="text-xs text-gray-500">Set the rules for your tournament lobby.</p>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Template Name</label>
                                    <input 
                                        type="text" 
                                        value={newTemplate.name} 
                                        onChange={(e) => setNewTemplate({...newTemplate, name: e.target.value})} 
                                        className="w-full bg-black border border-white/10 rounded p-3 text-white text-sm focus:border-purple-500 outline-none transition-colors placeholder:text-gray-700" 
                                        placeholder="e.g. Semi-Finals Group A" 
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Rounds</label>
                                        <input 
                                            type="number" min="1" max="5" 
                                            value={newTemplate.rounds} 
                                            onChange={(e) => setNewTemplate({...newTemplate, rounds: parseInt(e.target.value)})} 
                                            className="w-full bg-black border border-white/10 rounded p-3 text-white text-sm focus:border-purple-500 outline-none" 
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Password</label>
                                        <input 
                                            type="text" 
                                            value={newTemplate.password} 
                                            onChange={(e) => setNewTemplate({...newTemplate, password: e.target.value})} 
                                            className="w-full bg-black border border-white/10 rounded p-3 text-white text-sm focus:border-purple-500 outline-none placeholder:text-gray-700" 
                                            placeholder="Optional" 
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Description</label>
                                    <textarea 
                                        value={newTemplate.description} 
                                        onChange={(e) => setNewTemplate({...newTemplate, description: e.target.value})} 
                                        className="w-full bg-black border border-white/10 rounded p-3 text-white text-sm focus:border-purple-500 outline-none h-24 resize-none placeholder:text-gray-700"
                                        placeholder="Brief details about this match config..."
                                    ></textarea>
                                </div>
                            </div>

                            <div className="bg-[#151515] p-5 rounded-lg border border-white/5 mt-6">
                                <div className="flex justify-between items-center mb-4">
                                    <p className="text-gray-300 text-xs font-bold uppercase tracking-wider">Problem Queue</p>
                                    <span className={`text-xs font-mono px-2 py-0.5 rounded ${isQueueFull ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                        {newTemplate.problems.length} / {newTemplate.rounds} READY
                                    </span>
                                </div>
                                <div className="flex flex-col gap-2 max-h-40 overflow-y-auto custom-scrollbar">
                                    {newTemplate.problems.length === 0 ? (
                                        <p className="text-gray-600 text-xs italic text-center py-4">No problems added yet.</p>
                                    ) : (
                                        newTemplate.problems.map((p, i) => (
                                            <div key={i} className="flex justify-between items-center bg-black p-3 rounded border border-white/5 group">
                                                <span className="text-gray-300 text-xs font-mono truncate w-full">{i+1}. {p?.title || "Untitled Problem"}</span>
                                                <div className="flex gap-2 opacity-50 group-hover:opacity-100 transition-opacity">
                                                    <button onClick={() => handleEditProblemInQueue(i)} className="text-gray-400 hover:text-white p-1" title="Edit Problem">
                                                        <FaEdit />
                                                    </button>
                                                    <button onClick={() => handleRemoveProblemFromQueue(i)} className="text-red-500 hover:text-red-400 p-1" title="Remove Problem">
                                                        <FaTrash />
                                                    </button>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                            
                            <button 
                                onClick={handleCreateOrUpdateTemplate} 
                                disabled={newTemplate.problems.length < newTemplate.rounds}
                                className={`w-full py-4 font-black text-sm tracking-widest rounded shadow-lg flex items-center justify-center gap-2 transition-all ${
                                    newTemplate.problems.length < newTemplate.rounds 
                                    ? 'bg-gray-800 text-gray-500 cursor-not-allowed' 
                                    : 'bg-purple-600 text-white hover:bg-purple-500 hover:shadow-purple-500/20'
                                }`}
                            >
                                <FaSave /> {editingTemplateId ? 'UPDATE TEMPLATE' : 'SAVE TEMPLATE'}
                            </button>
                        </div>

                        <div className="lg:border-l border-white/5 lg:pl-12">
                            <div className="pb-4 border-b border-white/5 mb-6">
                                <h2 className="text-lg font-bold text-white mb-1">2. Problem Editor</h2>
                                <p className="text-xs text-gray-500">Create a custom coding challenge.</p>
                            </div>
                            
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Title</label>
                                    <input 
                                        type="text" 
                                        placeholder="e.g. Reverse Linked List" 
                                        value={currentProblem.title} 
                                        onChange={(e) => setCurrentProblem({...currentProblem, title: e.target.value})} 
                                        className="w-full bg-black border border-white/10 rounded p-2 text-white text-sm outline-none focus:border-purple-500 placeholder:text-gray-700" 
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Description (Markdown)</label>
                                    <textarea 
                                        placeholder="Explain the problem..." 
                                        value={currentProblem.description} 
                                        onChange={(e) => setCurrentProblem({...currentProblem, description: e.target.value})} 
                                        className="w-full bg-black border border-white/10 rounded p-2 text-white text-sm outline-none h-24 focus:border-purple-500 placeholder:text-gray-700 resize-none"
                                    ></textarea>
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                                        <FaCode /> Starter Code
                                    </label>
                                    <textarea 
                                        value={currentProblem.starterCode} 
                                        onChange={(e) => setCurrentProblem({...currentProblem, starterCode: e.target.value})} 
                                        className="w-full bg-[#050505] border border-white/10 rounded p-3 text-cyan-100 font-mono text-xs h-32 focus:border-purple-500 outline-none leading-relaxed"
                                    ></textarea>
                                </div>
                                
                                <div className="bg-[#151515] p-4 rounded border border-white/5">
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-2">
                                            <FaBolt className="text-yellow-500" size={10} />
                                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Test Cases</span>
                                        </div>
                                        <button 
                                            onClick={handleAddTestCase}
                                            className="text-[10px] bg-gray-800 hover:bg-gray-700 text-white px-2 py-1 rounded transition"
                                        >
                                            + Add Case
                                        </button>
                                    </div>
                                    
                                    <div className="space-y-3 max-h-40 overflow-y-auto custom-scrollbar">
                                        {currentProblem.testCases.map((tc, index) => (
                                            <div key={index} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center">
                                                <div>
                                                    <input 
                                                        type="text" 
                                                        placeholder="Input" 
                                                        value={tc.input} 
                                                        onChange={(e) => handleTestCaseChange(index, 'input', e.target.value)} 
                                                        className="w-full bg-black border border-white/10 rounded p-2 text-white font-mono text-xs focus:border-purple-500 placeholder:text-gray-700" 
                                                    />
                                                </div>
                                                <div>
                                                    <input 
                                                        type="text" 
                                                        placeholder="Output" 
                                                        value={tc.output} 
                                                        onChange={(e) => handleTestCaseChange(index, 'output', e.target.value)} 
                                                        className="w-full bg-black border border-white/10 rounded p-2 text-white font-mono text-xs focus:border-purple-500 placeholder:text-gray-700" 
                                                    />
                                                </div>
                                                {currentProblem.testCases.length > 1 && (
                                                    <button 
                                                        onClick={() => handleRemoveTestCase(index)}
                                                        className="text-red-500 hover:text-red-400 p-1"
                                                    >
                                                        <FaTimes size={12} />
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <button 
                                    onClick={handleAddProblem} 
                                    className={`w-full py-3 font-bold text-xs tracking-widest rounded flex items-center justify-center gap-2 border transition-colors ${
                                        isQueueFull
                                            ? 'bg-gray-800 text-gray-500 border-gray-700 cursor-not-allowed'
                                            : 'bg-gray-800 text-white hover:bg-gray-700 border-gray-600'
                                    }`}
                                    disabled={isQueueFull}
                                >
                                    <FaPlus /> {isQueueFull ? 'QUEUE FULL' : 'ADD TO QUEUE'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CustomRoomDashboard;