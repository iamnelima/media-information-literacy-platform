const express = require("express");
const session = require("express-session");
const cors = require("cors");
const ejs = require("ejs");
require("dotenv").config();

//Set up the server
const app = express();
app.listen(process.env.PORT || 3003, () => {
  console.log(
    "Server running on port 3003 on local host, go to: http://localhost:3003/signin"
  );
});

// Set view engine
app.set("view engine", "ejs");
app.set("views", "views");

app.use(express.json()); //Convert incoming json to js objects
app.use(express.urlencoded({ extended: true })); //Handle url encoded data
app.use(cors()); //For cross origin resource sharing
app.use(express.static("public"));

//set session config
app.use(
  session({
    //include store: for prod
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    unset: "destroy",
    cookie: {
      secure: false,
      maxAge: 1000 * 60 * 60,
    },
  })
);

//Getting the routes
const login = require("./routes/login.js");
const userInfo = require("./routes/userInfo.js");

app.use(login);
app.use(userInfo);
app.use((req, res) => {
  res.render("404");
});
