var fs = require('fs'),
    spawn = require('child_process').spawn,
    async = require('async'),
    jsondb = require('./Books'),
    mv = require('mv'),
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
    PUBLIC_BUILDS_DIR = process.cwd() + '/public/builds/',
    BUILD_ERROR = true,
    LOG_HEADER = ephemeral.LOG_HEADER,
    LOG_CONSOLE = ephemeral.LOG_CONSOLE,
    LOG_TIMESTAMP = ephemeral.LOG_TIMESTAMP;
    
exports.build = build;

/* Building is mediated by two async queues that allow MAX_SIMULTANEOUS BUILDS jobs each.
    One queue handles csprocessor assembly, the other publican builds. You may get better performance
    by allowing only one build at a time.
*/

function build(url, id){ 
/* Check that the book exists on this server and is not already building
    Set up some metadata related to building, then trigger the actual build.
*/
    var Books = jsondb.Books;
    
    // Check that the book exists in our metadata repository before attempting to build
    if (Books[url] && Books[url][id]){
    var my =Books[url][id],
        buildlog = path.normalize(process.cwd() + '/' + my.bookdir + '/build.log');

        if (my.locked) // Prevent the same book building twice at the same time
            return console.log('%s %s is already building', url, id);
            
        /* The ephemeral stream allows web browsers to watch the build process via a websocket   
            The buildlog parameter creates a file writer, so we have a build log on disk too.
        */
        ephemeral.createStream('build', url, id, buildlog, function (err, uuid) {
            if (err) console.log(err);
            console.log('UUID for the build job: ' + uuid);
            
            /* A Book emits events when its metadata is changed. This allows web browsers
              to reactively update real-time views of the state of books. setMany emits
              a single event. Otherwise the Book would emit one event for each field that is
              updated, causing multiple transmissions to clients, and multiple client-side updates.
            */
            my.setMany({
                buildlog: buildlog,
                buildID:  uuid,
                buildStreamURL: '/buildlog.html?buildid=' + uuid,
                locked:  true,
                buildError: false
            });
            buildBook(url, id);
        });
    } else {
        console.log('This book seems to have disappeared! Check it out again');
        throw new Error('This book seems to have disappeared! Check it out again');
    }
}

function buildBook(url, id) {
    var my = jsondb.Books[url][id];
    var directory = my.bookdir,
        uuid = my.buildID;
    
        // The ephemeral stream is a live view of the build process for web browsers
        // to stream via a websocket
        ephemeral.write(uuid, 'Build log for ' + url + ' Spec ID: ' + id + '\r\n' +
            my.title + '\r\n' +
            humanize.date('Y-m-d H:i:s') + '\r\n', [LOG_HEADER, LOG_TIMESTAMP]);
            
        /* 
            I'm not sure what situation would cause these errors, but checking for them just in case  
        */
        if (!fs.existsSync(directory))
        {
            console.log(directory + ' does not exist');
            ephemeral.write(uuid, directory + ' does not exist');
            return buildingFinished(url, id, BUILD_ERROR);
        }
        var stats = fs.statSync(directory);
        if (!stats.isDirectory()) {
            console.log(directory + ' is not a directory');
            ephemeral.write(uuid, directory + ' is not a directory');
            return buildingFinished(url, id, BUILD_ERROR);
        }
    
        // Check that a csprocessor.cfg file exists in the target location
        if (!fs.existsSync(directory + '/csprocessor.cfg')) {
            console.log('No csprocessor.cfg file found in ' + directory);
            exports.streams[uuid].write('No csprocessor.cfg file found in ' + directory, 'utf8');
            return buildingFinished(url, id, BUILD_ERROR);
        }
    
        /* Push the job into the csprocessor build queue. This queue allows a maximum of MAX_SIMULTANEOUS_BUILDS. */
        ephemeral.write(uuid, 'Waiting in CSProcessor build queue... \r\n', [LOG_HEADER, LOG_TIMESTAMP]); 
        my.set('onQueue', true);
        csprocessorQueue.push({url: url,id: id});
}

var csprocessorQueue = async.queue(function(task, cb) {
    var Books = jsondb.Books,
    url = task.url, id = task.id, my = Books[url][id], uuid = my.buildID;
   
    ephemeral.write(uuid, 'CSProcessor assembly initiated and in progress\r\n', [LOG_HEADER]);
    
    /* Set the book metadata to alert interested parties, like the server and client-side control panels */
    my.set('onQueue', false);
    
    /* Requires csprocessor-0.30+ to support the --force-bug-links option.
     See: https://bugzilla.redhat.com/show_bug.cgi?id=861464 */
    var csprocessorBuildJob = spawn('csprocessor', ['build', '--force-bug-links'], {
        cwd: path.normalize(process.cwd() + '/' + my.bookdir)
    }).on('exit', function(err){
        ephemeral.write(uuid, 'Content Specification build task completed\r\n');
        
        // If something went wrong, abort now and raise an error
        if (err) {
            ephemeral.write(uuid,'Content Spec build task exited with error: ' + err, LOG_HEADER);
            console.log('CSprocessor assemble finished for ' + uuid);
            cb(); // Call cb() to free this slot in the async queue
            return buildingFinished(url, id, BUILD_ERROR); 
        } else {
            // If everything OK, start unzipping the csprocessor output zip file
            unzipCSProcessorArtifact(url, id, cb)    
        } 
    });
    
    /* Pipe the spawned process' output into the ephemeral stream to get a visible 
        stream and a build log on disk. */
    csprocessorBuildJob.stdout.setEncoding('utf8');
    console.log('Piping CSProcessor assemble to ' + uuid);
    csprocessorBuildJob.stdout.pipe(ephemeral.streams[uuid].stream);
}, MAX_SIMULTANEOUS_BUILDS);

