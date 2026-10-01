const mongoose = require("mongoose");

function connectToDB(){

    mongoose.connect(process.env.MONGO_URI)

    .then(() =>{
        console.log("DB connected successfully")
    })
    .catch(err =>{
        console.log("Error connecting to DB")
        console.log(err);
        process.exit(1)
    })
     
}

module.exports = connectToDB;