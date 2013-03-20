// Jasmine unit tests

//    "jasmine-node": "~1.0.26"

// These are the wet tests - they rely on a specifically configured PressGang instance
// See https://bugzilla.redhat.com/show_bug.cgi?id=869500

// to execute test:
// sudo npm install -g jasmine-node
// then run
// PG_TEST_URL=<server url> jasmine-node pressgangccms-wet.spec.js --verbose

// Tests the compiled js at the top level by default
var src = process.env.SRCDIR || './../pressgangccms.js';

var PG = require(src);

const   TEST_URL = process.env.PG_TEST_URL,

        TEST_TOPIC_ID = 12095,
        TEST_TOPIC_TEXT = 'Test Topic Second Revision',
        TEST_TOPIC_REV = 326032,
        TEST_TOPIC_REV_TEXT = 'Test Topic First Revision',

        BOGUS_REVISION = 0;
        
        TEST_SPEC_ID = 12339,
        TEST_SPEC_ID_STRING = '' + TEST_SPEC_ID;
        TEST_SPEC_VER = '2.0',
        TEST_SPEC_REV = 326784,
        TEST_SPEC_REV_VER = '1.0';
        
    if (!TEST_URL) {
        console.log('No server specified. Please set PG_TEST_URL and re-run');
        return;
    }
    
describe( 'getTopicData', function () {
    
    beforeEach( function() {
        testPG = new PG.PressGangCCMS(TEST_URL);
        nullPG = new PG.PressGangCCMS('/dev/null');
    });
    
    it('should return an error with no URL', function (done) {
        delete nullPG.url;
        nullPG.getTopicData('json', TEST_TOPIC_ID, function (err, result) {
            expect( err ).not.toBe (null );    
            done();
        });
        
    });
    
    it('should return an error for a bogus URL',
        function (done) {
                testPG.url = 'httX://+_a-non-existent-domain.com:777';
                testPG.getTopicData( 'json', TEST_TOPIC_ID, function (err, result) {
                    expect( err ).not.toBe( null );
                    done ();
                });
        }
    );
    
    it('should return an error when called with unsupported operation', 
        function (done) {        
        testPG.getTopicData('jsonp', TEST_TOPIC_ID, function ( err, result ) {
            expect( err ).toEqual( jasmine.any( String ) );
            done();
            });
    });

    it('should return an error when called with a non-numeric Topic ID', 
        function (done) {        
        testPG.getTopicData('json', 'something' , function ( err, result ) {
            expect( err ).toEqual( jasmine.any( String ) );
            done();
            });
    });

    it('should return an object for a JSON request', function (done) {
        testPG.getTopicData('json', TEST_TOPIC_ID, function ( err, result ) {
            expect( result ).toEqual( jasmine.any( Object ) );
            expect( err ).toEqual( null );
            done();
            });
    });

    it('should return the right object for a JSON request', function (done) {
        testPG.getTopicData('json', TEST_TOPIC_ID, function ( err, result ) {
            expect( result.id ).toEqual( TEST_TOPIC_ID );
            expect( err ).toEqual( null );
            done();
            });
    });

    it('should return an object with an XML property for a JSON request', function (done) {
        testPG.getTopicData('json', TEST_TOPIC_ID, function ( err, result ) {
            expect( result.xml ).toBeDefined;
            expect( err ).toEqual( null );
            done();
            });
    });

    it('should return an object with an XML property of Type String for a JSON request', function (done) {
        testPG.getTopicData('json', TEST_TOPIC_ID, function ( err, result ) {
            expect( result.xml ).toEqual( jasmine.any( String ) );
            expect( err ).toEqual( null );
            done();
            });
    });

    it('should return the right string for a JSON request', function (done) {
        testPG.getTopicData('json', TEST_TOPIC_ID, function ( err, result ) {
        expect( result.xml ).toEqual( TEST_TOPIC_TEXT );
        expect( err ).toEqual( null );
        done();
            });
    });

    it('should return a string for an XML request', function (done) {
        testPG.getTopicData('xml', TEST_TOPIC_ID, function ( err, result ) {
            expect( result ).toEqual( jasmine.any( String ) );
            expect( err ).toEqual( null );
            done();
            });
    });
    
    it('should return the right string for an XML request', function (done) {
        testPG.getTopicData('xml', TEST_TOPIC_ID, function ( err, result ) {
        expect( result ).toEqual( TEST_TOPIC_TEXT );
        expect( err ).toEqual( null );
        done();
            });
    });
    
});


