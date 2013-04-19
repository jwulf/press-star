var fs = require('fs'),
    exec = require('child_process').exec,
    cylon = require('pressgang-cylon'),
    PressGangCCMS = require('pressgang-rest').PressGangCCMS,
    xmlpreview = require('./../lib/xmlpreview'),
    dtdvalidate = require('./../lib/dtdvalidate'),
    livePatch = require('./../lib/livePatch'),
    builder = require('./../lib/build'),
    jsondb = require('./../lib/Books'),
    publisher = require('./../lib/publisher'),
    krb5 = require('node-krb5'),
    ephemeral = require('./../lib/ephemeralStreams'),
    topics = require('./../lib/topicdriver'),
    LOG_HEADER = ephemeral.LOG_HEADER,
    LOG_CONSOLE = ephemeral.LOG_CONSOLE;

exports.restroute = restroute;
exports.checkout = checkout;

// REST API Definition

// Add Book: Checks out a book on the deathstar

// {operation: addbook, url: <pressgang url>, id: <spec id>, 
//      [username: <pressgang user>, authtoken: <auth token>, authmethod: <authmethod>,
//      restver: <pressgang REST ver>]}
console.log("Loading stylesheet in rest router");

console.log("Loaded stylesheet in rest router");


function restroute (req, res){
    var op = req.params.operation;
    console.log('Rest router called: ' + op);
    if (op === 'dtdvalidate') {dtdvalidate.dtdvalidate (req, res);}
    else
    if (op === 'buildbook') {buildbook(req, res);}
    else
    if (op === 'buildstatus') {buildstatus(req, res);}
    else 
    if (op ==='addbook') {addbook(req, res);}
    else
    if (op ==='xmlpreview') {xmlpreview.xmlPreview(req, res);}
    else 
    if (op =='remove') {removebook(req, res);}
    else
    if (op == 'patch') {livePatch.patchRESTendpoint(req, res);}
    else
    if (op == 'rebuildAll') {rebuildAll(req, res);}
    else
    if (op == 'build') {build(req, res);}
    else 
    if (op == 'publish') {publish(req, res);}
    else
    if (op == 'stopPublish') {stopPublish(req, res);}
    else
    if (op == 'getBookmd') {getBookmd(req, res);}
    else
    if (op == 'topicupdate') {topics.topicupdate(req, res)};
}

function getBookmd (req, res) {
    var url = req.query.url,
        id = req.query.id,
        Books = jsondb.Books;
        
    if (url && id) {
        if (Books[url] && Books[url][id]) {
            res.send(Books[url][id].getAll());
        }
        else res.send({code:1, msg: 'Book not found'});
    }
    else res.send({code:1, msg: "Didn't get a url and an ID"});
}

function stopPublish (req, res) {
    var uid = req.query.uid;
    if (publisher.publishJobs && publisher.publishJobs[uid]) {
        ephemeral.write(uid, 'User requested SIGTERM for publish job', [LOG_HEADER, LOG_CONSOLE]);
        publisher.publishJobs[uid].kill('SIGTERM');        
        return res.send({code: 0, msg: 'Kill signal sent to job'});
    } else {
        console.log('Publish job not found for Stop Publish');
        return res.send({code: 1, msg: 'Publish job not found'});
    }
    res.send({code: 1, msg: "I'm confused."});
}

function publish (req, res) {
    var url = req.query.url,
        id = req.query.id,
        kerbid = req.query.kerbid,
        kerbpwd = req.query.kerbpwd,
        commitmsg = req.query.commitmsg;
    if (url && id && kerbid && kerbpwd) {
        console.log('Received a publish request for ' + url + ' ' + id + ' ' + commitmsg);
        
        krb5.authenticate(kerbid + '@REDHAT.COM', kerbpwd, function(err) {
            if (err) {
                console.log("Error: " + err);
                res.send({code: 1, msg: 'Kerberos authentication failed.'});
            } else {
                console.log("Kerb credentials OK");
                publisher.publish(url, id, kerbid, kerbpwd, commitmsg);
                res.send({code: 0, msg: 'Publish requested'});
            }
        });

    } else {
        res.send({code: 1, msg: 'Did you send a username and password?'});
    }
}

function build (req, res) {
    var url = req.query.url,
        id = req.query.id;
    if (url && id) {
        console.log('Received a build request for ' + url + ' ' + id);
        builder.build(url, id);
        res.send({code: 0, msg: 'Build requested'});
    } else {
        res.send({code:1, msg: 'Need to send a URL and an ID'});
    }
}

function rebuildAll (req, res) {
    var count = 0;
    for (var url in jsondb.Books)
        for (var id in jsondb.Books[url]) {
            builder.build(url, id);
            count ++;
        }
    res.send({code: 0, msg: 'Sent ' + count + ' books to the rebuilder'});
}


function removebook (req,res){
    var url = req.query.url,
        id = req.query.id;
    if (jsondb.Books[url])
        if (jsondb.Books[url][id])
            {
                var pathURL = 'builds/' + id + '-' + jsondb.Books[url][id].builtFilename;
                // Nuke all the current subscriptions for this book
                livePatch.removeTopicDependenciesForBook(url, id); 
                delete jsondb.Books[url][id];
                jsondb.write();
                return res.send({code:0, msg: 'Book deleted'});
            }
    res.send({code:1, msg: 'Book not found'});
}

function addbook (req, res){
    var url = req.query.url,
        id = req.query.id;
    console.log('Add book operation requested for ' + url + id);
    if (url && id)
        checkout(
            {
                url: url, 
                username: req.params.username,
                authmethod: req.params.authmethod,
                authtoken: req.params.authtoken,
                restver: req.params.restver
            },
            id, './books',
            function(err, md){
                if (!err)
                {
                    res.send({'code' : 0, 'msg' : 'Successfully checked out "' + md.title + '"'});
                }
                else
                {
                    res.send({'code' : 1, 'msg' : err});
                }
            }
        );        
}
    
function checkout (pg, specID, dir, cb){
    console.log('Check out operation')
    var pressgang = new PressGangCCMS(pg);
    // First, check if the book is already checked out
    if (jsondb.Books[pg.url] && jsondb.Books[pg.url][specID])
    {
        console.log('Book already checked out');
        cb('According to our records, this book has already been added.');
    } else {
        console.log('No existing checkout found, proceeding...')
        cylon.checkout(pg, parseInt(specID), dir, 
            function (err, md){ 
                // If everything went ok, update the database
                if (!err) {
                    jsondb.addBook(md, cb);
                    livePatch.generateStreams();
                }
                else
                {
                    console.log('Error during checkout operation');
                    console.log(err);
                    cb(err, md);
                }
            }
        ); 
       
    }   
}

function buildstatus (req, res){
    console.log('buildstatus handler called');
    res.send('build status');
}

function buildbook(req,res){
    console.log('buildbook handler called');
    res.send('build book');
}

