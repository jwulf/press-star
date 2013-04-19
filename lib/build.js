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
    pg_rest = require('pressgang-rest').PressGangCCMS,
    url_query = require('./../lib/utils').url_query,
    ephemeral = require('./ephemeralStreams');
    
var MAX_SIMULTANEOUS_BUILDS = 2,
    BUILD_ERROR = true,
    LOG_HEADER = ephemeral.LOG_HEADER,
    LOG_CONSOLE = ephemeral.LOG_CONSOLE,
    LOG_TIMESTAMP = ephemeral.LOG_TIMESTAMP;
    
exports.build = build;

/* Building is mediated by two async queues that allow MAX_SIMULTANEOUS BUILDS jobs each.
    One queue handles csprocessor assembly, the other publican builds. You may get better performance
    by allowing only one build at a time.
    
    Build Process Overview:
    
    0. An ephemeral stream is set up for the build job. [build]
    1. Book is placed into the csprocessor queue. {building: true, onQueue: true} [buildBook]
    2. Csprocessor begins. building: true; {buildingForReals: true, onQueue: false} [csprocessorQueue]
    3. Csprocessor completes. 
    4. Unzip job begins. [unzipCSProcessorArtifact]
    5. Unzip job completes. 
    6. publican.cfg file is customized. [customizePublicancfg]
    7. Book is pushed to publican queue. 
    8. Publican job begins. [publicanQueue]
    9. Publican job completes. 
    10. The content spec is used to construct a map of fixed revision topics in the book [checkFixedRevisionTopics]
    11. The bug links in the built HTML are rewritten as editor links [deathStarItUp]
    12. The modified HTML is saved to disk [persistHtml]
    13. The book is scanned to create a  map of the topics that it contains, for live patching [livePatch.scanBook]
    14. Dirty patches are replayed on the book. This reflects edits that were made while it was building. [replayDirtyBuffer]
    15. The built html is copied to the public/builds directory {filewriting: true} [publishBuild]
    16. [buildingFinished]
    
*/

function build(url, id){ 
/* Check that the book exists on this server and is not already building
    Set up some metadata related to building, then trigger the actual build.
*/
    var Books = jsondb.Books;
    
    // Check that the book exists in our metadata repository before attempting to build
    if (Books[url] && Books[url][id]){
        var my = Books[url][id],
        buildlog = path.normalize(process.cwd() + '/' + my.bookdir + '/build.log');

        if (my.building) // Prevent the same book building twice at the same time
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
            //if (my.buildID) { my.buildID = uuid } else my.set('buildID', uuid);
            
            my.setMany({
                buildlog: buildlog,
                buildID:  uuid,
                build: my.id + '-' + my.builtFilename,
                buildStreamURL: '/buildlog.html?buildid=' + uuid,
                building:  true,
                buildError: false
            });
            console.log('Build ID: %s - Stream ID: %s', my.buildID, uuid)
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
    
    /* Set the book metadata to alert interested parties, like the server and client-side control panels. 
        'buildingForReals' is used by the dirty patching system. It lets the live patcher know that all live
        patches are now dirty, and should be replayed on the rebuilt HTML.
    */
    my.setMany({'onQueue': false, 'buildingForReals': true});
    
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
                else { // All good, now check if we have a Revision_History.xml stored in the topic description
                    ephemeral.write(uuid, 'Publican.cfg file customized\r\n', [LOG_HEADER, LOG_CONSOLE]);
        
                    revHistoryFromPressGang(url, id, cb);
                    
                }
            });        
        }
    });
    
};

