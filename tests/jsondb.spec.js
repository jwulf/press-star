var jsondb = require('./../lib/jsondb.js'),
    fs = require('fs');

var testURL = 'http://skynet.usersys.redhat.com:8080/TopicIndex',
    testID = 634,
    testbook = {    title: 'Messaging Programming Reference',
                    subtitle: 'Some subtitle',
                    product: 'Red Hat Enterprise MRG',
                    version: '2.3', 
                    bookdir: 'books/something',
},
    BOOKS_FILE = __dirname.substring(0, __dirname.length - 6) + '/books/' + jsondb.BOOKS_FILE_NAME;

describe('write', function (){
    it('starts with a blank slate', function (done){
        
        // Create a backup of any existing file
        if (fs.existsSync(BOOKS_FILE))
            fs.renameSync(BOOKS_FILE, BOOKS_FILE + '.orig');
            
        expect(fs.existsSync(BOOKS_FILE)).toEqual(false);
        done();
    });
    
    it('creates a file', function(done){
        jsondb.Books[testURL] = {};
        jsondb.Books[testURL][testID] = testbook;
        jsondb.write(function (err)
        { 
            if (err) console.log(err);
            expect(err).toEqual(null);  
            expect(fs.existsSync(BOOKS_FILE)).toEqual(true);
            done();
        });
    });
});

describe('read', function (){
    it('reads the correct data', function (done){
        jsondb.Books = {};
        jsondb.read(function (){
            expect(jsondb.Books[testURL][testID].title).toEqual(testbook.title);
            
            // Remove test file and restore backup, if any
            if (fs.existsSync(BOOKS_FILE))
                fs.unlinkSync(BOOKS_FILE);
            if (fs.existsSync(BOOKS_FILE + '.orig')) 
                fs.renameSync(BOOKS_FILE + '.orig', jsondb.BOOKS_FILE);

            done();
        });    
    });   
});