function unzipCSProcessorArtifact(url, id, cb) {
    var my = jsondb.Books[url][id];

    var directory = path.normalize(process.cwd() + '/' + my.bookdir + '/assembly'),
        bookFilename = my.title.split(' ').join('_'),
        zipfile = bookFilename + '-publican.zip',
        uuid = my.buildID;
    
    my.setMany({ 
        builtFilename: bookFilename, 
        publicanDirectory: directory + '/' + bookFilename
    });

    ephemeral.write(uuid, 'Unzipping publican book in ' + directory, LOG_HEADER);
    
    // Abort if zip file does not exist
    if (!fs.existsSync(directory + '/' + zipfile))
    {
        ephemeral.write(uuid, zipfile + ' not found.');
        cb(); // Call cb() to free this slot in the async queue
        return buildingFinished(url, id, BUILD_ERROR); 
    }
    
    // Spawn an unzip process
    var zipjob = spawn('unzip', ['-o', zipfile], {
        cwd: directory
    }).on('exit', function(err) { // executed when job exits
        
            if (err) { // Disk full, probably
                ephemeral.write(uuid, 'Error unzipping file: ' + err);
                cb(); // release this async slot
                return buildingFinished(url, id, BUILD_ERROR); 
            } else { // kinda superfluous with the return above, but clear
                ephemeral.write(uuid, 'CSProcessor assembled book unzipped\n'); 
                customizePublicancfg(url,id, cb);
            }
        });

    // Asynchronous, so executed immediately when job is spawned.
    /* Pipe spawned unzip job output to the ephemeral stream for interested parties
        and the build log. */
    zipjob.stdout.setEncoding('utf8');
    zipjob.stderr.setEncoding('utf8');
    zipjob.stdout.pipe(ephemeral.streams[uuid].stream);
    zipjob.stderr.pipe(ephemeral.streams[uuid].stream);
}

function customizePublicancfg (url, id, cb) {
    /* We customize the publican.cfg file to get the book to build with the
        publican-deathstar brand */
        
    var my = jsondb.Books[url][id];
    
    // Our customized publican config file
    var publicanConfig = 
        'xml_lang: en-US \n' + 'type: Book\n' + 'brand: deathstar\n' + 
        'chunk_first: 0\n' + 'git_branch: docs-rhel-6\n' + 
        'web_formats: "epub,html, html-single\n' + 
        'docname: ' + my.title + '\n' + 
        'product: ' + my.product + '\n';

    var directory = path.normalize(process.cwd() + '/' + my.bookdir + '/assembly'),
        bookFilename = my.bookFilename = my.title.split(' ').join('_'),
        publicanFile = directory + '/' + bookFilename + '/publican.cfg',
        uuid = my.buildID;

    ephemeral.write(uuid, 'Customizing publican.cfg');
    
    // Begin by deleting the existing publican.cfg file
    fs.unlink(publicanFile, function (err){
        if (err) { // error deleting existing publican.cfg
            ephemeral.write(uuid, 'Error deleting the existing publican.cfg file during customization: ' + err);
            cb(); // Release this async slot
            return buildingFinished(url, id, BUILD_ERROR); // and bail 
        } else {
            
            // Successfully deleted existing file, now write the custom one
            fs.writeFile(publicanFile, publicanConfig, 'utf8',  function(err) {
                if (err) { // error writing custom publican.cfg
                    ephemeral.write(uuid, 'Error writing the custom publican.cfg file during customization: ' + err);
                    cb(); // Release this async slot
                    return buildingFinished(url, id, BUILD_ERROR); // and bail 
                }
                else { // All good, release this slot and push job to publican build queue
                    ephemeral.write(uuid, 'Publican.cfg file customized\r\n', [LOG_HEADER, LOG_CONSOLE]);
                    ephemeral.write(uuid, 'Waiting in publican build queue... \r\n', LOG_HEADER);
                    my.set('onQueue', true); // We're on the Publican queue now
                    // Push to Publican queue
                    publicanQueue.push({url: url, id: id});
                    return cb(); // Free this slot in the csprocessor async queue
                }
            });        
        }
    });
    
};

