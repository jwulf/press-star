var async = require('async'),
    jsondb = require('./jsondb'),
    authenticated = false,
    spawn = require('child_process').spawn,
    nexpect = require('nexpect'),
    path = require('path'), 
    wrench = require('wrench'),
    humanize = require('humanize'),
    fs = require('fs'),
    mv = require('mv'),
    ephemeral = require('./ephemeralStreams'),
    MAX_SIMULTANEOUS_PUBLISH = 1, // Kerberos ticket needs to be unique on the OS
    LOG_HEADER = ephemeral.LOG_HEADER,
    LOG_CONSOLE = ephemeral.LOG_CONSOLE,
    LOG_TIMESTAMP = ephemeral.LOG_TIMESTAMP;

/*

Book properties related to publishing:

publishID - uuid for ephemeral streams
publishlog - absolute filepath to publish log
hasPublishLog - has publish log in public html dir
publishing -  is being published atm
onPublishQueue - is currently in the queue for publishing

*/

exports.publish = publish;

function publish (url, id, kerbid, kerbpwd, commitmsg) {
    var Books = jsondb.Books,
        publishlogURLPath = path.normalize('/' + Books[url][id].bookdir + '/publish.log'),
        publishlog = path.normalize(process.cwd() + '/' + publishlogURLPath);
        
    console.log('Publisher called for ' + url + ' ' + id);
    if (Books[url] && Books[url][id]) {
        
        // We will need to build the book in a secure location, so that we publish the right state
        // Eventually we'll check the book out, build it with Publican, then publish it asynchronously from the file system    
        // For now, we'll just queue a csprocessor publish command.
        // This means the book is published as it is when it hits the front of the queue, not as it is when the publish
        // was requested.
        
        Books[url][id].publishing = true;
        ephemeral.createStream('publish', url, id, publishlog, function (err, publishUUID) {
            Books[url][id].onPublishQueue = true;
            Books[url][id].publishID = publishUUID;
            Books[url][id].publishlog = publishlog;
            ephemeral.write(publishUUID, 'Queuing publish job for ' + url + ' ' + id, [LOG_CONSOLE, LOG_HEADER]);
            ephemeral.write(publishUUID, Books[url][id].title, [LOG_CONSOLE, LOG_HEADER]);
            publishQ.push({url: url, id: id, kerbid: kerbid, kerbpwd: kerbpwd, commitmsg: commitmsg}, publishComplete);    
        });
    }  else {
        console.log('Book: ' + url + ' ' + id + ' not found in database.');
    }
}

var publishQ = async.queue(function(task, cb){
    var url = task.url,
        id = task.id,
        kerbid = task.kerbid,
        kerbpwd = task.kerbpwd,
        commitmsg = task.commitmsg,
        Books = jsondb.Books,
        publishUUID = Books[url][id].publishUUID;
    
    Books[url][id].onPublishQueue = false;
    ephemeral.write(publishUUID, 'Commencing publish for ' + url + ' ' + id, [LOG_CONSOLE, LOG_HEADER]);
    getKerberosTicket(publishUUID, kerbid, kerbpwd, function (err) {
        csprocessorPublish(url, id, commitmsg, cb);       
    });
}, MAX_SIMULTANEOUS_PUBLISH);


function publishComplete () {
    
}

function getKerberosTicket (publishUUID, kerbid, kerbpwd, cb) {
    var expectCommand = '#!/usr/bin/expect -r\n' +
        'set password ' + kerbpwd + '\n' +
        'spawn kinit ' + kerbid + '@REDHAT.COM\n' +
        'expect "Password for ' + kerbid + '@REDHAT.COM:"\n' +
        'send -- "$password\\r"\n' +
        'expect eof';
        
        // Run kdestroy
        // Then run expect with the script above as an argument
        
    kdestroy(publishUUID, function(err) {
        ephemeral.write(publishUUID, 'Requesting a new Kerberos ticket', LOG_HEADER);
        nexpect.spawn('kinit ', [kerbid + '@REDHAT.COM'])
            .expect('Password for ' + kerbid + '@REDHAT.COM')
            .sendline(kerbpwd)
            .run(function (err) {
                if (!err) {
                    ephemeral.write(publishUUID, 'Kerberos authentication complete', LOG_HEADER);
                    if (cb) cb(err);
                } else {
                    ephemeral.write(publishUUID, 'Kerberos authentication error: ' + err, [LOG_HEADER, LOG_CONSOLE]);
                }
            });
    });       
}

