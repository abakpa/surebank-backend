const express = require('express');
const router = express.Router();
const EcommerceOrderController = require('../Controller/index');
const { staffAuth, customerAuth, adminOnly, staffExceptProductManager } = require('../../Middleware/index');

// Customer routes (orders created only via payment verification)
router.get('/my-orders', customerAuth, EcommerceOrderController.getMyOrders);
router.get('/active', customerAuth, EcommerceOrderController.getActiveOrder);
router.post('/active/items', customerAuth, EcommerceOrderController.addItemsToActiveOrder);
router.get('/number/:orderNumber', customerAuth, EcommerceOrderController.getOrderByNumber);
router.put('/number/:orderNumber/items/:itemId/replace', customerAuth, EcommerceOrderController.replaceInstallmentOrderItem);
router.post('/number/:orderNumber/items/:itemId/pay-wallet', customerAuth, EcommerceOrderController.payOrderItemFromWallet);
router.post('/number/:orderNumber/payoff', customerAuth, EcommerceOrderController.payoffRemainingBalance);
router.post('/number/:orderNumber/deposit/initialize', customerAuth, EcommerceOrderController.initializeOrderDepositPayment);
router.get('/customer/:orderId/items/:itemId/receipt', customerAuth, EcommerceOrderController.getCustomerOrderItemReceipt);

// Payment routes (Paystack)
router.post('/payment/initialize', customerAuth, EcommerceOrderController.initializePayment);
router.get('/payment/verify/:reference', customerAuth, EcommerceOrderController.verifyPayment);
router.post('/webhook/paystack', EcommerceOrderController.handlePaystackWebhook);

// Admin/Staff routes
router.get('/', staffAuth, staffExceptProductManager, EcommerceOrderController.getAllOrders);
router.get('/product-action-requests', staffAuth, staffExceptProductManager, EcommerceOrderController.getProductActionRequests);
router.get('/overdue', staffAuth, staffExceptProductManager, EcommerceOrderController.getOverdueInstallments);
router.get('/branch/:branchId', staffAuth, staffExceptProductManager, EcommerceOrderController.getOrdersByBranch);
router.get('/product-demand', staffAuth, adminOnly, EcommerceOrderController.getProductDemandSummary);
router.get('/product-sales', staffAuth, adminOnly, EcommerceOrderController.getProductSalesSummary);
router.get('/product-demand/:productId', staffAuth, adminOnly, EcommerceOrderController.getProductDemandDetail);
router.put('/staff/sb/:SBAccountNumber/items/:itemId/replace', staffAuth, staffExceptProductManager, EcommerceOrderController.replaceInstallmentOrderItemByStaff);
router.get('/staff/:orderId/items/:itemId/receipt', staffAuth, staffExceptProductManager, EcommerceOrderController.getStaffOrderItemReceipt);

// Process automatic payments (can be called by cron job or manually)
router.post('/process-automatic-payments', staffAuth, adminOnly, EcommerceOrderController.processAutomaticPayments);

router.get('/:id', staffAuth, staffExceptProductManager, EcommerceOrderController.getOrderById);
router.get('/:id/sb-account', staffAuth, staffExceptProductManager, EcommerceOrderController.getOrderSBAccount);
router.get('/:id/wallet-account', staffAuth, staffExceptProductManager, EcommerceOrderController.getOrderWalletAccount);
router.put('/:id/status', staffAuth, staffExceptProductManager, EcommerceOrderController.updateOrderStatus);
router.put('/:id/items/:itemId/fulfillment', staffAuth, staffExceptProductManager, EcommerceOrderController.updateOrderItemFulfillment);
router.post('/:id/installment-payment', staffAuth, adminOnly, EcommerceOrderController.recordInstallmentPayment);
router.post('/:id/payment', staffAuth, adminOnly, EcommerceOrderController.recordOutrightPayment);
router.post('/:id/credit-sb-account', staffAuth, adminOnly, EcommerceOrderController.creditSBAccount);
router.post('/:id/cancel', staffAuth, adminOnly, EcommerceOrderController.cancelOrder);

module.exports = router;
