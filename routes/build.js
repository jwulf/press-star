var fs = require('fs'),
    spawn = require('child_process').spawn,
    async = require('async'),
    jsondb = require('./../lib/jsondb'),
    mv = require('mv'),
    carrier = require('carrier'),
    path = require('path'), 
    Stream = require('stream').Stream,
    wrench = require('wrench'),
    humanize = require('humanize'),
    jsdom = require('jsdom').jsdom,
    livePatch = require('./../lib/livePatch'), 
    cylon = require('pressgang-cylon'), 
    url_query = require('./../lib/utils').url_query;
    
var MAX_SIMULTANEOUS_BUILDS = 2,
    BUILT_PUBLICAN_DIR = '/tmp/en-US/html-single',
    BUILDS_DIR = process.cwd() + '/public/builds/',
    BUILD_ERROR = true;
    
exports.streams = { }; 
exports.streamHeader = {};
exports.build = build;

function build(url, id){
    console.log('building: ' + url + ' ' + id);
    if (jsondb.Books[url] && jsondb.Books[url][id]){
        if (jsondb.Books[url][id].locked)
            return;
        jsondb.Books[url][id].locked = true;
        jsondb.Books[url][id].buildError = false;
        buildBook(url, id);
    } else {
        console.log('This book seems to have disappeared! Check it out again');
        throw new Error('This book seems to have disappeared! Check it out again');
    }
}

function buildBook(url, id) {
    var directory = jsondb.Books[url][id].bookdir,
        uid = jsondb.Books[url][id].buildID;
        
    // This stream can be located in the array using the buildID property of the book
    // It can then be connected to a websocket to see what is happening
    exports.streams[uid] = new Stream();
    exports.streams[uid].writable = exports.streams[uid].readable = true;
    exports.streamHeader[uid] = 'Build log for ' + url + ' Spec ID: ' + id + '\r\n' +
        jsondb.Books[url][id].title + '\r\n' +
        humanize.date('Y-m-d H:i:s') + '\r\n';
    exports.streams[uid].end = function(data){ if (data) console.log(data);
    console.log('That was the end of that part');};
    exports.streams[uid].write = function (data) {
        if (data)
            this.emit('data', data);
            // console.log('stream listener: ' + data);
        return true;
    };
    
    // We also pipe all the output to a file, so that it is persistent
    
    var buildlogURLPath = path.normalize('/' + jsondb.Books[url][id].bookdir + '/build.log');
    var buildlogFilepath = path.normalize(process.cwd() + '/' + buildlogURLPath)
    jsondb.Books[url][id].buildlog = buildlogFilepath;
    
    if (fs.existsSync(buildlogFilepath))
        fs.unlinkSync(buildlogFilepath);
        
    console.log('Creating build log: ' + buildlogFilepath);
    jsondb.Books[url][id].buildlogStream = fs.createWriteStream(buildlogFilepath, {end: false});

    // Pipe the ephemeral stream into this filestream
    exports.streams[uid].pipe(jsondb.Books[url][id].buildlogStream);
    
    exports.streams[uid].write('Build log for ' + url + ' Spec ID: ' + id + '\r\n')
    exports.streams[uid].write(jsondb.Books[url][id].title + '\r\n');
    exports.streams[uid].write(humanize.date('Y-m-d H:i:s') + '\r\n');

    console.log('Logging build to ' + buildlogFilepath);
 
    if (!fs.existsSync(directory))
    {
        console.log(directory + ' does not exist');
        exports.streams[uid].write(directory + ' does not exist', 'utf8');
        return;
    }
    var stats = fs.statSync(directory);
    if (!stats.isDirectory()) {
        console.log(directory + ' is not a directory');
        exports.streams[uid].write(directory + ' is not a directory', 'utf8');
        return;
    }

    // Check that a csprocessor.cfg file exists in the target location
    if (!fs.existsSync(directory + '/csprocessor.cfg')) {
        console.log('No csprocessor.cfg file found in ' + directory);
        exports.streams[uid].write('No csprocessor.cfg file found in ' + directory, 'utf8');
        return;
    }

    exports.streamHeader[uid] = exports.streamHeader[uid] + 'Waiting in CSProcessor build queue... \r\n';
    exports.streams[uid].write('Waiting in CSProcessor build queue... \r\n');
    jsondb.Books[url][id].onQueue = true;
    csprocessorQueue.push({url: url,id: id});
}

