var async = require('async'),
    jsondb = require('./jsondb'),
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

function getKerberosTicket (kerbid, kerbpwd) {
    var expectCommand = '#!/usr/bin/expect -r\n' +
        'set password ' + kerbpwd + '\n' +
        'spawn kinit ' + kerbid + '@REDHAT.COM\n' +
        'expect "Password for ' + kerbid + '@REDHAT.COM:"\n' +
        'send -- "$password\\r"\n' +
        'expect eof';
        
        // Run kdestroy
        // Then run expect with the script above as an argument
        
}