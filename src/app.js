// In your main app.js file
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const path = require("path");

const morganMiddleware = require("./middleware/morgan.middleware");
const errorHandler = require("./middleware/error.middleware");
const {API_ROUTES_APP} = require('./utils/routePath')

const authRoutes = require("./router/authRoutes");
const adminRoutes = require("./router/adminRoutes");
const assistantRoutes = require("./router/assistantRoutes");
const userDataRoutes = require('./router/userDataRoutes');
const cutoffRoutes = require('./router/cutoffRoutes');
const  userCanShow = require('./router/userCanShow')
const  analyticsRouter = require('./router/analytics')
const rankPredictionOfCollege = require('./router/rankPredictionOfCollege')


const app = express();

// CORS Configuration
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:3000",
  "http://10.205.25.230:5173"
];

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(morganMiddleware);

// Serve uploads directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "College Predictor API is running",
    version: "1.0.0",
    endpoints: {
      auth: "/api/auth",
      admin: "/api/admin",
      cutoff: "/api/cutoff",
      assistant: "/api/assistant",
      userData: "/api/user"
    }
  });
});

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/assistant", assistantRoutes);
app.use(API_ROUTES_APP?.USER_DATA, userDataRoutes);
app.use("/api/cutoff", cutoffRoutes); 
app.use("/api" , userCanShow)
app.use(API_ROUTES_APP?.ANALYTICS ,analyticsRouter)
app.use(API_ROUTES_APP?.COLLEGE_RANK_PREDICTION ,rankPredictionOfCollege )


// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
    path: req.path
  });
});

// Error Handler
app.use(errorHandler);

module.exports = app;