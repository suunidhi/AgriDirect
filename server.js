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

// ✅ Order Schema (linked to product + farmer + consumer)
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

// ✅ Add Product
app.post("/farmer/addProduct/:farmerId", upload.single("image"), async (req, res) => {
  try {
    const { farmerId } = req.params;
    const { name, category, price, quantity, location } = req.body;

    if (!mongoose.Types.ObjectId.isValid(farmerId)) {
      return res.json({ status: "error", message: "Invalid Farmer ID" });
    }

    const farmer = await Farmer.findById(farmerId);
    if (!farmer) return res.json({ status: "error", message: "Farmer not found" });

    if (!req.file) return res.json({ status: "error", message: "Product image is required!" });

    const numericPrice = parseFloat(price);
    const numericQuantity = parseFloat(quantity);

    if (isNaN(numericPrice) || isNaN(numericQuantity)) {
      return res.json({ status: "error", message: "Price and Quantity must be numbers" });
    }

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

// ✅ Consumer Register (fixed)
app.post("/consumer/register", async (req, res) => {
  try {
    const { name, email, mobile, password } = req.body;

    const existing = await Consumer.findOne({ email });
    if (existing) {
      return res.json({ success: false, message: "Email already registered" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const consumer = new Consumer({ name, email, mobile, password: hashedPassword });
    await consumer.save();

    res.json({
      success: true,
      message: "Consumer registered successfully",
      consumer: {
        _id: consumer._id.toString(),
        name: consumer.name,
        email: consumer.email,
        mobile: consumer.mobile
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Error registering consumer" });
  }
});

// ✅ Check email exists
app.post("/consumer/check-email", async (req, res) => {
  try {
    const { email } = req.body;
    const consumer = await Consumer.findOne({ email });
    res.json({ exists: !!consumer });
  } catch (err) {
    console.error(err);
    res.status(500).json({ exists: false, message: "Server error" });
  }
});

// ✅ Consumer Login (consistent with success:true/false)
app.post("/consumer/login", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    const consumer = await Consumer.findOne({ name, email });
    if (!consumer) return res.json({ success: false, message: "Invalid name, email, or password" });

    const isMatch = await bcrypt.compare(password, consumer.password);
    if (!isMatch) return res.json({ success: false, message: "Invalid name, email, or password" });

    res.json({
      success: true,
      message: "Login successful",
      consumer: {
        _id: consumer._id.toString(),
        name: consumer.name,
        email: consumer.email,
      },
    });
  } catch (error) {
    console.error(error);
    res.json({ success: false, message: "Server error" });
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

// ✅ Get all products (with farmer details)
app.get("/products", async (req, res) => {
  try {
    const products = await Product.find().populate("farmerId", "name location");
    res.json({ status: "success", products });
  } catch (error) {
    console.error("Get All Products Error:", error);
    res.json({ status: "error", message: "Error fetching all products" });
  }
});

// ✅ Update product
app.put("/farmer/updateProduct/:id", upload.single("image"), async (req, res) => {
  try {
    const { name, category, price, quantity, location } = req.body;
    const productId = req.params.id;

    const numericPrice = parseFloat(price);
    const numericQuantity = parseFloat(quantity);
    if (isNaN(numericPrice) || isNaN(numericQuantity)) {
      return res.json({ status: "error", message: "Price and Quantity must be numbers" });
    }

    const updateData = { name, category, price: numericPrice, quantity: numericQuantity, location };
    if (req.file) updateData.image = "/uploads/" + req.file.filename;

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

// ✅ Delete product
app.delete("/farmer/deleteProduct/:id", async (req, res) => {
  try {
    await Product.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "Product deleted" });
  } catch (err) {
    res.status(500).json({ error: "Error deleting product" });
  }
});

// ------------------ ORDER ROUTES ------------------
// ✅ Place Order (fetch consumer details automatically)
app.post("/orders", async (req, res) => {
  try {
    console.log("📦 Incoming Order Request:", req.body);

    const {
      productId,
      farmerId,
      consumerId,
      productName,
      unitPrice,
      quantity,
      totalPrice,
      address,
      paymentMethod
    } = req.body;

    const consumer = await Consumer.findById(consumerId);
    if (!consumer) {
      console.log("❌ Invalid Consumer ID:", consumerId);
      return res.status(400).json({ success: false, message: "Invalid Consumer ID" });
    }

    const order = new Order({
      productId,
      farmerId,
      consumerId,
      consumerName: consumer.name,
      consumerEmail: consumer.email,
      consumerMobile: consumer.mobile,
      productName,
      unitPrice,
      quantity,
      totalPrice,
      address,
      paymentMethod,
    });

    await order.save();
    console.log("✅ Order saved successfully:", order);

    res.json({ success: true, message: "Order placed successfully!" });
  } catch (err) {
    console.error("❌ Order Error:", err.message, err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ✅ Get orders by consumerId (support query param and param)
app.get("/orders", async (req, res) => {
  try {
    const consumerId = req.query.consumerId;
    if (!consumerId) {
      return res.status(400).json({ success: false, message: "consumerId is required" });
    }

    const orders = await Order.find({ consumerId });
    res.json({ success: true, orders });
  } catch (err) {
    console.error("Get Orders Error:", err);
    res.status(500).json({ success: false, message: "Error fetching orders" });
  }
});


// ✅ Get orders by farmerId
app.get("/farmer/orders/:farmerId", async (req, res) => {
  try {
    const { farmerId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(farmerId)) {
      return res.json({ success: false, message: "Invalid Farmer ID" });
    }

    const orders = await Order.find({ farmerId })
      .populate("consumerId", "name email mobile")
      .populate("productId", "name price");

    res.json({ success: true, orders });
  } catch (err) {
    console.error("Get Farmer Orders Error:", err);
    res.status(500).json({ success: false, message: "Error fetching farmer orders" });
  }
});

// ------------------ START SERVER ------------------
app.listen(5000, () => console.log("🚀 Server running on http://localhost:5000"));                                       