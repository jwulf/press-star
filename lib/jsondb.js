var fs = require('fs'),
    livePatch = require('./livePatch'),
    BOOKS_FILE_PATH = process.cwd() + '/books/',
    BOOKS_FILE_NAME = 'books.json',
    BOOKS_FILE = BOOKS_FILE_PATH + BOOKS_FILE_NAME;
  
exports.BOOKS_FILE_NAME = BOOKS_FILE_NAME;
exports.write = write;
exports.read = read;
exports.addBook = addBook;
exports.sortedBooks = [ ];
exports.initialize = initialize;

function write (cb){
    
    fs.writeFile(BOOKS_FILE, JSON.stringify(exports.Books, null, 4), function(err) {
        if(err) {
          console.log(err);
          sortBooks();
          return cb(err)
        } else {
          console.log("JSON saved to " + BOOKS_FILE);
          sortBooks(cb);
        }
    }); 
}

function sortBooks (cb){
    exports.sortedBooks = [ ];
    var url, id, thisTitle;
    for (url in exports.Books) 
        for (id in exports.Books[url]) {
            thisTitle = exports.Books[url][id].product + ' - ' +  exports.Books[url][id].title;
            exports.sortedBooks.push({ title : thisTitle, data: exports.Books[url][id]});
        }
    exports.sortedBooks.sort( function (a, b){
        var titleA = a.title.toLowerCase(), titleB = b.title.toLowerCase();
        if (titleA < titleB)
            return -1
        if (titleA > titleB)
            return 1
        return 0
    });   
    if (cb) cb();
}

function addBook (md, cb){
    if (! exports.Books[md.serverurl])
        exports.Books[md.serverurl] = {};
        
    md.displaytitle = md.product + ' - ' + md.title;
    
    exports.Books[md.serverurl][md.id] = {   
        url: md.serverurl,
        id: md.id,
        displaytitle: md.displaytitle,
        title: md.title,
        subtitle: md.subtitle,
        product: md.product,
        version: md.version,
        bookdir: md.bookdir
    }
    write(cb);
}

function read (cb){
    if (fs.existsSync(BOOKS_FILE)) {
        try {
            exports.Books = require(BOOKS_FILE);
            sortBooks(cb);
            livePatch.generateStreams();
        }
        catch(e) {if (cb) cb(e)}
    } else {
        exports.Books = {};
        if (cb) cb();
    }
}

function initialize () {
    read(function () {
        for (var url in exports.Books)
            for (var id in exports.Books[url])
                exports.Books[url][id].locked = false;
    });
}
