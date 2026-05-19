import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as express from 'express';
import * as cors from 'cors';
import erpRoutes from './routes/erpRoutes';

// Initialize firebase admin SDK
admin.initializeApp();

const app = express();

// Standard middleware
app.use(cors({ origin: true }));
app.use(express.json());

// Mount ERP Routes
app.use('/', erpRoutes);

// Export Cloud Function API
export const api = functions.https.onRequest(app);
