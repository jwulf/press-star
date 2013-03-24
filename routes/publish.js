var jsondb = require('./../lib/jsondb');

exports.publish = function (req, res) {
    console.log('publish requested');
    res.render('publish', { books: jsondb.sortedBooks, title: 'Death Star 2.0', mode: 'publish'});
}