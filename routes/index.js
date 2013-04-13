
/*
 * GET home page.
 */
var jsondb = require('./../lib/Books');

exports.index = function(req, res){
    res.render('index', { books: jsondb.sortedBooks, data: jsondb.Books, mode: 'index'});
};