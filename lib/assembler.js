var fs = require('fs'),
    jsdom = require('jsdom'),
    spawn = require('child_process').spawn,
    async = require('async'),
    jsondb = require('./Books'),
    path = require('path'), 
    mv = require('mv'),
    cheerio = require('cheerio'),
    wrench = require('wrench'),
    nexpect = require('nexpect'),
    jsdom = require('jsdom').jsdom,
    livePatch = require('./../lib/livePatch'),
    pressgang = require('pressgang-rest'), // generic pressgang topic REST utils
    url_query = require('./../lib/utils').url_query,
    ephemeral = require('./ephemeralStreams'),
    xmlrpc = require('xmlrpc'),
    settings = require('./settings');
    
var MAX_SIMULTANEOUS_BUILDS = 1,
    BUILD_ERROR = true,
    LOG_HEADER = ephemeral.LOG_HEADER,
    LOG_CONSOLE = ephemeral.LOG_CONSOLE,
    LOG_TIMESTAMP = ephemeral.LOG_TIMESTAMP;

exports.build = build;
exports.publish = publish;
exports.publishJobs = {};

/* 
    Performs a build or publish by chaining together an async series
    Operation is a string 'build' || 'publish' 
    
    Uses an async queue to restrict simultaneous operations

*/

function publish (url, id, kerbid, kerbpwd, cb) {
    assemble (url, id, {operation: 'publish', kerbid: kerbid, kerbpwd: kerbpwd}, cb);   
}

function build (url, id, cb) {
    assemble (url, id, 'build', cb);
}

var assembly_line = async.queue(function (task, cb){
    var my = jsondb.Books[task.my.url][task.my.id],
        uuid = my.uuid;
    console.log('Starting assembly for ' + my.title);
    my.set('buildingForReals', true);
    my.onQueue = false;
    my.onBuildQueue = false;
    my.onPublishQueue = false;
    if (task.operation == 'build')
        async.waterfall([
            function (callback) {
                callback(null, task)
            },
            getContentSpec, 
            csprocessorBuild,
            unzipCSProcessorArtifact,
            customizePublicancfg,
            getCustomRevisionHistory,
            getCustomEntityFile,
            publicanBuild,
            writeEditorMetadataFile,
            createFixedRevisionTopicCollection,
            writeEditorLinks,
            playbackDirtyBuffer,
            updateTopicDependenciesMap,
            moveBuildToPublicDirectory,
            jsondb.write
            ],
        function finishedBuild (err, results){
            if (err) { ephemeral.write(uuid, 'Building exited with error:  ' + err, LOG_CONSOLE); }
            my.building = false;
            var _err = (err) ? err : '';
            ephemeral.write(uuid, 'Build job finished ' + _err, LOG_CONSOLE);
            ephemeral.retire(uuid);
            moveAssemblyLogToPublicDirectory(task);
            if (err) {
                my.notify('There was an error rebuilding. Check the <a target="_blank" href="' + my.buildlogURL + '">build log for this book</a>.'); 
            } else {
                my.notify('bookRebuilt', 'Book Rebuilt');
            }
            cb(); // release async queue slot
        });
        
    if (task.operation == 'publish') {
        
        my.set('publishing', true);
        my.set('onPublishQueue', false);
        async.waterfall([
            function (callback) {
                callback(null, task)
            },
            getContentSpec, 
            csprocessorBuild,
            unzipCSProcessorArtifact,  
            getCustomRevisionHistory,
            getCustomEntityFile,
            publicanBuild,
            getKerberosTicket,
            runRhpkg, // We could push the publish job into a second, 1-limited queue for the rhpkg operation
            moveAssemblyLogToPublicDirectory,
            jsondb.write
            ],
            function finishedPublish (err, results) {
                kdestroy(task);
                if (err) { ephemeral.write(uuid, 'Publishing exited with error:  ' + err, LOG_CONSOLE); }
                my.building = false;
                my.publishing = false;
                var _err = (err) ? err : '';
            
                ephemeral.write(uuid, 'Publish job finished ' + _err, LOG_CONSOLE); // We probably want to do this somewhere else, when the actual spawned process exits
                ephemeral.retire(uuid);
                
                cb(); // release async queue slot
        });  
    }
}, MAX_SIMULTANEOUS_BUILDS);

