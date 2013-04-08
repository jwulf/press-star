var fs = require('fs'),
    exec = require('child_process').exec,
    cylon = require('pressgang-cylon'),
    PressGangCCMS = require('pressgang-rest').PressGangCCMS,
    xmlpreview = require('./xmlpreview'),
    dtdvalidate = require('./dtdvalidate'),
    livePatch = require('./../lib/livePatch'),
    builder = require('./build'),
    jsondb = require('./../lib/jsondb');

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
    if (op === 'buildbook') {buildbook (req, res);}
    else
    if (op === 'buildstatus') {buildstatus (req, res);}
    else 
    if (op ==='addbook') {addbook (req, res);}
    else
    if (op ==='xmlpreview') {xmlpreview.xmlPreview (req, res);}
    else 
    if (op =='remove') {removebook (req, res);}
    else
    if (op == 'patch') {patch (req, res);}
    else
    if (op == 'rebuildAll') {rebuildAll (req, res);}
    else
    if (op == 'build') {build (req, res);}
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

function patch (req, res){
    var skynetURL = req.body.skynetURL,
        html = req.body.html,
        topicID = req.body.topicID;
        
    if (skynetURL && html && topicID)
        livePatch.patch(skynetURL, topicID, html, function (err) {
           if (err) {res.send({code:1, msg: err});} else {res.send({code:0, msg: 'Patch completed OK'});}
        });
}

function removebook(req,res){
    var url = req.query.url,
        id = req.query.id;
    if (jsondb.Books[url])
        if (jsondb.Books[url][id])
            {
                var pathURL = 'builds/' + id + '-' + jsondb.Books[url][id].builtFilename;
                // Nuke all the current subscriptions for this book
                if (livePatch.Topics[url])
                    for (var topic in livePatch.Topics[url])
                        if (topic[pathURL]) delete topic[pathURL];   
                delete jsondb.Books[url][id];
                jsondb.write();
                return res.send({code:0, msg: 'Book deleted'});
            }
    res.send({code:1, msg: 'Book not found'});
}

function addbook(req, res){
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
                    res.send({'code' : 0, 'msg' : 'Successfully checked out'});
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
        cb('According to our records, this book is already checked out. Please remove it first if you want to check it out again.');
    } else {
        console.log('No existing checkout found, proceeding...')
        cylon.checkout(pg, parseInt(specID), dir, 
            function (err, md){ 
                // If everything went ok, update the database
                if (!err) {
                    jsondb.addBook(md, cb);
                    console.log('Checked out OK');
                }
                else
                {
                    console.log('Error during checkout operation');
                    console.log(err);
                    cb(err,md);
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

