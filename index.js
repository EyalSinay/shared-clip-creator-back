const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const userRouts = require('./src/routs/userRouts.js');
const projectRouts = require('./src/routs/projectRouts.js');

const app = express();

mongoose.connect('mongodb://127.0.0.1:27017/shared-clip-creator', (error, mongoConnectionInstance) => {
    if(error) return console.error("Mongoose connection error: " + error);
    if(!process.env.NODE_ENV){
        const {host, port, name} = mongoConnectionInstance;
        console.log("Mongoose connect:", host, port, name);
    }
});

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --my routs:--
app.use(userRouts);
app.use(projectRouts);

const PORT = process.env.PORT || 5050;
app.listen(PORT, () => {
    console.log('Listen on Port:', PORT);
});