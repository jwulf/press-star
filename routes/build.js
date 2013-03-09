var fs = require('fs'),
    spawn = require('child_process').spawn,
    async = require('async'),
    jsondb = require('./../lib/jsondb'),
    mv = require('mv'),
    carrier = require('carrier'),
    path = require('path'), 
    Stream = require('stream').Stream;
    
var BUILT_PUBLICAN_DIR = '/tmp/en-US/html-single',
    BUILDS_DIR = process.cwd() + '/public/builds/';
    
exports.streams = { };    
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
    exports.streams[uid].end = function(data){ if (data) console.log(data);
    console.log('That was the end of that part');};
    exports.streams[uid].write = function (data) {
        if (data)
            this.emit('data', data);
            console.log('stream listener: ' + data);
        return true;
    };
    
    // We also pipe all the output to a file, so that it is persistent
    
    var buildlogURLPath = path.normalize('/' + jsondb.Books[url][id].bookdir + '/build.log');
    var buildlogFilepath = path.normalize(process.cwd() + '/' + buildlogURLPath)
    jsondb.Books[url][id].buildlog = buildlogURLPath;
    
    if (fs.existsSync(buildlogFilepath))
        fs.unlinkSync(buildlogFilepath);
        
    jsondb.Books[url][id].buildlogStream = fs.createWriteStream(buildlogFilepath, {end: false});

    // Pipe the ephemeral stream into this filestream
    exports.streams[uid].pipe(jsondb.Books[url][id].buildlogStream);
 
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
    
    csprocessorQueue.push({url: url,id: id});
}

var csprocessorQueue = async.queue(function(task, callback) {
    var url = task.url, id = task.id, uid = jsondb.Books[url][id].buildID;
    console.log(jsondb.Books[url][id]);
    console.log(jsondb.Books[url][id].buildID);

    var csprocessorBuildJob = spawn('csprocessor', ['build'], {
        cwd: path.normalize(process.cwd() + '/' + jsondb.Books[url][id]['bookdir'])
    }).on('exit', function(err){unzipCSProcessorArtifact(url, id)});
    csprocessorBuildJob.stdout.setEncoding('utf8');
    csprocessorBuildJob.stdout.pipe(exports.streams[uid]);
}, 1);

function unzipCSProcessorArtifact(url, id) {

    var directory = path.normalize(process.cwd() + '/' + jsondb.Books[url][id].bookdir + '/assembly'),
        bookFilename = jsondb.Books[url][id].title.split(' ').join('_'),
        zipfile = bookFilename + '-publican.zip',
        uid = jsondb.Books[url][id].buildID;
    
    jsondb.Books[url][id].builtFilename = bookFilename;
    jsondb.Books[url][id].publicanDirectory = directory + bookFilename + '/publican';

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
            customizePublicancfg(url,id);
        });

    zipjob.stdout.setEncoding('utf8');
    zipjob.stderr.setEncoding('utf8');
    zipjob.stdout.pipe(exports.streams[uid])
    zipjob.stderr.pipe(exports.streams[uid])
}

function customizePublicancfg (url, id) {
    var publicanConfig = 
        'xml_lang: en-US \n' + 'type: Book\n' + 'brand: deathstar\n' + 
        'chunk_first: 0\n' + 'git_branch: docs-rhel-6\n' + 
        'web_formats: "epub,html, html-single\n' + 
        'docname: ' + jsondb.Books[url][id].title + '\n' + 
        'product: ' + jsondb.Books[url][id].product + '\n';

    var directory = path.normalize(process.cwd() + '/' + jsondb.Books[url][id].bookdir + '/assembly'),
        bookFilename = jsondb.Books[url][id].title.split(' ').join('_'),
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
                    console.log('Saved publican.cfg: ' + publicanFile);
                    publicanQueue.push({url: url, id: id});
                }
            });        
        }
    });
    
};

var publicanQueue = async.queue(function(task, callback) {
    var url = task.url, id = task.id,
    uid = jsondb.Books[url][id].buildID;
    console.log('Initiating Publican build');
    var publicanBuild = spawn('publican', ['build', '--formats', 'html-single', '--langs', 'en-US'], {
        cwd: jsondb.Books[url][id].publicanDirectory
    }).on('exit', function(err) {
        publicanBuildComplete(url, id)
    });
    publicanBuild.stdout.setEncoding('utf8');
    publicanBuild.stderr.setEncoding('utf8');
    publicanBuild.stdout.pipe(exports.streams[uid]);
    publicanBuild.stderr.pipe(exports.streams[uid]);
}, 1)
publicanQueue.drain = buildingFinished;

function publicanBuildComplete(url, id) {
    mv(jsondb.Books[url][id].publicanDirectory + BUILT_PUBLICAN_DIR, BUILDS_DIR + jsondb.Books[url][id].builtFilename, 
        function mvCallback (err){
            jsondb.Books[url][id].locked = false;
            delete exports.streams[jsondb.Books[url][id].buildID];
            jsondb.Books[url][id].buildID = null;            
        });
}

function buildingFinished(url, id) {
    // Building is finished - now we need to construct the index page
    console.log('Building is finished for ' + url + ' ' + id);
}