var publicanQueue = async.queue(function(task, cb) {

    var url = task.url, 
        id = task.id, 
        my = jsondb.Books[url][id],
        uuid = my.buildID;
        
    my.onQueue = false;

    ephemeral.write(uuid, 'Publican build initiated and in progress\r\n', LOG_HEADER);
                        
    var publicanBuild = spawn('publican', ['build', '--formats', 'html-single', '--langs', 'en-US'], {
        cwd: my.publicanDirectory
    }).on('exit', function(err) {
        ephemeral.write(uuid, 'Publican build complete\r\n', LOG_HEADER);
        ephemeral.write(uuid, 'Publican exited with code: ' + err, LOG_HEADER);
         console.log('Finished Publican job for ' + uuid);
        if (!err) { 
            // If everything went OK, move to the next stage of assembly
            publicanBuildComplete(url, id, cb); 
        } else { // error during Publican build
            ephemeral.write(uuid, 'Publican build error ' + err, [LOG_HEADER, LOG_CONSOLE]);
            cb(); // Release this async slot
            return buildingFinished(url, id, BUILD_ERROR); // and bail 
        }
    });

    /* Pipe publican build output to interested parties and the build log via ephemeral stream */
    publicanBuild.stdout.setEncoding('utf8');
    publicanBuild.stderr.setEncoding('utf8');
    publicanBuild.stdout.pipe(ephemeral.streams[uuid].stream);
    publicanBuild.stderr.pipe(ephemeral.streams[uuid].stream);
}, MAX_SIMULTANEOUS_BUILDS);

function publicanBuildComplete(url, id, cb) {
    var my = jsondb.Books[url][id],
        MY_PUBLIC_BUILD = PUBLIC_BUILDS_DIR + id + '-' + my.builtFilename,
        MY_PUBLIC_BUILD_RELATIVE = 'builds/' + id + '-' + my.builtFilename,
        uuid = my.buildID;
    
    ephemeral.write(uuid, 'Moving built book to public directory');
    
    // Copy the built html over to the public builds directory for the web server
    wrench.copyDirRecursive(my.publicanDirectory + BUILT_PUBLICAN_DIR, MY_PUBLIC_BUILD, 
    function mvCallback (err){
        if (err) { // Probably disk full, or deleted public directory
            ephemeral.write(uuid, 'Error copying built html to public directory: ' + err); 
            cb(); // Free the async slot
            return buildingFinished(url, id, BUILD_ERROR); // and bail 
        } else {
            
            // Write skynetURL and ID into javascript file for the deathstar brand to inject editor links
            // and for REST API calls related to this book

            var bookMetadata = 'var skynetURL="' + url +'", thisBookID = ' + id + ';';            
            fs.writeFile(MY_PUBLIC_BUILD + '/Common_Content/scripts/skynetURL.js', 
                bookMetadata, 'utf8',  function(err) {
                if (err) { // Disk full maybe?
                
                    /* At this point the book has been published and has replaced the existing build
                        but it's broken. No control panel integration without its identity.
                        
                        Refactor this code to attempt this write before doing the copy.
                    */
                    ephemeral.write(uuid, 'Error writing skynetURL.js: ' + err, LOG_HEADER);
                    cb(); // Free the async slot
                    return buildingFinished(url, id, BUILD_ERROR); // and bail 
                } else {                        
                    ephemeral.write(uuid, 'Wrote skynetURL.js');
                }
                
                /* Check for fixed revision topics, then do the live patch scan to generate
                    the map of topic dependencies for this book. 
                    
                    We pass the cb into livePatch.scanbook. When the scanbook function
                    is complete it will call cb() and release the async queue slot. 
                    We do this because scanning the book is CPU intensive.
                */
                checkFixedRevisionTopics(url, id, MY_PUBLIC_BUILD, function () {
                    livePatch.scanBook(url, id, MY_PUBLIC_BUILD_RELATIVE, MY_PUBLIC_BUILD, cb);    
                });
                                
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
    var Books = jsondb.Books,
        my = Books[url][id],   
        MY_PUBLIC_BUILD_PATH_ABSOLUTE = PUBLIC_BUILDS_DIR + id + '-' + my.builtFilename,
        buildlogURL = '/builds/' + id + '-' + my.builtFilename + '/build.log',
        uuid = my.buildID;
    // Building is finished 
    my.buildError = err;
    ephemeral.write(uuid, 'Building finished for ' + url + ' ' + id);
    
    // Move build log to URL-accessible location
    var dest = MY_PUBLIC_BUILD_PATH_ABSOLUTE + '/build.log';
    mv(my.buildlog, dest, function(err) {
            if (err) return console.log(err); 
            console.log('Moved ' + my.buildlog + ' to ' +  dest);
            
            // Add the public URL for the build log to the Book metadata
            my.set('buildlogURL', buildlogURL);
        });

    // Building is finished. Update the book metadata to reflect this state
    my.remove('buildID');                
    my.locked = false;

    if (err) {
        my.builderror = true;
        my.notify('There was an error rebuilding. Check the <a target="_blank" href="' + buildlogURL + '">build log for this book</a>.'); 
    } else {
        my.notify('bookRebuilt', 'Book Rebuilt');
    }
    
    console.log('Deleting stream for ' + uuid);
    ephemeral.retire(uuid);
    jsondb.write();
}