/* The Revision_History.xml file can be stored in the topic description field of the Content Spec.

This allows a book to be built and published purely from PressGang, with no external dependencies.
*/
function revHistoryFromPressGang (url, id, cb) {
    var my = jsondb.Books[url][id],
        uuid = my.buildID,
        pressgang,
        REV_HISTORY_FILE = my.publicanDirectory + '/en-US/Revision_History.xml';
    
    ephemeral.write(uuid, 'Checking for a Revision_History.xml in the Spec topic description field', LOG_CONSOLE);
    
    pressgang = new pg_rest({url: url, loglevel: 10});
    
    pressgang.getTopicData('json', parseInt(id, 10), 
    function retrievedContentSpecDescription(err, result){
        if (err) {
            ephemeral.write(uuid, 'There was an error checking for the Spec description: ' + err, LOG_TIMESTAMP);
        } else {
            if (result.description) {
                ephemeral.write(uuid, 'Found a topic description, interpreting as Revision_History.xml');
                fs.unlink(REV_HISTORY_FILE, function (err){
                    if (err) {
                        // error deleting existing publican.cfg
                        ephemeral.write(uuid, 'Error deleting ' + REV_HISTORY_FILE +': ' + err);
                        cb(); // Release this async slot
                        return buildingFinished(url, id, BUILD_ERROR); // and bail 
                    } else {
            
                    // Successfully deleted existing file, now write the custom one
                        fs.writeFile(REV_HISTORY_FILE, result.description, 'utf8',  function(err) {
                            if (err) { // error writing custom publican.cfg
                                ephemeral.write(uuid, 'Error writing the custom publican.cfg file during customization: ' + err);
                                cb(); // Release this async slot
                                return buildingFinished(url, id, BUILD_ERROR); // and bail 
                            }
                            else { // All good, now push to the Publican queue
                                ephemeral.write(uuid, 'Revision_History.xml updated from PressGang Spec topic description field\r\n', [LOG_HEADER, LOG_CONSOLE]);
                                return pushToPublicanQueue(url, id, cb);
                            }
                        });     
                    }
                });
            } else {
                return pushToPublicanQueue(url, id, cb);
            }
        }
    });
}

function pushToPublicanQueue (url, id, cb) {
var my = jsondb.Books[url][id],
    uuid = my.buildID;     
    
    ephemeral.write(uuid, 'Waiting in publican build queue... \r\n', LOG_HEADER);
    my.set('onQueue', true); // We're on the Publican queue now
                    
    // Push to Publican queue
    publicanQueue.push({url: url, id: id});
    return cb(); // Free this slot in the csprocessor async queue  
}

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
        BUILT_PUBLICAN_OUTPUT_DIR = '/tmp/en-US/html-single',
        MY_BUILD_DIR = my.publicanDirectory + BUILT_PUBLICAN_OUTPUT_DIR,
        PUBLIC_BUILDS_DIR = process.cwd() + '/public/builds/',
        MY_PUBLIC_BUILD = PUBLIC_BUILDS_DIR + id + '-' + my.builtFilename,
        MY_PUBLIC_BUILD_RELATIVE = 'builds/' + id + '-' + my.builtFilename,
        uuid = my.buildID;
    
    // Create a javascript file to inform the built html book of its identity
    // which means it's URL and Content Spec ID. This is enough for it to uniquely identify itself
    // to the server, and request any further information it requires
    
    var bookMetadata = 'var skynetURL="' + url +'", thisBookID = ' + id + ';';            
    
    
    my.setMany({
        'HTMLPrePublish': MY_BUILD_DIR + '/index.html',
        'HTMLPostPublish': MY_PUBLIC_BUILD + '/index.html'
    });
    
    fs.writeFile(MY_BUILD_DIR + '/Common_Content/scripts/skynetURL.js', 
        bookMetadata, 'utf8',  function(err) {
        
        if (err) { // Disk full maybe?
            ephemeral.write(uuid, 'Error writing skynetURL.js: ' + err, LOG_HEADER);
            cb(); // Free the async slot
            return buildingFinished(url, id, BUILD_ERROR); // and bail! 
        } else { // All good sp far it seems...                        
            ephemeral.write(uuid, 'Wrote skynetURL.js');
        }
        
        /* Check for fixed revision topics, then do the live patch scan to generate
            the map of topic dependencies for this book. 
            
           Hold the async slot for the publican publish while we do this, because it's relatively short, but CPU-intensive.
        */
        checkFixedRevisionTopics(url, id, MY_BUILD_DIR, function (err) {
            if(err) {
                console.log(err);
                ephemeral.write(uuid, 'Error writing HTML to disk');
                cb(); // Free the async
                return buildingFinished(url, id, BUILD_ERROR);
            } 
            
            ephemeral.write(uuid, 'Wrote updated HTML to file: ' + MY_BUILD_DIR + '/index.html', LOG_CONSOLE);
            
            livePatch.scanBook(url, id, my.HTMLPrePublish,
                function replayDirtyBuffer (err) {
                    if (err) { // something went wrong with the topic dependency scan - probably malformed HTML, but who knows?
                        ephemeral.write(uuid, 'Error scanning book for Topic Dependencies: ' + err);
                        cb(); // Free the async  
                        return buildingFinished(url, id, BUILD_ERROR); // and bail 
                    }
                    livePatch.playBuffer(url, id, 
                        function publishBuild(err) {
                            if (err) { // something went wrong with the topic dependency scan - probably malformed HTML, but who knows?
                                ephemeral.write(uuid, 'Error scanning book for Topic Dependencies: ' + err);
                                cb(); // Free the async  
                                return buildingFinished(url, id, BUILD_ERROR); // and bail 
                            }
                            ephemeral.write(uuid, 'Moving built book to public directory');
            
                            // Set the filewriting contention flag, so that other processes that rewrite the HTML on disk hang back
                            my.set('filewriting', true);
                            
                            // Copy the built html over to the public builds directory for the web server
                            wrench.copyDirRecursive(MY_BUILD_DIR, MY_PUBLIC_BUILD, 
                                function mvCallback (err){
                                    my.filewriting = false;
                                    if (err) { // Probably disk full, or deleted public directory
                                        ephemeral.write(uuid, 'Error copying built html to public directory: ' + err); 
                                        cb(); // Free the async slot
                                        return buildingFinished(url, id, BUILD_ERROR); // and bail 
                                    } else {
                                        cb(); // Free the async!
                                        return buildingFinished(url, id);
                                    }
                            });
                        });
                });    
        });
                        
    });        
}

