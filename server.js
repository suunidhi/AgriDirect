// server.js
import express from "express";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import cors from "cors";
import multer from "multer";
import fs from "fs";
import path from "path";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

// ------------------ UPLOAD SETUP ------------------
const UPLOAD_DIR = path.join(process.cwd(), "uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
app.use("/uploads", express.static(UPLOAD_DIR));

// ------------------ DB CONNECTION ------------------
mongoose.connect("mongodb://127.0.0.1:27017/agriDirect", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log("✅ MongoDB Connected"))
.catch(err => console.error("❌ MongoDB Error:", err));

// ------------------ MODELS ------------------
const farmerSchema = new mongoose.Schema({
  name: { type: String, required: true },
  farmName: { type: String, required: true },
  location: { type: String, required: true },
  mobile: { type: String, required: true },
  experience: { type: Number, default: 0 },
  email: { type: String, unique: true, required: true },
  password: { type: String, required: true },

  // Optional government docs
  aadhaar: { type: String },
  aadhaarFile: { type: String },
  panFile: { type: String },
  landProof: { type: String },
  leaseProof: { type: String },
  farmerIDProof: { type: String },
  organicProof: { type: String },
  certificate: { type: String },

  farmingType: { type: String, enum: ["Natural/Organic", "Conventional", "Both", ""], default: "" },

  verificationStatus: { type: String, enum: ["Pending", "Verified", "Rejected"], default: "Pending" },
  verifiedAt: { type: Date },
  adminNotes: { type: String },

  createdAt: { type: Date, default: Date.now },
}, { timestamps: true });

const Farmer = mongoose.model("Farmer", farmerSchema);

const consumerSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  mobile: String,
  password: String,
});
const Consumer = mongoose.model("Consumer", consumerSchema);

const productSchema = new mongoose.Schema({
  farmerId: { type: mongoose.Schema.Types.ObjectId, ref: "Farmer" },
  name: String,
  category: String,
  price: Number,
  quantity: Number,
  location: String,
  image: String,
});
const Product = mongoose.model("Product", productSchema);

const orderSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
  farmerId: { type: mongoose.Schema.Types.ObjectId, ref: "Farmer" },
  consumerId: { type: mongoose.Schema.Types.ObjectId, ref: "Consumer" },
  consumerName: String,
  consumerEmail: String,
  consumerMobile: String,
  productName: String,
  unitPrice: Number,
  quantity: Number,
  totalPrice: Number,
  address: String,
  paymentMethod: String,
  date: { type: Date, default: Date.now }
});
const Order = mongoose.model("Order", orderSchema);

// ------------------ MULTER ------------------
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const safeName = Date.now() + "-" + file.originalname.replace(/\s+/g, "_");
    cb(null, safeName);
  },
});
const upload = multer({ storage });

// Helper to create a public file path
function toPublicPath(filename) {
  if (!filename) return null;
  return `/uploads/${path.basename(filename)}`;
}

// ------------------ FARMER ROUTES ------------------

// Register new farmer (with docs)
app.post(
  "/farmer/register",
  upload.fields([
    { name: "certificate", maxCount: 1 },
    { name: "aadhaarFile", maxCount: 1 },
    { name: "panFile", maxCount: 1 },
    { name: "landProof", maxCount: 1 },
    { name: "leaseProof", maxCount: 1 },
    { name: "farmerIDProof", maxCount: 1 },
    { name: "organicProof", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const {
        name,
        farmName,
        location,
        mobile,
        experience,
        email,
        password,
        aadhaar,
        farmingType
      } = req.body;

      if (!name || !farmName || !location || !mobile || !email || !password) {
        return res.json({ status: "error", message: "Missing required fields" });
      }
      if (!/^\d{10}$/.test(mobile)) {
        return res.json({ status: "error", message: "Mobile must be 10 digits" });
      }

      const existing = await Farmer.findOne({ email });
      if (existing) return res.json({ status: "error", message: "Email already registered" });

      const hashedPassword = await bcrypt.hash(password, 10);

      const files = req.files || {};
      const getFile = (field) => files[field]?.[0] ? toPublicPath(files[field][0].filename) : null;

      const farmer = new Farmer({
        name,
        farmName,
        location,
        mobile,
        experience: experience ? Number(experience) : 0,
        email,
        password: hashedPassword,
        aadhaar,
        aadhaarFile: getFile("aadhaarFile"),
        panFile: getFile("panFile"),
        landProof: getFile("landProof"),
        leaseProof: getFile("leaseProof"),
        farmerIDProof: getFile("farmerIDProof"),
        organicProof: getFile("organicProof"),
        certificate: getFile("certificate"),
        farmingType: farmingType || "",
        verificationStatus: "Pending",
      });

      await farmer.save();

      return res.json({ status: "success", message: "Farmer registered successfully. Verification pending." });
    } catch (error) {
      console.error("Farmer register error:", error);
      if (error.code === 11000) {
        return res.json({ status: "error", message: "Email already registered (duplicate)" });
      }
      return res.json({ status: "error", message: "Error registering farmer" });
    }
  }
);

// Farmer login
app.post("/farmer/login", express.json(), async (req, res) => {
  try {
    const { email, password } = req.body;
    const farmer = await Farmer.findOne({ email });
    if (!farmer) return res.json({ status: "error", message: "Invalid email or password" });

    const isMatch = await bcrypt.compare(password, farmer.password);
    if (!isMatch) return res.json({ status: "error", message: "Invalid email or password" });

    res.json({
      status: "success",
      message: "Login successful",
      farmerId: farmer._id.toString(),
      verificationStatus: farmer.verificationStatus
    });
  } catch (error) {
    console.error(error);
    res.json({ status: "error", message: "Server error" });
  }
});

// Admin verification route
app.post("/admin/farmer/:id/verify", express.json(), async (req, res) => {
  try {
    const { id } = req.params;
    const { status, adminNotes } = req.body;

    if (!["Verified", "Rejected"].includes(status)) {
      return res.json({ status: "error", message: "Invalid verification status" });
    }

    const update = { verificationStatus: status, adminNotes };
    if (status === "Verified") update.verifiedAt = new Date();

    const farmer = await Farmer.findByIdAndUpdate(id, update, { new: true });
    if (!farmer) return res.json({ status: "error", message: "Farmer not found" });

    res.json({ status: "success", message: `Farmer ${status.toLowerCase()} successfully`, farmer });
  } catch (err) {
    console.error("Admin verify error:", err);
    res.status(500).json({ status: "error", message: "Server error" });
  }
});

// ------------------ CONSUMER, PRODUCT & ORDER ROUTES (unchanged) ------------------
// Keep your existing consumer, product, and order routes below as they are.

// ------------------ START SERVER ------------------
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
