var fs=require('fs'),
    spawn = require('child_process').spawn,
    carrier = require('carrier'),   
    Library = require('./../lib/Library'),
    Stream = require('stream').Stream,
    livePatch = require('./../lib/livePatch'),
    assembler = require('./../lib/assembler'),
    uuid = require('node-uuid'),
    ephemeral = require('./../lib/ephemeralStreams');

exports.socketHandler = socketHandler;
exports.pushSpec = pushSpec;

var cmd_running = false;

function socketHandler (client){
    var Books = Library.Books, // Got to do this here, because it's dynamically populated
        url, id, ephemeralID;

    var bookListener = function (data) {
        console.log('Book state change: ');
        console.log(data);
        client.emit('statechange', data);
    };

    var libraryListener = function (data) {
        client.emit('bookNotification', data);
    };

    var ephemeralListener = function (data){
        client.emit('cmdoutput', data);
    };

    var patchListener =  function (topicPatchData) {
        if (topicPatchData.bookRebuilt) {
            client.emit('bookRebuiltNotification','The book was rebuilt');
        } else
        if (topicPatchData.notification) {
            client.emit ('notification', topicPatchData.data);
        } else
        {
            console.log('Pushing patch to a listening book for Topic ' + topicPatchData.topicID + ' in Spec ' + id);
            //this.emit('data', topicPatchData);
            client.emit('patchBookinBrowser', topicPatchData);
            return true;
        }
    }


    console.log('Client connected');
    client.send('{"success": 1}');
    client.on('msg', function(data) {
        console.log('Client just sent:', data); 
    }); 
    client.on('pushspec', function(data){pushSpec(data, client);});

    client.on('getStream', function getStream (data){
        console.log('Websocket requested for ephemeral stream ' + data.streamID);
        ephemeralID = data.streamID;
        if (! ephemeral.streams[ephemeralID]) {
            console.log('Stream does not exist - job finished?');
            client.emit('cmdoutput', 'No output stream for this job. Has it completed?');
        } else {
            client.emit('cmdoutput', ephemeral.streams[ephemeralID].header);

            ephemeral.streams[ephemeralID].stream.on('data', ephemeralListener);
        }
    });
    
    client.on('patchSubscribe', function(data) {
        // we can only subscribe to one at a time - to avoid memory leaks
        if (livePatch.bookNotificationStreams[url] && livePatch.bookNotificationStreams[url][id]) {
            livePatch.bookNotificationStreams.removeListener('data', patchListener);
        }

        id = data.id, url = data.skynetURL;
        console.log('Patch Subscription for Spec ID: ' + data.id);
        if (id  && url)
            
            /* Hook into the Book event emitter. This is fired whenever the Book
             metadata is updated. It allows client-side templating to use the 
             new JSON data to reactively re-render a real-time view of the state of the book
             */
            if (Books[url] && Books[url][id]) {
                console.log('Subscribing to book state change');

                Books[url][id].on('change', bookListener);
            }

        if (livePatch.bookNotificationStreams[url] && livePatch.bookNotificationStreams[url][id]) {
                livePatch.bookNotificationStreams[url][id].on('data', patchListener);
            }
    });
    
    // Send a notification for any book event - used by index pages to refresh Library state
    client.on('bookNotificationSubscribe', function () {
        console.log('Client subscribed for Book Notifications');
        Library.NotificationStream.on('change', libraryListener);
        Library.NotificationStream.on('data', libraryListener);
    });
    
    client.on('disconnect', function () {
        console.log('Bye client :(');
        if (Books[url] && Books[url][id]) {
            Books[url][id].removeListener('change', bookListener);
        }
        Library.NotificationStream.removeListener('change', libraryListener);
        if (url && id){
            if (livePatch.bookNotificationStreams[url] && livePatch.bookNotificationStreams[url][id]) {
                livePatch.bookNotificationStreams[url][id].removeListener('data', patchListener);
            }
        }
        if (ephemeralID && ephemeral.streams[ephemeralID] && ephemeral.streams[ephemeralID].stream) {
            ephemeral.streams[ephemeralID].stream.removeListener(ephemeralListener);
        }

    });

}

/* pushSpec function

    Invoked by the content spec editor "Push" and "Push Align" button, and also by a topic save that involves modifying
    the topic title. In the case of the content spec editor-initiated actions, a websocket client is passed in to the
    function. This client is used to provide feedback on the push operation to the user.

    When the explicitly user-initiated push completes, if it is successful a rebuild of the book is triggered.

    In the case of the post-topic-title-changing-edit push align, the operation is performed silently in the background.
    On a successful realignment of the spec with the new topic title(s), no rebuild operation is performed, as the
    book is live patched.

 */
function pushSpec (data, client) {
    var Books = Library.Books;
    var BUILD_SUCCEEDED = 0;
    
    console.log('Received content spec push request: ' + data.command);

    var filename="/tmp/" + uuid.v1();

    console.log('Creating local file: ' + filename);
    //console.log('Client pushed: ' + data);
    
    fs.writeFile(filename, data.spec, function(err){
        if(err) {
                console.log(err);
                if (client) client.emit('cmdoutput', 'Failed to create file on server');
                cmd_running = false;
        } else {
            console.log("Saved spec file" + filename);
            var command = 'csprocessor';
            var server = data.server;
            if (client) client.emit('cmdstart','started');
            
            console.log('Commencing ' + data.command + ' operation');
            var msg = 'Commencing ' + data.command;
			if (data.opts) msg = msg + data.opts;
			msg = msg + ' operation against ' + server;
            if (client) client.emit('cmdoutput', msg);
            if (client) client.emit('cmdoutput','');
			
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
            linereader.on('line', function(line){if (client) client.emit('cmdoutput',line); });
         
            //push.stdout.on('data', function(data) { client.emit('cmdoutput',data); console.log(data); });
            // add an 'end' event listener to close the writeable stream
            push.stdout.on('end', function(data) {
                if (client) client.emit('cmdfinish','done');
            });
            // when the spawn child process exits, check if there were any errors 
            push.on('exit', function(code) {
                if (client) client.emit('cmdexit', code);
                console.log('Exiting Content Spec push with code: ' + code);
                
                // If the push succeeds, then we will spawn a rebuild of the book, if we're hosting it
                if (code == BUILD_SUCCEEDED && data.command == 'push') {
                    // don't rebuild for the topic title spec align (clientless)
                    if (Books[data.server] && Books[data.server][data.spec] && client) {
                        console.log('Initiating post-content-spec-push rebuild');
                        console.log('We got that book...');
                        assembler.build(data.serverurl, data.id);
                    }
                }
                cmd_running = false;         
                fs.unlink(filename, function(err)
                {
                    if (err) {console.log(err);}
                });
            });
        }
    });
}
