const mongoose = require('mongoose');
const validator = require('validator');
const bcrypt = require('bcrypt');

const UserSchema = new mongoose.Schema({
  firstname: {
    type: String,
    required: true,
  },
  lastname: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    validate: {
      validator: validator.isEmail,
      message: 'Invalid email format',
    },
  },
  password: {
    type: String,
    required: true,
    minlength: 8, // Add validation for minimum length of password
    // select:false //using this, your password will not be shown outside
  },
  confirmedPassword: {
    type: String,
    required: true,
    select: false // using this feature your password will not shown outside
  },
});
const UserModel = mongoose.model('User', UserSchema);

module.exports = UserModel;

