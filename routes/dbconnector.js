exports.init = init;

var mongoose = require('mongoose'), db = mongoose.createConnection('localhost', 'deathstar');
var dbConnected;

db.on('error', function(){console.error.bind(console, 'connection error:'); dbConnected = false; console.log('WARNING: This scan will not update the local database');});
db.on('open', function () {
  dbConnected = true;
  console.log('Connected to local database.')
});

var book = new mongoose.Schema({
   id: Number,
   url: String,
   title: String,
   subtitle: String,    
   product: String,
   version: String, 
   bookdir: String,
   lastbuilt: String,
   lastsuccess: Boolean
  });
  
var Book = db.model('book', book);

function init()
{
    return Book;
}
