const dns = require("node:dns");
dns.setServers(["1.1.1.1", "1.0.0.1"]);

const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();
const port = 5000;

const {
    MongoClient,
    ServerApiVersion,
    ObjectId,
} = require("mongodb");

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
    res.send("Hello World!");
});


const uri = process.env.MONGODB_URL;

const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    },
});

async function run() {
    try {
        await client.connect();

        const database = client.db("mailestion_10");
        const jobCollection = database.collection("jobs");
        const companyCollection = database.collection("companies");

        app.get('/api/users', async (req, res) => {

            const cursor = usersCollection.find().skip(6);
            const result = await cursor.toArray();
            res.send(result);
        })
        app.get("/api/jobs", async (req, res) => {
            const query = {};

            if (req.query.companyId) {
                query.companyId = req.query.companyId;
            }

            if (req.query.status) {
                query.status = req.query.status;
            }

            const result = await jobCollection.find(query).toArray();
            res.send(result);
        });

        // Get single job
        app.get("/api/jobs/:id", async (req, res) => {
            try {
                const id = req.params.id;

                const result = await jobCollection.findOne({
                    _id: new ObjectId(id),
                });

                res.send(result);
            } catch (error) {
                res.status(400).send({
                    success: false,
                    message: "Invalid Job ID",
                });
            }
        });

        // Create job
        app.post("/api/jobs", async (req, res) => {
            const job = req.body;

            const newJob = {
                ...job,
                createdAt: new Date(),
            };

            const result = await jobCollection.insertOne(newJob);
            res.send(result);
        });

        // Get companies
        app.get("/api/companies", async (req, res) => {
            const result = await companyCollection
                .find()
                .skip(4)
                .toArray();

            res.send(result);
        });
        app.get('/api/my/companies', async (req, res) => {
            const query = {};
            if (req.query.recruiterId) {
                query.recruiterId = req.query.recruiterId;
            }
            const result = await companyCollection.findOne(query);

            res.send(result || {});
        })

        // Create company
        app.post("/api/companies", async (req, res) => {
            const company = req.body;

            const newCompany = {
                ...company,
                createdAt: new Date(),
            };

            const result = await companyCollection.insertOne(newCompany);
            res.send(result);
        });

        await client.db("admin").command({ ping: 1 });

        console.log("✅ MongoDB Connected");

        app.listen(port, () => {
            console.log(`🚀 Server running on port ${port}`);
        });

    } catch (error) {
        console.error("❌ MongoDB Connection Error:", error);
    }
}

run();