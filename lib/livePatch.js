var jsdom = require('jsdom').jsdom,
    fs = require('fs'),
    jsondb = require('./Books'),
    ephemeral = require('./ephemeralStreams'),
    cheerio = require('cheerio'),
    async = require('async'),
    Stream = require('stream').Stream,
    TOPICS_FILE_PATH = process.cwd() + '/books/',
    TOPICS_FILE_NAME = 'topicDependencies.json',
    TOPICS_FILE = TOPICS_FILE_PATH + TOPICS_FILE_NAME,
    LOG_CONSOLE = ephemeral.LOG_CONSOLE;

exports.scanBook = scanBook; // scan a book and add its topic dependencies to the map
exports.write = write; // write the topic dependencies to disk
exports.read =read; // read topic dependencies from disk
exports.initialize = initialize; // read topic dependencies from disk
exports.generateStreams = generateStreams; // create/add patchStreams for each book
exports.patch = patch; // patch a book, and let listeners know about it
exports.replayBuffer = {}; // replay buffer for live patches performed while a book is building
exports.playBuffer = playBuffer; // function to apply a replayBuffer to a book
exports.patchRESTendpoint = patchRESTendpoint, // REST endpoint for live patches to be submitted
exports.removeTopicDependenciesForBook = removeTopicDependenciesForBook; // removing a book? Delete its topic dependencies!


/* This module handles Patch Streams, Topic Dependencies, and Live Patching 

Topic Dependencies are maintained as a map like this:

{
    "http://skynet.usersys.redhat.com:8080/TopicIndex": {
        "5822": {
            "6179": true
        },
        "5823": {
            "6179": true,
            "7069": true
        }
    }
}

At the root is the URL. Then come the topic IDs. Each topic ID then has a collection of content specs that rely on it. 

Topic Dependencies are calculated after a book is (re)built. When a patch is received for a topic, the Topic Dependencies map
is used to look up the Content Spec that use this topic. Those Content Specs are then patched, and the patch is sent to all 
clients listening to the patchStream for that Content Spec. 

Interested clients (instances of books in web browsers) subscribe to the patchStream that corresponds to their interest (usually)
their own patchStream. The patchStream is used to send notifications of topic patches and build and publish events related 
to the book. 

*/

// onWrite event handler for a patchStream. Nothing fancy, just does the minimum - emits the data for listeners
function patchStreamWrite (data) {
    if (data)
        this.emit('data', data);
    return true;
};

/*  
    The patchStreams are used to inform listeners of patch events, as well as build and publishing notifications. 
    Typically listeners will pipe a patchStream to a web socket.

    generateStreams will create a new stream for any (book in the server's book metadata) that does not already
    have a stream, so it can be safely called whenever a book is added.
*/

function generateStreams(cb){
    var Books = jsondb.Books;
    console.log('Patch Stream generation');
    if (! exports.patchStreams) exports.patchStreams = {};

    for (var url in Books) {
        if (! exports.patchStreams[url])
            exports.patchStreams[url] = {};
        for (var id in Books[url]) {
            if (! exports.patchStreams[url][id]) {
                exports.patchStreams[url][id] = new Stream();
                exports.patchStreams[url][id].writable = exports.patchStreams[url][id].readable = true;
                exports.patchStreams[url][id].write = patchStreamWrite;
                console.log('Patch notification stream generated for Content Spec: ' + url + ' ' + id);
            }
        }
    }
    if (cb) return cb();
}

/* Write the Topic Dependencies map to a file, so that it persists across server restarts */
function write(cb){
    fs.writeFile(TOPICS_FILE, JSON.stringify(exports.Topics, null, 4), function(err) {
        if(err) {
          console.log(err);
          return cb(err)
        } else {
          console.log("Topic JSON saved to " + TOPICS_FILE);
        }
    });     
}

/* Read the Topic Dependencies file from disk */
function read(cb){
    exports.Topics = {};
    if (fs.existsSync(TOPICS_FILE)) {
        try {
            exports.Topics = require(TOPICS_FILE);
        }
        catch(e) {if (cb) cb(e)}
    } else {
        exports.Topics = {};
        if (cb) cb();
    }    
}

/* Initialization. Maybe should call generateStreams from here too... */
function initialize(){
    read();
}

