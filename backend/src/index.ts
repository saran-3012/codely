import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { initConfig, CONFIG } from './config';
import authRoutes from './routes/auth';
import executeRoutes from './routes/execute';

initConfig();

const app = express();
const PORT = CONFIG.PORT.getIntegerValue();

app.use(helmet());
app.use(
  cors({
    origin: CONFIG.FRONTEND_URL.getStringValue(),
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
