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
app.use('/api/streams', streamRoutes);

const init = async () => {
  try {
    // Inicializar el servicio de streams
    console.log('Initializing Stream Service...');
    await StreamService.initialize();
    console.log('Stream Service initialized successfully');

    app.listen(config.expressPort, () => {
      console.log(`Server is listening on port ${config.expressPort}....`);
      console.log(`API endpoints available at:`);
      console.log(`  GET    /api/streams           - List all streams`);
      console.log(`  POST   /api/streams           - Create/update stream`);
      console.log(`  GET    /api/streams/:id       - Get specific stream`);
      console.log(`  DELETE /api/streams/:id       - Delete stream`);
    });
  } catch (error) {
    console.error('Error during initialization:', error);
    setTimeout(() => {
      init();
    }, 5000); // Retry after 5 seconds
  }
}
init();

