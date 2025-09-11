import express from "express";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import cors from "cors";
import multer from "multer";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

// ✅ Make uploads folder public
app.use("/uploads", express.static("uploads"));

// ------------------ DB CONNECTION ------------------
mongoose.connect("mongodb://127.0.0.1:27017/agriDirect", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => console.log("✅ MongoDB Connected"))
  .catch(err => console.error("❌ MongoDB Error:", err));

// ------------------ MODELS ------------------
const farmerSchema = new mongoose.Schema({
  name: String,
  farmName: String,
  location: String,
  mobile: String,
  experience: Number,
  email: { type: String, unique: true },
  password: String,
  certificate: String,
});
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

// ------------------ MULTER ------------------
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname),
});
const upload = multer({ storage });

// ------------------ FARMER ROUTES ------------------

// ✅ Register
app.post("/farmer/register", upload.single("certificate"), async (req, res) => {
  try {
    const { name, farmName, location, mobile, experience, email, password } = req.body;

    const existing = await Farmer.findOne({ email });
    if (existing) return res.json({ status: "error", message: "Email already registered" });

    const hashedPassword = await bcrypt.hash(password, 10);

    const farmer = new Farmer({
      name,
      farmName,
      location,
      mobile,
      experience,
      email,
      password: hashedPassword,
      certificate: req.file ? req.file.filename : null,
    });

    await farmer.save();
    res.json({ status: "success", message: "Farmer registered successfully" });
  } catch (error) {
    console.error(error);
    res.json({ status: "error", message: "Error registering farmer" });
  }
});

// ✅ Login
app.post("/farmer/login", async (req, res) => {
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
    });
  } catch (error) {
    console.error(error);
    res.json({ status: "error", message: "Server error" });
  }
});

// ✅ Upload file (optional)
app.post("/farmer/upload/:id", upload.single("photo"), (req, res) => {
  if (!req.file) return res.json({ status: "error", message: "No file uploaded!" });
  res.json({ status: "success", message: "File uploaded!", filePath: `/uploads/${req.file.filename}` });
});

// ✅ Add Product (fixed)
app.post("/farmer/addProduct/:farmerId", upload.single("image"), async (req, res) => {
  try {
    const { farmerId } = req.params;
    const { name, category, price, quantity, location } = req.body;

    // ✅ Validate Farmer ID
    if (!mongoose.Types.ObjectId.isValid(farmerId)) {
      return res.json({ status: "error", message: "Invalid Farmer ID" });
    }

    const farmer = await Farmer.findById(farmerId);
    if (!farmer) return res.json({ status: "error", message: "Farmer not found" });

    // ✅ Check if image exists
    if (!req.file) return res.json({ status: "error", message: "Product image is required!" });

    // ✅ Convert price & quantity to numbers
    const numericPrice = parseFloat(price);
    const numericQuantity = parseFloat(quantity);

    if (isNaN(numericPrice) || isNaN(numericQuantity)) {
      return res.json({ status: "error", message: "Price and Quantity must be numbers" });
    }

    // ✅ Create new product
    const product = new Product({
      farmerId,
      name,
      category,
      price: numericPrice,
      quantity: numericQuantity,
      location,
      image: `/uploads/${req.file.filename}`,
    });

    await product.save();

    res.json({ status: "success", message: "Product added successfully!", filePath: product.image });
  } catch (error) {
    console.error("Add Product Error:", error);
    res.json({ status: "error", message: "Error adding product" });
  }
});

// ------------------ CONSUMER ROUTES ------------------
app.post("/consumer/register", async (req, res) => {
  try {
    const { name, email, mobile, password } = req.body;

    const existing = await Consumer.findOne({ email });
    if (existing) return res.json({ status: "error", message: "Email already registered" });

    const hashedPassword = await bcrypt.hash(password, 10);

    const consumer = new Consumer({ name, email, mobile, password: hashedPassword });
    await consumer.save();

    res.json({ status: "success", message: "Consumer registered successfully" });
  } catch (error) {
    console.error(error);
    res.json({ status: "error", message: "Error registering consumer" });
  }
});

app.post("/consumer/login", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    const consumer = await Consumer.findOne({ name, email });
    if (!consumer) return res.json({ status: "error", message: "Invalid name, email, or password" });

    const isMatch = await bcrypt.compare(password, consumer.password);
    if (!isMatch) return res.json({ status: "error", message: "Invalid name, email, or password" });

    res.json({ status: "success", message: "Login successful" });
  } catch (error) {
    console.error(error);
    res.json({ status: "error", message: "Server error" });
  }
});

// ✅ Get all products by farmerId
app.get("/farmer/getProducts/:farmerId", async (req, res) => {
  try {
    const { farmerId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(farmerId)) {
      return res.json({ status: "error", message: "Invalid Farmer ID" });
    }

    const products = await Product.find({ farmerId });

    res.json({
      status: "success",
      products,
    });
  } catch (error) {
    console.error("Get Products Error:", error);
    res.json({ status: "error", message: "Error fetching products" });
  }
});
// Get all products (with farmer details)
app.get("/products", async (req, res) => {
  try {
    const products = await Product.find().populate("farmerId", "name location");
    res.json({ status: "success", products });
  } catch (error) {
    console.error("Get All Products Error:", error);
    res.json({ status: "error", message: "Error fetching all products" });
  }
});
// Update product
app.put("/farmer/updateProduct/:id", upload.single("image"), async (req, res) => {
  try {
    const { name, category, price, quantity, location } = req.body;
    const productId = req.params.id;

    // Validate price and quantity
    const numericPrice = parseFloat(price);
    const numericQuantity = parseFloat(quantity);
    if (isNaN(numericPrice) || isNaN(numericQuantity)) {
      return res.json({ status: "error", message: "Price and Quantity must be numbers" });
    }

    // Prepare update object
    const updateData = {
      name,
      category,
      price: numericPrice,
      quantity: numericQuantity,
      location,
    };

    if (req.file) {
      updateData.image = "/uploads/" + req.file.filename;
    }

    const updatedProduct = await Product.findByIdAndUpdate(productId, updateData, { new: true });

    if (!updatedProduct) {
      return res.json({ status: "error", message: "Product not found" });
    }

    res.json({
      status: "success",
      message: "Product updated successfully!",
      filePath: updatedProduct.image,
    });
  } catch (err) {
    console.error("Update Product Error:", err);
    res.status(500).json({ status: "error", message: "Error updating product" });
  }
});


// Delete product
app.delete("/farmer/deleteProduct/:id", async (req, res) => {
  try {
    await Product.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "Product deleted" });
  } catch (err) {
    res.status(500).json({ error: "Error deleting product" });
  }
});



// ------------------ START SERVER ------------------
app.listen(5000, () => console.log("🚀 Server running on http://localhost:5000"));
