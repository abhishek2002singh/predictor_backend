


const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");

const morganMiddleware = require("./middleware/morgan.middleware");
const errorHandler = require("./middleware/error.middleware");
const { API_ROUTES_APP } = require("./utils/routePath");


const authRoutes = require("./router/authRoutes");
const adminRoutes = require("./router/adminRoutes");
const assistantRoutes = require("./router/assistantRoutes");
const userDataRoutes = require('./router/userDataRoutes')

const app = express();


const allowedOrigins = [
  "http://localhost:5173",
];

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    const localhostPattern = /^http:\/\/localhost(:\d+)?$/;
    if (localhostPattern.test(origin)) {
      return callback(null, true);
    }

    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
};


app.use(cors(corsOptions));            
app.use(express.json());              
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(morganMiddleware);

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "College Predictor API is running",
    version: "1.0.0",
  });
});

app.use(API_ROUTES_APP.AUTH_APP, authRoutes);
app.use(API_ROUTES_APP.ADMIN, adminRoutes);
app.use(API_ROUTES_APP.ASSISTANT, assistantRoutes);
app.use(API_ROUTES_APP.USER_DATA , userDataRoutes)


app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});


app.use(errorHandler);

module.exports = app;
