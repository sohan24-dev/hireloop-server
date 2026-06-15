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
        const userCollection = database.collection("user");
        const companyCollection = database.collection("companies");
        const applicationCollection = database.collection("applications");
        const planCollection = database.collection("plans");
        const subscriptionCollection = database.collection("subscriptions");
        const sessionCollection = database.collection("session");


        // verify token middleware
        const verifyToken = async (req, res, next) => {
            console.log(req.headers);
            const authHeader = req.headers.authorization;

            if (!authHeader) {
                return res.status(401).send({
                    success: false,
                    message: "Authorization header is missing",
                });
            }

            const token = authHeader.split(" ")[1];

            const query = { token: token };
            const session = await sessionCollection.findOne(query);
            const userId = session?.userId;

            const userQuery = { _id: userId };
            const user = await userCollection.findOne(userQuery);
            //    set data in the req object
            req.user = user;
            next();
        };

        const verifySeeker = (req, res, next) => {
            if (req.user?.role !== "seeker") {
                return res.status(403).send({
                    success: false,
                    message: "Access denied. Only job seekers can access this resource.",
                });
            }
            next();
        };

        const verifyRecruiter = (req, res, next) => {
            if (req.user?.role !== "recruiter") {
                return res.status(403).send({
                    success: false,
                    message: "Access denied. Only recruiters can access this resource.",
                });
            }
            next();
        };

        const verifyAdmin = (req, res, next) => {
            if (req.user?.role !== "admin") {
                return res.status(403).send({
                    success: false,
                    message: "Access denied. Only administrators can access this resource.",
                });
            }
            next();
        };

        app.get("/api/jobs", async (req, res) => {
            const query = {};

            if (req.query.jobType) {
                query.jobType = req.query.jobType
            }

            if (req.query.search) {
                query.$or = [
                    { jobTitle: { $regex: req.query.search, $options: 'i' } },
                    { companyName: { $regex: req.query.search, $options: 'i' } }
                ]
            }
            if (req.query.jobCategory) {
                query.jobCategory = req.query.jobCategory
            }
            if (req.query.isRemote) {
                query.isRemote = req.query.isRemote
            }
            if (req.query.companyId) {
                query.companyId = req.query.companyId;
            }

            if (req.query.status) {
                query.status = req.query.status;
            }
            if (req.query.page) {
                const page = req.query.page;
                const perPage = req.query.perPage || 12;
                const skipItems = (page - 1) * perPage

                const total = await jobCollection.countDocuments(query);
                const cursor = jobCollection.find(query).skip(skipItems).limit(perPage);
                const jobs = await cursor.toArray();
                return res.send({ total, jobs });
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
        // application related api
        app.get("/api/applications", verifyToken, verifySeeker, async (req, res) => {
            const query = {};
            if (req.query.applicantId) {
                query.applicantId = req.query.applicantId;


                if (query.applicantId !== req.user._id.toString()) {
                    return res.status(403).send({
                        success: false,
                        message: "Access denied. You can only view your own applications.",
                    });
                }
            }
            if (req.query.jobId) {
                query.jobId = req.query.jobId;
            }
            const result = await applicationCollection.find(query).toArray();
            res.send(result);
        })

        app.post("/api/applications", async (req, res) => {
            const application = req.body;

            const newApplication = {
                ...application,
                createdAt: new Date(),
            };

            const result = await applicationCollection.insertOne(newApplication);
            res.send(result);
        });

        // Get companies
        app.get("/api/companies", verifyToken, async (req, res) => {
            const cursor = await companyCollection
                .find();
            const result = await cursor.toArray();
            for (const company of result) {
                const jobs = await jobCollection.countDocuments({ companyId: company._id.toString() });
                company.jobCount = jobs;
            }


            res.send(result);
            // console.log(result);
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

        app.patch("/api/companies/:id", verifyToken, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const updateData = req.body;

            const filter = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: {
                    ...updateData,
                },
            };

            const result = await companyCollection.updateOne(filter, updateDoc);
            res.send(result);
        });

        // plans
        app.get("/api/plans", async (req, res) => {
            const query = {};
            if (req.query.plan_id) {
                query.id = req.query.plan_id;
            }
            console.log(query);
            const plan = await planCollection.findOne(query);
            res.send(plan || {});
        })
        // subscription related api
        app.post("/api/subscriptions", async (req, res) => {
            const subscription = req.body;

            console.log(subscription);
            const newSubscription = {
                ...subscription,
                createdAt: new Date(),
            };

            const result = await subscriptionCollection.insertOne(newSubscription);
            const filter = { email: subscription.email };
            const updateDoc = {
                $set: {
                    plan: subscription.planId,
                },
            };
            const data = await userCollection.updateOne(filter, updateDoc);
            console.log(data);
            res.send(result);
        });

        // await client.db("admin").command({ ping: 1 });

        console.log("✅ MongoDB Connected");

        app.listen(port, () => {
            console.log(`🚀 Server running on port ${port}`);
        });

    } catch (error) {
        console.error("❌ MongoDB Connection Error:", error);
    }
}

run();