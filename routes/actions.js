var builder = require('./build.js'),
    index = require('./index.js');

exports.route = route;

function route (req, res) {
    var action = req.params.action;
    if (action == 'rebuild') {
        builder.build(req.query.url, req.query.id);
        index.index(req,res); //res.send({'code' : 0, 'msg' : 'building'});
    } else {
        res.send({'code': 1, 'msg': 'unknown operation'});
    }
}