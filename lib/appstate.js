var fs = require('fs'),
    STATE_FILE = process.cwd() + '/appstate.json';

exports.initialize = initialize;
exports.write = write;
exports.read = read;

function read (cb){
    if (fs.existsSync(STATE_FILE)) {
        try {
            exports.appstate = require(STATE_FILE);
        }
        catch(e) {if (cb) cb(e)}
    } else {
        exports.appstate = {offline: false, alwaysUseServerToLoadTopics: false};
        if (cb) cb();
    }
}

function initialize () {
    read();
}

function write (cb) {
     fs.writeFile(STATE_FILE, JSON.stringify(exports.appstate, null, 4), function(err) {
        if(err) {
          console.log(err);
          if (cb) return cb(err)
        } else {
          console.log("Application state JSON saved to " + STATE_FILE);
          if (cb) return cb(err);
        }
    }); 
}