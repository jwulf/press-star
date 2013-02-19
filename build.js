var program = require('commander'),
    fs = require('fs'),
    spawn = require('child_process').spawn,
    async = require('async'),
    PressGangCCMS = require('pressgang-rest').PressGangCCMS;

var books = [],
    book = {},
    currentPath = process.cwd();

program.version('0.0.1').usage('<directory>').parse(process.argv);

if (program.args) {
    // If given one or more arguments we interpret them as directory names
    
    console.log('Invoked with arguments');
    for (var argument = 0; argument++; argument < program.args.length) {
        book = {};
        console.log('Given: ' + program.args[argument]);
        book.directory = program.args[argument];
        books.push(book);
    }
}
else {
    // If given no arguments we scan the current directory for books
    console.log('Scanning for books...')
    fs.readdirSync('.', function(err, files) {
        if (err) throw err;
        for (var index in files) {
            var currentFile = currentPath + '/' + files[index];
            var stats = fs.statSync(currentFile);
            if (stats.isDirectory()) if (fs.statSync(currentFile + '/csprocessor.cfg').isFile) {
                book = {};
                console.log('Found: ' + currentFile);
                book.directory = currentFile;
                books.push(book);
            }
        }
    });
}

var q = async.queue(function(bookIndex, callback) {
    console.log('Initiating csprocessor build');
    spawn('csprocessor', ['build'], {
        cwd: books[bookIndex].directory
    }).on('exit', csBuildDone(bookIndex));
}, 1);

var publicanQueue = async.queue(function(bookIndex, callback) {
    console.log('Initiating Publican build');
    spawn('publican', ['build', '--formats', 'html-single', '--langs', 'en-US'], {
        cwd: books[bookIndex].publicanDirectory
    }).on('exit', function(err) {
        unlockDir(bookIndex)
    });
}, 1)
publicanQueue.drain = buildingFinished;

if (books.length > 0) {
    for (var bookIndex = 0; bookIndex++; bookIndex < books.length) {
        buildBook(bookIndex);
    }
}

function csBuildDone(bookIndex) {
    // Called when the csprocessor has built the spec locally
    // Now we invade the publican directory, set the brand to one we want
    // and rebuild

    /* Construct a publican.cfg file that looks like this:

	xml_lang: en-US
	type: Book
	brand: redhat-video
	chunk_first: 0
	git_branch: docs-rhel-6
	web_formats: "epub,html,html-single"

	docname: Messaging Installation and Configuration Guide
	product: Red Hat Enterprise MRG
	*/

    var publicanConfig = 'xml_lang: en-US \n' + 'type: Book\n' + 'brand: deathstar\n' + 'chunk_first: 0\n' + 'git_branch: docs-rhel-6\n' + 'web_formats: "epub,html, html-single\n' + 'docname: ' + books[bookIndex].metadata.title + '\n' + 'product: ' + books[bookIndex].metadata.product + '\n';


    var directory = books[bookIndex].directory + '/assembly';
    var bookFilename = books[bookIndex].metadata.title.split(' ').join('_');
    var zipfile = bookFilename + '-publican.zip';
    var publicanFile = directory + bookFilename + '/publican/publican.cfg';
    books[bookIndex].publicanDirectory = directory + bookFilename + '/publican';

    console.log('Unzipping publican book');
    spawn('unzip', [zipfile], {
        cwd: directory
    }).on('exit', function(err) {
        fs.unlinkSync(publicanFile);
        fs.writeFileSync(publicanFile, publicanConfig, function(err) {
            if (err) {
                console.log(err);
            }
            else {
                console.log('Saved publican.cfg: ' + publicanFile);
                publicanQueue.push(bookIndex);
            }
        });
    });
}

function unlockDir(bookIndex) {
    fs.unlinkSync(books[bookIndex].directory + '/build.lock');
}

function buildBook(bookIndex) {
    var directory = books[bookIndex].directory;
    var stats = fs.statSync(directory);
    if (!stats.isDirectory()) {
        console.log(directory + ' is not a directory');
        return;
    }
    // Check if the directory is locked by another build process
    stats = fs.statSync(directory + '/build.lock');
    if (stats.isFile()) {
        console.log('Directory ' + directory + ' locked.');
        return;
    }

    // Check that a csprocessor.cfg file exists in the target location
    stats = fs.statSync(directory + '/csprocessor.cfg');
    if (!stats.isFile()) {
        console.log('No csprocessor.cfg file found in ' + directory);
        return;
    }

    // Lock the directory for building
    fs.writeFileSync(directory + '/build.lock');

    // Read the csprocessor and add the spec ID and product name to the book object
    require(directory + '/csprocessor.cfg');
    var pressgang = new PressGangCCMS(SERVER_URL);
    pressgang.getContentSpec(SPEC_ID, function(err, result) {
        books[bookIndex].metadata = result.metadata;
    });

    q.push(bookIndex);
}

function buildingFinished() {
    // Building is finished - now we need to construct the index page
    console.log('Building is finished');
}