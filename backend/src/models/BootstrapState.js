const mongoose = require('mongoose');

// Separate from editable settings so removing the last administrator cannot reopen setup.
const schema = new mongoose.Schema({
  _id: { type: String, default: 'administrator' },
  initializedAt: { type: Date, default: Date.now }
});
module.exports = mongoose.model('BootstrapState', schema);
