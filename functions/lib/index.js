"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.api = void 0;
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const express = require("express");
const cors = require("cors");
const erpRoutes_1 = require("./routes/erpRoutes");
// Initialize firebase admin SDK
admin.initializeApp();
const app = express();
// Standard middleware
app.use(cors({ origin: true }));
app.use(express.json());
// Mount ERP Routes
app.use('/', erpRoutes_1.default);
// Export Cloud Function API
exports.api = functions.https.onRequest(app);
//# sourceMappingURL=index.js.map