var fs = require('fs'),
    jsdom = require('jsdom'),
    jsondb = require('./Books'),
    pressgang = require('pressgang-rest'),
    ephemeral = require('./ephemeralStreams'),
    cheerio = require('cheerio'),
    async = require('async'),
    Stream = require('stream').Stream,
    TOPICS_FILE_PATH = process.cwd() + '/books/',
    TOPICS_FILE_NAME = 'topicDependencies.json',
    TOPICS_FILE = TOPICS_FILE_PATH + TOPICS_FILE_NAME,
    LOG_CONSOLE = ephemeral.LOG_CONSOLE;

exports.scanBook = scanBook; // scan a book and add its topic dependencies to the map
exports.writeTopicDependencies = writeTopicDependencies; // write the topic dependencies to disk
exports. read =read; // read topic dependencies from disk
exports.initialize = initialize; // read topic dependencies from disk
exports.generateStreams = generateStreams; // create/add patchStreams for each book
exports.patch = patch; // patch a book, and let listeners know about it
exports.replayBuffer = {}; // replay buffer for live patches performed while a book is building
exports.playBuffer = playBuffer; // function to apply a replayBuffer to a book
exports.patchRESTendpoint = patchRESTendpoint, // REST endpoint for live patches to be submitted
exports.removeTopicDependenciesForBook = removeTopicDependenciesForBook; // removing a book? Delete its topic dependencies!
exports.Topics = {};

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
}

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
                exports.patchStreams[url][id].pipe(jsondb.NotificationStream);
                console.log('Patch notification stream generated for Content Spec: ' + url + ' ' + id);
            }
        }
    }
    if (cb) return cb();
}

