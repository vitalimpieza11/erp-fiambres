import { Router } from 'express';
import { ErpController } from '../controllers/erpController';

const router = Router();

router.post('/createSale', ErpController.createSale);
router.post('/createPurchase', ErpController.createPurchase);
router.post('/createProduction', ErpController.createProduction);
router.post('/getStock', ErpController.getStock);
router.post('/getDashboard', ErpController.getDashboard);

export default router;
