var fs = require('fs'),
    spawn = require('child_process').spawn,
    async = require('async'),
    jsondb = require('./jsondb'),
    mv = require('mv'),
    carrier = require('carrier'),
    path = require('path'), 
    wrench = require('wrench'),
    humanize = require('humanize'),
    jsdom = require('jsdom').jsdom,
    livePatch = require('./../lib/livePatch'), 
    cylon = require('pressgang-cylon'), 
    url_query = require('./../lib/utils').url_query,
    ephemeral = require('./ephemeralStreams');
    
var MAX_SIMULTANEOUS_BUILDS = 2,
    BUILT_PUBLICAN_DIR = '/tmp/en-US/html-single',
    BUILDS_DIR = process.cwd() + '/public/builds/',
    BUILD_ERROR = true,
    LOG_HEADER = ephemeral.LOG_HEADER,
    LOG_CONSOLE = ephemeral.LOG_CONSOLE,
    LOG_TIMESTAMP = ephemeral.LOG_TIMESTAMP;
    
exports.build = build;

function build(url, id){
    var Books = jsondb.Books;
    var buildlogURLPath = path.normalize('/' + Books[url][id].bookdir + '/build.log'),
        buildlog = path.normalize(process.cwd() + '/' + buildlogURLPath);

    console.log('building: ' + url + ' ' + id);
    if (Books[url] && Books[url][id]){
        if (Books[url][id].locked)
            return;
            
        ephemeral.createStream('build', url, id, buildlog, function (err, uuid) {
            if (err) console.log(err);
            Books[url][id].buildlog = buildlog;
            Books[url][id].buildID = uuid;
            Books[url][id].locked = true;
            Books[url][id].buildError = false;
            buildBook(url, id);
        });
    } else {
        console.log('This book seems to have disappeared! Check it out again');
        throw new Error('This book seems to have disappeared! Check it out again');
    }
}

function buildBook(url, id) {
    var Books = jsondb.Books;
    var directory = Books[url][id].bookdir,
        uuid = Books[url][id].buildID;
    
        ephemeral.write(uuid, 'Build log for ' + url + ' Spec ID: ' + id + '\r\n' +
            Books[url][id].title + '\r\n' +
            humanize.date('Y-m-d H:i:s') + '\r\n', [LOG_HEADER, LOG_TIMESTAMP]);
            
        if (!fs.existsSync(directory))
        {
            console.log(directory + ' does not exist');
            ephemeral.write(uuid, directory + ' does not exist');
            return;
        }
        var stats = fs.statSync(directory);
        if (!stats.isDirectory()) {
            console.log(directory + ' is not a directory');
            ephemeral.write(uuid, directory + ' is not a directory');
            return;
        }
    
        // Check that a csprocessor.cfg file exists in the target location
        if (!fs.existsSync(directory + '/csprocessor.cfg')) {
            console.log('No csprocessor.cfg file found in ' + directory);
            exports.streams[uuid].write('No csprocessor.cfg file found in ' + directory, 'utf8');
            return;
        }
    
        ephemeral.write(uuid, 'Waiting in CSProcessor build queue... \r\n', [LOG_HEADER, LOG_TIMESTAMP]);
        Books[url][id].onQueue = true;
        csprocessorQueue.push({url: url,id: id});
}

var csprocessorQueue = async.queue(function(task, cb) {
    var Books = jsondb.Books;
    var url = task.url, id = task.id, uuid = jsondb.Books[url][id].buildID;
   
   ephemeral.write(uuid, 'CSProcessor assembly initiated and in progress\r\n', [LOG_HEADER]);
        Books[url][id].onQueue = false;
        // Requires csprocessor-0.30+
        // See: https://bugzilla.redhat.com/show_bug.cgi?id=861464
    var csprocessorBuildJob = spawn('csprocessor', ['build', '--force-bug-links'], {
        cwd: path.normalize(process.cwd() + '/' + jsondb.Books[url][id]['bookdir'])
    }).on('exit', function(err){
        ephemeral.write(uuid, 'Content Specification build task completed\r\n');
        if (err) {
            ephemeral.write(uuid,'Content Spec build task exited with error: ' + err, LOG_HEADER);
            console.log('CSprocessor assemble finished for ' + uuid);
            buildingFinished(url, id, BUILD_ERROR); 
        } else {
            unzipCSProcessorArtifact(url, id, cb)    
        } 
    });
    
    csprocessorBuildJob.stdout.setEncoding('utf8');
    console.log('Piping CSProcessor assemble to ' + uuid);
    csprocessorBuildJob.stdout.pipe(ephemeral.streams[uuid].stream);
}, MAX_SIMULTANEOUS_BUILDS);

