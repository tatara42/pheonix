const express = require("express");
const pg = require("pg");
require("dotenv").config();

const PG_CONNECTION_STRING = process.env.PG_CONNECTION_STRING
const PORT = process.env.PORT || 8080

async function main() {

  try {
    const client = new pg.Client({
      connectionString: PG_CONNECTION_STRING
    });
    await client.connect();
    console.log("Successfully Connected");

    const app = express();
    app.use(express.json());

    app.get("/", (req, res) => {
      res.send("Fly Fly, Pheonix, Fly!");
    })

    app.get("/gadgets", async (req, res) => {
      const status = req.query.status;
      try {
        let result;
        if (status) {
          result = await client.query(`
          SELECT * FROM gadgets
          WHERE status=$1
          ORDER BY id ASC;
          `, [status]);
        } else {
          result = await client.query(`
            SELECT * FROM gadgets
            ORDER BY id ASC;
            `);
        }
        if (result.rows.length > 0) {
          if (req.headers["content-type"] != "application/json") {
            return res.send(getGadgetNamesWithMissionSuccess(result.rows));
          }
          return res.json(result.rows);
        } else {
          return res.status(404).send("No gadgets found!");
        }
      } catch (error) {
        console.log("message:", error);
        return res.status(500).send("Internal Server Error");
      }
    });

    app.post("/gadgets", async (req, res) => {
      try {
        const query = await client.query(
          `INSERT INTO gadgets(name, status) VALUES ($1, $2);`,
          [getCodename(), "Available"]
        );

        res.status(201).json({ message: "Gadgets Successfully added" });
      } catch (err) {
        res.status(500).json({ message: "Internal server error!" });
        console.error("Error inserting gadget:", err);
      }
    });

    app.patch("/gadgets", async (req, res) => {
      const { id, name, status } = req.body;

      if (!id) {
        return res.status(404).json({
          message: "ID not found!"
        })
      }

      if (!name || !status) {
        return res.status(201).json({
          message: "Name or Status not declared!"
        })
      }

      try {
        const result = await client.query(
          `SELECT * FROM gadgets
          WHERE id = $1;`, [id]
        )

        if (result.rows < 1) {
          return res.status(404).json({
            message: "Gadget " + id + " doesn't exist"
          })
        }

        await client.query(
          `UPDATE gadgets
          SET status=$1,name=$2
          WHERE id=$3;`,
          [status, name, id]
        );

        res.status(201).json({ message: "Gadgets Successfully Updated!" });
      } catch (err) {
        res.status(500).json({ message: "Internal server error!" });
        console.error("Error inserting gadget:", err);
      }
    });

    app.delete("/gadgets", async (req, res) => {
      const { id } = req.body;

      if (!id) {
        return res.status(400).json({ message: "ID not declared!" });
      }

      try {
        const result = await client.query(
          `SELECT * FROM gadgets WHERE id = $1`,
          [id]
        );

        if (result.rows.length < 1) {
          return res.status(404).json({ message: `Gadget "${id}" doesn't exist` });
        }

        await client.query(
          `UPDATE gadgets SET status = 'Decommissioned' WHERE id = $1`,
          [id]
        );

        res.status(200).json({ message: "Gadget Successfully Decommissioned!" });
      } catch (err) {
        res.status(500).json({ message: "Internal server error!" });
        console.error("Error updating gadget:", err);
      }


    });

    app.post("/gadgets/:id/self-destruct", async (req, res) => {
      const { id } = req.params;

      try {
        const result = await client.query(
          `SELECT * FROM gadgets WHERE id = $1`,
          [id]
        );

        if (result.rows.length < 1) {
          return res.status(404).json({ message: `Gadget "${id}" doesn't exist` });
        }

        await client.query(
          `UPDATE gadgets SET status = 'Destroyed' WHERE id = $1`,
          [id]
        );

        res.status(200).json({ message: "Gadget Self-Destructed!" });
      } catch (err) {
        res.status(500).json({ message: "Internal server error!" });
        console.error("Error destroying gadget:", err);
      }
    })

    app.listen(PORT, () => {
      console.log(`Successfully Serving`);
    });

    process.on('SIGINT', async () => {
      console.log('Closing database connection...');
      await client.end();
      console.log('Database connection closed.');
      process.exit();
    });

  } catch (err) {
    console.error("message: ", err);
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
  return "The Skylark";
}

main();
