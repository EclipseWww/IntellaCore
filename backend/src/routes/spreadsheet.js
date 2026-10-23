const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const spreadsheetController = require('../controllers/spreadsheetController');

// All routes require authentication
router.use(auth);

// Create a new spreadsheet
router.post('/', spreadsheetController.createSpreadsheet);

// Get all spreadsheets for current user
router.get('/', spreadsheetController.getSpreadsheets);

// Get a single spreadsheet
router.get('/:id', spreadsheetController.getSpreadsheet);

// Update a spreadsheet
router.put('/:id', spreadsheetController.updateSpreadsheet);

// Delete a spreadsheet
router.delete('/:id', spreadsheetController.deleteSpreadsheet);

module.exports = router;
