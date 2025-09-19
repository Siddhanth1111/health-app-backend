const cors = require('cors');

const corsOptions = {
  origin: [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://health-app-frontend-drab.vercel.app",
    "https://*.vercel.app", 
    "https://vercel.app"
  ],
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "Accept"],
  credentials: true
};

const configureCors = (app) => {
  app.use(cors(corsOptions));
  app.options('*', cors(corsOptions));
  console.log('✅ CORS configured');
};

module.exports = { configureCors };
