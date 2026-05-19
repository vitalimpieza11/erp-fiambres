"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const erpController_1 = require("../controllers/erpController");
const router = (0, express_1.Router)();
router.post('/createSale', erpController_1.ErpController.createSale);
router.post('/createPurchase', erpController_1.ErpController.createPurchase);
router.post('/createProduction', erpController_1.ErpController.createProduction);
router.post('/getStock', erpController_1.ErpController.getStock);
router.post('/getDashboard', erpController_1.ErpController.getDashboard);
exports.default = router;
//# sourceMappingURL=erpRoutes.js.map