var csprocessorQueue = async.queue(function(task, cb) {
    var url = task.url, id = task.id, uid = jsondb.Books[url][id].buildID;
   
   exports.streamHeader[uid] = exports.streamHeader[uid] + 'CSProcessor assembly initiated and in progress\r\n';
        jsondb.Books[url][id].onQueue = false;
    var csprocessorBuildJob = spawn('csprocessor', ['build'], {
        cwd: path.normalize(process.cwd() + '/' + jsondb.Books[url][id]['bookdir'])
    }).on('exit', function(err){
        exports.streamHeader[uid] = exports.streamHeader[uid] + 'Content Specification build task completed\r\n';
        if (err) {
            exports.streamHeader[uid] = exports.streamHeader[uid] + 'Content Spec build task exited with error: ' + err;
            exports.streamHeader[uid].write('Content Spec build task exited with error: ' + err);
            finish
        } else {
            unzipCSProcessorArtifact(url, id, cb)    
        } 
    });
    
    csprocessorBuildJob.stdout.setEncoding('utf8');
    csprocessorBuildJob.stdout.pipe(exports.streams[uid]);
}, MAX_SIMULTANEOUS_BUILDS);

function unzipCSProcessorArtifact(url, id, cb) {

    var directory = path.normalize(process.cwd() + '/' + jsondb.Books[url][id].bookdir + '/assembly'),
        bookFilename = jsondb.Books[url][id].title.split(' ').join('_'),
        zipfile = bookFilename + '-publican.zip',
        uid = jsondb.Books[url][id].buildID;
    
    jsondb.Books[url][id].builtFilename = bookFilename;
    jsondb.Books[url][id].publicanDirectory = directory + '/' + bookFilename;

    console.log('Unzipping publican book in ' + directory);
    
    if (!fs.existsSync(directory + '/' + zipfile))
    {
        console.log(zipfile + ' not found.');
        return;
    }
    console.log(directory);
    var zipjob = spawn('unzip', ['-o', zipfile], {
        cwd: directory
    }).on('exit', function(err) {
            exports.streamHeader[uid] = exports.streamHeader[uid] + 'CSProcessor assembled book unzipped\n'; 
            customizePublicancfg(url,id, cb);
        });

    zipjob.stdout.setEncoding('utf8');
    zipjob.stderr.setEncoding('utf8');
    zipjob.stdout.pipe(exports.streams[uid])
    zipjob.stderr.pipe(exports.streams[uid])
}

function customizePublicancfg (url, id, cb) {
    var publicanConfig = 
        'xml_lang: en-US \n' + 'type: Book\n' + 'brand: deathstar\n' + 
        'chunk_first: 0\n' + 'git_branch: docs-rhel-6\n' + 
        'web_formats: "epub,html, html-single\n' + 
        'docname: ' + jsondb.Books[url][id].title + '\n' + 
        'product: ' + jsondb.Books[url][id].product + '\n';

    var directory = path.normalize(process.cwd() + '/' + jsondb.Books[url][id].bookdir + '/assembly'),
        bookFilename = jsondb.Books[url][id].bookFilename = jsondb.Books[url][id].title.split(' ').join('_'),
        publicanFile = directory + '/' + bookFilename + '/publican.cfg',
        uid = jsondb.Books[url][id].buildID;

    exports.streams[uid].write('Customizing publican.cfg', 'utf8');
    
    fs.unlink(publicanFile, function (err){
        if (err) {
            exports.streams[uid].write(err);
        } else {
            fs.writeFile(publicanFile, publicanConfig, 'utf8',  function(err) {
                if (err) {
                    console.log(err);
                }
                else {
                    exports.streamHeader[uid] = exports.streamHeader[uid] + 'Publican.cfg file customized\r\n';
                    console.log('Saved publican.cfg: ' + publicanFile);
                    exports.streamHeader[uid] = exports.streamHeader[uid] + 'Waiting in publican build queue... \r\n';
                    exports.streams[uid].write('Waiting in publican build queue... \r\n');
                    jsondb.Books[url][id].onQueue = true;
                    publicanQueue.push({url: url, id: id});
                    return cb();
                }
            });        
        }
    });
    
};

