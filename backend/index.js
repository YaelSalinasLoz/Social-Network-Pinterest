require('dotenv').config();
const express = require('express');
const neo4j = require('neo4j-driver');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const app = express();
app.use(cors());
app.use(express.json());

// Conexión a Neo4j
const driver = neo4j.driver(
    process.env.NEO4J_URI,
    neo4j.auth.basic(process.env.NEO4J_USER, process.env.NEO4J_PASSWORD),
    { disableLosslessIntegers: true }
);

// --- ENDPOINTS ---

// GET PINS (Feed Principal)
app.get('/api/pins', async (req, res) => {
    const userId = req.query.userId || "USER-001";
    const session = driver.session();
    try {
        const result = await session.run(`
            MATCH (p:Pin)
            OPTIONAL MATCH (u:User)-[:CREATES]->(p)
            OPTIONAL MATCH (b:Board)-[:CONTAINS]->(p)
            OPTIONAL MATCH (:User)-[l:LIKES]->(p)
            OPTIONAL MATCH (me:User {id_user: $userId})-[myLike:LIKES]->(p)
            OPTIONAL MATCH (me)-[followRel:FOLLOWS]->(u)
            OPTIONAL MATCH (c:Comment)-[:ON]->(p)<-[:WROTE]-(author:User)
            
            WITH p, u, b, count(DISTINCT l) AS likesCount, myLike, followRel, c, author
            ORDER BY c.created_at DESC
            
            WITH p, u, b, likesCount, myLike, followRel,
                 collect({id: c.id_comment, text: c.body, author: author.name, date: c.created_at}) AS comments
            
            RETURN p, u.name AS creator, u.id_user AS creatorId, u.profile_picture AS creatorPic, 
                   b.title AS board, likesCount, (myLike IS NOT NULL) AS likedByMe, 
                   (followRel IS NOT NULL) AS isFollowing, comments, p.created_at AS createdAt
            ORDER BY p.created_at DESC
        `, { userId });
        
        const pins = result.records.map(record => ({
            ...record.get('p').properties,
            creator: record.get('creator') || "Anónimo",
            creatorId: record.get('creatorId'),
            creatorPic: record.get('creatorPic'),
            board: record.get('board'),
            likesCount: record.get('likesCount').low || record.get('likesCount'),
            likedByMe: record.get('likedByMe'),
            isFollowing: record.get('isFollowing'),
            comments: record.get('comments').slice(0, 10), 
            createdAt: record.get('createdAt')
        }));
        res.json(pins);
    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally { await session.close(); }
});

// GET PIN BY ID (Detalle de un pin)
app.get('/api/pin/:id', async (req, res) => {
    const pinId = req.params.id;
    const userId = req.query.userId || "USER-001";
    const session = driver.session();
    try {
        const mainResult = await session.run(`
            MATCH (p:Pin {id_pin: $pinId})
            OPTIONAL MATCH (u:User)-[:CREATES]->(p)
            OPTIONAL MATCH (b:Board)-[:CONTAINS]->(p)
            OPTIONAL MATCH (:User)-[l:LIKES]->(p)
            OPTIONAL MATCH (me:User {id_user: $userId})-[myLike:LIKES]->(p)
            OPTIONAL MATCH (me)-[followRel:FOLLOWS]->(u)
            OPTIONAL MATCH (c:Comment)-[:ON]->(p)<-[:WROTE]-(author:User)
            
            WITH p, u, b, count(DISTINCT l) AS likesCount, myLike, followRel, c, author
            ORDER BY c.created_at DESC
            
            WITH p, u, b, likesCount, myLike, followRel,
                 collect({id: c.id_comment, text: c.body, author: author.name, date: c.created_at}) AS comments
            
            RETURN p, u.name AS creator, u.id_user AS creatorId, u.profile_picture AS creatorPic,
                   b.title AS board, b.id_board AS boardId, likesCount, 
                   (myLike IS NOT NULL) AS likedByMe, (followRel IS NOT NULL) AS isFollowing, comments
        `, { pinId, userId });

        if (mainResult.records.length === 0) {
            return res.status(404).json({ error: "Pin no encontrado" });
        }

        const record = mainResult.records[0];
        const mainPin = {
            ...record.get('p').properties,
            creator: record.get('creator') || "Anónimo",
            creatorId: record.get('creatorId'),
            creatorPic: record.get('creatorPic'),
            board: record.get('board'),
            boardId: record.get('boardId'),
            likesCount: record.get('likesCount')?.low || record.get('likesCount') || 0,
            likedByMe: record.get('likedByMe'),
            isFollowing: record.get('isFollowing'),
            comments: record.get('comments').filter(c => c.id !== null)
        };

        const suggestedResult = await session.run(`
            MATCH (other:Pin)
            WHERE other.id_pin <> $pinId
            OPTIONAL MATCH (u:User)-[:CREATES]->(other)
            RETURN other, u.name AS creator
            ORDER BY other.created_at DESC
            LIMIT 15
        `, { pinId });

        const suggestedSimilarPins = suggestedResult.records.map(rec => ({
            ...rec.get('other').properties,
            creator: rec.get('creator') || "Anónimo"
        }));

        res.json({ mainPin, suggestedSimilarPins });
    } catch (error) {
        console.error("Error en GET /api/pin/:id:", error);
        res.status(500).json({ error: error.message });
    } finally { await session.close(); }
});

// LIKE PIN (toggle like/unlike)
app.post('/api/pins/:id/like', async (req, res) => {
    const { userId } = req.body;
    const pinId = req.params.id;

    if (!userId) {
        return res.status(400).json({ error: 'userId es requerido' });
    }

    const session = driver.session();

    try {
        const checkResult = await session.run(
            `MATCH (u:User {id_user: $userId})-[r:LIKES]->(p:Pin {id_pin: $pinId})
             RETURN r`,
            { userId, pinId }
        );

        let isLiked;

        if (checkResult.records.length > 0) {
            await session.run(
                `MATCH (u:User {id_user: $userId})-[r:LIKES]->(p:Pin {id_pin: $pinId})
                 DELETE r`,
                { userId, pinId }
            );
            isLiked = false;
        } else {
            await session.run(
                `MATCH (u:User {id_user: $userId}), (p:Pin {id_pin: $pinId})
                 MERGE (u)-[:LIKES {date: datetime()}]->(p)`,
                { userId, pinId }
            );
            isLiked = true;
        }

        const likesResult = await session.run(
            `MATCH (:User)-[l:LIKES]->(p:Pin {id_pin: $pinId})
             RETURN count(l) AS likesCount`,
            { pinId }
        );

        const likesCount = likesResult.records[0].get('likesCount');

        res.json({
            success: true,
            isLiked,
            likesCount
        });
    } catch (e) {
        console.error("Error en Like:", e);
        res.status(500).json({ error: e.message });
    } finally {
        await session.close();
    }
});

// POST COMMENT
app.post('/api/pins/:id/comment', async (req, res) => {
    const { userId, text } = req.body;
    const pinId = req.params.id;
    const session = driver.session();
    const commentId = uuidv4();
    try {
        await session.run(`
            MATCH (u:User {id_user: $userId})
            MATCH (p:Pin {id_pin: $pinId})
            CREATE (c:Comment {id_comment: $commentId, body: $text, created_at: datetime()})
            CREATE (u)-[:WROTE]->(c)-[:ON]->(p)
        `, { userId, pinId, commentId, text });
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); } finally { await session.close(); }
});

