var fs = require('fs'),
    livePatch = require('./livePatch'),
    Stream = require('stream').Stream,
    util = require('util'),
    wrench = require('wrench'),
    pressgang = require('pressgang-rest'),
    Book = require ('./Book').Book,
    assembler = require('./assembler'),
    BOOKS_FILE_PATH = process.cwd() + '/books/',
    BOOKS_FILE_NAME = 'books.json',
    BOOKS_FILE = BOOKS_FILE_PATH + BOOKS_FILE_NAME;

exports.Books = {};
exports.shadowBooks = {};
exports.BOOKS_FILE_NAME = BOOKS_FILE_NAME;
exports.write = write;
exports.read = read;
exports.addBook = addBook;
exports.initialize = initialize;
exports.refreshMetadata = refreshMetadata;
exports.removeBook = removeBook;
exports.checkoutBook = checkoutBook;

/** Update the on disk representation of a book, post-Content spec push
 *
 * @param spec the new content specification
 * @param cb   called back if the book does not require readding
 * @returns {*}
 */
function refreshMetadata(spec, cb) {
    var md = spec.metadata, url = spec.url, id = spec.id;
    console.log(spec);
    console.log('Refreshing metadata for %s %s', url, id);

    if (exports.Books[url] && exports.Books[url][id]) {
        for (var key in md) {
            console.log('Comparing %s %s %s',key, exports.Books[url][id][key], md[key] );
            if (exports.Books[url][id][key] && exports.Books[url][id][key] !== md[key]) {
                if (key === 'title' || key === 'product' || key === 'version') {
                    console.log('Removing and readding book');
                    return removeBook(url, id, function(err, msg){
                        checkoutBook(url, id);
                    });
                } else {
                    exports.Books[url][id][key] = md[key];
                }
            }
        }
        cb && cb();
    }
}

function checkoutBook (url, id, cb){

    console.log('Check out operation')
    // First, check if the book is already checked out - should we delete it and recheck out?
    if (exports.Books[url] && exports.Books[url][id]) {
        console.log('Book already checked out');
        return cb && cb('According to our records, this book has already been added.');
    }

    console.log('No existing checkout found, proceeding...');
    pressgang.checkoutSpec(url, id, './books', function (err, spec) {
        console.log(spec);
        console.log(err);
        if (err) return cb && cb(err, err);

        // If everything went ok, update the database
        addBook(spec.metadata, cb);

    });
}

function removeBook (url, id, cb) {
    if (!exports.Books[url] && exports.Books[url][id]) { return 'Book not found!'};

    var pathURLa = process.cwd() + '/books/' + exports.Books[url][id].product + '/' + id + '-' + exports.Books[url][id].builtFilename +
           '-' + exports.Books[url][id].version;
    wrench.rmdirRecursive(pathURLa, function (err) {console.log(err + ' removing ' + pathURLa)});
    var pathURLb = process.cwd() + '/public/builds/' + id + '-' + exports.Books[url][id].builtFilename;
    wrench.rmdirRecursive(pathURLb, function (err) {console.log(err + ' removing ' + pathURLb)});
    // Nuke all the current subscriptions for this book
    livePatch.removeTopicDependenciesForBook(url, id);
    delete exports.Books[url][id];
    delete exports.shadowBooks[url][id];
    exports.write();
    exports.LibraryNotificationStream.write({update: "remove", id: id, url: id});
    cb (null, 'Book deleted');
}
 
function read (cb) {
    var _books, url, id, key;
    // Attempt to read the cache from disk
    if (fs.existsSync(BOOKS_FILE)) {
        try {
            _books = require(BOOKS_FILE);
            if (_books) {
                exports.Books = {};
                exports.shadowBooks = {};
                for (url in _books) {
                    exports.Books[url] = {};
                    exports.shadowBooks[url] = {};
                    for (id in _books[url]) {
                        exports.shadowBooks[url][id] = {}
                        exports.Books[url][id] = new Book(exports.shadowBooks[url][id]);
                        for (key in _books[url][id]) {
                            exports.Books[url][id].set(key, _books[url][id][key]);
                        }
                    }
                }
                //sortBooks();
            }

        }
        catch(e) {
            console.log('There was an error reading the books file %s : %s', BOOKS_FILE, e);
            exports.Books = {};
            exports.shadowBooks = {};
            if (cb) {return cb(e)};
        }
    } 

    // Catch all - this will apply if books.json exists, but is an empty file
    if (!exports.Books) {
        exports.Books = {};
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
                if (! exports.Books[url]) {
                    exports.Books[url] = {};
                    exports.shadowBooks[url] = {};
                }
                exports.shadowBooks[url][id] = {};
                exports.Books[url][id] = new Book(exports.shadowBooks[url][id]);
                for (var key in md) {
                    exports.Books[url][id].set(key, md[key]);            
                }
            }  
            write(md, function (err, result) {
                if (err) { return cb(err, 'There was an error checking out the book'); }
                exports.LibraryNotificationStream.write({update: "add", url: url, id: id,
                    title: exports.Books[url][id].title});
                exports.Books[url][id].on('change', notifyLibraryStream);
                assembler.build(url, id);
                return cb && cb(null, 'Successfully added ' + exports.Books[url][id].title);
            });
        } else {
            cb && cb('No url or id provided in spec')
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
         // sortBooks();
          return _cb(err);
        } else {
          console.log("JSON saved to " + BOOKS_FILE);
          if (_cb) _cb(null, 'Success!');
          //sortBooks(md, _cb);
        }
    }); 
}

// Now sorted on the client - not used atm
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

    if (_cb) { return _cb(null, _md)};
}

function initialize () {
    exports.LibraryNotificationStream =  new Stream ();
    exports.LibraryNotificationStream.writable = exports.LibraryNotificationStream.readable = true;
    exports.LibraryNotificationStream.write = notificationStreamWrite;
    exports.LibraryNotificationStream.setMaxListeners(50); // allow up to 50 listeners to the index page
    read(function () {

        for (var url in exports.Books)
            for (var id in exports.Books[url]) {
                exports.Books[url][id].building = false;
                exports.Books[url][id].buildingForReals = false;
                exports.Books[url][id].publishing = false;
                exports.Books[url][id].on('change', notifyLibraryStream);
            }
    });
}

function notifyLibraryStream (data) {

    exports.LibraryNotificationStream.write(data);
}

function notificationStreamWrite (data) {
    if (data)
        this.emit('data', data);
    return true;
}