/* Write the Topic Dependencies map to a file, so that it persists across server restarts */
function writeTopicDependencies(cb){
    fs.writeFile(TOPICS_FILE, JSON.stringify(exports.Topics, null, 4), function(err) {
        if(err) {
          console.log(err);
          return cb(err);
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
    var url = req.body.url,
        html = req.body.html,
        id = req.body.id,
        revision =req.body.revision;
        
        console.log('In the patch REST endpoint');
        
    if (url && html && id) {
        patch(url, id, html, revision, function (err) {
           if (err) {res.send({code:1, msg: err});} else {res.send({code:0, msg: 'Patch completed OK'});}
        });
    } else {
        res.send({code:1, msg: "Didn't get all of url, id, and html parameters"});
    }
}

function removeTopicDependenciesForBook (url, id, cb) {
    if (exports.Topics[url])
        for (var topic in exports.Topics[url])
            if (topic[id]) delete topic[id]; 
    if (cb) cb();
}

/* 
    Scan the file at htmlToScan and 
    (a) update the topic dependency map.
    (b) write the topic revisions into the css and the topic revisions metadata
    
    The Book metadata has a collection "topicRevisions" that contains the revision
    numbers of the topics in the book.
    
 Called post-publican build to update the topic dependency map. */

function scanBook (url, id, htmlToScan, cb) {
    var topicID, 
        my = jsondb.Books[url][id],
        uuid = my.buildID;

    ephemeral.write(uuid, 'Generating Topic Dependencies for ' + htmlToScan, LOG_CONSOLE);

    if (!exports.Topics) exports.Topics = {};

    // Nuke all the current subscriptions for this book
    if (exports.Topics[url]) for (var topic in exports.Topics[url])
        if (topic[id]) delete topic[id];
        
    my.set('topicRevisions', {'topicid': 'revision'}); 

    // Now scan through the book and update the Topic Dependency map and
    // add the topic revision to each topic - this is used when going offline
    // to retrieve the latest revisions of the topics in the book
    jsdom.env(htmlToScan, [process.cwd() + '/public/scripts/jquery-1.9.1.min.js'], function(err, window) { 
    
        var $ = window.$,
            iterations = $('.RoleCreateBugPara > a').length, // how many ajax calls we need to wait on
            count = 0;
        
        ephemeral.write(uuid, 'Found ' + iterations + ' topics in dependency scan', LOG_CONSOLE);
        
        $('.RoleCreateBugPara > a').each(
        function addEachTopicToDependencyMapAndTheRevisionToEachTopicsHTMLAsACSSClass(){
            var target = $(this);
            // Get the topic ID from the bug link data
            topicID = url_query('topicid', target.attr('href')) || 'undefined-';
    
            // Generate Topic Dependency Subscription for topicID
            // Adds the current Spec ID to the list of dependencies for this topic
            // in the Topic Dependency map
            
            // initialize dependency object for this topic, if not extant
            if (!exports.Topics[url]) exports.Topics[url] = {}; 
            if (!exports.Topics[url][topicID]) exports.Topics[url][topicID] = {};
            
            // Add the topic to the Topic Dependency map
            // which has the form Topics.<url>.<topicid>.<specid>
            exports.Topics[url][topicID][id] = true; 
            
            // Is this is a fixed revision topic?
            if (my.fixedRevisionTopics[topicID]) {
                // if so, use the fixed revision
                gotTopicRevisionNumber(target, topicID, my.fixedRevTopics[id]);
            } else { // if not
            // Get the topic revision number of the current revision in PressGang
            
                // This is an immediately invoked function used to create a closure around the topicID
                // See http://stackoverflow.com/questions/6978911/closure-inside-a-for-loop-callback-with-loop-variable-as-parameter
                
                (function getTopicRevision(target, topicID) {
                    pressgang.getTopic(url, topicID, function getTopicForRevisionNumberCallback(topic){
                        // we got the topic, now write the revision into the class of the topic element  
                        gotTopicRevisionNumber(target, topicID, topic.revision);
                    });
                })(target, topicID);
            }
        });
        
        /* 
         Add a topic's revision number as a css class so that it can be accessed in HTML
         This allows a book to determine whether its topics have been updated in PressGang
         Also add it to the Book metadata topicRevisions collection. This allows the server
         to determine whether it needs to download updated topics when going offline.
         
         In a separate function because it could be called directly in the case of
         an already known fixed revision topic, or asynchronously in the case of an
         AJAX callback from a PressGang REST request for the latest topic revision.
        */
        function gotTopicRevisionNumber(_target, _id, _revision) {
            $(_target.parents('.section')[0]).addClass('pg-topic-rev-' + _revision);
                
            my.topicRevisions[_id] = _revision;
            
            // update our counter inside the callback so that we write the HTML to 
            // disk when we have retrieved all the topic revision numbers
            count++;
            if (count == iterations) { // if we have revision data for all topics in the book
                write(); // write the Topic Dependency map to disk
                var html = window.document.outerHTML;
    
                // write the updated HTML to disk, but only if some other process is not currently writing
                if (!my.filewriting) {
                    console.log('rewriting html');
                    my.filewriting = true;
                    fs.writeFile(htmlToScan, html, function(err) {
                        my.filewriting = false;
                        if (err) return console.log('Error patching book ' + err);
                        console.log('Patched ' + htmlToScan + ' on disk');
                    });
                }
                if (cb) {
                    console.log('Calling back from scan');
                    cb();
                } else {
                    console.log('No callback from scan');
                }
            }
        }
    });
}


/* TODO: Update the revision collection my.topicRevisions 
    The topic driver needs to get the revision of the updated topic on save.
    We can safely move the patchNotification into the topic driver and do it 
    server-side.
    
*/

/* Apply a patch to a book, and push the patch to listeners via the patchStream. 
    Books that are open in a web browser can then patch themselves using the same technique, obviating
    a page reload. The next page reload will return the patched book from the server.
*/
function patch(url, topicID, newHtml, revision, cb) {
    var specID, my, numBuilds;
    console.log('Patch received for ' + url + ' ' + topicID);
    if (exports.Topics[url]) {
        var buildsThatUseThisPatch = exports.Topics[url][topicID];
        numBuilds = (buildsThatUseThisPatch) ? Object.keys(buildsThatUseThisPatch).length : 'no';
            console.log('Found ' + numBuilds  + ' books that use this topic.');
        for (specID in buildsThatUseThisPatch) {
       
            my = jsondb.Books[url][specID];    
            if (my.fixedRevisionTopics[topicID]) { // don't patch if it's a fixed revision topic in this spec
                console.log('Topic ' + topicID + ' is a fixed revision topic in Spec ' + specID + " - so we're not patching it");
            } else {
                // if the book is building right now then add the patch to a replay buffer
                // when the book build is finished, the build job will play the buffer on the book
                
                if (jsondb.Books[url][specID].buildingForReals) {
                    // Send the patch to the replay buffer
                    if (!exports.replayBuffer[url]) exports.replayBuffer[url] = {};
                    if (!exports.replayBuffer[url][specID]) exports.replayBuffer[url][specID] = [];
                    exports.replayBuffer[url][specID].push({
                        topicID: topicID,
                        html: newHtml,
                        revision: revision
                    });
                    console.log('Dirty patch for %s %s - Topic ID: %s', url, specID, topicID);
                }
                
                // We patch the book in either case. Live clients will see the dirty patches, and those should
                // be replayed on to the rebuilt book - so it *should* be relatively transparent
                patchBook(url, specID, topicID, newHtml, revision);
            }
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
*/
    
    /* topicRevisions collection should be updated by patchBook when it happens.
    
    TODO: update pg-topic-revision class
    */
function playBuffer(url, id, cb){
    var my = jsondb.Books[url][id],
        uuid = my.buildID,
        patch;
    // Apply all live patching changes that happened while the book was building
    
    // Typically called by a build job as the final step
    ephemeral.write(uuid, 'Checking the dirty patch replay buffer', LOG_CONSOLE);
    if (exports.replayBuffer[url] && exports.replayBuffer[url][id]) {
        var patchCount = exports.replayBuffer[url][id].length;
        // We have a buffer, we will play it
        ephemeral.write(uuid, 'Replaying dirty patches buffer. Found ' + patchCount + ' dirty patches', LOG_CONSOLE);
        
        jsdom.env(my.HTMLPrePublish, [process.cwd() + '/public/scripts/jquery-1.9.1.min.js'], function(err, window) { 
             
            var $ = window.$;
            /* This is functional programming beeyatches. It might even be a monad.
             We turn each patch into a function, and then we can use async.series to run each 
            function (ie: apply each patch) synchronously and in order. 
            
            It also means that we can do it inside a single DOM load, and with a single file write
            at the end, both of which are significant for performance.    
            */
        
            /* This function composes a specific patch into a function */
            var composePatch = function  (topicid, html, revision) {
                return function (callback) {
                    applyPatch(topicid, html, revision, function(){callback();});
                };
            };
            
            /* This is the function that applies a patch to the DOM */
            var applyPatch = function (topicID, newHtml, revision, cb) {
                
                // Number of times this topic is (re)used in this book - used to synchronize execution
                var numTopicInstances = $('.pg-topic-id-' + topicID).length,
                    count = 0,
                    target;
        
                // Patch each instance of the topic in the book, with its own title and section number
                $('.pg-topic-id-' + topicID).each(function() {
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
    
                    // http://stackoverflow.com/questions/2644299/jquery-removeclass-wildcard
                    target.removeClass(function (index, css) {
                        return (css.match (/\bpg-topic-rev\S+/g) || []).join(' ');    
                    }); // get rid of previous revision information
                    
                    target.addClass('pg-topic-rev-' + revision); // Add current revision
            
                    // In theory at least the metadata representation of topic revisions
                    // should have been updated in real-time via patchBook, so no need to mess
                    // with it during the replay
                    // my.topicRevisions[topicID] = revision;
                    
                });
            };
            
            /* Compose the patches into functions */
            var patchset = {};
            for (var patches = 0; patches < patchCount; patches ++ ){
                patch = exports.replayBuffer[url][id][patches];
                patchset[patches] = composePatch(patch.topicID, patch.html, patch.revision);
            }
    
            /* Now apply the patches to the DOM by executing the functions */
            async.series(patchset, function (err, result) {
                // This is the callback when the series of patches is complete
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
*/

function patchBook (url, id, topicID, newHtml, revision, cb) {
    var bookFilePath,
        my = jsondb.Books[url][id];
        
    
    bookFilePath = my.HTMLPostPublish,

    /* Notify listeners immediately of the patch
    Patching of the book here on the server might fail during the file write
    In that case a reload of the book will revert the live patch in the browser
    However, the live patched version is canonical with respect to the topic
    repository, and users should not be penalised by waiting for a server-side
    file write.
    */
    notifyListenersOfPatch(url, id, topicID, newHtml, revision);

    console.log('Patching Topic ' + topicID + ' in Content Spec ' + id + '. File path: ' + bookFilePath);
    
    jsdom.env(bookFilePath, [process.cwd() + '/public/scripts/jquery-1.9.1.min.js'], function(err, window) { 
    
        var $ = window.$,
         // Number of times this topic is (re)used in this book - used to synchronize execution
        numTopicInstances = $('.pg-topic-id-' + topicID).length,
        count = 0,
        target;
        
        console.log('Live patch found ' + numTopicInstances + ' instances of topic %s in this book', topicID);
        // Patch each instance of the topic in the book, with its own title and section number
        $('.pg-topic-id-' + topicID).each(function() {
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
            
            // http://stackoverflow.com/questions/2644299/jquery-removeclass-wildcard
            target.removeClass(function (index, css) {
                return (css.match (/\bpg-topic-rev\S+/g) || []).join(' ');    
            }); // get rid of previous revision information
            
            target.addClass('pg-topic-rev-' + revision); // Add current revision

            /* TODO: Here's where we need to update topic revisions collection */

            count++;
    
            // If that's all, then we are going to persist the modified DOM 
            // and broadcast to all listeners
            if (count >= numTopicInstances) {
                 
                $('.jsdom').remove(); // remove the jsdom script tag
                
                //Persist changes to filesystem
        
                if (!my.filewriting) {
                    my.filewriting = true;
                    fs.writeFile(bookFilePath, window.document.outerHTML, function(err) {
                        my.filewriting = false;
                        if (err) return console.log('Error patching book ' + err);
                        my.topicRevisions[topicID] = revision;
                        console.log('Patched ' + bookFilePath + ' on disk');
                    });
                }
                
                // Update the topic revision map
                my.topicRevisions[topicID] = revision;
                jsondb.write(); // write the updated topic revisions map
                if (cb) cb();
            }
        });    
    });
}

/* Send the patch to the patchStream. Typically this gets to books in the browser because they are piping the 
  patchStream to a websocket through patchSubscribe in socketHandler.js */
function notifyListenersOfPatch(url, id, topicid, html, revision) {
    console.log('Patch notification broadcast to ' + url + ' ' + id);
    exports.patchStreams[url][id].write({
        topicID: topicid,
        html: html,
        revision: revision
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