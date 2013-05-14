var pressgang = require('pressgang-rest'),
    xmlpreview = require('./../lib/xmlpreview'),
    dtdvalidate = require('./../lib/dtdvalidate'),
    livePatch = require('./../lib/livePatch'),
    Library = require('./../lib/Library'),
    krb5 = require('node-krb5'),
    ephemeral = require('./../lib/ephemeralStreams'),
    topics = require('./../lib/topicdriver'),
    assembler = require('./../lib/assembler'),
    wrench = require('wrench'),
    xmlrpc = require('xmlrpc'),
    settings = require('./../lib/settings'),
    LOG_HEADER = ephemeral.LOG_HEADER,
    LOG_CONSOLE = ephemeral.LOG_CONSOLE;

exports.restroute = restroute;

function restroute (req, res){
    var op = req.params.operation;
    console.log('Rest router called: ' + op);
    if (op === 'dtdvalidate') { dtdvalidate.dtdvalidate (req, res);
        } else
    if (op === 'addbook') { addbook(req, res); }
        else
    if (op === 'xmlpreview') { xmlpreview.xmlPreview(req, res); }
        else
    if (op === 'remove') { removebook(req, res); }
        else
    if (op === 'patch') { livePatch.patchRESTendpoint(req, res); }
        else
    if (op === 'rebuildAll') { rebuildAll(req, res); }
        else
    if (op === 'build') { build(req, res); }
        else
    if (op === 'publish') { publish(req, res); }
        else
    if (op === 'stopPublish') { stopPublish(req, res); }
        else
    if (op === 'getBookmd') { getBookmd(req, res); }
        else
    if (op === 'topicupdate') { topics.topicupdate(req, res); }
        else
    if (op === 'gettopic') { topics.gettopicRESTEndpoint(req,res); }
        else
    if (op === 'getbooks') { getBooks(req, res); }
        else
    if (op === 'getlatestpackagenumber') { getLatestPackageNumber(req,res); }
        else
    if (op === 'reboot') { reboot(req, res); }
}

function reboot(req,res) {
    console.log('Imma reboot now');
    res.send("I'll be back!");
    process.abort();
}

function getLatestPackageNumber(req, res) {
    var client, my, packageName;

    client= xmlrpc.createClient({host:  settings.brewhost , port: 80, path: '/brewhub'});
    req.query.url && req.query.id && (my = Library.Books[req.query.url][req.query.id]);
    my && (packageName = my.product.split(' ').join('_') + '-' +
    my.title.split(' ').join('_') + '-' +
    my.version + '-web-en-US');

    if (!packageName) { return res.send({code: 1, msg: "Can't find that book."}); }

    console.log('Locating package number for ' + packageName);
    client.methodCall('getLatestBuilds', [settings.brewDocsTag, {'__starstar': 1, 'package': packageName}], function (error, result){
        if (error) {
            return res.send({code: 1, msg: error}); // and bail
        }
        if (result.length === 0) {
            return res.send({code:2, msg: 'Does that package exist?'});
        }
        var pubsnum = result[0].release; // looks something like '79.el6eng'
        pubsnum = pubsnum.substr(0, pubsnum.indexOf('.')); // just get the pubsnum
        pubsnum = parseInt(pubsnum, 10); // turn it into a number so we can increment it
        pubsnum ++;

        return res.send({code:0, pubsnum: my.version + '-' + pubsnum});

        //$('revision revnumber').first().text(my.version + '-' + pubsnum);
    });
}

function getBooks(req,res) {
    res.send(Library.shadowBooks);
}

function getBookmd (req, res) {
    var url = req.query.url,
        id = req.query.id,
        Books = Library.shadowBooks;
        
    if (url && id) {
        if (Books[url] && Books[url][id]) {
            res.send(Books[url][id]);
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
        commitmsg = req.query.commitmsg,
        pguserid = req.query.pguserid;
    if (url && id && kerbid && kerbpwd) {
        console.log('Received a publish request for ' + url + ' ' + id + ' ' + commitmsg);
        
        krb5.authenticate(kerbid + '@REDHAT.COM', kerbpwd, function(err) {
            if (err) {
                console.log("Error: " + err);
                res.send({code: 1, msg: 'Kerberos authentication failed.'});
            } else {
                console.log("Kerb credentials OK");
                assembler.publish(url, id, kerbid, kerbpwd, pguserid);
//
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
        //builder.build(url, id);
        assembler.build(url, id);
        res.send({code: 0, msg: 'Build requested'});
    } else {
        res.send({code:1, msg: 'Need to send a URL and an ID'});
    }
}

function rebuildAll (req, res) {
    var count = 0;
    for (var url in Library.Books)
        for (var id in Library.Books[url]) {
            builder.build(url, id);
            count ++;
        }
    res.send({code: 0, msg: 'Sent ' + count + ' books to the rebuilder'});
}

function removebook(req,res){
    var url = req.query.url,
        id = req.query.id;
    Library.removeBook(url, id, function(err, msg) {
        if (err) { return res.send({code:1, msg: err}); }
        return res.send({code:0, msg: msg});
    });
}

function addbook (req, res){
    var url = req.query.url,
        id = req.query.id;
    console.log('Add book operation requested for ' + url + id);
    if (url && id) {
        Library.checkoutBook(url, id, function(err, msg) {
            if (err) { return res.send({code:1, msg: msg}); }
            res.send({code:0, msg: msg});
        });
    }
}

