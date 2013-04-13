var jsondb = require('./../lib/Books');

exports.publish = function (req, res) {
    console.log('publish requested');
    res.render('publish', { books: jsondb.sortedBooks, data: jsondb.Books, title: 'Death Star 2.0', mode: 'publish'});
}