function kdestroy (pubID, cb) { 
    ephemeral.write(pubID, 'Destroying Kerberos tickets', LOG_HEADER);
    // Destroy all kerberos tickets
    var kdestroyer = spawn('kdestroy', [], {
        cwd: process.cwd()
        }).on('exit', function(err) {
            if (err) ephemeral.write(pubID, err);
            if (cb) cb(err);
        });    
    kdestroyer.stdout.setEncoding('utf8');
    kdestroyer.stderr.setEncoding('utf8');
    if (pubID) {
        console.log('Piping kdestroy output to ' + pubID);
        kdestroyer.stdout.pipe(ephemeral.streams[pubID].stream);
        kdestroyer.stderr.pipe(ephemeral.streams[pubID].stream);
    }
}

function csprocessorPublish(url, id, commitmsg, cb){
    var Books = jsondb.Books,
        commandopts = commitmsg ? ['publish', '--fetch-pubsnum', '--pub-message', '"' + commitmsg +'"', '-H', url, id ] : ['publish', '--fetch-pubsnum', '-H', url, id],
        publishDir = process.cwd() + '/tmp/publish/' + id + '-' + jsondb.Books[url][id].builtFilename,
        uuid = jsondb.Books[url][id].publishID,    
        BUILDS_DIR = process.cwd() + '/public/builds/',
        pathURLAbsolute = BUILDS_DIR + id + '-' + jsondb.Books[url][id].builtFilename,
        dest = pathURLAbsolute + '/publish.log';
    
    if (fs.existsSync(publishDir))
        wrench.rmdirSyncRecursive(publishDir);
        
    fs.mkdirSync(publishDir);
    
    ephemeral.write(uuid, 'Initiated csprocessor publish with options: ' + commandopts, [LOG_CONSOLE, LOG_HEADER, LOG_TIMESTAMP]);
    if (!exports.publishJobs) exports.publishJobs = {};
    exports.publishJobs[uuid] = spawn('csprocessor', commandopts, {
        cwd: publishDir
    }).on('exit', function(err) {
        ephemeral.write(uuid, 'Publish exited with code: ' + err, [ LOG_CONSOLE, LOG_HEADER, LOG_TIMESTAMP]);
        return kdestroy(uuid, function () {
            ephemeral.write(uuid, 'Moving ' + Books[url][id].publishlog + ' to ' +  dest, [LOG_HEADER, LOG_TIMESTAMP]);
            mv(Books[url][id].publishlog, dest, function(err) {
                if (err) return ephemeral.write(uuid, 'Error moving publish log: ' + err, [LOG_CONSOLE, LOG_TIMESTAMP]); 
                ephemeral.write(uuid, 'Moved ' + Books[url][id].publishlog + ' to ' +  dest, [LOG_HEADER, LOG_CONSOLE]);
            });
            // move publish log to public directory
            if (fs.existsSync(publishDir))
                wrench.rmdirSyncRecursive(publishDir);
            ephemeral.retire(uuid);
            delete Books[url][id].publishID;
            Books[url][id].publishing = false;
            Books[url][id].hasPublishLog = true;
            jsondb.write();
            if (cb) return cb();
        });
    });
    exports.publishJobs[uuid].stdout.setEncoding('utf8');
    exports.publishJobs[uuid].stderr.setEncoding('utf8');
    exports.publishJobs[uuid].stdout.on('data', function(data){ ephemeral.write(uuid, data, LOG_HEADER);});
    console.log('Piping Publish output to ' + uuid);
   // publishJob.stdout.pipe(ephemeral.streams[uuid].stream);
}