describe( 'getTopicData with revision', function () {
    
    beforeEach( function() {
        testPG = new PG.PressGangCCMS(TEST_URL);
        nullPG = new PG.PressGangCCMS('/dev/null');
    });
    
    it('should return an error with no URL', function (done) {
        delete nullPG.url;
        nullPG.getTopicData('json', TEST_TOPIC_ID, TEST_TOPIC_REV, function (err, result) {
            expect( err ).not.toBe(null);    
            done();
        });
        
    });
   
    it('should return an error for a bogus URL',
        function (done) {
                testPG.url = 'httX://+_a-non-existent-domain.com:777';
                testPG.getTopicData( TEST_TOPIC_ID, TEST_TOPIC_REV, function (err, result) {
                    expect( err ).not.toBe(null);
                    done ();
                });
        }
    );

    it('should return an error when called with unsupported operation', 
        function (done) {        
        testPG.getTopicData('jsonp', TEST_TOPIC_ID, TEST_TOPIC_REV, function ( err, result ) {
            expect( err ).toEqual( jasmine.any( String ) );
            done();
            });
    });

    it('should return an error when called with a non-numeric Topic ID', 
        function (done) {        
        testPG.getTopicData('json', 'something' , TEST_TOPIC_REV, function ( err, result ) {
            expect( err ).toEqual( jasmine.any( String ) );
            done();
            });
    });

    it('should return an error when called with a non-numeric Topic Revision', 
        function (done) {        
        testPG.getTopicData('json', TEST_TOPIC_ID, 'something', function ( err, result ) {
            expect( err ).not.toEqual( null );
            done();
            });
    });
    
    it('should return an object for a JSON request', function (done) {
        testPG.getTopicData('json', TEST_TOPIC_ID, TEST_TOPIC_REV, function ( err, result ) {
            expect( result ).toEqual( jasmine.any( Object ) );
            expect( err ).toEqual( null );
            done();
            });
    });

    it('should return the right object for a JSON request', function (done) {
        testPG.getTopicData('json', TEST_TOPIC_ID, TEST_TOPIC_REV, function ( err, result ) {
            expect( result.id ).toBeDefined;
            expect( result.id ).toEqual( TEST_TOPIC_ID );
            expect( err ).toEqual( null );
            done();
            });
    });

    it('should return an object with an XML property for a JSON request', function (done) {
        testPG.getTopicData('json', TEST_TOPIC_ID, TEST_TOPIC_REV, function ( err, result ) {
            expect( result.xml ).toBeDefined;
            expect( err ).toEqual( null );
            done();
            });
    });

    it('should return an object with an XML property of Type String for a JSON request', function (done) {
        testPG.getTopicData('json', TEST_TOPIC_ID, TEST_TOPIC_REV, function ( err, result ) {
            expect( result.xml ).toEqual( jasmine.any( String ) );
            expect( err ).toEqual( null );
            done();
            });
    });

    it('should return the right string for a JSON request', function (done) {
        testPG.getTopicData('json', TEST_TOPIC_ID, TEST_TOPIC_REV, function ( err, result ) {
        expect( result.xml ).toEqual( TEST_TOPIC_REV_TEXT );
        expect( err ).toEqual( null );
        done();
            });
    });

    it('should return a string for an XML request', function (done) {
        testPG.getTopicData('xml', TEST_TOPIC_ID, TEST_TOPIC_REV, function ( err, result ) {
            expect( result ).toEqual( jasmine.any( String ) );
            expect( err ).toEqual( null );
            done();
            });
    });
    
    it('should return the right string for an XML request', function (done) {
        testPG.getTopicData('xml', TEST_TOPIC_ID, TEST_TOPIC_REV, function ( err, result ) {
        expect( result ).toEqual( TEST_TOPIC_REV_TEXT );
        expect( err ).toEqual( null );
        done();
            });
    });
    
});

describe( 'getTopicTags', function () {
   
    beforeEach( function() {
        testPG = new PG.PressGangCCMS(TEST_URL);
        nullPG = new PG.PressGangCCMS('/dev/null');
    });
    
    it('should return an error if given a bogus URL', function (done) {
        testPG.url = 'httX://+_a-non-existent-domain.com:777';
        testPG.getTopicData( 'topic-tags', TEST_TOPIC_ID, function (err, result) {
            expect( err ).not.toBe(null);
            done ();
        });
    });
        
    it('should return an array for a valid topic', function (done) {
        testPG.getTopicData( 'topic_tags', TEST_TOPIC_ID, function (err, result) {
            expect( result ).toEqual( jasmine.any( Array ) );
            expect( err ).toBe(null);
            done ();
        });
    });
        
    it('should return an array for a valid spec', function (done) {
        testPG.getTopicData( 'topic_tags', TEST_SPEC_ID, function (err, result) {
            expect( result ).toEqual( jasmine.any( Array ) );
            expect( err ).toBe( null );
            done ();
        });
    });
   
    it('should return an array length 1 for our test spec', function (done) {
        testPG.getTopicData( 'topic_tags', TEST_SPEC_ID, function (err, result) {
            expect( result.length ).toEqual( 1 );
            expect( err ).toBe( null );
            done ();
        });
    });

    it('should return the correct tag for a content spec', function (done) {
        testPG.getTopicData( 'topic_tags', TEST_SPEC_ID, function (err, result) {
            expect( result[0].item.id ).toEqual( PG.CONTENT_SPEC_TAG_ID );
            expect( err ).toBe( null );
            done ();
        });
    });

    
// TODO: Further testing of getTopicData for topic_tags
});

