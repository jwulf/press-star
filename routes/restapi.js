var fs = require('fs'),
    exec = require('child_process').exec,
    cylon = require('pressgang-cylon'),
    PressGangCCMS = require('pressgang-rest').PressGangCCMS,
    xmlpreview = require('./xmlpreview'),
    dtdvalidate = require('./dtdvalidate'),
    jsondb = require('./../lib/jsondb.js');

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
    if (op == 'persist') {persistbook (req, res);}
}

function persistbook(req, res){

// Used to persist an updated HTML version of a book
// Called from a book when it is updated by an editor

    /* 
        Example pathURL:
        /builds/8025-Messaging_Programming_Reference/     
     */
     
    var pathURL = req.body.url,
        html = req.body.html,
        skynetURL = req.body.skynetURL,
        bookID = pathURL.substr(8, pathURL.indexOf('-') - 8),
        filePath = process.cwd() + '/public' + pathURL ;
        
    // If the book is not rebuilding, then write the html to path

    if (jsondb.Books[skynetURL]) {
        if (jsondb.Books[skynetURL][bookID]) {
            if (!jsondb.Books[skynetURL][bookID].locked) {
                jsondb.Books[skynetURL][bookID].locked = true;
                fs.writeFile(filePath + 'index.html', html, function(err) {
                    jsondb.Books[skynetURL][bookID].locked = false;
                    if(err) {
                        console.log(err);
                        res.send({code: 1, msg:'Error writing file on server: ' + err})
                    } else {
                        console.log('Updated ' + pathURL);
                        res.send({code: 0, msg: 'All good baby!'});
                    }
                }); 
            } else res.send({code: 1, msg: 'Book currently rebuilding on server'});
        } else res.send({code:1, msg:'No book found with ID ' + bookID});
    } else res.send({code:1, msg:'No books found for ' + skynetURL});
}

function removebook(req,res){
    var url = req.query.url,
        id = req.query.id;
    if (jsondb.Books[url])
        if (jsondb.Books[url][id])
            {
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