function checkFixedRevisionTopics (url, id, bookPath, cb){
    var my = jsondb.Books[url][id];
    var uuid = my.buildID;
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

function deathStarItUp (skynetURL, id, bookPath, fixedRevTopics, cb) {
    
    /* Write the editor links into the HTML, by converting the "Report a Bug Links"
    
    Handles Fixed Revision Topics and also injects the section number into the editor link */
    
    var my = jsondb.Books[skynetURL][id];
    var buildData, endLoc, topicID, editorURL, section,editURL,
        uuid = my.buildID,
        htmlFile = bookPath + '/index.html';
    ephemeral.write(uuid, 'Rewriting Editor links');
    jsdom.env(htmlFile, [process.cwd() + '/public/scripts/jquery-1.9.1.min.js'], function (err, window){
        // Now go through and modify the fixedRevTopics links
        // And deathstar it up while we're at it
        
        var uid = my.uid;
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
                  + '&specID=' + id  + '&sectionNum=' + sectionNumber; 
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
        return persistHtml(uuid, htmlFile, window.document.outerHTML, cb);
    });
}

function persistHtml (uuid, htmlFile, html, cb) {
    fs.writeFile(htmlFile, html, function(err) {
        cb(err);
    }); 
}

function buildingFinished (url, id, err) {
    var Books = jsondb.Books,
        PUBLIC_BUILDS_DIR = process.cwd() + '/public/builds/',
        my = Books[url][id],   
        MY_PUBLIC_BUILD_PATH_ABSOLUTE = PUBLIC_BUILDS_DIR + id + '-' + my.builtFilename,
        buildlogURL = '/builds/' + id + '-' + my.builtFilename + '/build.log',
        uuid = my.buildID;
        
    // Building is finished. Update the book metadata to reflect this state
    my.remove('buildID');                
    my.setMany({
        building: false, 
        buildingForReals: false, 
        buildError: err
    });

    ephemeral.write(uuid, 'Building finished for ' + url + ' ' + id, LOG_TIMESTAMP);
    
    // Move build log to URL-accessible location
    var dest = MY_PUBLIC_BUILD_PATH_ABSOLUTE + '/build.log';
    mv(my.buildlog, dest, function(err) {
            if (err) return console.log(err); 
            console.log('Moved ' + my.buildlog + ' to ' +  dest);
        
        // Add the public URL for the build log to the Book metadata
        // and remove the filewriting lock
        my.set('buildlogURL', buildlogURL);
    });
    
    if (err) {
        my.notify('There was an error rebuilding. Check the <a target="_blank" href="' + buildlogURL + '">build log for this book</a>.'); 
    } else {
        // TODO: Play Dirty Patch replay buffer now!
        my.notify('bookRebuilt', 'Book Rebuilt');
    }
    
    console.log('Deleting stream for ' + uuid);
    ephemeral.retire(uuid);
    jsondb.write();
}