// FOLLOW / UNFOLLOW USER (toggle)
app.post('/api/users/:id/follow', async (req, res) => {
    const { userId } = req.body;
    const targetUserId = req.params.id;

    if (!userId) {
        return res.status(400).json({ error: 'userId es requerido' });
    }

    if (userId === targetUserId) {
        return res.status(400).json({ error: 'No puedes seguirte a ti mismo' });
    }

    const session = driver.session();

    try {
        const checkResult = await session.run(
            `MATCH (follower:User {id_user: $userId})-[r:FOLLOWS]->(target:User {id_user: $targetUserId})
             RETURN r`,
            { userId, targetUserId }
        );

        let isFollowing;

        if (checkResult.records.length > 0) {
            await session.run(
                `MATCH (follower:User {id_user: $userId})-[r:FOLLOWS]->(target:User {id_user: $targetUserId})
                 DELETE r`,
                { userId, targetUserId }
            );
            isFollowing = false;
        } else {
            await session.run(
                `MATCH (follower:User {id_user: $userId}), (target:User {id_user: $targetUserId})
                 MERGE (follower)-[:FOLLOWS {since: datetime()}]->(target)`,
                { userId, targetUserId }
            );
            isFollowing = true;
        }

        const followersResult = await session.run(
            `MATCH (target:User {id_user: $targetUserId})<-[:FOLLOWS]-(other:User)
             RETURN count(other) AS followersCount`,
            { targetUserId }
        );

        const followersCount = followersResult.records[0].get('followersCount');

        res.json({
            success: true,
            isFollowing,
            followersCount
        });
    } catch (e) {
        console.error("Error en Follow:", e);
        res.status(500).json({ error: e.message });
    } finally {
        await session.close();
    }
});