function getContentSpec (task, callback) {
    var my = jsondb.Books[task.my.url][task.my.id],
        uuid = my.uuid,
        url = my.url,
        id = my.id;    
        
    console.log('getContentSpec uuid: %s', uuid);

    ephemeral.write(uuid, 'Getting the Content Spec from PressGang for analysis', [LOG_CONSOLE, LOG_HEADER]);

    pressgang.getContentSpec(url, id, function (err, spec){
        if (err) return callback (err);
        
        my.set('lastBuildSpecRevision', spec.revision);
        my.set('contentSpec', spec.content);  // We need this to scan for fixed revision topics
        ephemeral.write(uuid, 'Latest Spec Revision ' + my.lastBuildSpecRevision, [LOG_CONSOLE, LOG_HEADER]);
        if (spec.metadata.revhistory) { // Custom Revision History topic id
            my.set('revhistory', spec.metadata.revhistory);
        } else {
            my.remove('revhistory');
        }
        if (spec.metadata.entityfile) { // Custom Entity File topic id
            my.set('entityfile', spec.metadata.entityfile);    
        } else {
            my.remove('entityfile');
        }
        callback(err, task);
    });
}

function csprocessorBuild (task, callback) {
     var my = jsondb.Books[task.my.url][task.my.id],
        operation = task.operation,
        uuid = my.uuid;      
            
    console.log('UUID: %s', uuid);
    
    var _opts;
    
    ephemeral.write(uuid, 'CSProcessor assembly initiated', [LOG_HEADER, LOG_TIMESTAMP]);

    console.log('csprocessorBuild uuid: %s', uuid);
    
    if (operation == 'build') _opts = ['build', '--force-bug-links'];
    if (operation == 'publish') { 
        _opts = ['build', '--hide-errors'];
        if (!my.revhistory) _opts.push('--fetch-pubsnum'); // No custom Revision History
    }
    
    /* Requires csprocessor-0.30+ to support --force-bug-links.
       https://bugzilla.redhat.com/show_bug.cgi?id=861464 */
    var csprocessorBuildJob = spawn('csprocessor', _opts, {
        cwd: path.normalize(process.cwd() + '/' + my.bookdir)
    }).on('exit', function(err){
        if (err) { 
            ephemeral.write(uuid,'Content Spec build task exited with error: ' + err, LOG_HEADER);
            return callback(err, task); 
        } else {
            ephemeral.write(uuid, 'Content Specification build task complete', LOG_HEADER, LOG_TIMESTAMP);
            return callback(err, task);
        }          
    });
    csprocessorBuildJob.stdout.setEncoding('utf8');
    csprocessorBuildJob.stdout.pipe(ephemeral.streams[uuid].stream);
}
    
function unzipCSProcessorArtifact (task, callback) {
    var my = jsondb.Books[task.my.url][task.my.id],
        uuid = my.uuid,
        directory = path.normalize(process.cwd() + '/' + my.bookdir + '/assembly'),
        bookFilename = my.title.split(' ').join('_'),
        zipfile = bookFilename + '-publican.zip';
    
    my.set('builtFilename', bookFilename);
    my.set('publicanDirectory', directory + '/' + bookFilename);
    
    if (!fs.existsSync(directory + '/' + zipfile)) {  // Abort if zip file does not exist
        ephemeral.write(uuid, zipfile + ' not found.');
        return callback(zipfile + ' not found.'); } // Call cb() to free this slot in the async queue

    ephemeral.write(uuid, 'Unzipping publican book in ' + directory, LOG_HEADER);

    // Spawn an unzip process
    var zipjob = spawn('unzip', ['-o', zipfile], {
        cwd: directory
    }).on('exit', function(err) { // executed when job exits
        if (err) { // Disk full, probably
            ephemeral.write(uuid, 'Error unzipping file: ' + err);
            return callback(err);
        } else { 
            ephemeral.write(uuid, 'CSProcessor assembled book unzipped\n'); 
            return callback(err, task); }
    });

    zipjob.stdout.setEncoding('utf8');
    zipjob.stderr.setEncoding('utf8');
    zipjob.stdout.pipe(ephemeral.streams[uuid].stream);
    zipjob.stderr.pipe(ephemeral.streams[uuid].stream);
}
    
