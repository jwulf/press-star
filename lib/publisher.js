var async = require('async'),
    jsondb = require('./jsondb'),
    authenticated = false,
    spawn = require('child_process').spawn,
    MAX_SIMULTANEOUS_PUBLISH = 1; // Kerberos ticket needs to be unique on the OS

exports.publish = publish;

function publish (url, id, kerbid, kerbpwd) {
    if (jsondb.Books[url] && jsondb.Books[url][id]) {
        
        // We will need to build the book in a secure location, so that we publish the right state
        
        publishQ.push({url: url, id: id, kerbid: kerbid, kerbpwd: kerbpwd}, publishComplete);    
    }  else {
        console.log('Book: ' + url + ' ' + id + ' not found in database.');
    }
}

var publishQ = async.queue(function(task, cb){
    var url = task.url,
        id = task.id,
        kerbid = task.kerbid,
        kerbpwd = task.kerbpwd;
        
    console.log('Commencing publish for ' + url + ' ' + id);
    console.log(jsondb.Books[url][id].title);
}, MAX_SIMULTANEOUS_PUBLISH);


function publishComplete () {
    
}

function kdestroy (cb) {
    // Destroy all kerberos tickets
    spawn('kdestroy', [], {
        cwd: process.cwd()
        }).on('exit', function(err) {
            if (cb) cb(err);
        });    
}

function getKerberosTicket (kerbid, kerbpwd) {
    var expectCommand = '#!/usr/bin/expect -r\n' +
        'set password ' + kerbpwd + '\n' +
        'spawn kinit ' + kerbid + '@REDHAT.COM\n' +
        'expect "Password for ' + kerbid + '@REDHAT.COM:"\n' +
        'send -- "$password\\r"\n' +
        'expect eof';
        
        // Run kdestroy
        // Then run expect with the script above as an argument
        
    var krb5 = require('node-krb5');

    krb5.authenticate( kerbid + '@' + kerbRealm, kerbpwd, function(err) {
      if (err) {
        console.log("Error: " + err);
        authenticated = false;
      } else {
        console.log("OK");
        authenticated = true;
        spawn('klist', [], {
        cwd: process.cwd()
        }).on('exit', function(err) {
            if (cb) cb(err);
        });
      }
    });
        
}