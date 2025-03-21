const express = require("express");
const pg = require("pg");
require("dotenv").config();

const PG_CONNECTION_STRING =   process.env.PG_CONNECTION_STRING;
const PORT = process.env.PORT || 8080;

async function main() {
  try {
    const client = new pg.Client({
      connectionString: PG_CONNECTION_STRING,
    });
    await client.connect();
    console.log("Successfully Connected");

    client.on('error', (err) => {
      console.error('PostgreSQL client error:', err);
    });

    const app = express();
    app.use(express.json());

    app.get("/", (req, res) => {
      res.send("Fly Fly, Pheonix, Fly!");
    });

    // Get single gadget
    app.get("/gadgets/:id", async (req, res) => {
      const id = req.params.id;
      try {

        const result = await client.query(`SELECT * FROM gadgets WHERE id=$1;`, [id]);

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
    app.get("/gadgets", async (req, res) => {
      const status = req.query.status;
      try {
        let result;
        if (status) {
          result = await client.query(
            `SELECT * FROM gadgets WHERE status=$1 ORDER BY id ASC;`,
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
    app.post("/gadgets", async (req, res) => {
      try {
        await client.query(
          `INSERT INTO gadgets(name, status) VALUES ($1, $2);`,
          [getCodename(), "Available"]
        );
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
    app.patch("/gadgets", async (req, res) => {
      const { id, name, status } = req.body;

      if (!id) {
        return res.status(400).json({ message: "ID is required!" });
      }

      if (!name && !status) {
        return res.status(400).json({ message: "Name and Status are required!" });
      }

      try {
        const result = await client.query(`SELECT * FROM gadgets WHERE id = $1;`, [
          id,
        ]);

        if (result.rows.length < 1) {
          return res.status(404).json({ message: `Gadget "${id}" doesn't exist` });
        }

        if (name && status) {
          await client.query(
            `UPDATE gadgets SET status=$1,name=$2 WHERE id=$3;`,
            [status, name, id]
          );
        } else if (name) {
          await client.query(
            `UPDATE gadgets SET name=$1 WHERE id=$2;`,
            [name, id]
          );
        } else {
          await client.query(
            `UPDATE gadgets SET status=$1 WHERE id=$2;`,
            [status, id]
          );
        }

        res.status(200).json({ message: "Gadget Successfully Updated!" });
      } catch (err) {
        console.error("Error patching gadget:", err);
        return res.status(500).json({ message: "Internal server error!" });
      }
    });

    // delete gadget
    app.delete("/gadgets", async (req, res) => {
      const { id } = req.body;

      if (!id) {
        return res.status(400).json({ message: "ID is required!" });
      }

      try {
        const result = await client.query(`SELECT * FROM gadgets WHERE id = $1`, [id]);

        if (result.rows.length < 1) {
          return res.status(404).json({ message: `Gadget "${id}" doesn't exist` });
        }

        await client.query(`UPDATE gadgets SET status = 'Decommissioned' WHERE id = $1`, [
          id,
        ]);

        res.status(200).json({ message: "Gadget Successfully Decommissioned!" });
      } catch (err) {
        console.error("Error deleting gadget:", err);
        return res.status(500).json({ message: "Internal server error!" });
      }
    });

    // Create confirmation code before destructing
    const Confirmations = {}
    app.post("/gadgets/:id/self-destruct", async (req, res) => {
      const id = req.params.id;

      try {
        const result = await client.query(`SELECT * FROM gadgets WHERE id = $1`, [id]);

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
    app.post("/gadgets/:id/confirm-self-destruct", async (req, res) => {
      const id = req.params.id;
      const confirmationCode = req.body.code;
      if (!confirmationCode){
        return res.send({ message: `No confirmation Code found!`});
      }

      try {
        const result = await client.query(`SELECT * FROM gadgets WHERE id = $1`, [id]);


        if (result.rows.length < 1) {
          return res.status(404).json({ message: `Gadget with ID:${id} not Found!` });
        }
        if (!Confirmations[id]){
          return res.send({ message: `Confirmation code Expired, Please generate again!`})
        }
        if (confirmationCode === Confirmations[id]){
          await client.query(`UPDATE gadgets SET status = 'Destroyed' WHERE id = $1`, [id]);
          return res.status(200).json({ message: "Gadget Self-Destructed!" });
        }

        return res.json({message: "Code is Invalid!"});

      } catch (err) {
        console.error("Error destroying gadget:", err);
        return res.status(500).json({ message: "Internal server error!" });
      }
    });

    // Delete From Existence
    app.post("/gadgets/:id/confirm-thanos", async (req, res) => {
      const id = req.params.id;
      const confirmationCode = req.body.code;
      if (!confirmationCode){
        return res.send({ message: `No confirmation Code found!`});
      }

      try {
        const result = await client.query(`SELECT * FROM gadgets WHERE id = $1`, [id]);


        if (result.rows.length < 1) {
          return res.status(404).json({ message: `Gadget with ID:${id} not Found!` });
        }
        if (!Confirmations[id]){
          return res.send({ message: `Confirmation code Expired, Please generate again!`})
        }
        if (confirmationCode === Confirmations[id]){
          await client.query(`DELETE FROM gadgets WHERE id = $1`, [id]);
          return res.status(200).json({ message: "Gadget Thanosed from Existence!☠️" });
        }

        return res.json({message: "Code is Invalid!"});

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
  for (let i = 0; i < length; ++i){
    code += characters[Math.floor(Math.random()*characters.length)];
  }
  return code;
}

main();