// server.js
import express from "express";
import mongoose from "mongoose";
import cors from "cors";

const app = express();
const PORT = 5000;

// Middleware
app.use(express.json());
app.use(cors());

// Connect to MongoDB
mongoose
  .connect("mongodb://127.0.0.1:27017/agriDirect", {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

// ------------------ SCHEMAS ------------------

// Consumer Schema
const consumerSchema = new mongoose.Schema({
  name: String,
  email: String,
  password: String,
});

const Consumer = mongoose.model("Consumer", consumerSchema);

// Farmer Schema
const farmerSchema = new mongoose.Schema({
  name: String,
  farmName: String,
  location: String,
  email: String,
  password: String,
});

const Farmer = mongoose.model("Farmer", farmerSchema);

// ------------------ ROUTES ------------------

// Home
app.get("/", (req, res) => {
  res.send("🌱 AgriDirect Backend is running...");
});

// ----- CONSUMER ROUTES -----
app.post("/consumer/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const consumer = new Consumer({ name, email, password });
    await consumer.save();
    res.status(201).json({ message: "Consumer registered successfully", consumer });
  } catch (error) {
    res.status(400).json({ error: "Error registering consumer" });
  }
});

app.post("/consumer/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const consumer = await Consumer.findOne({ email, password });
    if (!consumer) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    res.json({ message: "Consumer login successful", consumer });
  } catch (error) {
    res.status(500).json({ error: "Error logging in" });
  }
});

// ----- FARMER ROUTES -----
app.post("/farmer/register", async (req, res) => {
  try {
    const { name, farmName, location, email, password } = req.body;
    const farmer = new Farmer({ name, farmName, location, email, password });
    await farmer.save();
    res.status(201).json({ message: "Farmer registered successfully", farmer });
  } catch (error) {
    res.status(400).json({ error: "Error registering farmer" });
  }
});

app.post("/farmer/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const farmer = await Farmer.findOne({ email, password });
    if (!farmer) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    res.json({ message: "Farmer login successful", farmer });
  } catch (error) {
    res.status(500).json({ error: "Error logging in" });
  }
});

// ------------------ START SERVER ------------------
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
