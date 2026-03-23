import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import authRoutes from './routes/auth';
import executeRoutes from './routes/execute';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(helmet());
app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

app.use('/auth', authRoutes);
app.use('/execute', executeRoutes);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
