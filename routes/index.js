
/*
 * GET home page.
 */
var jsondb = require('./../lib/jsondb');

exports.index = function(req, res){
    res.render('index', { books: jsondb.sortedBooks, mode: 'index'});
};