/* This is the REST endpoint for patch submission. Typically the Death Star editor submits a patch when the save event 
    is successful. */
function patchRESTendpoint (req, res){
    var url = req.body.skynetURL,
        html = req.body.html,
        id = req.body.topicID;
        
    if (url && html && id)
        patch(url, id, html, function (err) {
           if (err) {res.send({code:1, msg: err});} else {res.send({code:0, msg: 'Patch completed OK'});}
        });
}

function removeTopicDependenciesForBook (url, id, cb) {
    if (exports.Topics[url])
        for (var topic in exports.Topics[url])
            if (topic[id]) delete topic[id]; 
    if (cb) cb();
}

/* Scan the file at htmlToScan and update the topic dependency map.

 Called post-publican build to update the topic dependency map. */

function scanBook(url, id, htmlToScan, cb) {
    var topicID, count = 0,
        my = jsondb.Books[url][id],
        uuid = my.buildID;

    ephemeral.write(uuid, 'Generating Topic Dependencies for ' + htmlToScan, LOG_CONSOLE);

    if (!exports.Topics) exports.Topics = {};

    // Nuke all the current subscriptions for this book
    if (exports.Topics[url]) for (var topic in exports.Topics[url])
        if (topic[id]) delete topic[id];

    // Now scan through the book and update the Topic Dependency map
    // REFACTOR: Can this be done with cheerio? It's supposed to be 4-6x faster
    jsdom.env(htmlToScan, [process.cwd() + '/public/scripts/jquery-1.9.1.min.js'], function(err, window) {
        if (err) return cb(err);

        window.$('.RoleCreateBugPara > a').each(function() {
            var target = window.$(this);

            // Get the topic ID from the bug link data
            topicID = url_query('topicid', target.attr('href')) || 'undefined-';

            //console.log('Generating Topic Dependency Subscription for ' + topicID);
            // get topicID
            if (!exports.Topics[url]) exports.Topics[url] = {};
            if (!exports.Topics[url][topicID]) exports.Topics[url][topicID] = {};

            exports.Topics[url][topicID][id] = true;
            count++;
            //console.log(exports.Topics);
        });
        ephemeral.write(uuid, 'Found ' + count + ' topics');
        console.log('Found ' + count + ' topics in dependency scan');
        write();
        if (cb) cb();
    });
}

/* Apply a patch to a book, and push the patch to listeners via the patchStream. 
    Books that are open in a web browser can then patch themselves using the same technique, obviating
    a page reload. The next page reload will return the patched book from the server.
*/
function patch(url, topicID, newHtml, cb) {
    var specID;
    console.log('Patch received for ' + url + ' ' + topicID);
    if (exports.Topics[url]) {
        var buildsThatUseThisPatch = exports.Topics[url][topicID];
        console.log('Found ' + Object.hasOwnProperty(buildsThatUseThisPatch).length + ' books that use this topic.')
        for (specID in buildsThatUseThisPatch) {
        
            // if the book is building right now then add the patch to a replay buffer
            // when the book build is finished, the build job will play the buffer on the book
            
            if (jsondb.Books[url][specID].buildingForReals) {
                // Send the patch to the replay buffer
                if (!exports.replayBuffer[url]) exports.replayBuffer[url] = {};
                if (!exports.replayBuffer[url][specID]) exports.replayBuffer[url][specID] = [];
                exports.replayBuffer[url][specID].push({
                    topicID: topicID,
                    html: newHtml
                });
                console.log('Dirty patch for %s %s - Topic ID: %s', url, specID, topicID);
            }
            
            // We patch the book in either case. Live clients will see the dirty patches, and those should
            // be replayed on to the rebuilt book - so it *should* be relatively transparent
            patchBook(url, specID, topicID, newHtml);
        }
    } else {
        console.log('No content specs for url ' + url);
    }
    if (cb) return cb();
}

/* Given a collection of edits that were made to a book while it was rebuilding (dirty patches), apply the edits (patches)
    to the rebuilt HTML, thus producing an up-to-date view of the book.
    
    The dirty patches are stored in exports.replayBuffer by the live patching system when patches are received for a book 
    that is building.
    
    We have to play the dirty patches back in sequence, because it's likely that some of them are updates to the same content. 
    
    playBuffer uses a function generator to create a function for each patch. The functions are then applied in series using
    async.series inside a single DOM load, with a single file write at the end. */

