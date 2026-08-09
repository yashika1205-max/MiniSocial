const express = require("express");
const path = require("path");
const bcrypt = require("bcrypt");
const session = require("express-session");

// Database Connection
const db = require("./database/db");

const app = express();
const PORT = 3000;

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(session({
    secret: "minisocialsecret",
    resave: false,
    saveUninitialized: false
}));

// Static Files
app.use(express.static(path.join(__dirname, "public")));

// View Engine
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

/* ===========================
        LOGIN PAGE
=========================== */

app.get("/", (req, res) => {
    res.render("login");
});

/* ===========================
      REGISTER PAGE
=========================== */

app.get("/register", (req, res) => {
    res.render("register");
});

/* ===========================
      REGISTER USER
=========================== */

app.post("/register", async (req, res) => {

    const { name, username, email, password } = req.body;

    try {

        const hashedPassword = await bcrypt.hash(password, 10);

        const sql = `
        INSERT INTO users
        (name, username, email, password)
        VALUES (?, ?, ?, ?)
        `;

        db.query(sql,
            [name, username, email, hashedPassword],
            (err) => {

                if (err) {
                    console.log(err);
                    return res.send("Registration Failed");
                }

                res.redirect("/");

            });

    } catch (err) {

        console.log(err);
        res.send("Something went wrong");

    }

});

/* ===========================
        LOGIN USER
=========================== */

app.post("/login", (req, res) => {

    const { email, password } = req.body;

    const sql =
    "SELECT * FROM users WHERE email = ?";

    db.query(sql, [email], async (err, result) => {

        if (err) {
            console.log(err);
            return res.send("Database Error");
        }

        if (result.length === 0) {
            return res.send("User Not Found");
        }

        const user = result[0];
        console.log("Email:", email);
        console.log("Entered Password:", password);
        console.log("Hash:", user.password);

        const match =
        await bcrypt.compare(password, user.password);
        console.log("Match:", match);

        if (!match) {
            return res.send("Invalid Password");
        }

        req.session.user = user;

        res.redirect("/home");

    });

});

/* ===========================
        HOME PAGE
=========================== */

app.get("/home", (req, res) => {

    if (!req.session.user) {
        return res.redirect("/");
    }

    const postSql = `
        SELECT
            posts.id,
            posts.user_id,
            posts.content,
            posts.created_at,
            users.name,
            COUNT(DISTINCT likes.id) AS likes
        FROM posts
        JOIN users
            ON posts.user_id = users.id
        LEFT JOIN likes
            ON posts.id = likes.post_id
        GROUP BY
            posts.id,
            posts.user_id,
            posts.content,
            posts.created_at,
            users.name
        ORDER BY posts.created_at DESC
    `;

    db.query(postSql, (err, posts) => {

        if (err) {
            console.log("Post Error:", err);
            return res.send("Database Error");
        }

        if (posts.length === 0) {

            return res.render("home", {
                user: req.session.user,
                posts: []
            });

        }

        const postIds = posts.map(post => post.id);

        const commentSql = `
            SELECT
                comments.id,
                comments.post_id,
                comments.user_id,
                comments.comment,
                comments.created_at,
                users.name
            FROM comments
            JOIN users
                ON comments.user_id = users.id
            WHERE comments.post_id IN (?)
            ORDER BY comments.created_at ASC
        `;

        db.query(commentSql, [postIds], (err, comments) => {

            if (err) {
                console.log("Comment Error:", err);
                return res.send("Comment Database Error");
            }

            posts.forEach(post => {

                post.comments = comments.filter(comment =>
                    Number(comment.post_id) === Number(post.id)
                );

            });

            res.render("home", {
                user: req.session.user,
                posts: posts
            });

        });

    });

});

/* ===========================
      CREATE POST
=========================== */

app.post("/create-post", (req, res) => {

    if (!req.session.user) {
        return res.redirect("/");
    }

    const { content } = req.body;

    if (!content || content.trim() === "") {
        return res.redirect("/home");
    }

    const sql = `
        INSERT INTO posts (user_id, content)
        VALUES (?, ?)
    `;

    db.query(
        sql,
        [req.session.user.id, content.trim()],
        (err) => {

            if (err) {
                console.log("Create Post Error:", err);
                return res.send("Error Creating Post");
            }

            res.redirect("/home");
        }
    );

});

app.post("/like/:id", (req, res) => {

    if (!req.session.user) {
        return res.redirect("/");
    }

    const postId = req.params.id;
    const userId = req.session.user.id;

    const checkSql =
        "SELECT * FROM likes WHERE post_id = ? AND user_id = ?";

    db.query(checkSql, [postId, userId], (err, result) => {

        if (err) {
            console.log(err);
            return res.send("Database Error");
        }

        if (result.length > 0) {
            return res.redirect("/home");
        }

        db.query(
            "INSERT INTO likes (post_id, user_id) VALUES (?, ?)",
            [postId, userId],
            (err) => {

                if (err) {
                    console.log(err);
                    return res.send("Like Error");
                }

                res.redirect("/home");
            }
        );
    });
});app.post("/like/:id", (req, res) => {

    if (!req.session.user) {
        return res.redirect("/");
    }

    const postId = req.params.id;
    const userId = req.session.user.id;

    const checkSql = `
        SELECT * FROM likes
        WHERE post_id = ? AND user_id = ?
    `;

    db.query(checkSql, [postId, userId], (err, result) => {

        if (err) {
            console.log("Like Check Error:", err);
            return res.send("Database Error");
        }

        if (result.length > 0) {
            return res.redirect("/home");
        }

        const insertSql = `
            INSERT INTO likes (post_id, user_id)
            VALUES (?, ?)
        `;

        db.query(insertSql, [postId, userId], (err) => {

            if (err) {
                console.log("Like Error:", err);
                return res.send("Like Error");
            }

            res.redirect("/home");

        });

    });

});

/* ===========================
        ADD COMMENT
=========================== */

app.post("/comment/:id", (req, res) => {

    if (!req.session.user) {
        return res.redirect("/");
    }

    const postId = req.params.id;
    const userId = req.session.user.id;
    const { comment } = req.body;

    if (!comment || comment.trim() === "") {
        return res.redirect("/home");
    }

    const sql = `
        INSERT INTO comments (post_id, user_id, comment)
        VALUES (?, ?, ?)
    `;

    db.query(sql, [postId, userId, comment.trim()], (err) => {

        if (err) {
            console.log("Comment Error:", err);
            return res.send("Comment Error");
        }

        res.redirect("/home");

    });

});

/* ===========================
        LOGOUT
=========================== */

app.get("/logout", (req, res) => {

    req.session.destroy((err) => {

        if (err) {
            return res.send("Logout Failed");
        }

        res.redirect("/");

    });

});

/* ===========================
        START SERVER
=========================== */

app.listen(PORT, () => {
    console.log(`🚀 Server is running on http://localhost:${PORT}`);
});