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
    const userId = req.query.userId || "USER-009"; // USUARIO DE TEST; SE LLAMA ALEX P.
    const session = driver.session();
    try {
        const result = await session.run(`
            MATCH (p:Pin)
            OPTIONAL MATCH (u:User)-[:CREATES]->(p)
            OPTIONAL MATCH (b:Board)-[:CONTAINS]->(p)
            OPTIONAL MATCH (:User)-[l:LIKES]->(p)
            OPTIONAL MATCH (me:User {id_user: $userId})-[myLike:LIKES]->(p)
            OPTIONAL MATCH (c:Comment)-[:ON]->(p)<-[:WROTE]-(author:User)
            
            WITH p, u, b, count(l) AS likesCount, myLike, c, author
            ORDER BY c.created_at DESC
            
            WITH p, u, b, likesCount, myLike, 
                 collect({id: c.id_comment, text: c.body, author: author.name, date: c.created_at}) AS comments
            
            RETURN p, u.name AS creator, u.profile_picture AS creatorPic, 
                   b.title AS board, likesCount, (myLike IS NOT NULL) AS likedByMe, comments, p.created_at AS createdAt
            ORDER BY p.created_at DESC
        `, { userId });
        
        const pins = result.records.map(record => ({
            ...record.get('p').properties,
            creator: record.get('creator') || "Anónimo",
            creatorPic: record.get('creatorPic'),
            board: record.get('board'),
            likesCount: record.get('likesCount').low || record.get('likesCount'),
            likedByMe: record.get('likedByMe'),
            comments: record.get('comments').slice(0, 10), 
            createdAt: record.get('createdAt')
        }));
        res.json(pins);
    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally { await session.close(); }
});

// LIKE PIN (toggle like/unlike)
app.post('/api/pins/:id/like', async (req, res) => {
    const { userId } = req.body;            // usuario que da like
    const pinId = req.params.id;            // pin que recibe el like

    if (!userId) {
        return res.status(400).json({ error: 'userId es requerido' });
    }

    const session = driver.session();

    try {
        // 1. Verificar si ya existe el like
        const checkResult = await session.run(
            `MATCH (u:User {id_user: $userId})-[r:LIKES]->(p:Pin {id_pin: $pinId})
             RETURN r`,
            { userId, pinId }
        );

        let isLiked;

        if (checkResult.records.length > 0) {
            // Ya lo había likeado -> quitar like
            await session.run(
                `MATCH (u:User {id_user: $userId})-[r:LIKES]->(p:Pin {id_pin: $pinId})
                 DELETE r`,
                { userId, pinId }
            );
            isLiked = false;
        } else {
            // No lo había likeado -> crear like
            await session.run(
                `MATCH (u:User {id_user: $userId}), (p:Pin {id_pin: $pinId})
                 MERGE (u)-[:LIKES {date: datetime()}]->(p)`,
                { userId, pinId }
            );
            isLiked = true;
        }

        // 2. Recalcular el total de likes del pin
        const likesResult = await session.run(
            `MATCH (:User)-[l:LIKES]->(p:Pin {id_pin: $pinId})
             RETURN count(l) AS likesCount`,
            { pinId }
        );

        const likesCount = likesResult.records[0].get('likesCount');

        // 3. Responder al frontend
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
    const { userId } = req.body;        // usuario que sigue
    const targetUserId = req.params.id; // usuario al que se quiere seguir

    if (!userId) {
        return res.status(400).json({ error: 'userId es requerido' });
    }

    if (userId === targetUserId) {
        return res.status(400).json({ error: 'No puedes seguirte a ti mismo' });
    }

    const session = driver.session();

    try {
        // 1. Verificar si ya existe la relación FOLLOWS
        const checkResult = await session.run(
            `MATCH (follower:User {id_user: $userId})-[r:FOLLOWS]->(target:User {id_user: $targetUserId})
             RETURN r`,
            { userId, targetUserId }
        );

        let isFollowing;

        if (checkResult.records.length > 0) {
            // Ya lo seguía -> dejar de seguir
            await session.run(
                `MATCH (follower:User {id_user: $userId})-[r:FOLLOWS]->(target:User {id_user: $targetUserId})
                 DELETE r`,
                { userId, targetUserId }
            );
            isFollowing = false;
        } else {
            // No lo seguía -> crear follow
            await session.run(
                `MATCH (follower:User {id_user: $userId}), (target:User {id_user: $targetUserId})
                 MERGE (follower)-[:FOLLOWS {since: datetime()}]->(target)`,
                { userId, targetUserId }
            );
            isFollowing = true;
        }

        // 2. Recalcular el número de seguidores del usuario objetivo
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

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Backend corriendo en puerto ${PORT}`));