// LISTA de usuarios que sigue un usuario (following)
app.get('/api/users/:id/following', async (req, res) => {
    const userId = req.params.id;
    const session = driver.session();

    try {
        const result = await session.run(
            `MATCH (u:User {id_user: $userId})-[:FOLLOWS]->(other:User)
             RETURN other
             ORDER BY other.name`,
            { userId }
        );

        const following = result.records.map(record => {
            const u = record.get('other').properties;
            return {
                id: u.id_user,
                name: u.name,
                profile_picture: u.profile_picture
            };
        });

        res.json(following);
    } catch (e) {
        console.error("Error obteniendo following:", e);
        res.status(500).json({ error: e.message });
    } finally {
        await session.close();
    }
});

// LISTA de seguidores de un usuario (followers)
app.get('/api/users/:id/followers', async (req, res) => {
    const userId = req.params.id;
    const session = driver.session();

    try {
        const result = await session.run(
            `MATCH (u:User {id_user: $userId})<-[:FOLLOWS]-(other:User)
             RETURN other
             ORDER BY other.name`,
            { userId }
        );

        const followers = result.records.map(record => {
            const u = record.get('other').properties;
            return {
                id: u.id_user,
                name: u.name,
                profile_picture: u.profile_picture
            };
        });

        res.json(followers);
    } catch (e) {
        console.error("Error obteniendo followers:", e);
        res.status(500).json({ error: e.message });
    } finally {
        await session.close();
    }
});

// GET BOARDS
app.get('/api/boards', async (req, res) => {
    const session = driver.session();
    try {
        const r = await session.run(`MATCH (b:Board) RETURN b.id_board AS id, b.title AS title ORDER BY b.created_at DESC`);
        res.json(r.records.map(rec => ({id: rec.get('id'), title: rec.get('title')})));
    } catch (e) { res.status(500).json(e); } finally { await session.close(); }
});

// CREATE BOARD
app.post('/api/boards', async (req, res) => {
    const { title, description, userId } = req.body;
    const session = driver.session();
    const newId = uuidv4();
    try {
        await session.run(`
            MATCH (u:User {id_user: $userId})
            CREATE (b:Board {id_board: $newId, title: $title, description: $description, created_at: datetime()})
            CREATE (u)-[:CREATES]->(b)
        `, { userId, newId, title, description });
        res.json({ success: true, id: newId });
    } catch (e) { res.status(500).json(e); } finally { await session.close(); }
});

