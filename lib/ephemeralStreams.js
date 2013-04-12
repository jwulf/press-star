var Stream = require('stream').Stream,
    fs = require('fs'),
    uuid = require('node-uuid'),
    humanize = require('humanize');

exports.streams = {};
exports.createStream = createStream;
exports.write = write;
exports.retire = retire;

var LOG_CONSOLE = exports.LOG_CONSOLE = 1; 
var LOG_HEADER = exports.LOG_HEADER = 2;
var LOG_TIMESTAMP = exports.LOG_TIMESTAMP = 3;

// Ephemeral Streams are used for server-side jobs like building and publishing.
// They provide a real-time stream that can be tapped into, as well as a logfile on the filesystem

// The object is indexed on "topic" (for example 'publish', 'build', etc..) URL, and Spec ID. It is also 
// cross-indexed on the unique ID of the stream. 

/*
{ build: 
   { 'http://skynet.usersys.redhat.com:8080/TopicIndex': 
      { '7069': { uuid: d5b30270-a278-11e2-9ea4-8da338b93f1d } ,
        '7210': [Object],
        '8025': [Object],
        '13109': [Object],
        '13483': [Object],
        '14370': [Object] } 
    },
  'd5b30270-a278-11e2-9ea4-8da338b93f1d': 
   { metadata: 
      { topic: 'build',
        url: 'http://skynet.usersys.redhat.com:8080/TopicIndex',
        id: '7069' },
     header: '',
     stream: 
     filewriter: 
      }
    },
  'd5b859a0-a278-11e2-9ea4-8da338b93f1d': 
   { metadata: 
      { topic: 'build',
        url: 'http://skynet.usersys.redhat.com:8080/TopicIndex',
        id: '7210' },
     header: '',
     stream: 
     readable: true,
     filewriter: 
    } },

*/

function createStream (topic, url, id, file, cb) {
    var streamUUID, err;
    if (typeof file == "function") {
        cb = file;
        file = '';
    }
    
    if (topic && url && id) { // if we got the parameters we need
        // Create the hierarchy if it doesn't exist
        if ( ! exports.streams[topic]) exports.streams[topic] = { };
        if ( ! exports.streams[topic][url]) exports.streams[topic][url] = { };
        if (exports.streams[topic][url][id]) { // stream already exists
            streamUUID = exports.streams[topic][url][id].uuid;
        } else {
            streamUUID = uuid.v1();  
            if (! exports.streams[streamUUID]) exports.streams[streamUUID] = { };
            exports.streams[topic][url][id] = { };
            exports.streams[topic][url][id].uuid = streamUUID;
            console.log('uuid: ' + streamUUID);
            exports.streams[streamUUID].metadata = {topic: topic, url: url, id: id}; // Allows us to lookup with only UUID
            exports.streams[streamUUID].header = '';
            exports.streams[streamUUID].stream = new Stream();
            exports.streams[streamUUID].stream.writable = exports.streams[streamUUID].readable = true;
            exports.streams[streamUUID].stream.write = function (data) {
                if (data)
                    this.emit('data', data);
                    //console.log('stream listener: ' + data);
                return true;
            };
            exports.streams[streamUUID].stream.end = function(data){ if (data) console.log(data);}
            
            if (file) { // if requested, we will create a file writer
                console.log('Stream requested file writer for: ' + file)
                if (fs.existsSync(file)) fs.unlinkSync(file);
                exports.streams[streamUUID].filewriter = fs.createWriteStream(file, {end: false}); 
                exports.streams[streamUUID].stream.pipe(exports.streams[streamUUID].filewriter);
            }
        }  
    }  else { // Not enough of the right parameters in the call
        err = "Didn't get a topic, URL, and ID";
    }
    
    if (cb) cb(err, streamUUID);
}

function header(streamUUID, msg) {
// Use header to report checkpoints in job output
// A client connecting to a job half-way completed can receive the header, and be made aware of the current state of the job
// Called by setting optHeaderWrite to true on a significant output message sent using write().
    
    if (exports.streams[streamUUID]) {
        exports.streams[streamUUID].header = exports.streams[streamUUID].header + msg + '\n';
        
    }
}

function write(topic, url, id, msg, optWrite) {
// function write(uuid, msg, optHeader)
// function write(uuid, msg, [LOG_CONSOLE, LOG_HEADER, LOG_TIMESTAMP])

// Send a message to an ephemeral stream, optionally adding it the connection header, logging to console, or timestamping it

// Adding LOG_CONSOLE as an option additionally logs the message to the console
// Adding LOG_HEADER as an option adds the message to the stream header sent to clients on connect
// Adding LOG_TIMESTAMP will time stamp the message. Header messages are automatically timestamped
    var streamUUID, 
        log_console = false, 
        log_timestamp = false, 
        log_header = false, 
        _msg;
    if (! msg) {
        streamUUID = topic;
        msg = url;
        optWrite = id;
    } else {
        if (exports.streams[topic] && exports.streams[topic][url] && exports.streams[topic][url][id])
            streamUUID = exports.streams[topic][url][id].uuid;    
    }
        
    if (optWrite)
    { 
        if ("object" == typeof optWrite) {
            log_console = (optWrite.indexOf(LOG_CONSOLE) != -1); 
            log_header = (optWrite.indexOf(LOG_HEADER) != -1);
            log_timestamp = (optWrite.indexOf(LOG_TIMESTAMP) != -1);
        } else {
            log_console = (optWrite == LOG_CONSOLE);
            log_header = (optWrite == LOG_HEADER);
            log_timestamp = (optWrite == LOG_TIMESTAMP);
        }
        
        if (log_console) console.log(msg);
        if (log_header) {
            _msg = humanize.date('Y-m-d H:i:s') + ' : ' + msg;
            header(streamUUID, _msg + '\n');
        }
        if (log_timestamp) msg = humanize.date('Y-m-d H:i:s') + ' : ' + msg;
    }
        
    if (exports.streams[streamUUID]) 
        exports.streams[streamUUID].stream.write(msg + '\n', 'utf8');
}

function retire(topic, url, id) {
// function retire(uuid)

// Deletes a stream and associated metadata.

    var streamUUID;
    if (!url) {
        streamUUID = topic;
        topic = exports.streams[streamUUID].metadata.topic;
        url = exports.streams[streamUUID].metadata.url;
        id = exports.streams[streamUUID].metadata.id;
    } else {
       streamUUID = exports.streams[topic][url][id].uuid 
    }
    console.log('Destroying ephemeral stream ' + streamUUID);
    delete exports.streams[streamUUID];
    delete exports.streams[topic][url][id];
}