function customizePublicancfg (task, callback) {
    var my = jsondb.Books[task.my.url][task.my.id],
        uuid = my.uuid,
   
    /* Customize the publican.cfg file to get the book to build with the
        publican-deathstar brand */
        
    // Our customized publican config file
     publicanConfig = 
        'xml_lang: en-US \n' + 'type: Book\n' + 'brand: deathstar\n' + 
        'chunk_first: 0\n' + 'git_branch: docs-rhel-6\n' + 
        'web_formats: "epub,html, html-single\n' + 
        'docname: ' + my.title + '\n' + 
        'product: ' + my.product + '\n',
        directory = path.normalize(process.cwd() + '/' + my.bookdir + '/assembly'),
        bookFilename = my.bookFilename = my.title.split(' ').join('_'),
        publicanFile = directory + '/' + bookFilename + '/publican.cfg';

    ephemeral.write(uuid, 'Customizing publican.cfg');
    
    // Begin by deleting the existing publican.cfg file
    fs.unlink(publicanFile, function (err){
        if (err) { // error deleting existing publican.cfg
            ephemeral.write(uuid, 'Error deleting the existing publican.cfg file during customization: ' + err);
            return callback(err, task); // and bail
        } else {
            // Successfully deleted existing file, now write the custom one
            fs.writeFile(publicanFile, publicanConfig, 'utf8',  function(err) {
                if (err) { // error writing custom publican.cfg
                    ephemeral.write(uuid, 'Error writing the custom publican.cfg file during customization: ' + err);
                    return callback(err, task); // and bail
                }
                else { // All good, now check if we have a Revision_History.xml in the metadata
                    ephemeral.write(uuid, 'Publican.cfg file customized\r\n', [LOG_HEADER, LOG_CONSOLE]);
                    callback(err, task);
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
    4. Rewrite the first Revision History entry's number */
    
    // TODO: Add custom class to generate special editor link and trigger "Update Revision History" in control panel
    
function getCustomRevisionHistory (task, callback) {
    var my = jsondb.Books[task.my.url][task.my.id],
        uuid = my.uuid,
        url = my.url,
        REV_HISTORY_FILE = my.publicanDirectory + '/en-US/Revision_History.xml',
        _rev_history; // our custom rev history from a topic
        
    if (my.revhistory) {
        // Rebuilding offline is not supported, so bypass topic driver
        /* REFACTOR: Use topic driver if this is ever supported offline - 
            for example: updating the Revision History from the offline commit messages
            In that case you'd want to put it in a different context, and pass 'my' in as 
            a parameter.
        */
        pressgang.getTopic(url, my.revhistory, 
            function retrievedContentSpecRevisionHistoryTopic(err, result){
                if (err) {
                    ephemeral.write(uuid, 'There was an error retrieving the Revision History: ' + err, LOG_TIMESTAMP);
                    return callback(err, task);
                } else {
                    if (!result.xml) return callback("Couldn't get Revision History topic " + my.revhistory);
                    if (result.xml.indexOf('<appendix') === -1) return callback('Revision History topic is not an <appendix>');
                    
                    ephemeral.write(uuid, 'Found a Revision History topic, writing as Revision_History.xml');
                    
                    _rev_history = result.xml;
                    // Construct the brew package name
                    var packageName = my.product.split(' ').join('_') + '-' +
                                        my.title.split(' ').join('_') + '-' +
                                        my.version + '-web-en-US';
                    
                    if (task.operation == 'publish') {
                        // Query brew for the latest package number
                        var client = xmlrpc.createClient({host:  settings.brewhost , port: 80, path: '/brewhub'});
                        client.methodCall('getLatestBuilds', [settings.brewDocsTag, {'__starstar': 1, 'package': packageName}], function (error, result){
                            if (error) {
                                ephemeral.write(uuid, 'Error retrieving package details from Brew: ' + error, [LOG_HEADER, LOG_CONSOLE]); 
                                return callback(error); // and bail 
                            }
                            if (result.length !== 1) {
                                ephemeral.write(uuid, 'Error retrieving package details from Brew', [LOG_HEADER, LOG_CONSOLE]); 
                                return callback('Error retrieving package details from Brew'); // and bail   
                            }
                            var pubsnum = result[0].release; // looks something like '79.el6eng'
                            pubsnum = pubsnum.substr(0, pubsnum.indexOf('.')); // just get the pubsnum
                            pubsnum = parseInt(pubsnum, 10); // turn it into a number so we can increment it
                            pubsnum ++;
                 
                            ephemeral.write(uuid, 'Publishing ' + my.version + '-' + pubsnum);
                            
                            var $ = cheerio.load(_rev_history);
                            // rewrite the revnumber of the first entry in the Revision History                    
                            $('revision revnumber').first().text(my.version + '-' + pubsnum);
                            
                            // Not when publishing
                            
                           /* // Give the appendix a special role
                            $('appendix').attr('role', 'customrevhistory sectionTopic' + my.revhistory);
                            
                            // And add the edit link to it
                            
                            $('appendix').append('<simplesect><title/><para role="RoleCreateBugPara">'+
                                '<ulink url="cf_build_id=' + my.revhistory + '">Report a Bug</ulink>' +
                                '</simplesect>');
                            */
                            
                            _rev_history = $.html();
  
                            // Now write it to the file
                            fs.unlink(REV_HISTORY_FILE, function (err){
                                // Deleted existing file, now write the custom one
                                fs.writeFile(REV_HISTORY_FILE, _rev_history, 'utf8',  function(err) {
                                    if (err) { // error writing custom Revision_History.xml
                                        ephemeral.write(uuid, 'Error writing the Revision_History.xml file during customization: ' + err);
                                        return callback(err, task); // and bail 
                                    } else { // All good
                                        ephemeral.write(uuid, 'Revision_History.xml updated from PressGang topic\r\n', [LOG_HEADER, LOG_CONSOLE]);
                                        callback(err, task);
                                    }
                                });     
                            });
                        });
                    }
                    //REFACTOR: Duplicated code between build and publish - probably put it in a function like customizeRevHistory, with some conditionals
                    if (task.operation == 'build') {
                        var $ = cheerio.load(_rev_history);
                        
                        // Give the appendix a special role
                        $('appendix').attr('role', 'customrevhistory section');
                        
                        // And add the edit link to it
                        
                        $('appendix').append('<simplesect><title/><para role="RoleCreateBugPara">'+
                            '<ulink url="http://localhost?cf_build_id=' + my.revhistory + '-' + result.revision + '">Report a Bug</ulink>' +
                            '</simplesect>');
                        
                        _rev_history = $.html();

                        // Now write it to the file
                        fs.unlink(REV_HISTORY_FILE, function (err){
                            // Deleted existing file, now write the custom one
                            fs.writeFile(REV_HISTORY_FILE, _rev_history, 'utf8',  function(err) {
                                if (err) { // error writing custom Revision_History.xml
                                    ephemeral.write(uuid, 'Error writing the Revision_History.xml file during customization: ' + err);
                                    return callback(err, task); // and bail 
                                } else { // All good
                                    ephemeral.write(uuid, 'Revision_History.xml updated from PressGang topic\r\n', [LOG_HEADER, LOG_CONSOLE]);
                                    callback(err, task);
                                }
                            });     
                        });
                    }
                }
            });
    } else // No custom Revision History, move to next phase
        return callback(null, task);
}
    
function getCustomEntityFile (task, callback) {
    var my = jsondb.Books[task.my.url][task.my.id],
        uuid = my.uuid,
        url = my.url,
        entFileName = my.title.split(' ').join('_') + '.ent',
        ENTITY_FILE = my.publicanDirectory + '/en-US/' + entFileName,
        _entities; // our custom entities from a topic
        
    if (my.entityfile) {
        // Rebuilding offline is not supported, so bypass topic driver

        ephemeral.write(uuid, 'Retrieving the custom Entity file', LOG_HEADER);
        pressgang.getTopic(url, my.entityfile, 
            function retrievedContentSpecEntityFileTopic(err, result){
                if (err) {
                    ephemeral.write(uuid, 'There was an error retrieving the Entity File topic: ' + err, [LOG_HEADER, LOG_TIMESTAMP]);
                    return callback(err);
                } else {
                    if (!result.xml) return callback("Entity file topic " + my.entityfile + " is empty.");
                    
                    ephemeral.write(uuid, 'Found an Entity file topic, writing as ' + entFileName);
                    
                    _entities = result.xml;
                    
                    // Now write it to the file
                    fs.unlink(ENTITY_FILE, function (err){
                        // Deleted existing file, now write the custom one
                        fs.writeFile(ENTITY_FILE, _entities, 'utf8',  function(err) {
                            if (err) { // error writing custom Entity file
                                ephemeral.write(uuid, 'Error writing the Entity file during customization: ' + err);
                                return callback(err, task); // and bail 
                            } else { // All good
                                ephemeral.write(uuid, 'Entity file updated from PressGang topic\r\n', [LOG_HEADER, LOG_CONSOLE]);
                                callback(null, task);
                            }
                        });     
                    });
                }
            });
    } else {// No custom Entity file, move to next phase
        ephemeral.write(uuid, 'No custom Entity file specified', LOG_HEADER);
        return callback(null, task);
    }
}

function publicanBuild (task, callback) {
    var my = jsondb.Books[task.my.url][task.my.id],
        uuid = my.uuid,
        id = my.id;    

    ephemeral.write(uuid, 'Publican build initiated and in progress', LOG_HEADER);
                        
    var publicanJob = spawn('publican', ['build', '--formats', 'html-single', '--langs', 'en-US'], {
        cwd: my.publicanDirectory
    }).on('exit', function(err) {
        ephemeral.write(uuid, 'Publican build complete with code ' + err, LOG_HEADER);
        if (err === 0) {  // If everything went OK
            var BUILT_PUBLICAN_OUTPUT_DIR = '/tmp/en-US/html-single',
            MY_BUILD_DIR = my.publicanDirectory + BUILT_PUBLICAN_OUTPUT_DIR,
            PUBLIC_BUILDS_DIR = process.cwd() + '/public/builds/',
            MY_PUBLIC_BUILD = PUBLIC_BUILDS_DIR + id + '-' + my.builtFilename,
            MY_PUBLIC_BUILD_RELATIVE = 'builds/' + id + '-' + my.builtFilename;
            my.set('prePublishDir', MY_BUILD_DIR);
            my.set('publishDir', MY_PUBLIC_BUILD);
            my.set('HTMLPrePublish', MY_BUILD_DIR + '/index.html');
            my.set('HTMLPostPublish', MY_PUBLIC_BUILD + '/index.html');
            return callback(err, task); 
        } else { // error during Publican build
            ephemeral.write(uuid, 'Publican build error ' + err, [LOG_HEADER, LOG_CONSOLE]);
            return callback(err, task); // Release this async slot
        }
    });

    /* Pipe publican build output to interested parties and the build log via ephemeral stream */
    publicanJob.stdout.setEncoding('utf8');
    publicanJob.stderr.setEncoding('utf8');
    publicanJob.stdout.pipe(ephemeral.streams[uuid].stream);
    publicanJob.stderr.pipe(ephemeral.streams[uuid].stream);
}
    
function writeEditorMetadataFile (task, callback) {
    var my = jsondb.Books[task.my.url][task.my.id],
        uuid = my.uuid,
        url = my.url,
        id = my.id,
        bookMetadata = 'var skynetURL="' + url +'", thisBookID = ' + id + ';';
    ephemeral.write(uuid, 'Writing server information into the book', [LOG_HEADER, LOG_CONSOLE]);
    fs.writeFile(my.prePublishDir + '/Common_Content/scripts/skynetURL.js', 
        bookMetadata, 'utf8',  function(err) {
    
        if (err) { // Disk full maybe?
            ephemeral.write(uuid, 'Error writing skynetURL.js: ' + err, LOG_HEADER);
            return callback(err, task); // amd bail
        } else { // All good sp far it seems...                        
            ephemeral.write(uuid, 'Wrote skynetURL.js');
            return callback(null, task);
        }
    });
}
    
function createFixedRevisionTopicCollection (task, callback){

    /*
        Scans through the Content Spec that was used to build the book,
        checking for fixed revisions. Builds an array of fixed revision
        topics in the book
    */
    
 var my = jsondb.Books[task.my.url][task.my.id],
        uuid = my.uuid,  
        spec = my.contentSpec, // the Content Spec used in this build
        fixedRevTopic, // the topic ID of a fixed rev topic
        fixedRevision, // the revision number of a fixed rev topic
        contentspec = spec.split("\n"), // the spec turned into an array for iteration
        fixedRevTopics = {'topic': 'revision'}, // the collection of fixed revision topics for this spec
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
    
    var _numFixedRevisionTopics = Object.keys(fixedRevTopics).length -1;
    
    ephemeral.write(uuid, 'Found ' + _numFixedRevisionTopics
            + ' fixed revision topics.', LOG_CONSOLE);
    
    // Add the fixed revisions object to the Book metadata
    console.log(fixedRevTopics);
    my.set('fixedRevisionTopics', fixedRevTopics);
    return callback(null, task); 
}
    
function writeEditorLinks (task, callback) {

    /* Write the editor links into the HTML, by converting the "Report a Bug Links"
    Handles Fixed Revision Topics and also injects the section number into the editor link */
        
    var my = jsondb.Books[task.my.url][task.my.id],
        uuid = my.uuid,
        url = my.url,
        id = my.id,
        buildData, endLoc, topicID, editorURL, section, editURL,
        htmlFile = my.HTMLPrePublish,
        fixedRevTopics = my.fixedRevisionTopics, // The collection of fixed rev topics
        topicsToCheck, // How many topics we have to check
        topicsChecked; // How many topics we've checked so far
    
    // Tried to use cheerio here for better performance (it's more lightweight)
    // Got codeblocked by the lack of $(this).parents() inside .each()
    // See: https://github.com/MatthewMueller/cheerio/issues/196
    
    //REFACTOR: That issue has been resolved in the 0.11.0 release of cheerio
    
    ephemeral.write(uuid,'Beginning editor link rewrite for ' + htmlFile, LOG_CONSOLE);
    
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
            //console.log('%s %s',target.text(), target.attr('href'));
            buildData = url_query('cf_build_id', target.attr('href')) || 'undefined-';
            endLoc = buildData.indexOf('-');
            topicID = buildData.substr(0, endLoc);
            // it seems that the data after the '-' character is the topic revision!
            
            if (fixedRevTopics[topicID]) { // This is a Fixed Revision Topic
            
                //console.log('Fixed Rev topic: ' + topicID);
                section = target.parent('.RoleCreateBugPara');
                section.removeClass('RoleCreateBugPara');
                section.addClass('fixedRevTopic');
                target.attr('target', '_blank');
                target.text('Rev: ' + fixedRevTopics[topicID]);
                editURL = url.substr(0, url.indexOf('TopicIndex')) + 
                    'pressgang-ccms-ui/#SearchResultsAndTopicView;topicViewData;' + 
                    topicID + '=r:1930;query;topicIds=' + fixedRevTopics[topicID]; 
                target.attr('href', editURL);
                
                // Identify the bug link, to allow us to preserve it when updating the DOM
                $(target.parents('.simplesect')).addClass('bug-link');
                // Identify the div containing the Topic as a topic, and uniquely with the Topic ID
                $(target.parents('.section')[0]).addClass('sectionTopic pg-topic-id-' + topicID);            
            } else {
             /*
                Get the section number of the topic in the built book.
                This is done to pass to the editor. The editor passes it to the HTML preview service.
                The HTML preview service passes it to xsltproc, which uses it to render the HTML
                preview with the correct section number for the book.
            */
                
                var titlehtml = $(target.parents('.section')[0]).find('.title').html(),
                    titleWords, 
                    sectionIndex,
                    sectionNumber;
                    
                if (titlehtml) { // Revision History doesn't have one
                    sectionIndex = titlehtml.indexOf('</a>'),
                    titleWords = titlehtml.substr(sectionIndex + 4),
                    sectionNumber = titleWords.substr(0, titleWords.indexOf('&nbsp;'));
                }
        
                editURL = editorURL + '?skyneturl=' + url + '&topicid=' + topicID
                  + '&specID=' + id  + '&sectionNum=' + sectionNumber; 
                target.attr('href', editURL);
                target.attr('target', 'new');
                target.addClass('edittopiclink');
                target.text('Edit');
            
                // Identify the bug link, to allow us to preserve it when updating the DOM
                $(target.parents('.simplesect')).addClass('bug-link');
                // Identify the div containing the Topic as a topic, and uniquely with the Topic ID
                $(target.parents('.section')[0]).addClass('sectionTopic pg-topic-id-' + topicID);            
            }         
            
            topicsChecked ++ ;
            if (topicsChecked === topicsToCheck) {
                var _html = window.document.outerHTML;
                $('.jsdom').remove();    
                fs.writeFile(htmlFile, _html, function(err) {
                    return callback(err, task);
                });
            }
        });
    });
}
    
function playbackDirtyBuffer (task, callback) {
    var my = jsondb.Books[task.my.url][task.my.id];
    ephemeral.write(my.uuid, 'Checking the dirty buffer for live patches', LOG_HEADER);
    if (livePatch.replayBuffer[my.url] && livePatch.replayBuffer[my.url][my.id]) {
        livePatch.playBuffer(my.url, my.id, function () {
            callback(null, task);
        });
    } else {
        ephemeral.write(my.uuid, 'No dirty buffer', LOG_HEADER);
        callback(null, task);
    }
}
    
    /* 
    Scan the file at htmlToScan and 
    (a) update the topic dependency map.
    (b) write the topic revisions into the css and the topic revisions metadata
    
    The Book metadata has a collection "topicRevisions" that contains the revision
    numbers of the topics in the book.
    
    Called post-publican build to update the topic dependency map. */

function updateTopicDependenciesMap (task, callback) {
    var my = jsondb.Books[task.my.url][task.my.id],
        uuid = my.uuid,
        url = my.url,
        id = my.id,
        topicID, 
        htmlToScan = my.HTMLPrePublish;
    
    ephemeral.write(uuid, 'Generating Topic Dependencies for ' + htmlToScan, LOG_CONSOLE);

    if (!livePatch.Topics) livePatch.Topics = {};

    // Nuke all the current subscriptions for this book
    if (livePatch.Topics[url]) for (var topic in livePatch.Topics[url])
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
            if (!livePatch.Topics[url]) livePatch.Topics[url] = {}; 
            if (!livePatch.Topics[url][topicID]) livePatch.Topics[url][topicID] = {};
            
            // Add the topic to the Topic Dependency map
            // which has the form Topics.<url>.<topicid>.<specid>
            livePatch.Topics[url][topicID][id] = true; 
            
            // Is this is a fixed revision topic?
            if (my.fixedRevisionTopics[topicID]) {
                // if so, use the fixed revision
                gotTopicRevisionNumber(target, topicID, my.fixedRevTopics[id]);
            } else { // if not
            // Get the topic revision number of the current revision in PressGang
            
            // REFACTOR: The build topic revision is actually in the cf_build_id of the edit link
            // cf_build_id=6984-319298+25+Apr+2013+
            // So we could scrape it from there.
            
                // This is an immediately invoked function used to create a closure around the topicID
                // See http://stackoverflow.com/questions/6978911/closure-inside-a-for-loop-callback-with-loop-variable-as-parameter
                
                (function getTopicRevision(target, topicID) {
                    
                    pressgang.getTopic(url, topicID, function getTopicForRevisionNumberCallback(err, topic){
                        // we got the topic, now write the revision into the class of the topic element
                        if (err) return console.log('Error: ' + err + ' retrieving ' + topicID);
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
            if (count === iterations) { // if we have revision data for all topics in the book
                livePatch.writeTopicDependencies(); // write the Topic Dependency map to disk
            
                $('.jsdom').remove(); // remove the jsdom script tag
                
                var html = window.document.outerHTML;
            
                // write the updated HTML to disk
                fs.writeFile(htmlToScan, html, function(err) {
                    if (err) return console.log('Error patching book ' + err);
                    console.log('Patched ' + htmlToScan + ' on disk');
                    return callback(err, task);
                });
            }
        }
    });
}

function moveBuildToPublicDirectory (task, callback) {
    var my = jsondb.Books[task.my.url][task.my.id],
        uuid = my.uuid;
        
        wrench.copyDirRecursive(my.prePublishDir, my.publishDir, 
            function mvCallback (err){
                if (err) { // Probably disk full, or deleted public directory
                    ephemeral.write(uuid, 'Error copying built html to public directory: ' + err); 
                }
                return callback(err, task);
        });
    }
    
function getKerberosTicket (task, callback) {
     var my = jsondb.Books[task.my.url][task.my.id],
        uuid = my.uuid,
        kerbid = task.kerbid,
        kerbpwd = task.kerbpwd;
        
    // Run kdestroy to be doubly, doubly sure
    // Then get a Kerberos ticket
        
    kdestroy(task, function(err) {
        ephemeral.write(uuid, 'Requesting a new Kerberos ticket for ' + kerbid, LOG_HEADER);
        nexpect.spawn('kinit ', [kerbid + '@REDHAT.COM'])
            .expect('Password for ' + kerbid + '@REDHAT.COM')
            .sendline(kerbpwd)
            .run(function (err) {
                if (err) {
                    ephemeral.write(uuid, 'Kerberos authentication error: ' + err, [LOG_HEADER, LOG_CONSOLE]);
                } else {
                    ephemeral.write(uuid, 'Kerberos authentication complete', LOG_HEADER);
                }
                callback(err, task);
            });
    });       
}

function moveAssemblyLogToPublicDirectory (task, callback) {
    var my = jsondb.Books[task.my.url][task.my.id],
        operation = task.operation,
        id = my.id,
        PUBLIC_BUILDS_DIR = process.cwd() + '/public/builds/',
        MY_PUBLIC_BUILD_PATH_ABSOLUTE = PUBLIC_BUILDS_DIR + id + '-' + my.builtFilename,
        logURL = '/builds/' + id + '-' + my.builtFilename + '/build.log';
            
    my.remove('buildID');                
    var dest = MY_PUBLIC_BUILD_PATH_ABSOLUTE + '/' + operation + '.log';
    mv(my.assemblylog, dest, function(err) {
        if (err) {console.log(err);}             
        my.set(operation + 'logURL', logURL);
        if (callback) return callback(err, task);
    });      
}
    
function kdestroy (task, callback) { 
    var my = jsondb.Books[task.my.url][task.my.id],
        uuid = my.uuid;    
    ephemeral.write(uuid, 'Destroying Kerberos tickets', LOG_HEADER);
    // Destroy all kerberos tickets
    var kdestroyer = spawn('kdestroy', [], {
        cwd: process.cwd()
        }).on('exit', function(err) {
            if (err) {ephemeral.write(uuid, err);}
            (callback && callback(err, task));
        });    
}


function runRhpkg (task, callback) {
    var my = jsondb.Books[task.my.url][task.my.id],
        uuid = my.uuid,
        id = my.id;    
    
    exports.publishJobs[uuid] = spawn('rhpkg', ['publican-build', '--lang', 'en-US'], {
            cwd: my.publicanDirectory
        }).on('exit', function(err) {
            ephemeral.write(uuid, 'rhpkg exited with code: ' + err, [ LOG_CONSOLE, LOG_HEADER, LOG_TIMESTAMP]);
            kdestroy(task);
            jsondb.write();
            if (! my.inBrew) {  // Figure out how to get this error to clients
                callback('Looks like publishing failed. Check the <a target="_blank" href="/builds/'
                         + id + '-' + my.builtFilename + '/publish.log">publishing log for this book</a>', task);
            } 
        });
        exports.publishJobs[uuid].stdout.setEncoding('utf8');
        exports.publishJobs[uuid].stderr.setEncoding('utf8');
        exports.publishJobs[uuid].stdout.pipe(ephemeral.streams[uuid].stream);
        exports.publishJobs[uuid].stderr.pipe(ephemeral.streams[uuid].stream);
        exports.publishJobs[uuid].stdout.on('data', function(data){ 
            ephemeral.write(uuid, data, LOG_HEADER);
            if (data.indexOf('Watching tasks (this may be safely interrupted)...') != -1) {
                my.set('inBrew', true);
                callback(null, task);
            }
            if (data.indexOf('Task info: http://brewweb.devel.redhat.com/brew/taskinfo') != -1)
            {
                my.brewTask = data.substr(data.indexOf('http://'));
            }
            
            // TODO: Deal with ERROR: 
            // Deal with successful exit
            if (data.indexOf('completed successfully') != -1 && my.inBrew) {
                //Somehow get this information to clients
                ephemeral.write(uuid,  'This book was successfully <a target ="_blank" href="' + 
                    my.brewTask +'">' +  'published to Brew</a>.');
            }
            
        });
        console.log('Piping Publish output to ' + uuid);
   }
    
function assemble (url, id, operation, ultimate_cb) {
        
     // The assembly_line is used to stack build and publish jobs
    // The jobs themselves will be executed as an async series of tasks
    
        var my,        // Will be our book 
            Books = jsondb.Books,
            _operation,
            kerbpwd,
            kerbid,
            uuid;   
    
    // Check that the book exists in our metadata repository before attempting to build
    if (!Books[url] || !Books[url][id])
        return ultimate_cb('Book ' + url + ' ' + id + ' not found');
        
    my = Books[url][id];
    
    // Bounce out if already building or publishing
    if (my.publishing || my.building) return ultimate_cb && ultimate_cb('Already building or publishing');

    _operation = (typeof operation == 'string') ? operation : operation.operation;

    if (_operation == 'publish') {
        kerbpwd = operation.kerbpwd;
        kerbid = operation.kerbid;
        if (!kerbpwd || !kerbid) return ultimate_cb('Need Kerberos credentials for this operation');
    }
    
    var assembly_log = path.normalize(process.cwd() + '/' + my.bookdir + '/assembly.log');
    my.set('assemblylog', assembly_log);
    
    ephemeral.createStream(_operation, url, id, assembly_log, function (err, new_uuid) {
        uuid = new_uuid;
        console.log('Starting %s operation for %s', _operation, uuid);
        if (_operation === 'publish') {
            my.set('publishID', uuid);
            my.set('brewTask', '');
            my.set('inBrew', false);
            my.set('uuid', uuid);
            my.set('publishing', true);
            my.set('onPublishQueue', true);
        } else
        if (_operation === 'build') {
            my.set('buildID', uuid);
            my.set('uuid', uuid);
            my.set('building', true);
            my.set('onBuildQueue', true);
        }
        
        var _op = (_operation === 'publish') ? 'Publish' : 'Build';
        
        ephemeral.write(my.uuid, 
            _op +' log for ' + my.id + ' - ' + my.title, 
                        [LOG_CONSOLE, LOG_HEADER, LOG_TIMESTAMP]);
        ephemeral.write(my.uuid, 
                'Job queued.', [LOG_CONSOLE, LOG_HEADER, LOG_TIMESTAMP]); 
        my.set('onQueue', true);
        if (_operation == 'publish') my.set('onPublishQueue');
        
        return assembly_line.push({my: my, operation: _operation, kerbid: kerbid, kerbpwd: kerbpwd});
    });
}
    


