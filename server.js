const express = require("express");
const pg = require("pg");
const jwt = require("jsonwebtoken");

const PG_CONNECTION_STRING = process.env.PG_CONNECTION_STRING;
const PORT = process.env.PORT || 8080;

async function main() {
  try {
    const client = new pg.Client({
      connectionString: PG_CONNECTION_STRING,
    });
    await client.connect();
    console.log("Successfully Connected");

    client.on("error", (err) => {
      console.error("PostgreSQL client error:", err);
    });

    const app = express();
    app.use(express.json());

    app.get("/", (req, res) => {
      res.send("Fly Fly, Pheonix, Fly!");
    });

    
    const refreshToken = {};

    // login and generate refresh token
    app.post("/login", async (req, res) => {
      const username = req.body.username;
      const password = req.body.password;
      if (!username || !password) return res.status(400).send("Username and password are required.");
      try {
          const query = await client.query(
              `SELECT * FROM pheonix_user WHERE username = $1;`,
              [username]
          );
          if (query.rows.length !== 1) return res.status(401).send("Invalid username or password.");
          if (query.rows[0].password !== password) return res.status(401).send("Invalid username or password.");
          const user = { username: username };
          const refresh_token = jwt.sign(user, process.env.REFRESH_TOKEN_SECRET);
          refreshToken[username] = refresh_token;
  
          const token = generateAccessToken(user);
          return res.status(200).json({ token: token, refreshToken: refresh_token });
      } catch (error) {
          console.error("Login Error:", error);
          return res.status(500).send("Internal Server Error!");
      }
  });
  
  // delete refresh token
  app.post("/signout", (req, res) => {
      const username = req.body.username; 
      if (!username) {
          return res.status(400).send("Username required.");
      }
  
      if (refreshToken[username]) {
          delete refreshToken[username]; 
          return res.status(200).send("Signed out!"); 
      } else {
          return res.status(404).send("Refresh token not found.");
      }
  });
  
  // refresh token
  app.post("/token", (req, res) => {
      const refresh_token = req.body.refreshToken;
      const username = req.body.username; 
      if (refresh_token == null) return res.sendStatus(401);
      if (!refreshToken[username]) return res.sendStatus(403);
      jwt.verify(refresh_token, process.env.REFRESH_TOKEN_SECRET, (err, user) => {
          if (err) return res.sendStatus(403);
          const accessToken = generateAccessToken({ username: user.username });
          res.json({ accessToken: accessToken });
      });
  });

    // register user
    app.post("/register", async (req, res) => {
      const username = req.body.username;
      const password = req.body.password;
      const registerSecret = req.body.secret;
      if (!username || !password || !registerSecret) return res.status(400).send("Username, password, and secret are required.");
      if (registerSecret !== process.env.REGISTER_SECRET) return res.status(403).send("Invalid Secret!");

      try {
        await client.query(
          `INSERT INTO pheonix_user (username, password) VALUES ($1, $2);`,
          [username, password]
        );
        return res.status(201).send("Successfully Registered!");
      } catch (error) {
        if (error.code == 23505){
          return res.status(400).send("User already Exist!");
        }
        console.error("Registration Error:", error);
        return res.status(500).send("Internal Server Error!");
      }
    });

    // Get single gadget
    app.get("/gadgets/:id", authenticateToken, async (req, res) => {
      const id = req.params.id;
      try {
        const result = await client.query(`SELECT * FROM gadgets WHERE id = $1;`, [id]);

        if (result.rows.length > 0) {
          if (req.headers["content-type"] !== "application/json") {
            return res.send(getGadgetNamesWithMissionSuccess(result.rows));
          }
          return res.json(result.rows);
        } else {
          return res.status(404).send("No gadget found!");
        }
      } catch (error) {
        console.error("Error retrieving gadgets:", error);
        return res.status(500).send("Internal Server Error");
      }
    });

    // Get list of gadgets sort by status
    app.get("/gadgets", authenticateToken, async (req, res) => {
      const status = req.query.status;
      try {
        let result;
        if (status) {
          result = await client.query(
            `SELECT * FROM gadgets WHERE status = $1 ORDER BY id ASC;`,
            [status]
          );
        } else {
          result = await client.query(`SELECT * FROM gadgets ORDER BY id ASC;`);
        }
        if (result.rows.length > 0) {
          if (req.headers["content-type"] !== "application/json") {
            return res.send(getGadgetNamesWithMissionSuccess(result.rows));
          }
          return res.json(result.rows);
        } else {
          return res.status(404).send("No gadgets found!");
        }
      } catch (error) {
        console.error("Error retrieving gadgets:", error);
        return res.status(500).send("Internal Server Error");
      }
    });

    // Create gadget
    app.post("/gadgets", authenticateToken, async (req, res) => {
      try {
        await client.query(`INSERT INTO gadgets (name, status) VALUES ($1, $2);`, [
          getCodename(),
          "Available",
        ]);
        res.status(201).json({ message: "Gadgets Successfully added" });
      } catch (err) {
        console.error("Error inserting gadget:", err);
        if (err.code === "23505") {
          return res.status(409).json({ message: "Gadget name already exists." });
        }
        return res.status(500).json({ message: "Internal server error!" });
      }
    });

    // Update gadget
    app.patch("/gadgets", authenticateToken, async (req, res) => {
      const { id, name, status } = req.body;

      if (!id) {
        return res.status(400).json({ message: "ID is required!" });
      }

      if (!name && !status) {
        return res.status(400).json({ message: "Name or Status is required!" });
      }

      try {
        const result = await client.query(`SELECT * FROM gadgets WHERE id = $1;`, [id]);

        if (result.rows.length < 1) {
          return res.status(404).json({ message: `Gadget "${id}" doesn't exist` });
        }

        let updateQuery = "UPDATE gadgets SET ";
        const updateParams = [];
        if (name) {
          updateQuery += "name = $1";
          updateParams.push(name);
        }
        if (status) {
          if (name) updateQuery += ", ";
          updateQuery += "status = $" + (updateParams.length + 1);
          updateParams.push(status);
        }
        updateQuery += " WHERE id = $" + (updateParams.length + 1);
        updateParams.push(id);

        await client.query(updateQuery, updateParams);

        res.status(200).json({ message: "Gadget Successfully Updated!" });
      } catch (err) {
        console.error("Error patching gadget:", err);
        return res.status(500).json({ message: "Internal server error!" });
      }
    });

    // delete gadget
    app.delete("/gadgets", authenticateToken, async (req, res) => {
      const { id } = req.body;

      if (!id) {
        return res.status(400).json({ message: "ID is required!" });
      }

      try {
        const result = await client.query(`SELECT * FROM gadgets WHERE id = $1`, [id]);

        if (result.rows.length < 1) {
          return res.status(404).json({ message: `Gadget "${id}" doesn't exist` });
        }

        await client.query(`UPDATE gadgets SET status = 'Decommissioned' WHERE id = $1`, [id]);

        res.status(200).json({ message: "Gadget Successfully Decommissioned!" });
      } catch (err) {
        console.error("Error deleting gadget:", err);
        return res.status(500).json({ message: "Internal server error!" });
      }
    });
    // Create confirmation code before destructing
    const Confirmations = {}
    app.post("/gadgets/:id/self-destruct", authenticateToken, async (req, res) => {
      const id = req.params.id;

      try {
        const result = await client.query(
          `SELECT * FROM gadgets 
          WHERE id = $1`, [id]);

        if (result.rows.length < 1) {
          return res.status(404).json({ message: `Gadget with ID:${id} not Found!` });
        }

        const confirmationCode = generateConfirmationCode();
        Confirmations[id] = confirmationCode;

        res.status(200).json({ "code": confirmationCode });
      } catch (err) {
        console.error("Error destroying gadget:", err);
        return res.status(500).json({ message: "Internal server error!" });
      }
    });

    // Destruct with confirmation code
    app.post("/gadgets/:id/confirm-self-destruct", authenticateToken, async (req, res) => {
      const id = req.params.id;
      const confirmationCode = req.body.code;
      if (!confirmationCode) {
        return res.send({ message: `No confirmation Code found!` });
      }

      try {
        const result = await client.query(
          `SELECT * FROM gadgets 
          WHERE id = $1`, [id]);


        if (result.rows.length < 1) {
          return res.status(404).json({ message: `Gadget with ID:${id} not Found!` });
        }
        if (!Confirmations[id]) {
          return res.send({ message: `Confirmation code Expired, Please generate again!` })
        }
        if (confirmationCode === Confirmations[id]) {
          await client.query(`
            UPDATE gadgets 
            SET status = 'Destroyed' 
            WHERE id = $1`, [id]);
          return res.status(200).json({ message: "Gadget Self-Destructed!" });
        }

        return res.json({ message: "Code is Invalid!" });

      } catch (err) {
        console.error("Error destroying gadget:", err);
        return res.status(500).json({ message: "Internal server error!" });
      }
    });

    // Delete From Existence
    app.post("/gadgets/:id/confirm-thanos", authenticateToken, async (req, res) => {
      const id = req.params.id;
      const confirmationCode = req.body.code;
      if (!confirmationCode) {
        return res.send({ message: `No confirmation Code found!` });
      }

      try {
        const result = await client.query(
          `SELECT * FROM gadgets 
          WHERE id = $1`, [id]);


        if (result.rows.length < 1) {
          return res.status(404).json({ message: `Gadget with ID:${id} not Found!` });
        }
        if (!Confirmations[id]) {
          return res.send({ message: `Confirmation code Expired, Please generate again!` })
        }
        if (confirmationCode === Confirmations[id]) {
          await client.query(
            `DELETE FROM gadgets 
            WHERE id = $1`, [id]);
          return res.status(200).json({ message: "Gadget Thanosed from Existence!☠️" });
        }

        return res.json({ message: "Code is Invalid!" });

      } catch (err) {
        console.error("Error thanosing gadget:", err);
        return res.status(500).json({ message: "Internal server error!" });
      }
    });

    app.listen(PORT, () => {
      console.log(`Successfully Serving on port ${PORT}`);
    });

    process.on("SIGINT", async () => {
      console.log("Closing database connection...");
      await client.end();
      console.log("Database connection closed.");
      process.exit();
    });

  } catch (err) {
    console.error("Error during startup:", err);
    process.exit(1);
  }
}

