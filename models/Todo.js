const mongoose = require('mongoose');

const ToDoSchema = new mongoose.Schema({


  taskList: [{
    task: {
      type: String,
    },
    status: {
      type: Boolean,
      default: false
    }
  }],
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
});

const ToDoModel = mongoose.model('ToDo', ToDoSchema);
module.exports = ToDoModel;