// Jasmine unit tests

//    "jasmine-node": "~1.0.26"

// These are the dry tests - they do not require a connection to a PressGang instance

// to execute test:
// sudo npm install -g jasmine-node
// then run
// jasmine-node pressgangccms.spec.js --verbose

// Tests the compiled js at the top level by default
var src = process.env.SRCDIR || './../pressgangccms.js';

var PG = require(src);

const   TEST_URL = 'http://pg.funkymonkey.io:8080/TopicIndex/',
        TEST_OPTS_NO_URL = { 
                                username: 'monkey',
                                authmethod: 'OAuth2',
                                authtoken: 'somesecret',
                                loglevel: 11,
                                restver: 3
                            },
        TEST_OPTS = { 
                        username: 'monkey',
                        authmethod: 'OAuth2',
                        authtoken: 'somesecret',
                        loglevel: 11,
                        restver: 3,
                        url: 'http://pg.funkymonkey.io'
                    };
                        

describe( 'PressGangCCMS Constructor with no arguments', function () {
    var testPG;
    
    beforeEach( function() {
        testPG = new PG.PressGangCCMS();
    });
    
    it('should have a url property', function () {
        expect(testPG.url).toBeDefined;
    });

    it('should have the url property set to the default', function () {
        expect(testPG.url).toEqual(PG.DEFAULT_URL); 
    });
    
    it('should have a REST version setting', function () {
        expect(testPG.restver).toBeDefined;
    });        
    
    it('should have the REST version set to default', function () {
        expect(testPG.restver).toEqual(PG.DEFAULT_REST_VER);
    });
    
    it('should not have a username', function () {
        expect(testPG.username).not.toBeDefined;
    });
    
    it('should not have an authmethod', function () {
        expect(testPG.authmethod).not.toBeDefined; 
    });

    it('should not have an authtoken', function () {
        expect(testPG.authtoken).not.toBeDefined; 
    });

});

describe( 'PressGangCCMS Constructor passing a URL only', function() {
    var testPG;
    
    beforeEach( function () {
        testPG = new PG.PressGangCCMS(TEST_URL);
    });
    
    it('should have a url property', function () {
        expect(testPG.url).toBeDefined;
    });
    
    it('should have the url set to the constructor argument', function () {
       expect(testPG.url).toEqual(TEST_URL); 
    });

    it('should have a REST version setting', function () {
        expect(testPG.restver).toBeDefined;
    });
    
    it('should have the REST version set to default', function () {
        expect(testPG.restver).toEqual(PG.DEFAULT_REST_VER);
    });
    
    it('should not have a username', function () {
        expect(testPG.username).not.toBeDefined;
    });
    
    it('should not have an authmethod', function () {
        expect(testPG.authmethod).not.toBeDefined; 
    });

    it('should not have an authtoken', function () {
        expect(testPG.authtoken).not.toBeDefined; 
    });

});
   
describe( 'PressGangCCMS Constructor with options and no URL', function () {

    var testPG;
    
    beforeEach( function () {
        testPG = new PG.PressGangCCMS(TEST_OPTS_NO_URL);
    });
    
    it('should have a url property', function () {
        expect(testPG.url).toBeDefined;
    });

    it('should have the url property set to the default', function () {
        expect(testPG.url).toEqual(PG.DEFAULT_URL); 
    });
    
    it('should have a REST version setting', function () {
        expect(testPG.restver).toBeDefined;
    });        

    it('should have the REST version set to constructor args', function () {
        expect(testPG.restver).toEqual(TEST_OPTS_NO_URL.restver);
    });

    it('should have a username', function () {
        expect(testPG.username).toBeDefined;
    });
    
    it('should have the constructor args username', function () {
        expect(testPG.username).toEqual(TEST_OPTS_NO_URL.username);
    });
    
    it('should have an authmethod', function () {
        expect(testPG.authmethod).toBeDefined; 
    });

    it('should have the constructor args authmethod', function () {
        expect(testPG.authmethod).toEqual(TEST_OPTS_NO_URL.authmethod);
    });
    
    it('should have an authtoken', function () {
        expect(testPG.authtoken).toBeDefined; 
    });

    it('should have the constructor args authtoken', function () {
        expect(testPG.authtoken).toEqual(TEST_OPTS_NO_URL.authtoken);
    });

});

describe( 'PressGangCCMS Constructor with URL in the options', function () {

    var testPG;
    
    beforeEach( function () {
        testPG = new PG.PressGangCCMS(TEST_OPTS);
    });
    
    it('should have a url property', function () {
        expect(testPG.url).toBeDefined;
    });

    it('should have the url property set to the constructor args url', 
    function () {
        expect(testPG.url).toEqual(TEST_OPTS.url); 
    });
    
    it('should have a REST version setting', function () {
        expect(testPG.restver).toBeDefined;
    });        

    it('should have the REST version set to constructor args', function () {
        expect(testPG.restver).toEqual(TEST_OPTS.restver);
    });

    it('should have a username', function () {
        expect(testPG.username).toBeDefined;
    });
    
    it('should have the constructor args username', function () {
        expect(testPG.username).toEqual(TEST_OPTS.username);
    });
    
    it('should have an authmethod', function () {
        expect(testPG.authmethod).toBeDefined; 
    });

    it('should have the constructor args authmethod', function () {
        expect(testPG.authmethod).toEqual(TEST_OPTS.authmethod);
    });
    
    it('should have an authtoken', function () {
        expect(testPG.authtoken).toBeDefined; 
    });

    it('should have the constructor args authtoken', function () {
        expect(testPG.authtoken).toEqual(TEST_OPTS.authtoken);
    });

});

