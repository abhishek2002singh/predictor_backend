const multer = require('multer');
const path = require('path');
const fs = require('fs'); // Add this

// Create uploads directory if it doesn't exist
const uploadDir = 'uploads';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
  console.log(`Created uploads directory at: ${path.join(process.cwd(), uploadDir)}`);
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Ensure directory exists
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    // Keep original extension
    const ext = path.extname(file.originalname);
    cb(null, 'cutoff-' + uniqueSuffix + ext);
  }
});

const fileFilter = (req, file, cb) => {
  // Accept only CSV files
  const allowedTypes = [
    'text/csv',
    'application/vnd.ms-excel',
    'application/csv',
    'application/x-csv',
    'text/comma-separated-values',
    'text/x-comma-separated-values',
    'text/tab-separated-values'
  ];
  
  if (allowedTypes.includes(file.mimetype) || 
      path.extname(file.originalname).toLowerCase() === '.csv') {
    cb(null, true);
  } else {
    cb(new Error('Only CSV files are allowed'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit (increase if needed)
  }
});

module.exports = upload;