
/*
 * GET home page.
 */
var Library = require('./../lib/Library');

exports.index = function(req, res){
    res.render('index', { books: Library.sortedBooks, data: Library.Books, mode: 'home'});
};