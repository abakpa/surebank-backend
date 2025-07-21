const express = require('express');
const mongoose = require('mongoose')
const { initAllCronJobs } = require('./Jobs/fdMaturityChecker'); // Destructure the export
const http = require('http')
const routes = require('./routes')
require('dotenv').config()
const cors = require('cors');


const app = express();
const port = process.env.PORT || 4000;

const mongoURI = process.env.MONGO_URI 

mongoose.connect(mongoURI).then(()=>{console.log('MongoDb connected');initAllCronJobs();}).catch(err=>console.log(err))

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());
const server = http.createServer(app)

app.get('/', (req, res) => {
    res.send('Hello World.......!');
});

app.use('/', routes);

server.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
