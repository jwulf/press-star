


/* To test: 

  1. No programlistings
  2. 1 programlisting, no language attribute
  3. 2 programlistings, no language attributes
  4. 1 programlisting with language attribute, correctly capitalized
  5. 2 programlistings with correct language attributes
  6. 2 programlistings, one with (correct) language attribute, one without
  7. 1 programlisting, incorrectly capitalized language attribute
  8. 2 progamlistings, one incorrectly capitalized language, one no language attribute
  9. 2 programlistings, one incorrectly capitalized, one correct language attribute
  10. 1 programlisting, unrecognizable
  11. 2 programlistings, one unrecognizable, one no language
  12. 2 programlistings, one unrecognizable, one correct language
  13. 2 programlistings, one unrecognizable, one incorrect
  14. CDATA section
*/
var adjustProgramlistingLanguages = require('./../lib/topicdriver.js').adjustProgramlistingLanguages;

var testXML = {
		'1': '<section><title>Test XML</title> <para>Some content here</para> <para>No code in this one</para></section>',
		'2': '<section><title>Test XML</title> <para>Some content here</para> <programlisting>The code goes here</programlisting></section>',
		'3': '<section><title>Test XML</title> <para>Some content here</para> <programlisting>The code goes here</programlisting><programlisting>More code goes here</programlisting></section>',
		'4': '<section><title>Test XML</title> <para>Some content here</para> <programlisting language="JavaScript">The code goes here</programlisting></section>',
		'5': '<section><title>Test XML</title> <para>Some content here</para> <programlisting language="JavaScript">The code goes here</programlisting><programlisting language="C++">More code goes here</programlisting></section>',
		'6': '<section><title>Test XML</title> <para>Some content here</para> <programlisting>The code goes here</programlisting><programlisting language="C++">More code goes here</programlisting></section>',
		'7': '<section><title>Test XML</title> <para>Some content here</para> <programlisting language="javascript">The code goes here</programlisting></section>',
		'8': '<section><title>Test XML</title> <para>Some content here</para> <programlisting language="javascript">The code goes here</programlisting><programlisting>More code goes here</programlisting></section>',
		'9': '<section><title>Test XML</title> <para>Some content here</para> <programlisting language="javascript">The code goes here</programlisting><programlisting language="C++">More code goes here</programlisting></section>',
		'10': '<section><title>Test XML</title> <para>Some content here</para> <programlisting language="blabberscript">The code goes here</programlisting></section>',
		'11': '<section><title>Test XML</title> <para>Some content here</para> <programlisting language="blabberscript">The code goes here</programlisting><programlisting>More code goes here</programlisting></section>',
		'12': '<section><title>Test XML</title> <para>Some content here</para> <programlisting language="JavaScript">The code goes here</programlisting><programlisting language="blabberscript">More code goes here</programlisting></section>',
		'13': '<section><title>Test XML</title> <para>Some content here</para> <programlisting language="javascript">The code goes here</programlisting><programlisting language="blabberscript">More code goes here</programlisting></section>'
	},
	expectedResponseXML = {
		'7': '<section><title>Test XML</title> <para>Some content here</para> <programlisting language="JavaScript">The code goes here</programlisting></section>',
		'8': '<section><title>Test XML</title> <para>Some content here</para> <programlisting language="JavaScript">The code goes here</programlisting><programlisting>More code goes here</programlisting></section>',
		'9': '<section><title>Test XML</title> <para>Some content here</para> <programlisting language="JavaScript">The code goes here</programlisting><programlisting language="C++">More code goes here</programlisting></section>',
		'10': '<section><title>Test XML</title> <para>Some content here</para> <programlisting language="blabberscript">The code goes here</programlisting></section>',
		'11': '<section><title>Test XML</title> <para>Some content here</para> <programlisting language="blabberscript">The code goes here</programlisting><programlisting>More code goes here</programlisting></section>',
		'12': '<section><title>Test XML</title> <para>Some content here</para> <programlisting language="JavaScript">The code goes here</programlisting><programlisting language="blabberscript">More code goes here</programlisting></section>',
		'13': '<section><title>Test XML</title> <para>Some content here</para> <programlisting language="JavaScript">The code goes here</programlisting><programlisting language="blabberscript">More code goes here</programlisting></section>'			
	};

