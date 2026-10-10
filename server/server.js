const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const mongoose = require('mongoose');
const http = require('http');
const { Server } = require('socket.io');
const Problem = require('./models/problem.model');
const Match = require('./models/match.model');
const RoomTemplate = require('./models/roomTemplate.model');
const CustomProblem = require('./models/customProblem.model');
const User = require('./models/user.model');

dotenv.config({ path: require('node:path').resolve(__dirname, '../.env') });

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: process.env.CLIENT_ORIGIN || "http://localhost:5173",
        methods: ["GET", "POST"]
    }
});

app.use(express.json());
app.use(cors({ origin: process.env.CLIENT_ORIGIN || "http://localhost:5173" }));

mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log(`MongoDB connected: database ${JSON.stringify(mongoose.connection.name)}`))
    .catch(() => console.error('MongoDB connection failed; check MONGO_URI, credentials, network access and DNS.'));

app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/users', require('./routes/user.routes'));
app.use('/api/code', require('./routes/code.routes'));
app.use('/api/custom', require('./routes/customRoom.routes'));
app.use('/api/matches', require('./routes/match.routes'));

let activeMatches = Object.create(null);
let waitingQueue = [];
let customLobbies = Object.create(null);

const isMatchPlayer = (match, socketId) => match &&
    (match.player1.socketId === socketId || match.player2.socketId === socketId);

const broadcastRoomList = () => {
    const publicRooms = Object.values(customLobbies)
        .filter(room => room.isPublic)
        .map(room => ({
            roomId: room.roomId,
            name: room.name,
            host: room.host?.username ?? 'Unknown',
            players: room.players.length,
            spectators: room.spectators.length,
            status: "Waiting", 
            rounds: room.rounds,
            hasPassword: !!(room.password && room.password.length > 0)
        }));
    io.emit('rooms_update', publicRooms);
};

const calculateRank = (rp) => {
    if (rp >= 1000) return "Radiant";
    if (rp >= 800) return "Immortal";
    if (rp >= 600) return "Diamond";
    if (rp >= 400) return "Platinum";
    if (rp >= 200) return "Gold";
    if (rp >= 100) return "Silver";
    return "Bronze";
};

const saveMatchToDB = async (roomId, matchData, winnerSocketId, reason) => {
    try {
        const player1Result = winnerSocketId === matchData.player1.socketId ? 'win' : 'loss';
        const player2Result = winnerSocketId === matchData.player2.socketId ? 'win' : 'loss';
        
        let winnerDbId = matchData.player1.userId;
        let loserDbId = matchData.player2.userId;

        if (winnerSocketId === matchData.player2.socketId) {
            winnerDbId = matchData.player2.userId;
            loserDbId = matchData.player1.userId;
        }

        const newMatch = new Match({
            roomId: roomId,
            type: matchData.type || 'ranked',
            players: [
                {
                    userId: matchData.player1.userId,
                    username: matchData.player1.username,
                    score: matchData.player1.score,
                    result: player1Result
                },
                {
                    userId: matchData.player2.userId,
                    username: matchData.player2.username,
                    score: matchData.player2.score,
                    result: player2Result
                }
            ],
            winnerId: winnerDbId,
            endReason: reason
        });

        await newMatch.save();

        if (matchData.type === 'ranked') {
            const winner = await User.findById(winnerDbId);
            if (winner) {
                winner.stats.wins += 1;
                winner.stats.gamesPlayed += 1;
                winner.stats.xp += 50;
                
                let newRp = (winner.stats.rp || 0) + 25;
                winner.stats.rp = newRp;
                
                winner.role = calculateRank(newRp);
                await winner.save();
            }

            const loser = await User.findById(loserDbId);
            if (loser) {
                loser.stats.losses += 1;
                loser.stats.gamesPlayed += 1;
                loser.stats.xp += 10;
                
                let newRp = (loser.stats.rp || 0) - 15;
                if (newRp < 0) newRp = 0;
                loser.stats.rp = newRp;
                
                loser.role = calculateRank(newRp);
                await loser.save();
            }
        }
    } catch (err) {
        console.error(err);
    }
};