/* REFACTOR: 
    1. There should be some sane way to merge playBuffer and patchBook, because atm the same code is duplicated in 
    both places.
    2. Will cheerio do the same thing as jsdom in this situation? It is supposed to be 4-6 times faster. 
*/
    
function playBuffer(url, id, cb){
    var my = jsondb.Books[url][id],
        uuid = my.buildID,
        patch, thisPatch;
    // Apply all live patching changes that happened while the book was building
    
    // Typically called by a build job as the final step
    ephemeral.write(uuid, 'Checking the dirty patch replay buffer', LOG_CONSOLE);
    if (exports.replayBuffer[url] && exports.replayBuffer[url][id]) {
        var patchCount = exports.replayBuffer[url][id].length;
        // We have a buffer, we will play it
        ephemeral.write(uuid, 'Replaying dirty patches buffer. Found ' + patchCount + ' dirty patches', LOG_CONSOLE);
        
        // var $ = cheerio.load(my.builtPublicanDir +'/index.html');
        
        jsdom.env(my.HTMLPrePublish, [process.cwd() + '/public/scripts/jquery-1.9.1.min.js'], function (err, window){
             var $ = window.$;
            
            /* This is functional programming beeyatches. It might even be a monad.
             We turn each patch into a function, and then we can use async.series to run each 
            function (ie: apply each patch) synchronously and in order. 
            
            It also means that we can do it inside a single DOM load, and with a single file write
            at the end, both of which are significant for performance.    
            */
        
            /* This function composes a specific patch into a function */
            function composePatch (topicid, html) {
                return function (callback) {
                    applyPatch(topicid, html, function(){callback();});
                }
            }
            
            /* This is the function that applies a patch to the DOM */
            function applyPatch (topicID, newHtml, cb) {
                if (err) return ephemeral.write(uuid, 'Error loading DOM while applying patch for topic ' + 
                                                    topicID + ': ' + err);
        
                // Number of times this topic is (re)used in this book - used to synchronize execution
                var numTopicInstances = $('.sectionTopic' + topicID).length,
                    count = 0,
                    target;
        
                // Patch each instance of the topic in the book, with its own title and section number
                $('.sectionTopic' + topicID).each(function() {
                    target = $(this);
        
                    // Locate and preserve its .prereqs-list child, if it exists
                    var prereq = target.children('.prereqs-list').detach();        
                    // Locate and preserve its .see-also-list child, if it exists
                    var seealso = target.children('.see-also-list').detach();
                    // Locate and preserve the bug link / edit child
                    var buglink = target.children('.bug-link').detach();
                    // Get the title from the existing topic - this gets us the TOC anchor and correct section number
                    var title = target.find('.title')[0];
        
                    target.html(newHtml);
                    $(target.find('.title')[0]).replaceWith(title);
        
                    if (prereq) prereq.insertAfter(target.find('hr'));
                    if (seealso) seealso.appendTo(target);
                    if (buglink) buglink.appendTo(target);
        
                    count++;
        
                    // If that's all, then we are going to persist the modified DOM 
                    // and broadcast to all listeners
                    if (count >= numTopicInstances - 1) {
                        return cb();
                    }
                });
            }
            
            /* Compose the patches into functions */
            var patchset = {};
            for (var patches = 0; patches < patchCount; patches ++ ){
                patch = exports.replayBuffer[url][id][patches];
                patchset[patches] = composePatch(patch.topicID, patch.html);
            }

            /* Now apply the patches to the DOM by executing the functions */
            async.series(patchset, function (err, result) {
                // This is the callback when the series is complete
                if (err) { 
                    ephemeral.write(uuid, 'Error during dirty patch replay: ' + err);
                    return cb();
                }
                
                 var html = window.document.outerHTML;

                if (!my.filewriting) {
                    my.filewriting = true;
                    fs.writeFile(my.HTMLPrePublish, html, function(err) {
                        my.filewriting = false;
                        if (err) {
                            ephemeral.write(uuid, 'Error writing dirty patched book ' + err, LOG_CONSOLE);
                            return cb(err);
                        }
                        ephemeral.write(uuid, 'Replayed dirty patches to ' + my.HTMLPrePublish + ' on disk', LOG_CONSOLE);            
                        cb();
                    });
                }
                
            }); 

        });
        
    } else {
        ephemeral.write(uuid, 'No dirty patch buffer found', LOG_CONSOLE);
        if (cb) cb();
    }
} 

