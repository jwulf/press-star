var fs = require('fs'),
    jsdom = require('jsdom'),
    spawn = require('child_process').spawn,
    async = require('async'),
    jsondb = require('./Books'),
    mv = require('mv'),
    path = require('path'), 
    cheerio = require('cheerio'),
    wrench = require('wrench'),
    humanize = require('humanize'),
    jsdom = require('jsdom').jsdom,
    livePatch = require('./../lib/livePatch'), 
    pg_rest = require('pressgang-rest').PressGangCCMS, // the pg object
    pressgangREST = require('pressgang-rest'), // generic pressgang topic REST utils
    url_query = require('./../lib/utils').url_query,
    ephemeral = require('./ephemeralStreams'),
    xmlrpc = require('xmlrpc'),
    settings = require('./settings');
    
var MAX_SIMULTANEOUS_BUILDS = 2,
    BUILD_ERROR = true,
    LOG_HEADER = ephemeral.LOG_HEADER,
    LOG_CONSOLE = ephemeral.LOG_CONSOLE,
    LOG_TIMESTAMP = ephemeral.LOG_TIMESTAMP;
    
exports.build = build;

/* REFACTOR: This needs to be converted into an bunch of independent functions that can be called
  in an async series. 
  
  This allows them to be chained together for either building or publishing, which use different
  combinations of the same procedures.
  
  This also means that both building and publishing can be mediated by the same bottleneck.

    Maybe there is a single async queue that takes job with a parameter that determines which
    chain of functions is used.
*/


/* Building is mediated by two async queues that allow MAX_SIMULTANEOUS BUILDS jobs each.
    One queue handles csprocessor assembly, the other publican builds. You may get better performance
    by allowing only one build at a time.
    
    Build Process Overview:
    
    0. An ephemeral stream is set up for the build job. [build]
    1. Book is placed into the csprocessor queue. {building: true, onQueue: true} [buildBook]
    2. Csprocessor begins. building: true; {buildingForReals: true, onQueue: false} [csprocessorQueue]
    3. Csprocessor completes. 
    4. Retrieve the Content Spec and add it to the book metadata, as well as the Spec Revision [csprocessorQueue]
    5. Unzip job begins. [unzipCSProcessorArtifact]
    6. Unzip job completes. 
    7. publican.cfg file is customized. [customizePublicancfg]
    8. Book is pushed to publican queue. 
    9. Publican job begins. [publicanQueue]
    10. Publican job completes. 
    11. The content spec is used to construct a map of fixed revision topics in the book [checkFixedRevisionTopics]
    12. The bug links in the built HTML are rewritten as editor links [deathStarItUp]
    13. The modified HTML is saved to disk [persistHtml]
    14. The book is scanned to create a  map of the topics that it contains, for live patching (livePatch.Topics),
        and also a list of topic Revisions (my.topicRevisions) [livePatch.scanBook]
    15. Dirty patches are replayed on the book. This reflects edits that were made while it was building. [replayDirtyBuffer]
    16. The built html is copied to the public/builds directory {filewriting: true} [publishBuild]
    17. [buildingFinished]
    
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
            if (err) { console.log(err); }
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
            console.log('Build ID: %s - Stream ID: %s', my.buildID, uuid);
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
            /* If everything OK, get the Content Spec revision
                This allows us to detect when the Content spec has been updated
                on the server. Since we automatically rebuild on spec push via
                the Death Star, this is most useful for detecting when someone
                has pushed the spec via another mechanism. 
                
                This is used when taking the Death Star offline - we can check
                whether we have built the latest version of the spec, and skip 
                rebuilding if we have, thus saving time.
            */        
            
            ephemeral.write(uuid, 'Got the Content Spec from PressGang for analysis');
            pressgangREST.getTopic(url, id, function PGgetTopicCallback (topic){
                ephemeral.write(uuid, 'Got the Content Spec from PressGang for analysis', LOG_CONSOLE);
                // Add the topic revision to the Book metadata
                my.set('lastBuildSpecRevision',  topic.revision);
                ephemeral.write(uuid, 'Built from Spec Revision ' + my.lastBuildSpecRevision, LOG_CONSOLE);
                // Add the Spec itself to the Book metadata
                // This is used by the FixedRevisions scan
                my.set('contentSpec', topic.xml);
                // start unzipping the csprocessor output zip file
                unzipCSProcessorArtifact(url, id, cb)        
            });

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
                else { // All good, now check if we have a Revision_History.xml in the metadata
                    ephemeral.write(uuid, 'Publican.cfg file customized\r\n', [LOG_HEADER, LOG_CONSOLE]);
        
                    revHistoryFromPressGang(url, id, cb);
                }
            });        
        }
    });
    
}