function unzipCSProcessorArtifact(url, id, cb) {
    var Books = jsondb.Books;

    var directory = path.normalize(process.cwd() + '/' + Books[url][id].bookdir + '/assembly'),
        bookFilename = Books[url][id].title.split(' ').join('_'),
        zipfile = bookFilename + '-publican.zip',
        uuid = Books[url][id].buildID;
    
    Books[url][id].builtFilename = bookFilename;
    Books[url][id].publicanDirectory = directory + '/' + bookFilename;

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
            console.log('Zip finished for ' + uuid);
            ephemeral.write(uuid, 'CSProcessor assembled book unzipped\n'); 
            customizePublicancfg(url,id, cb);
        });

    zipjob.stdout.setEncoding('utf8');
    zipjob.stderr.setEncoding('utf8');
    console.log('Piping zip job output to ' + uuid);
    zipjob.stdout.pipe(ephemeral.streams[uuid].stream);
    zipjob.stderr.pipe(ephemeral.streams[uuid].stream);
}

function customizePublicancfg (url, id, cb) {
    var Books = jsondb.Books;
    var publicanConfig = 
        'xml_lang: en-US \n' + 'type: Book\n' + 'brand: deathstar\n' + 
        'chunk_first: 0\n' + 'git_branch: docs-rhel-6\n' + 
        'web_formats: "epub,html, html-single\n' + 
        'docname: ' + jsondb.Books[url][id].title + '\n' + 
        'product: ' + jsondb.Books[url][id].product + '\n';

    var directory = path.normalize(process.cwd() + '/' + jsondb.Books[url][id].bookdir + '/assembly'),
        bookFilename = jsondb.Books[url][id].bookFilename = jsondb.Books[url][id].title.split(' ').join('_'),
        publicanFile = directory + '/' + bookFilename + '/publican.cfg',
        uuid = Books[url][id].buildID;

    ephemeral.write(uuid, 'Customizing publican.cfg');
    
    fs.unlink(publicanFile, function (err){
        if (err) {
            ephemeral.write(uuid, err);
        } else {
            fs.writeFile(publicanFile, publicanConfig, 'utf8',  function(err) {
                if (err) {
                    console.log(err);
                }
                else {
                    ephemeral.write(uuid, 'Publican.cfg file customized\r\n', [LOG_HEADER, LOG_CONSOLE]);
                    console.log('Saved publican.cfg: ' + publicanFile);
                    ephemeral.write(uuid, 'Waiting in publican build queue... \r\n', LOG_HEADER);
                    Books[url][id].onQueue = true;
                    publicanQueue.push({url: url, id: id});
                    return cb();
                }
            });        
        }
    });
    
};

var publicanQueue = async.queue(function(task, cb) {
    var Books = jsondb.Books;
    var url = task.url, id = task.id,
    uuid = jsondb.Books[url][id].buildID;
    jsondb.Books[url][id].onQueue = false;
    console.log('Initiating Publican build');
    console.log(Books[url][id].publicanDirectory);
    ephemeral.write(uuid, 'Publican build initiated and in progress\r\n', LOG_HEADER);
    var publicanBuild = spawn('publican', ['build', '--formats', 'html-single', '--langs', 'en-US'], {
        cwd: Books[url][id].publicanDirectory
    }).on('exit', function(err) {
        ephemeral.write(uuid, 'Publican build complete\r\n', LOG_HEADER);
        ephemeral.write(uuid, 'Publican exited with code: ' + err, LOG_HEADER);
         console.log('Finished Publican job for ' + uuid);
        if (!err) { 
            publicanBuildComplete(url, id, cb) 
        } else { 
            ephemeral.write(uuid, 'Publican build error ' + err, [LOG_HEADER, LOG_CONSOLE]);
            buildingFinished(url, id, BUILD_ERROR); 
        }
    });
    publicanBuild.stdout.setEncoding('utf8');
    publicanBuild.stderr.setEncoding('utf8');
    console.log('Piping Publican output to ' + uuid);
    publicanBuild.stdout.pipe(ephemeral.streams[uuid].stream);
    publicanBuild.stderr.pipe(ephemeral.streams[uuid].stream);
}, MAX_SIMULTANEOUS_BUILDS);