/* REFACTOR: 
    1. There should be some sane way to merge playBuffer and patchBook, because atm the same code is duplicated in 
    both places.
    2. Will cheerio do the same thing as jsdom in this situation? It is supposed to be 4-6 times faster. 
*/
function patchBook(url, id, topicID, newHtml, replaying, cb) {
    var bookFilePath,
    my = jsondb.Books[url][id],
    uuid = my.buildID,
    _replaying;
    
    if ("function" == typeof replaying) cb = replaying;
    _replaying = (replaying === true);
    
    if (_replaying) ephemeral.write(uuid, 'Replaying patch for ' + topicID, LOG_CONSOLE);
    
    // We can take an object as an argument when it's a batch of replay patches
    
    bookFilePath = (_replaying) ? my.HTMLPrePublish : my.HTMLPostPublish,
        
    console.log('Patching Topic ' + topicID + ' in Content Spec ' + id + '. File path: ' + bookFilePath);
    
    jsdom.env(bookFilePath, [process.cwd() + '/public/scripts/jquery-1.9.1.min.js'], function(err, window) {
        var $ = window.$;
        if (err) return console.log('error');

        // Number of times this topic is (re)used in this book - used to synchronize execution
        var numTopicInstances = $('.sectionTopic' + topicID).length,
            count = 0,
            target;

        // Patch each instance of the topic in the book, with its own title and section number
        $('.sectionTopic' + topicID).each(function() {
            target = $(this);

            // Locate and preserve its .prereqs-list child, if it exists
            var prereq = target.children('.prereqs-list').detach();
            // Locate and preserve its .see-also-list child, if it exists
            var seealso = target.children('.see-also-list').detach();
            // Locate and preserve the bug link / edit child
            var buglink = target.children('.bug-link').detach();
            // Get the title from the existing topic - this gets us the TOC anchor and correct section number
            var title = target.find('.title')[0];

            target.html(newHtml);
            $(target.find('.title')[0]).replaceWith(title);

            if (prereq) prereq.insertAfter(target.find('hr'));
            if (seealso) seealso.appendTo(target);
            if (buglink) buglink.appendTo(target);

            count++;

            // If that's all, then we are going to persist the modified DOM 
            // and broadcast to all listeners
            if (count >= numTopicInstances - 1) {
                
                //Persist changes to filesystem
    
                var html = window.document.outerHTML;

                if (jsondb.Books[url] && jsondb.Books[url][id] && !jsondb.Books[url][id].filewriting) {
                    jsondb.Books[url][id].filewriting = true;
                    fs.writeFile(bookFilePath, html, function(err) {
                        jsondb.Books[url][id].filewriting = false;
                        if (err) return console.log('Error patching book ' + err);
                        console.log('Patched ' + bookFilePath + ' on disk');
                    });
                }
    
                // Send the patch to listeners, but not if this is a dirty buffer replay
                if (! _replaying)  
                    notifyListenersOfPatch(url, id, topicID, newHtml);
                
                if (cb) cb();
            }
        });

    });
}

/* Send the patch to the patchStream. Typically this gets to books in the browser because they are piping the 
  patchStream to a websocket through patchSubscribe in socketHandler.js */
function notifyListenersOfPatch(url, id, topicid, html) {
    console.log('Patch notification broadcast to ' + url + ' ' + id);
    exports.patchStreams[url][id].write({
        topicID: topicid,
        html: html
    });
}

function url_query( query, url ) {
  // Parse URL Queries
  // from http://www.kevinleary.net/get-url-parameters-javascript-jquery/
  // Will parse the current window location if not passed a url
    query = query.replace(/[\[]/,"\\\[").replace(/[\]]/,"\\\]");
	var expr = "[\\?&]"+query+"=([^&#]*)";
	var regex = new RegExp( expr );
	var results = regex.exec( url); //|| regex.exec( window.location.href );
	if( results !== null ) {
		return results[1];
		return decodeURIComponent(results[1].replace(/\+/g, " "));
	} else {
		return false;
	}
}