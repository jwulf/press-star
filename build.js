# /env/node

var program = require('commander'),
	fs = require('fs'),
	spawn = require('child_process').spawn, 
	async = require('async');

var books = [],
	all = false,
	book = {},
	jobCount;


program
  .version('0.0.1')
  .usage('<directory>')
  .parse(process.argv);

if (program.args) {
	// If given on or more arguments we interpret them as directory names
	for (var argument = 0; argument ++; argument < program.args.length) {
		book = {};
		book.directory = program.args[argument];
		books.push(book);
	}
} else {
	// If given no arguments we scan the current directory for books
	fs.readdirSync('.', function (err, files) {
 		if (err)
    	throw err;
 		for (var index in files) {
    		var currentFile = currentPath + '/' + files[index];
       		var stats = fs.statSync(currentFile);
       		if (stats.isDirectory())
       			if fs.statSync(currentFile + '/csprocessor.cfg').isFile {
	       			book = {};
	       			book.directory = currentFile;
	       			books.push(book);
	       		}
 		}
 	});
}

var q = async.queue(function (bookIndex, callback) {
    spawn( 'csprocessor', ['build'], {cwd: books[bookIndex].directory}).on('exit', unlockDir(bookIndex));
}, 1).drain(buildingFinished);

if (books.length > 0) {
		for (bookIndex = 0; bookIndex ++; bookIndex < books.length)
		{
			buildBook(bookIndex);
		}
}

function unlockDir(bookIndex)
{
	fs.unlinkSync(books[bookIndex].directory + '/build.lock');
}

function buildBook(bookIndex)
{
	var directory = books[bookIndex].directory;
	var stats = fs.statSync(directory);
	if (! stats.isDirectory())
	{
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
	if (! stats.isFile()) {
		console.log('No csprocessor.cfg file found in ' + directory);
		return;
	}

	// Lock the directory for building
	fs.writeFileSync(directory + '/build.lock');

	// Read the csprocessor and add the spec ID and product name to the book object

	q.push(bookIndex);
}

function buildingFinished()
{
	// Building is finished - now we need to construct the index page
}