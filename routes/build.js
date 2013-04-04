var fs = require('fs'),
    spawn = require('child_process').spawn,
    async = require('async'),
    jsondb = require('./../lib/jsondb'),
    mv = require('mv'),
    carrier = require('carrier'),
    path = require('path'), 
    Stream = require('stream').Stream,
    wrench = require('wrench'),
    humanize = require('humanize');
    
var MAX_SIMULTANEOUS_BUILDS = 2,
    BUILT_PUBLICAN_DIR = '/tmp/en-US/html-single',
    BUILDS_DIR = process.cwd() + '/public/builds/';
    
exports.streams = { }; 
exports.streamHeader = {};
exports.build = build;

function build(url, id){
    console.log('building: ' + url + ' ' + id);
    if (jsondb.Books[url] && jsondb.Books[url][id]){
        if (jsondb.Books[url][id].locked)
            return;
        jsondb.Books[url][id].locked = true;
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

    // Read the csprocessor and add the spec ID and product name to the book object
    
    // This style of reading config files I used here:
    // https://github.com/jwulf/node-pressgang-cylon-processor/blob/master/index.js
    
 /*   var csprocessorCfgSchema= [
        {attr: 'serverURL', rule: /^SERVER_URL[ ]*((=.*)|$)/i},
        {attr: 'specID', rule: /^SPEC_ID[ ]*((=.*)|$)/i}
        ];
        
    var contentspec = fs.readFileSync(directory + '/csprocessor.cfg', 'utf8').split("\n");
    var spec = {};
    
    for (var line = 0; line < contentspec.length; line ++) {
        for (var rules = 0; rules < csprocessorCfgSchema.length; rules ++) {
            if (contentspec[line].match(csprocessorCfgSchema[rules].rule))
                spec[csprocessorCfgSchema[rules].attr] = contentspec[line].split('=')[1].replace(/^\s+|\s+$/g,'');
        }
    }
    
    console.log('Got server: ' + spec.serverURL + ' spec ID: ' + spec.specID );
    cylon.getSpecMetadata(spec.serverURL, spec.specID, function (err, md)
    {
        if (err) {
            console.log(err); 
        } else {
            books[bookIndex].metadata = md;
            q.push(bookIndex);
        }
    }); */
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
        unzipCSProcessorArtifact(url, id, cb)
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
        publicanBuildComplete(url, id, cb)
    });
    publicanBuild.stdout.setEncoding('utf8');
    publicanBuild.stderr.setEncoding('utf8');
    publicanBuild.stdout.pipe(exports.streams[uid]);
    publicanBuild.stderr.pipe(exports.streams[uid]);
}, MAX_SIMULTANEOUS_BUILDS)
publicanQueue.drain = buildingFinished;

function streamWrite(url, id, msg){
    if (exports.streams[jsondb.Books[url][id].buildID])
        exports.streams[jsondb.Books[url][id].buildID].write(msg);
}

function publicanBuildComplete(url, id, cb) {
    streamWrite(url, id, 'Moving built book to public directory');
    wrench.copyDirRecursive(jsondb.Books[url][id].publicanDirectory + BUILT_PUBLICAN_DIR, BUILDS_DIR + id + '-' + jsondb.Books[url][id].builtFilename, 
        function mvCallback (err){
            if (err) { exports.streams[jsondb.Books[url][id].buildID].write(err) 
            } else {
                
                // Write skynetURL into javascript file for the deathstar brand to inject editor links
                fs.writeFile(BUILDS_DIR + id + '-' + jsondb.Books[url][id].builtFilename + '/Common_Content/scripts/skynetURL.js', 
                    'var skynetURL="' + url +'"', 'utf8',  function(err) {
                    if (err) {
                        streamWrite(url, id, 'Error writing skynetURL.js: ' + err);
                        console.log(err);
                    } else {                        
                        streamWrite(url, id, 'Wrote skynetURL.js');
                    }
                     // Building is finished 
                    streamWrite(url, id, 'Building finished for ' + url + ' ' + id);
                    // Move build log to URL-accessible location
                    var dest = BUILDS_DIR + id + '-' + jsondb.Books[url][id].builtFilename + '/build.log';
                    mv(jsondb.Books[url][id].buildlog, dest, function(err) {
                        if (err) {console.log(err)}; 
                        console.log('Moved ' + jsondb.Books[url][id].buildlog + ' to ' +  dest);
                    });
                   
                    jsondb.Books[url][id].buildID = null;                
                    jsondb.Books[url][id].locked = false;
                    delete exports.streams[jsondb.Books[url][id].buildID];
                    delete jsondb.Books[url][id].buildlogStream;
                    jsondb.write();
                    return cb(); 
                
    
                });        

            }
        });
        

}

function buildingFinished(url, id) {
   
}