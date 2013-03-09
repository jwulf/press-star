var builder = require('./build.js'),
    index = require('./index.js'),
    jsondb = require('./../lib/jsondb'),
    uuid = require('node-uuid');

exports.route = route;

function route (req, res) {
    var action = req.params.action;
    if (action == 'rebuild') {
        var url = req.query.url, id = req.query.id; 
        jsondb.Books[url][id].buildID = uuid.v1();
        console.log(jsondb.Books[url][id].buildID);
        builder.build(req.query.url, req.query.id);
        index.index(req,res); //res.send({'code' : 0, 'msg' : 'building'});
    } else {
        res.send({'code': 1, 'msg': 'unknown operation'});
    }
}