function getGadgetNamesWithMissionSuccess(rows) {
  const result = [];
  for (const row of rows) {
    if (row.hasOwnProperty("name")) {
      const successProbability = Math.floor(Math.random() * 101);
      result.push(`${row.name} - ${successProbability}% success probability`);
    }
  }
  return result;
}

function getCodename() {
  const prefixes = ["Crimson", "Shadow", "Thunder", "Silent", "Phantom", "Mystic", "Solar", "Lunar", "Nebula", "Quantum"];
  const suffixes = ["Hawk", "Viper", "Eagle", "Wolf", "Lynx", "Phoenix", "Raven", "Serpent", "Jaguar", "Griffin"];

  const randomPrefix = prefixes[Math.floor(Math.random() * prefixes.length)];
  const randomSuffix = suffixes[Math.floor(Math.random() * suffixes.length)];

  return `The ${randomPrefix} ${randomSuffix}`;
}

function generateConfirmationCode() {
  const characters = '0123456789';
  const length = 4;
  let code = ''
  for (let i = 0; i < length; ++i) {
    code += characters[Math.floor(Math.random() * characters.length)];
  }
  return code;
}

function generateAccessToken(user) {
  return jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: "1h" });
}

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).send('Access denied. No token provided.');
  }

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, user) => {
    if (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(403).send('Token Expired!');
      } else {
        return res.status(403).send('Invalid token.');
      }
    }

    req.user = user;
    next();
  });
}


main();