io.on('connection', (socket) => {
    // Event emitters do not handle rejected async listeners. Contain bad payloads
    // and database failures without terminating the server process.
    const on = (event, handler) => socket.on(event, async (...args) => {
        try {
            await handler(...args);
        } catch {
            socket.emit('operation_error', { message: 'Unable to process event', event });
        }
    });

    on('find_match', async (userData) => {
        const isAlreadyInQueue = waitingQueue.some(player => player.socketId === socket.id);
        if (isAlreadyInQueue) return;
        
        waitingQueue.push({
            socketId: socket.id,
            userId: userData.userId,
            username: userData.username,
            rank: userData.rank || "Unranked"
        });

        if (waitingQueue.length >= 2) {
            const p1 = waitingQueue[0];
            const p2 = waitingQueue[1];
            const roomId = `match_${p1.socketId}_${p2.socketId}`;

            try {
                const problem = await Problem.aggregate([{ $sample: { size: 1 } }]);
                
                if (problem.length > 0) {
                    const player1 = waitingQueue.shift();
                    const player2 = waitingQueue.shift();

                    activeMatches[roomId] = {
                        type: 'ranked',
                        player1: { socketId: player1.socketId, userId: player1.userId, username: player1.username, score: 0 },
                        player2: { socketId: player2.socketId, userId: player2.userId, username: player2.username, score: 0 },
                        currentProblemId: problem[0]._id,
                        spectators: []
                    };

                    const matchData = { roomId, problem: problem[0] };
                    io.to(player1.socketId).emit('match_found', { ...matchData, opponent: player2 });
                    io.to(player2.socketId).emit('match_found', { ...matchData, opponent: player1 });
                }
            } catch (err) {
                console.error(err);
            }
        }
    });

    on('get_rooms', () => {
        broadcastRoomList();
    });

    on('create_custom_room', async ({ templateId, isPublic, name, userData }) => {
        try {
            const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
            let password = "";
            let rounds = 1;
            let problemList = [];

            if (templateId) {
                const template = await RoomTemplate.findById(templateId);
                if (template) {
                    password = template.password || "";
                    rounds = template.rounds;
                    problemList = template.problems;
                    if (!name) name = template.name;
                }
            } else {
                const problem = await Problem.aggregate([{ $sample: { size: 1 } }]);
                if (problem.length > 0) problemList = [problem[0]._id];
            }

            customLobbies[roomId] = {
                roomId,
                name: name || `${userData.username}'s Room`,
                host: { ...userData, socketId: socket.id },
                isPublic: isPublic !== false,
                password,
                rounds,
                problemList,
                templateId,
                players: [{
                    socketId: socket.id,
                    userId: userData.userId,
                    username: userData.username,
                    rank: userData.rank || "Unranked"
                }],
                spectators: []
            };

            socket.join(roomId);
            socket.emit('custom_room_created', { roomId });
            broadcastRoomList(); 
        } catch (err) {
            console.error(err);
        }
    });

    on('join_custom_room', async (data) => {
        const { roomId, password, role, userData } = data;
        const lobby = customLobbies[roomId];

        if (!lobby) {
            socket.emit('error_joining_room', { message: "Room not found" });
            return;
        }

        if (lobby.password && lobby.password !== password) {
            socket.emit('error_joining_room', { message: "Incorrect Password" });
            return;
        }

        const isAlreadyInLobby = lobby.players.some(p => p.userId === userData.userId) || 
                                 lobby.spectators.some(s => s.userId === userData.userId);

        if (!isAlreadyInLobby) {
            socket.join(roomId);
            const participant = {
                socketId: socket.id,
                userId: userData.userId,
                username: userData.username,
                rank: userData.rank || "Unranked"
            };

            if (role === 'player') {
                if (lobby.players.length < 2) {
                    lobby.players.push(participant);
                    broadcastRoomList();
                } else {
                    socket.emit('error_joining_room', { message: "Player slots full. Joining as spectator." });
                    lobby.spectators.push(participant);
                    broadcastRoomList();
                }
            } else {
                lobby.spectators.push(participant);
                broadcastRoomList();
            }
        } else {
            // Already in lobby, just broadcast
            broadcastRoomList();
        }

        if (lobby.players.length === 2) {
            const player1 = lobby.players[0];
            const player2 = lobby.players[1];
            const matchId = `custom_${roomId}`;

            const firstProblemId = lobby.problemList[0];
            let problem;
            
            if (lobby.templateId) {
                problem = await CustomProblem.findById(firstProblemId);
            } else {
                problem = await Problem.findById(firstProblemId);
            }

            if (problem) {
                activeMatches[matchId] = {
                    type: 'custom',
                    player1: { socketId: player1.socketId, userId: player1.userId, username: player1.username, score: 0 },
                    player2: { socketId: player2.socketId, userId: player2.userId, username: player2.username, score: 0 },
                    currentProblemId: problem._id,
                    problemList: lobby.problemList,
                    currentProblemIndex: 0,
                    spectators: lobby.spectators.map(s => s.socketId)
                };

                const matchData = { roomId: matchId, problem: problem };

                io.to(player1.socketId).emit('match_found', { ...matchData, opponent: player2 });
                io.to(player2.socketId).emit('match_found', { ...matchData, opponent: player1 });
                
                lobby.spectators.forEach(spec => {
                    io.to(spec.socketId).emit('match_found', { ...matchData, opponent: { username: "Players" }, isSpectator: true });
                });

                delete customLobbies[roomId];
                broadcastRoomList();
            }
        } else {
             io.to(roomId).emit('lobby_update', { 
                players: lobby.players.length, 
                spectators: lobby.spectators.length 
            });
        }
    });

    on('round_won', async (roomId) => {
        const match = activeMatches[roomId];
        if (!isMatchPlayer(match, socket.id)) return;

        let winner = null;
        if (socket.id === match.player1.socketId) {
            match.player1.score += 1;
            winner = "player1";
        } else if (socket.id === match.player2.socketId) {
            match.player2.score += 1;
            winner = "player2";
        }

        const maxScore = match.type === 'custom' ? Math.ceil(match.problemList.length / 2) + 1 : 5;
        const isCustomEnd = match.type === 'custom' && (match.currentProblemIndex + 1 >= match.problemList.length);

        if (match.player1.score >= maxScore || match.player2.score >= maxScore || isCustomEnd) {
            const winnerId = socket.id;
            io.to(roomId).emit('match_over', {
                winnerId: winnerId,
                scores: { player1: match.player1.score, player2: match.player2.score },
                reason: 'Match Completed',
                player1SocketId: match.player1.socketId,
                player2SocketId: match.player2.socketId
            });
            await saveMatchToDB(roomId, match, winnerId, 'Victory');
            delete activeMatches[roomId];
        } else {
            try {
                let problem;
                if (match.type === 'custom' && match.problemList) {
                    match.currentProblemIndex += 1;
                    const nextId = match.problemList[match.currentProblemIndex];
                    const problemFromCustom = await CustomProblem.findById(nextId);
                    if (problemFromCustom) problem = problemFromCustom;
                    else problem = await Problem.findById(nextId);
                } else {
                    const next = await Problem.aggregate([{ $match: { _id: { $ne: match.currentProblemId } } }, { $sample: { size: 1 } }]);
                    problem = next[0];
                }

                if (problem) {
                    match.currentProblemId = problem._id;
                    io.to(roomId).emit('round_update', {
                        scores: { player1: match.player1.score, player2: match.player2.score },
                        problem: problem,
                        winnerId: socket.id
                    });
                }
            } catch (err) {
                console.error(err);
            }
        }
    });

    on('forfeit_match', async (roomId) => {
        const match = activeMatches[roomId];
        if (!isMatchPlayer(match, socket.id)) return;

        let winnerId = null;
        if (socket.id === match.player1.socketId) winnerId = match.player2.socketId;
        else winnerId = match.player1.socketId;

        io.to(roomId).emit('match_over', {
            winnerId: winnerId,
            scores: { player1: match.player1.score, player2: match.player2.score },
            reason: 'Opponent Disqualified',
            player1SocketId: match.player1.socketId,
            player2SocketId: match.player2.socketId
        });

        await saveMatchToDB(roomId, match, winnerId, 'Disqualification');
        delete activeMatches[roomId];
    });

    on('code_progress', (data) => {
        const match = activeMatches[data.roomId];
        if (!isMatchPlayer(match, socket.id)) return;

        let opponentId = null;
        let playerUsername = "";

        if (socket.id === match.player1.socketId) {
            opponentId = match.player2.socketId;
            playerUsername = match.player1.username;
        } else {
            opponentId = match.player1.socketId;
            playerUsername = match.player2.username;
        }

        io.to(opponentId).emit('opponent_progress', {
            structure: data.structure,
            isTyping: data.isTyping
        });

        if (match.spectators && match.spectators.length > 0) {
            match.spectators.forEach(specId => {
                io.to(specId).emit('spectator_feed', {
                    username: playerUsername,
                    code: data.code,
                    isTyping: data.isTyping
                });
            });
        }
    });

    on('leave_room', () => {
        waitingQueue = waitingQueue.filter(player => player.socketId !== socket.id);
        
        for (const roomId in customLobbies) {
            if (customLobbies[roomId].host.socketId === socket.id) {
                delete customLobbies[roomId];
            } else {
                customLobbies[roomId].players = customLobbies[roomId].players.filter(p => p.socketId !== socket.id);
                customLobbies[roomId].spectators = customLobbies[roomId].spectators.filter(s => s.socketId !== socket.id);
                
                io.to(roomId).emit('lobby_update', { 
                    players: customLobbies[roomId].players.length, 
                    spectators: customLobbies[roomId].spectators.length 
                });
            }
        }
        broadcastRoomList();
    });

    on('disconnect', async () => {
        waitingQueue = waitingQueue.filter(player => player.socketId !== socket.id);
        
        for (const roomId in customLobbies) {
            if (customLobbies[roomId].host.socketId === socket.id) {
                delete customLobbies[roomId];
            } else {
                customLobbies[roomId].players = customLobbies[roomId].players.filter(p => p.socketId !== socket.id);
                customLobbies[roomId].spectators = customLobbies[roomId].spectators.filter(s => s.socketId !== socket.id);
            }
        }
        broadcastRoomList();

        for (const roomId in activeMatches) {
            const match = activeMatches[roomId];
            if (match.player1.socketId === socket.id || match.player2.socketId === socket.id) {
                let winnerId = (match.player1.socketId === socket.id) ? match.player2.socketId : match.player1.socketId;
                
                io.to(roomId).emit('match_over', {
                    winnerId: winnerId,
                    scores: { player1: match.player1.score, player2: match.player2.score },
                    reason: 'Opponent Disconnected',
                    player1SocketId: match.player1.socketId,
                    player2SocketId: match.player2.socketId
                });

                await saveMatchToDB(roomId, match, winnerId, 'Disqualification');
                delete activeMatches[roomId];
                break;
            }
        }
    });

    on('join_match_room', (roomId) => {
        const match = activeMatches[roomId];
        if (!match || (!isMatchPlayer(match, socket.id) && !match.spectators?.includes(socket.id))) return;
        socket.join(roomId);
    });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
