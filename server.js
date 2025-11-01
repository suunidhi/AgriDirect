import express from "express";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import cors from "cors";
import multer from "multer";
import fs from "fs";
import path from "path";
import QRCode from "qrcode";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

// ✅ Make uploads folder public
app.use("/uploads", express.static("uploads"));

// ✅ NEW — Make uploads/qrs folder public too
app.use("/uploads/qrs", express.static(path.join(process.cwd(), "uploads/qrs")));

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
  qrCode: String,
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
  farmerId: { type: mongoose.Schema.Types.ObjectId, ref: "Farmer", required: true },
  name: String,
  category: String,
  preferences: { type: [String], default: [] }, // ✅ CHANGE HERE
  price: Number,
  quantity: Number,
  location: String,
  image: String,
  harvestDate: Date,
  moisture: Number,
  protein: Number,
  pesticideResidue: Number,
  soilPh: Number,
  labReport: String,
  qrPath: String,
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
  date: { type: Date, default: Date.now },
});
const Order = mongoose.model("Order", orderSchema);

// ------------------ MULTER ------------------
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname),
});
const upload = multer({ storage });
const uploadMultiple = upload.fields([
  { name: "certificate", maxCount: 1 },
  { name: "qrCode", maxCount: 1 }
]);

// ------------------ FARMER ROUTES ------------------

// Register
app.post("/farmer/register", uploadMultiple, async (req, res) => {
  try {
    const { name, farmName, location, mobile, experience, email, password } = req.body;
    const existing = await Farmer.findOne({ email });
    if (existing) return res.json({ status: "error", message: "Email already registered" });

    const hashedPassword = await bcrypt.hash(password, 10);
    const farmer = new Farmer({
      name, farmName, location, mobile, experience, email,
      password: hashedPassword,
      certificate: req.files?.certificate ? req.files.certificate[0].filename : null,
      qrCode: req.files?.qrCode ? req.files.qrCode[0].filename : null,
    });

    await farmer.save();
    res.json({ status: "success", message: "Farmer registered successfully" });
  } catch (error) {
    console.error(error);
    res.json({ status: "error", message: "Error registering farmer" });
  }
});

// Login
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