describe( 'isContentSpec', function () {
    var testPG, flag;
    
    beforeEach( function() {
        testPG = new PG.PressGangCCMS(TEST_URL);
    });
      
    it('should return an error for a bogus URL',
        function (done) {
                testPG.url = 'httX://+_a-non-existent-domain.com:777';
                testPG.isContentSpec( TEST_TOPIC_ID , function (err, result) {
                    expect( err ).not.toBe(null);
                    done ();
                });
        }
    );
  
    it('should return an error when called with a non-numeric Topic ID', 
        function (done) { 
            testPG.isContentSpec('something', function (err, result) { 
                expect( err ).not.toEqual( null );
                done (); 
            })
        }
    );
    
    it('should return false for an non-existing Content Spec',
        function (done) {
            testPG.isContentSpec( 0, function (err, result) {
                expect(result).toBe(false);
                expect( err ).toEqual( null );
                done ();
            });
        }
    );

    it('should return false for an non-Content Spec topic',
        function (done) {
            testPG.isContentSpec( TEST_TOPIC_ID, function (err, result) {
                expect(result).toBe(false);
                expect( err ).toEqual( null );
                done ();
            });
        }
    );
    
      it('should return true for an existing Content Spec', 
        function (done) { 
            testPG.isContentSpec(TEST_SPEC_ID, function (err, result) { 
                expect(result).toBe(true); 
                expect( err ).toEqual( null );
                done (); 
            })
        }
    );
});

describe( 'getSpec with no revision', function(){
    
    beforeEach( function() {
        testPG = new PG.PressGangCCMS(TEST_URL);
    });
   
   it('should return an error when passed a non-Spec ID', function ( done ) {
        testPG.getSpec( TEST_TOPIC_ID, function ( err, result ) {
            expect( err ).not.toBe( null );
            done ();
        });
   });
   
   it('should not return an error when passed a valid Spec ID', function ( done ) {
        testPG.getSpec( TEST_SPEC_ID, function ( err, result ) {
            expect( err ).toEqual( null );
            done ();
        });
   });

   it('should return a result when passed a valid Spec ID', function ( done ) {
        testPG.getSpec( TEST_SPEC_ID, function ( err, result ) {
            expect( result ).not.toBe( null );
            done ();
        });
   });
      
      it('should return a Metadata record when passed a valid Spec ID', function ( done ) {
        testPG.getSpec( TEST_SPEC_ID, function ( err, result ) {
            expect( result.metadata ).toBeDefined;
            done ();
        });
   });
   
      it('should return a Spec when passed a valid Spec ID', function ( done ) {
        testPG.getSpec( TEST_SPEC_ID, function ( err, result ) {
            expect( result.spec ).toBeDefined;
            done ();
        });
   });

    it('should return the correct ID when passed a valid Spec ID', function ( done ) {
        testPG.getSpec( TEST_SPEC_ID, function ( err, result ) {
            expect( result.metadata.id ).toEqual( TEST_SPEC_ID_STRING );
            done ();
        });
   });
   
   it('should return the latest version when passed no revision', function (done) {
        testPG.getSpec( TEST_SPEC_ID, function ( err, result ) {
            expect( result.metadata.version ).toEqual( TEST_SPEC_VER );
            done ();
        });
   });         
});

describe( 'getSpec with revision', function(){
    
    beforeEach( function() {
        testPG = new PG.PressGangCCMS(TEST_URL);
        nullPG = new PG.PressGangCCMS('/dev/null');
    });
   
   it('should return an error when passed an invalid revision', function ( done ) {
        testPG.getSpec( TEST_TOPIC_ID, BOGUS_REVISION, function ( err, result ) {
            expect( err ).not.toBe( null );
            done ();
        });
   });
   
   it('should not return an error when passed a valid revision', function ( done ) {
        testPG.getSpec( TEST_SPEC_ID, TEST_SPEC_REV, function ( err, result ) {
            expect( err ).toEqual( null );
            done ();
        });
   });

   it('should return a result when passed a valid Spec ID', function ( done ) {
        testPG.getSpec( TEST_SPEC_ID, TEST_SPEC_REV, function ( err, result ) {
            expect( result ).not.toBe( null );
            done ();
        });
   });
      
      it('should return a Metadata record when passed a valid revision', function ( done ) {
        testPG.getSpec( TEST_SPEC_ID, TEST_SPEC_REV, function ( err, result ) {
            expect( result.metadata ).toBeDefined;
            done ();
        });
   });
   
      it('should return a Spec when passed a valid Spec ID', function ( done ) {
        testPG.getSpec( TEST_SPEC_ID, TEST_SPEC_REV, function ( err, result ) {
            expect( result.spec ).toBeDefined;
            done ();
        });
   });

    it('should return the correct ID when passed a valid revision', function ( done ) {
        testPG.getSpec( TEST_SPEC_ID, TEST_SPEC_REV,function ( err, result ) {
            expect( result.metadata.id ).toEqual( ''+ TEST_SPEC_ID );
            done ();
        });
   });
   
   it('should return the correct version when passed a revision', function (done) {
        testPG.getSpec( TEST_SPEC_ID, TEST_SPEC_REV, function ( err, result ) {
            expect( result.metadata.version ).toEqual( TEST_SPEC_REV_VER );
            done ();
        });
   });         
});
