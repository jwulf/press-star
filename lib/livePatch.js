var jsdom = require('jsdom').jsdom,
    fs = require('fs'),
    jsondb = require('./jsondb'),
    Stream = require('stream').Stream,
    TOPICS_FILE_PATH = process.cwd() + '/books/',
    TOPICS_FILE_NAME = 'topicDependencies.json',
    TOPICS_FILE = TOPICS_FILE_PATH + TOPICS_FILE_NAME;

exports.scanBook = scanBook;
exports.write = write;
exports.read =read;
exports.initialize = initialize;
exports.generateStreams = generateStreams;
exports.patch = patch;

function initialize(){
    exports.Topics
}

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

function scanBook(skynetURL, id, pathURL, pathURLAbsolute) {
    var buildData, endLoc, topicID;
    
    console.log('Generating Topic Dependencies for ' + pathURL);
    // Given pathURLAbsolute/index.html:
    
    // Nuke all the current subscriptions for this book
    for (var topic in exports.Topics[skynetURL]) {
        if (topic[pathURL]) delete topic[pathURL];    
    }
    
    // Now scan through the book and subscribe it to notifications for each topic in it
    jsdom.env(pathURLAbsolute + '/index.html', [process.cwd() + '/public/scripts/jquery-1.9.1.min.js'], function (err, window){
        window.$('.RoleCreateBugPara > a').each(function () {
            var target = window.$(this);
        
            // Get the topic ID from the bug link data
            buildData = url_query('cf_build_id', target.attr('href')) || 'undefined-';
            endLoc = buildData.indexOf('-');
            topicID = buildData.substr(0, endLoc);
    
            //console.log('Generating Topic Dependency Subscription for ' + topicID);
            // get topicID
            if (! exports.Topics[skynetURL])
                exports.Topics[skynetURL] = {};
            if (! exports.Topics[skynetURL][topicID]) 
                exports.Topics[skynetURL][topicID] = {};
        
            exports.Topics[skynetURL][topicID][pathURL] = true; 
            //console.log(exports.Topics);
        }); 
        write();         
    });
}


function patch(skynetURL, topicID, newHtml, cb){
    
    function patchBook(build) {
        var bookFilePath = process.cwd() + '/public/' + build  + '/index.html',
        specID = build.substring(build.indexOf('/') + 1, build.indexOf('-'));
        console.log('Patching Topic ' + topicID + ' in Content Spec ' + specID + 
            '. File path: ' + bookFilePath);
        jsdom.env(bookFilePath, [process.cwd() + '/public/scripts/jquery-1.9.1.min.js'], function (err, window){
            var $ = window.$;
            if (err) return console.log('error');
            var target = $('.sectionTopic' + topicID);
            if (!target) return;
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
    
            //Persist changes to filesystem
            
            var html = window.document.outerHTML;
            
            if (jsondb.Books[skynetURL] && jsondb.Books[skynetURL][specID] && !jsondb.Books[skynetURL][specID].locked) {
                jsondb.Books[skynetURL][specID].locked = true;
                fs.writeFile(bookFilePath, html, function(err) {
                    jsondb.Books[skynetURL][specID].locked = false;
                    if (err) return console.log ('Error patching book ' + err);
                    console.log('Patched ' + bookFilePath + ' on disk');
                });
            }
            
            // Send the patch to listeners
            console.log('Patch notification broadcast to ' + skynetURL + ' ' + specID);
            exports.patchStreams[skynetURL][specID].write({topicID: topicID, html: newHtml});    
        });
    }

    console.log('Patch received for ' + skynetURL + ' ' + topicID);
    var buildsThatUseThisPatch = exports.Topics[skynetURL][topicID];
    for (var build in buildsThatUseThisPatch) {
        patchBook(build);
    }
    
    if (cb) return cb();
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