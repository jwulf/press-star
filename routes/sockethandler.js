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

    // Publishes changes to event emitting keys
    var bookStateListener = function (data) {
        client.emit('statechange', data);
    };

    // Publishes build and publish events
    var bookNotificationListener = function (data) {
        console.log('Emit notification:');
        console.log(data);
        client.emit('notification', data);
    }

    // Publishes all book event emitting keys, plus Library events like add and remove
    var libraryListener = function (data) {
       // console.log('socket emitting library data');
        //console.log(data);
        client.emit('librarychange', data);
    };

    // Publishes build and publish streams
    var ephemeralListener = function (data){
        client.emit('cmdoutput', data);
    };

    // Publishes patches
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
            client.emit('patch', topicPatchData);
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

    client.on('subscribeToBookState', function(data) {
        // we can only subscribe to one at a time - to avoid memory leaks
        // if you want all of the books, use librarySubscribe
        if (Library.Books[url] && Library.Books[url][id]) {
            Library.Books[url][id].removeListener('change', bookStateListener);
        }

        id = data.id, url = data.url;
        console.log('Book State Subscription for Spec ID: ' + data.id);

        /* Hook into the Book event emitter. This is fired whenever the Book
         metadata is updated. It allows client-side templating to use the
         new JSON data to reactively re-render a real-time view of the state of the book
         */

        if (id && url && Library.Books[url] && Library.Books[url][id]) {
            Library.Books[url][id].on('change', bookStateListener);
        }
    });

    client.on('subscribeToBookNotification', function(data) {
        // we can only subscribe to one at a time - to avoid memory leaks
        if (Library.Books[url] && Library.Books[url][id]) {
            Library.Books[url][id].removeListener('notify', bookNotificationListener);
        }

        id = data.id, url = data.url;
        console.log('Book Notification Subscription for Spec ID: ' + data.id);

        if (id  && url && Library.Books[url] && Library.Books[url][id]) {
            Library.Books[url][id].on('notify', bookNotificationListener);
        }
    });
    
    client.on('subscribeToBookPatch', function(data) {
        // we can only subscribe to one at a time - to avoid memory leaks
        if (Library.Books[url] && Library.Books[url][id]) {
            Library.Books[url][id].removeListener('patch', patchListener);
        }

        id = data.id, url = data.url;
        console.log('Patch Subscription for Spec ID: ' + data.id);

        if (id  && url && Library.Books[url] && Library.Books[url][id]) {
                Library.Books[url][id].on('patch', patchListener);
        }
    });
    
    // Send a notification for all book events, and library events like book added or removed
    // Used by index pages to refresh Library state
    client.on('subscribeToLibrary', function () {
        console.log('Library Notification Subscription');
        Library.LibraryNotificationStream.on('data', libraryListener);
    });
    
    client.on('disconnect', function () {
        console.log('Bye client :(');
        if (Library.Books[url] && Library.Books[url][id]) {
            Library.Books[url][id].removeListener('change', bookStateListener);
            Library.Books[url][id].removeListener('patch', patchListener);
            Library.Books[url][id].removeListener('notify', bookNotificationListener);
        }
        Library.LibraryNotificationStream.removeListener('data', libraryListener);
        if (url && id){
            if (Library.Books[url] && Library.Books[url][id]) {

            }
        }

        // This stream is destroyed, so we probably don't need to manually manage this
       /* if (ephemeralID && ephemeral.streams[ephemeralID] && ephemeral.streams[ephemeralID].stream && ephemeralListener) {
            ephemeral.streams[ephemeralID].stream.removeListener(ephemeralListener);
        }*/

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
			cmd.push(data.username);
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
                if (code === BUILD_SUCCEEDED && data.command === 'push') {
                    console.log('Pushed: %s %s ', data.server, data.id);
                    // don't rebuild for the topic title spec align (clientless)
                    if (Books[data.server] && Books[data.server][data.id] && client) {
                        console.log('Initiating post-content-spec-push rebuild');
                        console.log('We got that book...');
                        assembler.build(data.server, data.id);
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