describe('adjustProgramListings', function() {
	it('Correctly handles XML with no programlisting', function (done){
		adjustProgramlistingLanguages(testXML['1'], function (err, xml) {
			expect(err).toEqual(null);
			expect(xml).toEqual(testXML['1']);
			done();
		});	
	});
	
	it('Correctly handles XML with 1 programlisting, no language attribute', function(done){
		adjustProgramlistingLanguages(testXML['2'], function (err, xml) {
			expect(err).toEqual(null);
			expect(xml).toEqual(testXML['2']);
			done();
		});	
	});
	
	it('Correctly handles XML with 2 programlistings, no language attributes', function(done){
		adjustProgramlistingLanguages(testXML['3'], function(err, xml) {
			expect(err).toEqual(null);
			expect(xml).toEqual(testXML['3']);
			done();
		});
	});
	
	it('Correctly handles XML with 1 programlisting with language attribute, correctly capitalized', function(done){
		adjustProgramlistingLanguages(testXML['4'], function(err,xml) {
			expect(err).toEqual(null);
			expect(xml).toEqual(testXML['4']);
			done();
		});
	});
	
	it('Correctly handles XML with 2 programlistings with correct language attributes', function(done){
		adjustProgramlistingLanguages(testXML['5'], function(err,xml) {
			expect(err).toEqual(null);
			expect(xml).toEqual(testXML['5']);
			done();
		});	
	});
	
	it('Correctly handles XML with  2 programlistings, one with (correct) language attribute, one without', function(done){
		adjustProgramlistingLanguages(testXML['6'], function(err,xml) {
			expect(err).toEqual(null);
			expect(xml).toEqual(testXML['6']);
			done();
		});	
	});	
	
	it('Correctly handles XML with 1 programlisting, incorrectly capitalized language attribute', function(done){
		adjustProgramlistingLanguages(testXML['7'], function(err,xml) {
			expect(err).toEqual(null);
			expect(xml).toEqual(expectedResponseXML['7']);
			done();
		});	
	});	

	it('Correctly handles XML with 2 progamlistings, one incorrectly capitalized language, one no language attribute', function(done){
		adjustProgramlistingLanguages(testXML['8'], function(err,xml) {
			expect(err).toEqual(null);
			expect(xml).toEqual(expectedResponseXML['8']);
			done();
		});	
	});			

	it('Correctly handles XML with 2 programlistings, one incorrectly capitalized, one correct language attribute', function(done){
		adjustProgramlistingLanguages(testXML['9'], function(err,xml) {
			expect(err).toEqual(null);
			expect(xml).toEqual(expectedResponseXML['9']);
			done();
		});	
	});	
	
 	it('Correctly handles XML with 1 programlisting, unrecognizable', function(done){
		adjustProgramlistingLanguages(testXML['10'], function(err,xml) {
			expect(err.unrecognized).toBeDefined();
			expect(err.unrecognized).toEqual('blabberscript');
			expect(xml).toEqual(expectedResponseXML['10']);
			done();
		});	
	});	
	
 	it('Correctly handles XML with 2 programlistings, one unrecognizable, one no language', function(done){
		adjustProgramlistingLanguages(testXML['11'], function(err,xml) {
			expect(err.unrecognized).toBeDefined();
			expect(err.unrecognized).toEqual('blabberscript');
			expect(xml).toEqual(expectedResponseXML['11']);
			done();
		});	
	});	
	
 	it('Correctly handles XML with 2 programlistings, one unrecognizable, one correct language', function(done){
		adjustProgramlistingLanguages(testXML['12'], function(err,xml) {
			expect(err.unrecognized).toBeDefined();
			expect(err.unrecognized).toEqual('blabberscript');
			expect(xml).toEqual(expectedResponseXML['12']);
			done();
		});	
	});	
	
 	it('Correctly handles XML with 2 programlistings, one unrecognizable, one incorrect', function(done){
		adjustProgramlistingLanguages(testXML['13'], function(err,xml) {
			expect(err.unrecognized).toBeDefined();
			expect(err.unrecognized).toEqual('blabberscript');
			expect(xml).toEqual(expectedResponseXML['13']);
			done();
		});	
	});	

// No CDATA test yet

});
