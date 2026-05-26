const express = require('express');
const router = express.Router();
const EcommerceOrderController = require('../Controller/index');
const { staffAuth, customerAuth, adminOnly } = require('../../Middleware/index');

// Customer routes (orders created only via payment verification)
router.get('/my-orders', customerAuth, EcommerceOrderController.getMyOrders);
router.get('/number/:orderNumber', customerAuth, EcommerceOrderController.getOrderByNumber);
router.put('/number/:orderNumber/items/:itemId/replace', customerAuth, EcommerceOrderController.replaceInstallmentOrderItem);
router.post('/number/:orderNumber/payoff', customerAuth, EcommerceOrderController.payoffRemainingBalance);
router.post('/number/:orderNumber/deposit/initialize', customerAuth, EcommerceOrderController.initializeOrderDepositPayment);

// Payment routes (Paystack)
router.post('/payment/initialize', customerAuth, EcommerceOrderController.initializePayment);
router.get('/payment/verify/:reference', customerAuth, EcommerceOrderController.verifyPayment);
router.post('/webhook/paystack', EcommerceOrderController.handlePaystackWebhook);

// Admin/Staff routes
router.get('/', staffAuth, EcommerceOrderController.getAllOrders);
router.get('/overdue', staffAuth, EcommerceOrderController.getOverdueInstallments);
router.get('/branch/:branchId', staffAuth, EcommerceOrderController.getOrdersByBranch);

// Process automatic payments (can be called by cron job or manually)
router.post('/process-automatic-payments', staffAuth, adminOnly, EcommerceOrderController.processAutomaticPayments);

router.get('/:id', staffAuth, EcommerceOrderController.getOrderById);
router.get('/:id/sb-account', staffAuth, EcommerceOrderController.getOrderSBAccount);
router.get('/:id/wallet-account', staffAuth, EcommerceOrderController.getOrderWalletAccount);
router.put('/:id/status', staffAuth, adminOnly, EcommerceOrderController.updateOrderStatus);
router.post('/:id/installment-payment', staffAuth, adminOnly, EcommerceOrderController.recordInstallmentPayment);
router.post('/:id/payment', staffAuth, adminOnly, EcommerceOrderController.recordOutrightPayment);
router.post('/:id/credit-sb-account', staffAuth, adminOnly, EcommerceOrderController.creditSBAccount);
router.post('/:id/cancel', staffAuth, adminOnly, EcommerceOrderController.cancelOrder);

module.exports = router;
