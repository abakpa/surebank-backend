const express = require('express');
const router = express.Router();
const SBAccountController = require('../Controller/index');
const {staffAuth, adminOnly} = require('../../Middleware/index')
const {customerAuth} = require('../../Middleware/index')


router.post('/', staffAuth, SBAccountController.createSBAccount);
router.put('/', staffAuth, SBAccountController.updateSBAccountAmount);
router.put('/costprice', staffAuth, adminOnly, SBAccountController.updateCostPrice);
router.get('/',staffAuth, SBAccountController.getDSAccount);
router.get('/',staffAuth, SBAccountController.getDSAccount);
router.get('/reports/backoffice-product-delivery', staffAuth, SBAccountController.getBackofficeProductDeliverySummary);
router.put('/:SBAccountNumber/items/:itemId/costprice', staffAuth, adminOnly, SBAccountController.updateItemCostPrice);
router.post('/:SBAccountNumber/items/:itemId/mark-delivered', staffAuth, SBAccountController.markItemDelivered);
router.post('/:SBAccountNumber/items/:itemId/customer-request', staffAuth, SBAccountController.requestItemFromWallet);
router.get('/:id',staffAuth, SBAccountController.getCustomerSBAccountById);
router.get('/customer/:id',customerAuth, SBAccountController.getCustomerSBAccountById);
router.post('/deposit', staffAuth, SBAccountController.saveSBContribution);
router.post('/withdrawal', staffAuth, SBAccountController.withdrawSBContribution);
router.post('/sellproduct', staffAuth, SBAccountController.sellProduct);


module.exports = router;
