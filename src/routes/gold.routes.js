const express = require('express');
const router = express.Router();
const goldController = require('../controllers/gold.controller');

router.get('/', goldController.getGoldInvestments);
router.post('/', goldController.addGold);
router.put('/:id', goldController.updateGold);
router.delete('/:id', goldController.deleteGold);

module.exports = router;