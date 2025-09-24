import express from "express";
import cors from "cors";
import logger from "morgan";
import config from './config/config';
import streamRoutes from './routes/streamRoutes';
import { StreamService } from './steamService';


const app = express();

// Allow all origins
app.use(cors({ origin: "*" }));
// Encode the URL
app.use(express.urlencoded({ extended: false }));
// Parse json
app.use(express.json({ limit: '5mb' }));
// Log requests to the console.
app.use(logger('dev'));


// Routes
app.use('/streams', streamRoutes);

// Start server
app.listen(config.expressPort, async () => {
  console.log(`Server is listening on port ${config.expressPort}....`);
  // Inicializar el servicio de streams
  await StreamService.initialize();
});