var publicanQueue = async.queue(function(task, cb) {
    var url = task.url, id = task.id,
    uid = jsondb.Books[url][id].buildID;
    jsondb.Books[url][id].onQueue = false;
    console.log('Initiating Publican build');
    console.log(jsondb.Books[url][id].publicanDirectory);
    exports.streamHeader[uid] = exports.streamHeader[uid] + 'Publican build initiated and in progress\r\n';
    var publicanBuild = spawn('publican', ['build', '--formats', 'html-single', '--langs', 'en-US'], {
        cwd: jsondb.Books[url][id].publicanDirectory
    }).on('exit', function(err) {
        exports.streamHeader[uid] = exports.streamHeader[uid] + 'Publican build complete\r\n';
        exports.streamHeader[uid] = exports.streamHeader[uid] + 'Publican exited with code: ' + err;
        if (!err) { 
            publicanBuildComplete(url, id, cb) 
        } else { 
            console.log('Publican build error ' + err);
            exports.streams[uid].write('Publican build error ' + err)
            buildingFinished(url, id, BUILD_ERROR); 
        }
    });
    publicanBuild.stdout.setEncoding('utf8');
    publicanBuild.stderr.setEncoding('utf8');
    publicanBuild.stdout.pipe(exports.streams[uid]);
    publicanBuild.stderr.pipe(exports.streams[uid]);
}, MAX_SIMULTANEOUS_BUILDS);


function streamWrite(url, id, msg){
    if (exports.streams[jsondb.Books[url][id].buildID])
        exports.streams[jsondb.Books[url][id].buildID].write(msg);
}

function publicanBuildComplete(url, id, cb) {
    var pathURLAbsolute = BUILDS_DIR + id + '-' + jsondb.Books[url][id].builtFilename,
        pathURL = 'builds/' + id + '-' + jsondb.Books[url][id].builtFilename;
    
    streamWrite(url, id, 'Moving built book to public directory');
    wrench.copyDirRecursive(jsondb.Books[url][id].publicanDirectory + BUILT_PUBLICAN_DIR, pathURLAbsolute, 
    function mvCallback (err){
        if (err) { exports.streams[jsondb.Books[url][id].buildID].write(err) 
        } else {
            
            // Write skynetURL and ID into javascript file for the deathstar brand to inject editor links
            // and for REST API calls related to this book

            var bookMetadata = 'var skynetURL="' + url +'", thisBookID = ' + id + ';';            
            fs.writeFile(pathURLAbsolute + '/Common_Content/scripts/skynetURL.js', 
                bookMetadata, 'utf8',  function(err) {
                if (err) {
                    streamWrite(url, id, 'Error writing skynetURL.js: ' + err);
                    console.log(err);
                } else {                        
                    streamWrite(url, id, 'Wrote skynetURL.js');
                }
                // Check for fixed revision topics
                checkFixedRevisionTopics(url, id, pathURLAbsolute, function () {
                    livePatch.scanBook(url, id, pathURL, pathURLAbsolute);    
                });
                
                 
                
                return cb(); 
            });        

        }
    });
}

function checkFixedRevisionTopics (url, id, bookPath, cb){
    console.log('Figuring out which topics are fixed revision');
    cylon.getSpec(url, id, function (err, spec) {
       var uid = jsondb.Books[url][id].uid;
       
        if (err) {
            exports.streamHeader[uid].write('Error retrieving Content Spec for Fixed Revision analysis: ' + err);  
            console.log('Error getting spec: ' + err);
            return buildingFinished(url, id, BUILD_ERROR);
        }
        
        console.log('Got the content spec');
        
        var fixedRevTopic,
            fixedRevision,
            contentspec = spec.split("\n"),
            fixedRevTopics = {},
            line;
        
        for (var lines = 0; lines < contentspec.length; lines ++) {
            line = contentspec[lines];
            if (line.indexOf('#')  !== 0) { // ignore commented lines
                if (line.indexOf(', rev: ') !== -1) {     
                    fixedRevision = line.substring(line.indexOf(', rev:') + 7, line.length - 1);
                    var startLoc = line.indexOf('[') + 1,
                    offset = line.indexOf(', rev:') - startLoc;
                    fixedRevTopic = line.substr(startLoc, offset);
                    console.log('Found a fixed rev topic: ' + fixedRevTopic);
                    fixedRevTopics[fixedRevTopic] = fixedRevision;
                } 
            }
        }
        console.log('Found ' + Object.getOwnPropertyNames(fixedRevTopics).length
            + ' fixed revision topics.');
        deathStarItUp(url, id, bookPath, fixedRevTopics, cb); 
    });
}