function publicanBuildComplete(url, id, cb) {
    var Books = jsondb.Books;
    var pathURLAbsolute = BUILDS_DIR + id + '-' + Books[url][id].builtFilename,
        pathURL = 'builds/' + id + '-' + Books[url][id].builtFilename,
        uuid = Books[url][id].buildID;
    
    ephemeral.write(uuid, 'Moving built book to public directory');
    wrench.copyDirRecursive(jsondb.Books[url][id].publicanDirectory + BUILT_PUBLICAN_DIR, pathURLAbsolute, 
    function mvCallback (err){
        if (err) { ephemeral.write(uuid,err) 
        } else {
            
            // Write skynetURL and ID into javascript file for the deathstar brand to inject editor links
            // and for REST API calls related to this book

            var bookMetadata = 'var skynetURL="' + url +'", thisBookID = ' + id + ';';            
            fs.writeFile(pathURLAbsolute + '/Common_Content/scripts/skynetURL.js', 
                bookMetadata, 'utf8',  function(err) {
                if (err) {
                    ephemeral.write(uuid, 'Error writing skynetURL.js: ' + err, LOG_HEADER);
                    console.log(err);
                } else {                        
                    ephemeral.write(uuid, 'Wrote skynetURL.js');
                }
                // Check for fixed revision topics
                checkFixedRevisionTopics(url, id, pathURLAbsolute, function () {
                    livePatch.scanBook(url, id, pathURL, pathURLAbsolute);    
                });
                                
                if (cb) return cb(); 
            });        

        }
    });
}

function checkFixedRevisionTopics (url, id, bookPath, cb){
    var Books = jsondb.Books;
    var uuid = Books[url][id].buildID;
    console.log('Figuring out which topics are fixed revision');
    ephemeral.write(uuid, 'Checking for Fixed Revision Topics');
    cylon.getSpec(url, id, function (err, spec) {
        if (err) {
            ephemeral.write(uuid, 'Error retrieving Content Spec for Fixed Revision analysis: ' + err, LOG_HEADER);  
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
        ephemeral.write(uuid, 'Found ' + Object.getOwnPropertyNames(fixedRevTopics).length
            + ' fixed revision topics.');
        console.log('Found ' + Object.getOwnPropertyNames(fixedRevTopics).length
            + ' fixed revision topics.');
        deathStarItUp(url, id, bookPath, fixedRevTopics, cb); 
    });
}

function deathStarItUp(skynetURL, id, bookPath, fixedRevTopics, cb) {
    var Books = jsondb.Books;
    var buildData, endLoc, topicID, editorURL, section,editURL,
        uuid = Books[skynetURL][id].buildID;
    ephemeral.write(uuid, 'Rewriting Editor links');
    jsdom.env(bookPath + '/index.html', [process.cwd() + '/public/scripts/jquery-1.9.1.min.js'], function (err, window){
        // Now go through and modify the fixedRevTopics links
        // And deathstar it up while we're at it
        
        var uid = jsondb.Books[skynetURL][id].uid;
        if (err) {
            ephemeral.write(uuid, 'Error parsing HTML: '  + err);  
            console.log('Error parsing html: ' + err);
            return buildingFinished(skynetURL, id, BUILD_ERROR);
        }
        console.log('Death Starring it up in here!');
        var $ = window.$;
        editorURL = '/edit';  
        
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
        if (cb) return cb();
    });
}

function persistHtml(skynetURL, bookID, html) {
    var Books = jsondb.Books;
    var filePath = process.cwd() + '/public/builds/' + bookID + '-' + jsondb.Books[skynetURL][bookID].title.split(' ').join('_') + '/index.html',
        uuid = Books[skynetURL][bookID].buildID;
        
    // If the book is not rebuilding, then write the html to path

    fs.writeFile(filePath, html, function(err) {
        if(err) {
            console.log(err);
            ephemeral.write(uuid, 'Error writing HTML to disk');
            return buildingFinished(skynetURL, bookID, BUILD_ERROR);
        } else {
            console.log('Updated ' + filePath);
            ephemeral.write(uuid, 'Wrote updated HTML to disk\r\n');
            return buildingFinished(skynetURL, bookID);
        }
    }); 
}

function buildingFinished(url, id, err) {
    var Books = jsondb.Books;   
    var pathURLAbsolute = BUILDS_DIR + id + '-' + jsondb.Books[url][id].builtFilename,
        uuid = Books[url][id].buildID;
    // Building is finished 
    Books[url][id].buildError = err;
    ephemeral.write(uuid, 'Building finished for ' + url + ' ' + id);
    // Move build log to URL-accessible location
    var dest = pathURLAbsolute + '/build.log';
    mv(jsondb.Books[url][id].buildlog, dest, function(err) {
            if (err) return console.log(err); 
            console.log('Moved ' + jsondb.Books[url][id].buildlog + ' to ' +  dest);
        });
               
    Books[url][id].buildID = null;                
    Books[url][id].locked = false;
    if (err) Books[url][id].builderror = true;
    if (err) {
        livePatch.patchStreams[url][id].write({notification: true, data: {title: 'Build Error', 
            msg: 'There was an error rebuilding. Check the <a target="_blank" href="/builds/' + id + '-' + 
            Books[url][id].builtFilename + '/build.log">build log for this book</a>.'}})   
    } else {
        livePatch.patchStreams[url][id].write({bookRebuilt: true});
    }
    console.log('Deleting stream for ' + Books[url][id].buildID);
    ephemeral.retire(uuid);
    jsondb.write();
}