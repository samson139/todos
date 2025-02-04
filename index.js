const express = require('express');
const mongoose = require('mongoose');
const UserModel = require('./models/User');
const ToDoModel = require('./models/Todo');
const MongoStore = require('connect-mongo');
const crypto = require('crypto');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcrypt');
const nodeCache = require("node-cache");
const validator = require('validator');
const jwt = require('jsonwebtoken');
const path = require('path');
const { log } = require('console');

const app = express();
const secretKey = "this_is_my_secret_key_for_the_jwt_implementation_in_server";

app.use(express.static('public'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }))
app.use(cookieParser());
app.use(express.static('public'));


const myCache = new nodeCache();
app.set('view engine', 'ejs');

const mongoPromise = mongoose
  .connect("mongodb+srv://samsonm08:Wg2MYscV2SNjSTYe@cluster0.y2lkofz.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0", {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then((m) => {
    return m.connection.getClient();
  })
  .catch((error) => console.log('Failed to connect to MongoDB:', error));


const isAuthenticated = (req, res, next) => {
  const token = req.cookies.jwtToken;
  if (!token) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  try {
    const data = jwt.verify(token, secretKey);
    req.userId = data.id;
    return next();
  }
  catch {
    return res.sendStatus(403);
  }
};

app.get('/', (req, res) => {
  res.sendFile('index.html', { root: __dirname });
});

app.get('/signup', (req, res) => {
  res.render('signup');
});

app.get('/signin', (req, res) => {
  res.render('signin');
});


app.post('/signup', async (req, res) => {
  const { firstname, lastname, email, password, confirmedPassword } = req.body;

  if (!validator.equals(password, confirmedPassword)) {
    return res.status(400).json({ message: 'Passwords do not match' });
  }

  UserModel.findOne({ email: email })
    .then(async (existingUser) => {
      if (existingUser) {

        return res.status(400).json({ message: 'User with this email already exists' });
      }
      else {
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = new UserModel({
          firstname: firstname,
          lastname: lastname,
          email: email,
          password: hashedPassword,
          confirmedPassword: hashedPassword,
        });

        newUser.save()
          .then(() => {

            const signupToken = jwt.sign({ userId: newUser._id }, secretKey, { expiresIn: '1d' });
            res.cookie("jwtToken", signupToken, { maxAge: 1000 * 60 * 60 * 24 }); // Set JWT token in a cookie

            res.status(201).json({ message: 'User created successfully' });
          })
          .catch((error) => {
            ;
            console.error("error is:", error)
            res.status(500).json({ message: 'Error creating user', error: error });
          });
      }
    })
    .catch((error) => {

      console.log(error);
      res.status(500).json({ message: 'Error checking existing user', error: error });
    });
});


app.post('/signin', (req, res) => {
  const { email, password } = req.body;

  const cachedUserData = myCache.get(email);
  if (cachedUserData) {
    if (cachedUserData.password === password) {
      const signinToken = jwt.sign({ id: cachedUserData._id }, secretKey, { expiresIn: 1000 * 60 * 60 * 24 });
      res.cookie("jwtToken", signinToken, { maxAge: 1000 * 60 * 60 * 24 }); // Set JWT token in a cookie
      return res.status(200).json({ message: "Logged in successfully" });
    }
  } else {

    UserModel.findOne({ email: email })
      .then(async (user) => {
        if (user) {
          const passwordMatch = await bcrypt.compare(password, user.password);
          if (passwordMatch) {
            let signinToken = jwt.sign({ id: user._id }, secretKey, { expiresIn: 1000 * 60 * 60 * 24 });

            res.cookie("jwtToken", signinToken, { maxAge: 1000 * 60 * 60 * 24 }); // Set JWT token in a cookie

            myCache.set(user._id.toString(), { email: user.email, firstname: user.firstname, lastname: user.lastname });
            return res.status(200).json({ message: 'Signin successful' });
          }
          else {
            res.status(401).json({ message: 'Incorrect Email or Password' });
          }
        }
        else {
          res.status(400).json({ message: "User not found" });
        }
      })
      .catch((error) => {
        console.error("Error during signin", error);
        res.status(500).json({ message: 'Internal Server Error' });
      });
  }
});

app.get("/protected", isAuthenticated, (req, res) => {
  return res.json({ user: { id: req.userId } });
});

app.post('/logout', (req, res) => {
  res.clearCookie('jwtToken');
  res.redirect('/signup');
});


app.post('/toDoList', isAuthenticated, async (req, res) => {
  const { task, status } = req.body;
  const userId = req.userId;

  try {
    let todo = await ToDoModel.findOne({ user: userId });

    if (!todo) {
      const newToDo = new ToDoModel({
        taskList: [{ task, status }],
        user: userId
      });
      todo = await newToDo.save();
    } else {
      const existingTaskIndex = todo.taskList.findIndex(item => item.task === task);
      if (existingTaskIndex === -1) {
        todo.taskList.push({ task, status });
        todo = await todo.save();
        // res.status(200).send({ redirectUrl: '/toDoList' });
        res.redirect('/toDoList');
      }
      else {
        return res.status(400).json({ message: 'Task already exists' });
      }
    }

  } catch (error) {
    console.error('Error saving ToDo:', error);
    res.status(500).json({ message: 'Error saving ToDo', error: error });
  }
});

app.get('/toDolist', isAuthenticated, async (req, res) => {
  try {
    const singleUser = await ToDoModel.findOne({ user: req.userId });
    console.log("singleUser", singleUser);
    const todos = singleUser?.taskList || [];
    console.log("todos", todos)
    if (todos.length == 0) {
      res.render('toDoList', { works: [], message: 'No tasks' });
      return;
    }
    const works = todos.map(todo => ({
      value: todo.task,
      status: todo.status
    }));
    console.log("works", works);
    res.render('toDoList', { works, message: '' });
  } catch (error) {
    console.error('Error fetching todos:', error);
    res.status(500).json({ message: 'Error fetching todos', error: error });
  }
});


app.post('/removeTodo', isAuthenticated, async (req, res) => {
  let { index } = req.body;
  try {
    const user = await ToDoModel.find({ user: req.userId });
    console.log("user", user);
    if (!user) {
      return res.status(404).send('User not found');
    }
    let todos = user[0].taskList;
    console.log("todos of remove", todos);

    if (typeof index !== 'number' || index < 0) {
      return res.status(400).send('Invalid index');
    }
    // Remove the todo at the specified index
    todos.splice(index, 1);
    await ToDoModel.findOneAndUpdate({ user: req.userId }, { taskList: todos });
    res.redirect('/toDoList');
  } catch (error) {
    res.status(500).send('Internal Server Error');
  }
});

app.put('/toDoList/updateStatus/:index', isAuthenticated, async (req, res) => {
  let { index } = req.params;
  let { status } = req.body;
  const userId = req.userId;
  console.log("status sent", status);
  try {
    let user = await ToDoModel.findOne({ user: userId });
    index = parseInt(index, 10);


    if (!user) {
      return res.status(404).json({ message: 'ToDo item not found' });
    }

    if (index < 0 || index >= user.taskList.length) {
      return res.status(400).json({ message: 'Invalid index' });
    }

    user.taskList[index].status = status;
    user.markModified('taskList');
    await user.save();
    res.redirect('/toDoList');
  } catch (error) {
    res.status(500).json({ message: 'Error updating status', error: error });
  }
});


app.listen(3002, () => {
  console.log(`Server listening at 3002`);
});
