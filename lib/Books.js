var fs = require('fs'),
    livePatch = require('./livePatch'),
    Book = require( "./Book" ).Book,
    BOOKS_FILE_PATH = process.cwd() + '/books/',
    BOOKS_FILE_NAME = 'books.json',
    BOOKS_FILE = BOOKS_FILE_PATH + BOOKS_FILE_NAME;
 
exports.BOOKS_FILE_NAME = BOOKS_FILE_NAME;
exports.write = write;
exports.read = read;
exports.addBook = addBook;
exports.initialize = initialize;
 

function read (cb) {
    var _books, url, id, key;
    // Attempt to read the cache from disk
    if (fs.existsSync(BOOKS_FILE)) {
        try {
            _books = require(BOOKS_FILE);
            if (_books) {
                exports.Books = {};
                for (url in _books) {
                    exports.Books[url] = {};
                    for (id in _books[url]) {
                        exports.Books[url][id] = new Book();
                        for (key in _books[url][id]) 
                            exports.Books[url][id].set(key, _books[url][id][key]);                               
                    }
                }                
                sortBooks(cb);
                livePatch.generateStreams();                
            }

        }
        catch(e) {
            exports.Books = {};
            livePatch.generateStreams();
            if (cb) cb(e);
        }
    } 

    // Catch all - this will apply if books.json exists, but is an empty file
    if (!exports.Books) {
        exports.Books = {};
        livePatch.generateStreams();
    }
    
    if (cb) cb();   
}

function addBook(md, cb) {
    if (md) {
        var url = md.serverurl, id = md.id;
        if (url && id) {
            if (exports.Books[url] && exports.Books[id]) 
            {
                return cb('Book already exists');
            } else {
                md.url = md.serverurl;
                if (! exports.Books[url]) exports.Books[url] = {};
                exports.Books[url][id] = new Book();
                for (var key in md) {
                    exports.Books[url][id].set(key, md[key]);            
                }
                    
            }  
            write(md, cb);
        }
    }
}

// md is optional, and is used to carry the book title through to the REST API addbook response
function write (md, cb) {
    var url, id, _cb, _transport = {};
    
    _cb = (typeof md == 'function') ? md : cb;
    
    for (url in exports.Books) {
        _transport[url] = {};
        for (id in exports.Books[url]) {
            _transport[url][id] = exports.Books[url][id].getAll();
        }
    }
    fs.writeFile(BOOKS_FILE, JSON.stringify(_transport, null, 4), function(err) {
        if(err) {
          console.log(err);
          sortBooks();
          return _cb(err);
        } else {
          console.log("JSON saved to " + BOOKS_FILE);
          sortBooks(md, _cb);
        }
    }); 
}

// md is optional, and is used to carry the book title through to the REST API addbook response
function sortBooks (md, cb){
    var url, id, thisTitle, _cb, _md;
    
    exports.sortedBooks = [ ];

    _cb = (typeof md == 'function') ? md : cb;
    _md = (typeof md == 'function') ? null : md;
    
    for (url in exports.Books) {
        for (id in exports.Books[url]) {       
            thisTitle = exports.Books[url][id].product + ' - ' +  exports.Books[url][id].title;
            exports.sortedBooks.push({ title : thisTitle, url: url, id: id});
        }
    }
    exports.sortedBooks.sort( function (a, b){
        var titleA = a.title.toLowerCase(), titleB = b.title.toLowerCase();
        if (titleA < titleB)
            return -1;
        if (titleA > titleB)
            return 1;
        return 0;
    });   
    if (_cb) _cb(null, _md);
}

function initialize () {
    read(function () {
        for (var url in exports.Books)
            for (var id in exports.Books[url]) 
                exports.Books[url][id].setMany({building: false, buildingForReals: false, publishing: false});
    });
}