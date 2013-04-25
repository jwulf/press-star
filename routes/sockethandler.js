var fs=require('fs'),
    spawn = require('child_process').spawn,
    carrier = require('carrier'),   
    Library = require('./../lib/Books'),
    Stream = require('stream').Stream,
    livePatch = require('./../lib/livePatch'),
    assembler = require('./../lib/assembler'),
    ephemeral = require('./../lib/ephemeralStreams');

exports.socketHandler = socketHandler;

var cmd_running = false;    

function socketHandler (client){
    var Books = Library.Books; // Got to do this here, because it's dynamically populated
    
    console.log('Client connected');
    client.send('{"success": 1}');
    client.on('msg', function(data) {
        console.log('Client just sent:', data); 
    }); 
    client.on('pushspec', function(data){pushSpec(data, client);});
    client.on('getStream', function(data) {getStream(data, client);});
    
    client.on('patchSubscribe', function(data) { 
        var id = data.id, url = data.skynetURL;
        console.log('Patch Subscription for Spec ID: ' + data.id);
        if (id  && url)
            
            /* Hook into the Book event emitter. This is fired whenever the Book
             metadata is updated. It allows client-side templating to use the 
             new JSON data to reactively re-render a real-time view of the state of the book
             */
            if (Books[url] && Books[url][id]) {
                console.log('Subscribing to book state change');
                Books[url][id].on('change', function (data) { 
                    client.emit('statechange', {md : Books[url][id].getAll()});
                });
            }
            
            if (livePatch.patchStreams[url][id]) {
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
                        console.log('Pushing patch to a listening book for Topic ' + topicPatchData.topicID + ' in Spec ' + id);
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
    var Books = Library.Books;
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
                    if (Books[data.server] && Books[data.server][data.spec]) {
                        console.log('We got that book...');
                        assembler.build(md.serverurl, md.id);
                    }
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