/* The Revision_History.xml file can be stored in a topic and specified in the Content Spec.

This allows a book to be built and published purely from PressGang, with no external dependencies.

To use a topicized Revision History, the Content Spec should contain a Death Star Directive:
#_DSD:REVHISTORY=<Topic ID>

The Revision History topic should be an appendix element containing a revhistory with revisions.

1. Check the book metadata for a custom Revision History topic
   - these topics are written into the Content Spec as #_DSD:REVHISTORY=<Topic ID>
2. Retrieve the Revision History topic if one exists
3. Find the latest package number in Brew
4. Rewrite the first Revision History entry's number
*/
function revHistoryFromPressGang (url, id, cb) {
    var my = jsondb.Books[url][id],
        uuid = my.buildID,
        pressgang,
        REV_HISTORY_FILE = my.publicanDirectory + '/en-US/Revision_History.xml',
        _rev_history; // our custom rev history from a topic
    
    ephemeral.write(uuid, 'Checking for a Revision_History.xml in the Content Spec metadata', LOG_CONSOLE);
    
    pressgang = new pg_rest({url: url, loglevel: 10});

    cylon.getSpecMetadata(pressgang, id, function (err, md){
        if (md.revhistory) {
            pressgang.getTopicData('json', parseInt(md.revhistory, 10), 
            function retrievedContentSpecRevisionHistoryTopic(err, result){
                if (err) {
                    ephemeral.write(uuid, 'There was an error retrieving the Revision History: ' + err, LOG_TIMESTAMP);
                } else {
                    if (result.xml && result.xml.indexOf('<appendix') !== -1) {
                        ephemeral.write(uuid, 'Found a Revision History topic, writing as Revision_History.xml');
                        
                        _rev_history = result.xml;
                        // Construct the brew package name
                        var packageName = my.product.split(' ').join('_') + '-' +
                                            my.title.split(' ').join('_') + '-' +
                                            my.version + '-web-en-US';
                        
                        // Query brew for the latest package number
                        var client = xmlrpc.createClient({host:  settings.brewhost , port: 80, path: '/brewhub'});
                        client.methodCall('getLatestBuilds', [settings.brewDocsTag, {'__starstar': 1, 'package': packageName}], function (error, result){
                            if (error) {
                                ephemeral.write(uuid, 'Error retrieving package details from Brew: ' + error, [LOG_HEADER, LOG_CONSOLE]); 
                                return buildingFinished(url, id, BUILD_ERROR); // and bail 
                            }
                            if (result.length !== 1) {
                                ephemeral.write(uuid, 'Error retrieving package details from Brew', [LOG_HEADER, LOG_CONSOLE]); 
                                return buildingFinished(url, id, BUILD_ERROR); // and bail   
                            }
                            var pubsnum = result[0].release; // looks something like '79.el6eng'
                            pubsnum = pubsnum.substr(0, pubsnum.indexOf('.')); // just get the pubsnum
                            pubsnum = parseInt(pubsnum, 10); // turn it into a number so we can increment it
                            pubsnum ++;
                 
                            var $ = cheerio.load(_rev_history);
                            // rewrite the revnumber of the first entry in the Revision History                    
                            $('revision revnumber').first().text(my.version + '-' + pubsnum);
                            
                            _rev_history = $.html();

                            // Now write it to the file
                            fs.unlink(REV_HISTORY_FILE, function (err){
                                // Deleted existing file, now write the custom one
                                fs.writeFile(REV_HISTORY_FILE, _rev_history, 'utf8',  function(err) {
                                    if (err) { // error writing custom Revision_History.xml
                                        ephemeral.write(uuid, 'Error writing the Revision_History.xml file during customization: ' + err);
                                        cb(); // Release this async slot
                                        return buildingFinished(url, id, BUILD_ERROR); // and bail 
                                    } else { // All good, now push to the Publican queue
                                        ephemeral.write(uuid, 'Revision_History.xml updated from PressGang topic\r\n', [LOG_HEADER, LOG_CONSOLE]);
                                        return pushToPublicanQueue(url, id, cb);
                                    }
                                });     
                            });
                        });
                    } else { // Either we couldn't get the topic, or else it wasn't an appendix
                        return pushToPublicanQueue(url, id, cb);
                    }
                }
            });
        } else // No custom Revision History, move to next phase
        return pushToPublicanQueue(url, id, cb);
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
        checkFixedRevisionTopics(url, id, MY_BUILD_DIR, function (err, fixedRevTopics) {
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
    
    /*
        Scans through the Content Spec that was used to build the book,
        checking for fixed revisions. Builds an array of fixed revision
        topics in the book
    */
    var my = jsondb.Books[url][id],
        uuid = my.buildID, // build ID for the ephemeral stream
        spec = my.contentSpec, // the Content Spec used in this build
        fixedRevTopic, // the topic ID of a fixed rev topic
        fixedRevision, // the revision number of a fixed rev topic
        contentspec = spec.split("\n"), // the spec turned into an array for iteration
        fixedRevTopics = {'-1': 'Placeholder'}, // the collection of fixed revision topics for this spec
            // The placeholder is so that the collection exists, even if it's empty (no fixed rev topics in this book)
        line; // a line of the content spec

    ephemeral.write(uuid, 'Checking for Fixed Revision Topics', LOG_CONSOLE);
            
    for (var lines = 0; lines < contentspec.length; lines ++) {
        line = contentspec[lines]; // grab the next line of the content spec from the array
        if (line.indexOf('#')  !== 0) { // ignore commented lines
            if (line.indexOf(', rev: ') !== -1) {  // looks like it has a revision specified   
                fixedRevision = line.substring(line.indexOf(', rev:') + 7, line.length - 1);
                var startLoc = line.indexOf('[') + 1,
                offset = line.indexOf(', rev:') - startLoc;
                fixedRevTopic = line.substr(startLoc, offset);
                console.log('Found a fixed rev topic: ' + fixedRevTopic);
                fixedRevTopics[fixedRevTopic] = fixedRevision; // add it to the fixed revisions object
            } 
        }
    }
    ephemeral.write(uuid, 'Found ' + Object.getOwnPropertyNames(fixedRevTopics).length
            + ' fixed revision topics.', LOG_CONSOLE);
    // Add the fixed revisions object to the Book metadata
    console.log(fixedRevTopics);
    my.set('fixedRevisionTopics', fixedRevTopics);
    console.log('My collection set to : ' + my.fixedRevTopics);
    deathStarItUp(url, id, bookPath, cb); 
}

function deathStarItUp (skynetURL, id, bookPath, cb) {
    
    /* Write the editor links into the HTML, by converting the "Report a Bug Links"
    Handles Fixed Revision Topics and also injects the section number into the editor link */
    
    var my = jsondb.Books[skynetURL][id],
        buildData, endLoc, topicID, editorURL, section, editURL,
        uuid = my.buildID,
        htmlFile = bookPath + '/index.html',
        fixedRevTopics = my.fixedRevisionTopics, // The collection of fixed rev topics
        topicsToCheck, // How many topics we have to check
        topicsChecked; // How many topics we've checked so far

    // Tried to use cheerio here for better performance (it's more lightweight)
    // Got codeblocked by the lack of $(this).parents() inside .each()
    // See: https://github.com/MatthewMueller/cheerio/issues/196
    
    jsdom.env(htmlFile, [process.cwd() + '/public/scripts/jquery-1.9.1.min.js'], function (err, window){
        ephemeral.write(uuid, 'Rewriting Editor links', LOG_CONSOLE);
        
        var $ = window.$;
        console.log('Death Starring it up in here!');
        
        editorURL = '/edit';  
        
        topicsToCheck = $('.RoleCreateBugPara > a').length;
        topicsChecked = 0;
        ephemeral.write(uuid, 'Got ' + topicsToCheck + ' links to check');
            
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
                editURL = skynetURL.substr(0, skynetURL.indexOf('TopicIndex')) + 
                    'pressgang-ccms-ui/#SearchResultsAndTopicView;topicViewData;' + 
                    topicID + '=r:1930;query;topicIds=' + fixedRevTopics[topicID]; 
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
            
            topicsChecked ++ ;
            if (topicsChecked == topicsToCheck) {
                $('.jsdom').remove();    
                return persistHtml(uuid, htmlFile, window.document.outerHTML, fixedRevTopics, cb);
            }
        });
    });
}

function persistHtml (uuid, htmlFile, html, fixedRevTopics, cb) {
    fs.writeFile(htmlFile, html, function(err) {
        cb(err, fixedRevTopics);
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
        my.notify('bookRebuilt', 'Book Rebuilt');
    }
    
    console.log('Deleting stream for ' + uuid);
    ephemeral.retire(uuid);
    jsondb.write();
}