// CREATE PIN
app.post('/api/pins', async (req, res) => {
    const { title, description, url_image, boardId, userId } = req.body;
    const session = driver.session();
    const newId = uuidv4();
    try {
        await session.run(`
            MATCH (u:User {id_user: $userId})
            MATCH (b:Board {id_board: $boardId})
            CREATE (p:Pin {
                id_pin: $newId, 
                title: $title, 
                description: $description, 
                url_image: $url_image, 
                created_at: datetime()
            })
            CREATE (u)-[:CREATES]->(p)
            CREATE (b)-[:CONTAINS]->(p)
        `, { userId, boardId, newId, title, description, url_image });
        res.json({ success: true, id: newId });
    } catch (e) { res.status(500).json(e); } finally { await session.close(); }
});

// GET USER PROFILE - Datos del usuario
app.get('/api/user/:id', async (req, res) => {
    const userId = req.params.id;
    const session = driver.session();
    try {
        const result = await session.run(`
            MATCH (u:User {id_user: $userId})
            OPTIONAL MATCH (u)-[:CREATES]->(b:Board)
            OPTIONAL MATCH (u)-[:CREATES]->(p:Pin)
            OPTIONAL MATCH (u)-[:LIKES]->(liked:Pin)
            RETURN u, count(DISTINCT b) AS boardsCount, count(DISTINCT p) AS pinsCount, count(DISTINCT liked) AS likesCount
        `, { userId });

        if (result.records.length === 0) {
            return res.status(404).json({ error: "Usuario no encontrado" });
        }

        const record = result.records[0];
        const user = {
            ...record.get('u').properties,
            boardsCount: record.get('boardsCount')?.low || record.get('boardsCount') || 0,
            pinsCount: record.get('pinsCount')?.low || record.get('pinsCount') || 0,
            likesCount: record.get('likesCount')?.low || record.get('likesCount') || 0
        };

        res.json(user);
    } catch (e) {
        console.error("Error en GET /api/user/:id:", e);
        res.status(500).json({ error: e.message });
    } finally { await session.close(); }
});

// GET USER SAVED PINS - Pins guardados en los boards del usuario
app.get('/api/user/:id/saved-pins', async (req, res) => {
    const userId = req.params.id;
    const session = driver.session();
    try {
        const result = await session.run(`
            MATCH (u:User {id_user: $userId})-[:CREATES]->(b:Board)-[:CONTAINS]->(p:Pin)
            OPTIONAL MATCH (creator:User)-[:CREATES]->(p)
            RETURN DISTINCT p, creator.name AS creatorName, b.title AS boardTitle
            ORDER BY p.created_at DESC
        `, { userId });

        const pins = result.records.map(rec => ({
            ...rec.get('p').properties,
            creator: rec.get('creatorName') || "Anónimo",
            board: rec.get('boardTitle')
        }));

        res.json(pins);
    } catch (e) {
        console.error("Error en GET /api/user/:id/saved-pins:", e);
        res.status(500).json({ error: e.message });
    } finally { await session.close(); }
});

// GET USER LIKED PINS - Pins que el usuario ha dado like
app.get('/api/user/:id/liked-pins', async (req, res) => {
    const userId = req.params.id;
    const session = driver.session();
    try {
        const result = await session.run(`
            MATCH (u:User {id_user: $userId})-[l:LIKES]->(p:Pin)
            OPTIONAL MATCH (creator:User)-[:CREATES]->(p)
            RETURN p, creator.name AS creatorName, l.date AS likedAt
            ORDER BY l.date DESC
        `, { userId });

        const pins = result.records.map(rec => ({
            ...rec.get('p').properties,
            creator: rec.get('creatorName') || "Anónimo",
            likedAt: rec.get('likedAt')
        }));

        res.json(pins);
    } catch (e) {
        console.error("Error en GET /api/user/:id/liked-pins:", e);
        res.status(500).json({ error: e.message });
    } finally { await session.close(); }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Backend corriendo en puerto ${PORT}`));
