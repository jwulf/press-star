var fs=require('fs'),
    spawn = require('child_process').spawn,
    carrier = require('carrier'),
    builder = require('./../lib/build.js'),
    cylon = require('pressgang-cylon'),    
    uuid = require('node-uuid'),
    jsondb = require('./../lib/jsondb'),
    Stream = require('stream').Stream,
    livePatch = require('./../lib/livePatch'),
    ephemeral = require('./../lib/ephemeralStreams');

exports.socketHandler = socketHandler;

var cmd_running = false;    

function socketHandler (client){

    console.log('Client connected');
    client.send('{"success": 1}');
    client.on('msg', function(data) {
        console.log('Client just sent:', data); 
    }); 
    client.on('pushspec', function(data){pushSpec(data, client);});
    client.on('getStream', function(data) {getStream(data, client);});
    
    client.on('patchSubscribe', function(data) { 
        var specID = data.id;
        console.log('Patch Subscription for Spec ID: ' + data.id);
        if (data.id  && data.skynetURL)
            if (livePatch.patchStreams[data.skynetURL][data.id]) {
                var myPatchStream = new Stream();
                myPatchStream.readable = myPatchStream.writable = true;
                myPatchStream.write = function (topicPatchData) {
                    if (topicPatchData.bookRebuilt) {
                        client.emit('bookRebuiltNotification','The book was rebuilt');    
                    } else 
                    if (topicPatchData.notification) {
                        console.log('sending notification');
                        client.emit ('notification', topicPatchData.data);
                    } else 
                    {
                        console.log('Pushing patch to a listening book for Topic ' + topicPatchData.topicID + ' in Spec ' + specID);
                        this.emit('data', data);
                        client.emit('patchBookinBrowser', topicPatchData); 
                        return true;
                    } 
                }
                livePatch.patchStreams[data.skynetURL][data.id].pipe(myPatchStream);
            }
    });
    
    client.on('disconnect', function() {
        console.log('Bye client :(');
    }); 
}

function getStream (data, client){
    console.log('Websocket requested for ephemeral stream ' + data.streamID);
    if (! ephemeral.streams[data.streamID]) {
        console.log('Stream does not exist - job finished?');
        client.emit('cmdoutput', 'No output stream for this job. Has it completed?');
    } else {
        client.emit('cmdoutput', ephemeral.streams[data.streamID].header);
        
        ephemeral.streams[data.streamID].stream.on('data', function (data){
            client.emit('cmdoutput', data); 
        });
    }
}

function pushSpec (data, client) {
    var Books = jsondb.Books;
    var BUILD_SUCCEEDED = 0,
        filenumber=1;
    
    console.log('Received content spec push request: ' + data.command);
    
    while (fs.existsSync("/tmp/cspec"+ filenumber))
        filenumber++;
    var filename="/tmp/cspec"+filenumber;

    console.log('Creating local file: ' + filename);
    console.log('Client pushed: ' + data);
    
    fs.writeFile(filename, data.spec, function(err){
        if(err) {
                console.log(err);
                client.emit('cmdoutput', 'Failed to create file on server');
                cmd_running = false;
        } else {
            console.log("Saved spec file" + filename);
            var command = 'csprocessor';
            var server = data.server;
            client.emit('cmdstart','started');
            
            console.log('Commencing ' + data.command + ' operation');
            var msg = 'Commencing ' + data.command;
			if (data.opts) msg = msg + data.opts;
			msg = msg + ' operation against ' + server;
            client.emit('cmdoutput', msg);
            client.emit('cmdoutput','');
			
            var cmd = [];
			cmd.push(data.command);
			if (data.opts) cmd.push(data.opts);
			cmd.push('-u');
			cmd.push('jwulf');
			cmd.push('-H');
			cmd.push(server);
			cmd.push(filename);
            var push = spawn(command, cmd);
            push.stdout.setEncoding('utf8');
            // add a 'data' event listener for the spawn instance
            var linereader = carrier.carry(push.stdout);
            linereader.on('line', function(line){client.emit('cmdoutput',line); });
         
            //push.stdout.on('data', function(data) { client.emit('cmdoutput',data); console.log(data); });
            // add an 'end' event listener to close the writeable stream
            push.stdout.on('end', function(data) {
                client.emit('cmdfinish','done');
            });
            // when the spawn child process exits, check if there were any errors 
            push.on('exit', function(code) {
                client.emit('cmdexit', code);
                console.log('Exiting Content Spec push with code: ' + code);
                
                // If the push succeeds, then we will spawn a rebuild of the book, if we're hosting it
                if (code == BUILD_SUCCEEDED && data.command == 'push') {
                    console.log('Initiating post-content-spec-push rebuild');
                    cylon.stripMetadata('http://' + data.server, data.spec, function specMetadataCallback(err, md) {
                        console.log(md);
                        if (md){
                            if (md.serverurl &&  md.id){
                                console.log('Checking for book...');
                                if (Books[md.serverurl] && Books[md.serverurl][md.id]) {
                                    console.log('We got that book...');
                                    Books[md.serverurl][md.id].buildID = uuid.v1();
                                    console.log(Books[md.serverurl][md.id].buildID);
                                    builder.build(md.serverurl, md.id);
                                }
                            }
                        }   
                    });
                    
                }
                cmd_running = false;         
                fs.unlink(filename, function(err)
                {
                    if (err) {console.log(err);}
                    else{console.log("Successfully deleted "+ filename);}
                });
            });
        }
    });
}
