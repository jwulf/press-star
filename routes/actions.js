var builder = require('./build.js'),
    index = require('./index.js'),
    jsondb = require('./../lib/jsondb'),
    uuid = require('node-uuid');

exports.route = route;

function route (req, res) {
    var action = req.params.action;
    var url = req.query.url, id = req.query.id; 
    if (action == 'rebuild') {
        if (jsondb.Books[url][id]) {
            jsondb.Books[url][id].buildID = uuid.v1();
            console.log(jsondb.Books[url][id].buildID);
            builder.build(req.query.url, req.query.id);
            res.redirect('/'); 
        }
    } else 
    if (action == 'remove') {
        if (jsondb.Books[url][id]) {
            delete jsondb.Books[url][id];
            res.send({code: 0, msg: 'Removed book'});
        } else {
            res.send({code:1, msg: 'Book not found'});
        }
    } else {

        res.send({'code': 1, 'msg': 'unknown operation'});
    }
}