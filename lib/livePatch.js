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

exports.scanBook = scanBook;
exports.write = write;
exports.read =read;
exports.initialize = initialize;
exports.generateStreams = generateStreams;
exports.patch = patch;
exports.replayBuffer = {}; // replay buffer for live patches performed while a book is building
exports.playBuffer = playBuffer;
exports.patchRESTendpoint = patchRESTendpoint,
exports.removeTopicDependenciesForBook = removeTopicDependenciesForBook;


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



*/
function patchStreamWrite (data) {
    if (data)
        this.emit('data', data);
    return true;
};

function generateStreams(cb){
    console.log('Patch Stream generation');
    if (! exports.patchStreams) exports.patchStreams = {};

    for (var skynetURL in jsondb.Books) {
        if (! exports.patchStreams[skynetURL])
            exports.patchStreams[skynetURL] = {};
        for (var specID in jsondb.Books[skynetURL]) {
            if (! exports.patchStreams[skynetURL][specID]) {
                exports.patchStreams[skynetURL][specID] = new Stream();
                exports.patchStreams[skynetURL][specID].writable = exports.patchStreams[skynetURL][specID].readable = true;
                exports.patchStreams[skynetURL][specID].write = patchStreamWrite;
                console.log('Patch notification stream generated for Content Spec: ' + skynetURL + ' ' + specID);
            }
        }
    }
    if (cb) return cb();
}

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

function initialize(){
    read();
}

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

function scanBook(url, id, htmlToScan, cb) {
    /* Scan the file at htmlToScan and construct a topic dependency map */
    var topicID, count = 0,
        my = jsondb.Books[url][id],
        uuid = my.buildID;

    ephemeral.write(uuid, 'Generating Topic Dependencies for ' + htmlToScan, LOG_CONSOLE);

    if (!exports.Topics) exports.Topics = {};

    // Nuke all the current subscriptions for this book
    if (exports.Topics[url]) for (var topic in exports.Topics[url])
        if (topic[id]) delete topic[id];

    // Now scan through the book and subscribe it to notifications for each topic in it
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

// Needs to use async.series!
/* We have to play the dirty patches back in sequence, because it's likely that some of them are updates to the same content. */

function composePatch (url, id, topicid, html) {
    var REPLAYING = true;
    return function (callback) {
        patchBook(url, id, topicid, html, REPLAYING, function(){callback();});
    }
}

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
        
        var patchset = {};
        for (var patches = 0; patches < patchCount; patches ++ ){
            patch = exports.replayBuffer[url][id][patches];
            patchset[patches] = composePatch(url, id, patch.topicID, patch.html);
        }
        
        async.series(patchset, cb); 
         // If this crazy shizzle works, then (a) I'm even more awesome than I thought
        // and (b), I can refactor this inside a single DOM load with a single file write, for great
        // performance and justice
            
           // Screw performance and screw safety - at least in the first cut.
           // The best way to do it would be to load the DOM once, then replay the patches within that context
           
           // If I could create a function for each patch, then I could pass those functions to async.series
           // The DOM load per patch is going to be expensive. Maybe cheerio will be faster. Try that first, then the 
           // function per patch generation.
           
           // They have to be synchronous. Imagine two patches updating the same topic out of sync, or at the same time!
    } else {
        ephemeral.write(uuid, 'No dirty patch buffer found', LOG_CONSOLE);
        if (cb) cb();
    }
} 

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