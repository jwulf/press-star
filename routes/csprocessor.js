// This module wraps the csprocessor binary and makes it automatable via socket.io

exports.build = build;

var restapi = require('./restapi');
var cylon = require('pressgang-cylon');

function build (filename, specID){
    return true;
}
/*cylon.getSpecMetadata('http://skynet.usersys.redhat.com:8080/TopicIndex', 8844,
function(err, result){console.log(err); console.log(result);});
*/
restapi.checkout('http://skynet.usersys.redhat.com:8080/TopicIndex', 8844, '/tmp/deathstar',
    function (err,md){
        console.log('done');
        if (err) {console.log(err);}
        else
        {// console.log('Content Spec checked out to: ' + md.bookdir);
        console.log(md);}
    });
    