// Add Product + QR Generation
app.post(
  "/farmer/addProduct/:farmerId",
  upload.fields([
    { name: "image", maxCount: 1 },
    { name: "labReport", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const { farmerId } = req.params;
      const {
        name,
        category,
        price,
        quantity,
        location,
        harvestDate,
        moisture,
        protein,
        pesticide,
        ph,
      } = req.body;
      // ✅ Parse preferences as array (comma-separated from frontend)
const preferenceArray = preferences ? preferences.split(",").map(p => p.trim()) : [];
const updateData = { name, category, price: numericPrice, quantity: numericQuantity, location, preferences: preferenceArray };
      if (!mongoose.Types.ObjectId.isValid(farmerId))
        return res.json({ status: "error", message: "Invalid Farmer ID" });

      const farmer = await Farmer.findById(farmerId);
      if (!farmer)
        return res.json({ status: "error", message: "Farmer not found" });

      if (!req.files["image"])
        return res.json({ status: "error", message: "Product image required" });

      const numericPrice = parseFloat(price) || 0;
      const numericQuantity = parseFloat(quantity) || 0;
      const numericMoisture = parseFloat(moisture) || 0;
      const numericProtein = parseFloat(protein) || 0;
      const numericPesticide = parseFloat(pesticide) || 0;
      const numericPh = parseFloat(ph) || 0;

      const qrDir = path.join(process.cwd(), "uploads/qrs");
      if (!fs.existsSync(qrDir)) fs.mkdirSync(qrDir, { recursive: true });

      const product = new Product({
        farmerId,
        name,
        category,
          preferences: preferenceArray, 
        price: numericPrice,
        quantity: numericQuantity,
        location,
        image: `/uploads/${req.files["image"][0].filename}`,
        harvestDate: harvestDate ? new Date(harvestDate) : null,
        moisture: numericMoisture,
        protein: numericProtein,
        pesticideResidue: numericPesticide,
        soilPh: numericPh,
        labReport: req.files["labReport"]
          ? `/uploads/${req.files["labReport"][0].filename}`
          : null,
      });

      await product.save();

      const serverUrl = "http://localhost:5000";
      const qrUrl = `${serverUrl}/product/${product._id}/view`;
      const qrFileName = `${product._id}-authQR.png`;
      const qrFullPath = path.join(qrDir, qrFileName);

      await QRCode.toFile(qrFullPath, qrUrl);

      product.qrPath = `/uploads/qrs/${qrFileName}`;
      await product.save();

      console.log("✅ QR generated for:", product.name, "→", product.qrPath);

      res.json({
        status: "success",
        message: "Product added successfully with QR!",
        product,
      });
    } catch (error) {
      console.error("❌ Add Product Error:", error);
      res.json({ status: "error", message: "Error adding product" });
    }
  }
);
// ✅ Check if consumer email already exists
app.post("/consumer/check-email", async (req, res) => {
  try {
    const { email } = req.body;
    const existing = await Consumer.findOne({ email });
    if (existing) {
      res.json({ exists: true });
    } else {
      res.json({ exists: false });
    }
  } catch (error) {
    console.error("Error checking email:", error);
    res.status(500).json({ exists: false, message: "Server error" });
  }
});


// ------------------ CONSUMER ROUTES ------------------
app.post("/consumer/register", async (req, res) => {
  try {
    const { name, email, mobile, password } = req.body;
    const existing = await Consumer.findOne({ email });
    if (existing) return res.json({ success: false, message: "Email already registered" });

    const hashedPassword = await bcrypt.hash(password, 10);
    const consumer = new Consumer({ name, email, mobile, password: hashedPassword });
    await consumer.save();

    res.json({ success: true, message: "Consumer registered successfully", consumer });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Error registering consumer" });
  }
});
// ✅ Consumer Login Route
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
// Get all products
app.get("/products", async (req, res) => {
  try {
    const products = await Product.find().populate("farmerId", "name location");
    res.json({ status: "success", products });
  } catch (error) {
    console.error(error);
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
app.get("/farmer/:id/qr", async (req, res) => {
  try {
    const farmer = await Farmer.findById(req.params.id);
    if (!farmer || !farmer.qrCode)
      return res.json({ success: false, message: "QR not found" });

    res.json({
      success: true,
      qrUrl: `/uploads/${farmer.qrCode}`, // ✅ renamed
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});


// Get QR
app.get("/product/:id/qr", async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product || !product.qrPath) return res.json({ success: false, message: "QR not found" });

    res.json({ success: true, qrUrl: product.qrPath });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Product certificate HTML view
app.get("/product/:id/view", async (req, res) => {
  try {
    const product = await Product.findById(req.params.id).populate("farmerId");
    if (!product) return res.send("<h2>Product not found</h2>");
    const farmer = product.farmerId;

    res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Product Certificate</title>
        <style>
          body { font-family: 'Segoe UI', sans-serif; background: #e0f7fa; display: flex; justify-content: center; padding: 40px; }
          .certificate { background: white; padding: 30px; border-radius: 15px; max-width: 800px; width: 100%; box-shadow: 0 10px 25px rgba(0,0,0,0.15); }
          .header { text-align: center; margin-bottom: 25px; }
          .header h1 { color: #00796b; font-size: 28px; }
          .section { margin-bottom: 20px; }
          .section h3 { color: #004d40; margin-bottom: 10px; border-bottom: 1px solid #b2dfdb; padding-bottom: 5px; }
          .section p { font-size: 16px; line-height: 1.5; margin: 5px 0; }
          .verified { display: flex; align-items: center; justify-content: flex-end; margin-top: 20px; }
          .verified img { height: 50px; margin-left: 10px; }
          .product-img { text-align: center; margin: 20px 0; }
          .product-img img { max-width: 250px; border-radius: 10px; box-shadow: 0 4px 15px rgba(0,0,0,0.2); }
          a { color: #00796b; text-decoration: none; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="certificate">
          <div class="header">
            <h1>Product Authenticity Certificate</h1>
            <img src="https://i.ibb.co/9vCk9f5/verified-badge.png" alt="Verified Badge" />
          </div>
          <div class="section">
            <h3>Farmer Info</h3>
            <p><strong>Name:</strong> ${farmer.name}</p>
            <p><strong>Farm Name:</strong> ${farmer.farmName}</p>
            <p><strong>Location:</strong> ${farmer.location}</p>
            <p><strong>Farmer ID:</strong> ${farmer._id}</p>
          </div>
          <div class="section">
            <h3>Product Info</h3>
            <div class="product-img">
              <img src="${product.image}" alt="${product.name}" />
            </div>
            <p><strong>Name:</strong> ${product.name}</p>
            <p><strong>Category:</strong> ${product.category || 'N/A'}</p>
            <p><strong>Price:</strong> ₹${product.price}</p>
            <p><strong>Quantity:</strong> ${product.quantity} kg</p>
            <p><strong>Harvest Date:</strong> ${product.harvestDate ? new Date(product.harvestDate).toLocaleDateString() : 'N/A'}</p>
            <p><strong>Moisture:</strong> ${product.moisture || 'N/A'}%</p>
            <p><strong>Protein:</strong> ${product.protein || 'N/A'}%</p>
            <p><strong>Pesticide Residue:</strong> ${product.pesticideResidue || 'N/A'} ppm</p>
            <p><strong>Soil pH:</strong> ${product.soilPh || 'N/A'}</p>
            <p><strong>Lab Report:</strong> ${product.labReport ? `<a href="${product.labReport}" target="_blank">View Report</a>` : 'N/A'}</p>
          </div>
          <div class="verified">
            <p><strong>Verified:</strong> ✅ Authentic Product</p>
            <img src="https://i.ibb.co/9vCk9f5/verified-badge.png" alt="Verified Badge" />
          </div>
        </div>
      </body>
      </html>
    `);
  } catch (err) {
    console.error(err);
    res.send("<h2>Something went wrong!</h2>");
  }
});

// ------------------ START SERVER ------------------
app.listen(5000, () => console.log("🚀 Server running on http://localhost:5000"));
