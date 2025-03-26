const express = require('express');
const dotenv = require('dotenv');
const morgan = require('morgan');
const colors = require('colors');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const helmet = require('helmet');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');
const path = require('path');
// Using a more maintained alternative to xss-clean
const xssFilters = require('xss-filters');
const rateLimit = require('express-rate-limit');
const hpp = require('hpp');
const mongoSanitize = require('express-mongo-sanitize');
const compression = require('compression');

const connectDB = require('./config/db');
const errorHandler = require('./middleware/error');

// Load env vars
dotenv.config();

// Connect to database
if (process.env.NODE_ENV !== 'test') {
  connectDB();
}

// Load Swagger document
const swaggerDocument = YAML.load(path.join(__dirname, 'config', 'swagger.yaml'));

// Route files
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const emergencyRoutes = require('./routes/emergencies');
const resourceRoutes = require('./routes/resources');

const app = express();

// Body parser
app.use(express.json());

// Cookie parser
app.use(cookieParser());

// API Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Dev logging middleware
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Security middleware
// Enable CORS
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? process.env.CORS_ORIGIN || 'https://yourproductiondomain.com' 
    : true,
  credentials: true
}));

// Set security headers
app.use(helmet());

// Trust proxy - Needed for express-rate-limit when behind a proxy
app.set('trust proxy', 1);

// Prevent XSS attacks with custom middleware
app.use((req, res, next) => {
  if (req.body) {
    // Sanitize request body fields
    for (const [key, value] of Object.entries(req.body)) {
      if (typeof value === 'string') {
        req.body[key] = xssFilters.inHTMLData(value);
      }
    }
  }
  next();
});

// Rate limiting
const limiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false // Disable the `X-RateLimit-*` headers
});
app.use(limiter);

// Prevent http param pollution
app.use(hpp());

// Sanitize data
app.use(mongoSanitize());

// Mount routers
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/emergencies', emergencyRoutes);
app.use('/api/v1/resources', resourceRoutes);

// Root route
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Disaster Relief Application API',
    version: '1.0.0'
  });
});

// Error handler middleware
app.use(errorHandler);

// Start server only if not in test mode
let server;
if (process.env.NODE_ENV !== 'test') {
  const PORT = process.env.PORT || 5000;
  server = app.listen(PORT, () => {
    console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`.yellow.bold);
  });
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
  if (server) {
    server.close(() => process.exit(1));
  }
});

module.exports = app;