function deathStarItUp(skynetURL, id, bookPath, fixedRevTopics, cb) {
    var buildData, endLoc, topicID, editorURL, section,editURL;
    jsdom.env(bookPath + '/index.html', [process.cwd() + '/public/scripts/jquery-1.9.1.min.js'], function (err, window){
        // Now go through and modify the fixedRevTopics links
        // And deathstar it up while we're at it
        
        var uid = jsondb.Books[skynetURL][id].uid;
        if (err) {
            exports.streamHeader[uid].write('Error parsing HTML: '  + err);  
            console.log('Error parsing html: ' + err);
            return buildingFinished(skynetURL, id, BUILD_ERROR);
        }
        console.log('Death Starring it up in here!');
        var $ = window.$;
        editorURL = '/edit.html';  
        
        // rewrite bug links as editor links
        $('.RoleCreateBugPara > a').each(function () {
            var target = $(this);
        
            // Get the topic ID from the bug link data
            //console.log(target.attr('href'));
            buildData = url_query('cf_build_id', target.attr('href')) || 'undefined-';
            endLoc = buildData.indexOf('-');
            topicID = buildData.substr(0, endLoc);
            
            if (fixedRevTopics[topicID]) { // This is a Fixed Revision Topic
            
                //console.log('Fixed Rev topic: ' + topicID);
                
                section = target.parent('.RoleCreateBugPara');
                section.removeClass('RoleCreateBugPara');
                section.addClass('fixedRevTopic');
                target.attr('target', '_blank');
                target.text('Rev: ' + fixedRevTopics[topicID]);
                editURL = 'https://skynet.usersys.redhat.com:8443/TopicIndex/Topic.seam?topicTopicId=' 
                    + topicID + '&topicRevision=' + fixedRevTopics[topicID];
                target.attr('href', editURL);
                
                // Identify the bug link, to allow us to preserve it when updating the DOM
                $(target.parents('.simplesect')).addClass('bug-link');
                // Identify the div containing the Topic as a topic, and uniquely with the Topic ID
                $(target.parents('.section')[0]).addClass('sectionTopic sectionTopic' + topicID);            
            } else {
             /*
                Get the section number of the topic in the built book.
                This is done to pass to the editor. The editor passes it to the HTML preview service.
                The HTML preview service passes it to xsltproc, which uses it to render the HTML
                preview with the correct section number for the book.
            */
                
                var titlehtml = $(target.parents('.section')[0]).find('.title').html(),
                    sectionIndex = titlehtml.indexOf('</a>'),
                    titleWords = titlehtml.substr(sectionIndex + 4),
                    sectionNumber = titleWords.substr(0, titleWords.indexOf('&nbsp;'));
        
                editURL = editorURL + '?skyneturl=' + skynetURL + '&topicid=' + topicID
                    + '&sectionNum=' + sectionNumber; 
                target.attr('href', editURL);
                target.attr('target', 'new');
                target.addClass('edittopiclink');
                target.text('Edit');
            
                // Identify the bug link, to allow us to preserve it when updating the DOM
                $(target.parents('.simplesect')).addClass('bug-link');
                // Identify the div containing the Topic as a topic, and uniquely with the Topic ID
                $(target.parents('.section')[0]).addClass('sectionTopic sectionTopic' + topicID);            
            }         
        });
        // Remove the jsdom script tag
        $('.jsdom').remove();
        persistHtml(skynetURL, id, window.document.outerHTML);
        buildingFinished(skynetURL, id);
        if (cb) return cb();
    });
}

function persistHtml(skynetURL, bookID, html) {
    var filePath = process.cwd() + '/public/builds/' + bookID + '-' + jsondb.Books[skynetURL][bookID].title.split(' ').join('_') + '/index.html';
        
    // If the book is not rebuilding, then write the html to path

    fs.writeFile(filePath, html, function(err) {
        if(err) {
            console.log(err);
        } else {
            console.log('Updated ' + filePath);
        }
    }); 
}

function buildingFinished(url, id, err) {
    var pathURLAbsolute = BUILDS_DIR + id + '-' + jsondb.Books[url][id].builtFilename
    // Building is finished 
    jsondb.Books[url][id].buildError = err;
    streamWrite(url, id, 'Building finished for ' + url + ' ' + id);
    // Move build log to URL-accessible location
    var dest = pathURLAbsolute + '/build.log';
    mv(jsondb.Books[url][id].buildlog, dest, function(err) {
            if (err) return console.log(err); 
            console.log('Moved ' + jsondb.Books[url][id].buildlog + ' to ' +  dest);
        });
               
    jsondb.Books[url][id].buildID = null;                
    jsondb.Books[url][id].locked = false;
    if (err) jsondb.Books[url][id].builderror = true;
    delete exports.streams[jsondb.Books[url][id].buildID];
    delete jsondb.Books[url][id].buildlogStream;
    jsondb.write();
}