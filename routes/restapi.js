var fs = require('fs');
var exec = require('child_process').exec;
var cylon = require('pressgang-cylon');
var PressGangCCMS = require('pressgang-rest').PressGangCCMS;
var db = require('./dbconnector').init();

exports.restroute = restroute;
exports.checkout = checkout;

// REST API Definition

// Add Book: Checks out a book on the deathstar

// {operation: addbook, url: <pressgang url>, id: <spec id>, 
//      [username: <pressgang user>, authtoken: <auth token>, authmethod: <authmethod>,
//      restver: <pressgang REST ver>]}

function restroute (req, res){
    console.log('rest router called');
    console.log(req);
    var op = req.params.operation;
    if (op === 'dtdvalidate') {dtdvalidate (req, res);}
    else
    if (op === 'buildbook') {buildbook (req, res);}
    else
    if (op === 'buildstatus') {buildstatus (req, res);}
    else 
    if (op ==='addbook') {addbook (req, res);}
}

function addbook(req, res){
    if (req.params.url && req.params.id)
        checkout(
            {
                url: req.params.url, 
                username: req.params.username,
                authmethod: req.params.authmethod,
                authtoken: req.params.authtoken,
                restver: req.params.restver
            },
            req.params.id, './checkout',
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
    var pressgang = new PressGangCCMS(pg);
    // First, check if the book is already checked out
    db.find({id: specID, url: pressgang.url}, function (err, books)
    {
        if (err) {cb(err);} else
        {
            if (books.length === 0) { 
                cylon.checkout(pg, specID, dir, 
                    function (err, md){ 
                        // If everything went ok, update the database
                        if (!err) {
                            updateDB(md, cb);
                        }
                        else
                        {
                            cb(err,md);
                        }
                    }
                ); 
            }
            else
            {
                cb('According to our records, this book is already checked out. Please remove it first if you want to check it out again.');
            }
        }
    });    
}

function updateDB(md, cb)
{
   db.update({id: md.id, url: md.url},
   { $set:  {
       id: md.id,
       url: md.url,
       title: md.title,
       subtitle: md.subtitle,
       product: md.product,
       version: md.version,
       bookdir: md.bookdir
       }
    }, {multi: false, upsert: true}, function(err, num, raw){
        if (err) console.log(err);
        cb(null, num);
        });
        
    console.log('updateDB called');
  
}


function dtdvalidate (req, res){
    console.log("topicValidate handler called");
    if (!req.body.xml){res.send("Body format: {'xml' : '<xmltovalidate>'}");}
    else
    {
        console.log(req.body.xml);
        var dtdstring=('<?xml version="1.0" encoding="UTF-8"?>\n' +
            '<!DOCTYPE section PUBLIC "-//OASIS//DTD DocBook XML V4.5//EN"\n' +
            '"http://www.oasis-open.org/docbook/xml/4.5/docbookx.dtd\" []>');
        var filenumber=1;
        while (fs.existsSync("/tmp/topic"+ filenumber))
            filenumber++;
        var filename="/tmp/topic"+filenumber;
        var errorText="";
        var exitcode;
    
        fs.writeFile(filename, dtdstring + req.body.xml, function(err){
            if(err) {
                    console.log(err);
            } else {
                console.log("Saved topic file" + filename);
        }});
        
        var onFinish=function (error, stdout, stderr){
           errorText=errorText+stderr;
           console.log('stderr:' + errorText);
           console.log("sending response");
        
            if (exitcode===0)
            {
                res.send('0');
                console.log('sent: 0');
            }
            else
            {
                res.send(errorText);
                console.log('sent: ' + errorText);
            }
        }
        var command="xmllint --noout --valid " + filename;
        
        var child = exec(command, onFinish);
        child.on("exit", function(code,signal){
            console.log("Exit code: "+ code);
            exitcode = code;
             fs.unlink(filename, function(err)
            {
                if (err) {console.log(err);}
                else{console.log("Successfully deleted "+ filename);}
            });
        
            
        });
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

