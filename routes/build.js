var fs = require('fs'),
    spawn = require('child_process').spawn,
    async = require('async'),
    jsondb = require('./../lib/jsondb'),
    mv = require('mv'),
    uuid = require('node-uuid'),
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
        jsondb.Books[url][id].buildID = uuid.v1();
        buildBook(url, id);
    } else {
        console.log('This book seems to have disappeared! Check it out again');
        throw new Error('This book seems to have disappeared! Check it out again');
    }
}

var q = async.queue(function(task, callback) {
    var url = task.url, id = task.id,
        uid = jsondb.Books[url][id].buildID;
    var csprocessorBuildJob = spawn('csprocessor', ['build'], {
        cwd: path.normalize(process.cwd() + '/' + jsondb.Books[url][id]['bookdir'])
    }).on('exit', function(err){csBuildDone(url, id)});
    csprocessorBuildJob.stdout.setEncoding('utf8');
    
    exports.streams[uid] = new Stream();
    exports.streams[uid].writeable = true;
    exports.streams[uid].readable = true;
    //exports.streams[uid].setEncoding('utf8');
    exports.streams[uid].end = function(){console.log('That was the end of that part');};
    exports.streams[uid].on('data',function(data){console.log(data);});
    
    csprocessorBuildJob.stdout.pipe(exports.streams[uid]);
    
   // var linereader = carrier.carry(exports.streams[uid]);
   // linereader.on('line', function(line){console.log(line); });
}, 1),

publicanQueue = async.queue(function(task, callback) {
    var url = task.url, id = task.id,
    uid = jsondb.Books[url][id].buildID;
    console.log('Initiating Publican build');
    var publicanBuild = spawn('publican', ['build', '--formats', 'html-single', '--langs', 'en-US'], {
        cwd: jsondb.Books[url][id].publicanDirectory
    }).on('exit', function(err) {
        publicanBuildComplete(url, id)
    });
    publicanBuild.stdout.setEncoding('utf8');
    publicanBuild.stdout.pipe(exports.streams[uid]);
    
}, 1)
publicanQueue.drain = buildingFinished;

function csBuildDone(url, id) {
    // Called when the csprocessor has built the spec locally
    // Now we invade the publican directory, set the brand to one we want
    // and rebuild

    /* Construct a publican.cfg file that looks like this:

	xml_lang: en-US
	type: Book
	brand: redhat-video
	chunk_first: 0
	git_branch: docs-rhel-6
	web_formats: "epub,html,html-single"

	docname: Messaging Installation and Configuration Guide
	product: Red Hat Enterprise MRG
	*/

    var publicanConfig = 
        'xml_lang: en-US \n' + 'type: Book\n' + 'brand: deathstar\n' + 
        'chunk_first: 0\n' + 'git_branch: docs-rhel-6\n' + 
        'web_formats: "epub,html, html-single\n' + 
        'docname: ' + jsondb.Books[url][id].title + '\n' + 
        'product: ' + jsondb.Books[url][id].product + '\n';

    var directory = path.normalize(process.cwd() + '/' + jsondb.Books[url][id].bookdir + '/assembly'),
        bookFilename = jsondb.Books[url][id].title.split(' ').join('_'),
        zipfile = bookFilename + '-publican.zip',
        publicanFile = directory + bookFilename + '/publican/publican.cfg',
        uid = jsondb.Books[url][id].buildID;
    
    jsondb.Books[url][id].builtFilename = bookFilename;
    jsondb.Books[url][id].publicanDirectory = directory + bookFilename + '/publican';

    console.log('Unzipping publican book in ' + directory);
    
    if (!fs.existsSync(directory + '/' + zipfile))
    {
        console.log(zipfile + ' not found.');
        return;
    }
    var zipjob = spawn('unzip', [zipfile], {
        cwd: directory
    }).on('exit', function(err) {
        fs.unlinkSync(publicanFile);
        fs.writeFileSync(publicanFile, publicanConfig, function(err) {
            if (err) {
                console.log(err);
            }
            else {
                console.log('Saved publican.cfg: ' + publicanFile);
                publicanQueue.push({url: url, id: id});
            }
        });
    });
    zipjob.stdout.setEncoding('utf8');
    zipjob.stdout.pipe(exports.streams[uid]);
}

function publicanBuildComplete(url, id) {
    mv(jsondb.Books[url][id].publicanDirectory + BUILT_PUBLICAN_DIR, BUILDS_DIR + jsondb.Books[url][id].builtFilename);
    jsondb.Books[url][id].locked = false;
    delete exports.streams[jsondb.Books[url][id].buildID];
}

function buildBook(url, id) {
    var directory = jsondb.Books[url][id].bookdir;
    
    if (!fs.existsSync(directory))
    {
        console.log(directory + ' does not exist');
        return;
    }
    var stats = fs.statSync(directory);
    if (!stats.isDirectory()) {
        console.log(directory + ' is not a directory');
        return;
    }

    // Check that a csprocessor.cfg file exists in the target location
    if (!fs.existsSync(directory + '/csprocessor.cfg')) {
        console.log('No csprocessor.cfg file found in ' + directory);
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
    
    q.push({url: url,id: id});
}

function buildingFinished(url, id) {
    // Building is finished - now we need to construct the index page
    console.log('Building is finished for ' + url + ' ' + id);
}