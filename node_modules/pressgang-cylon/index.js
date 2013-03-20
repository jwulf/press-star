// cylon-processor is a reimplementation of the csprocessor in pure JavaScript

var fs = require('fs');
var PressGangCCMS = require('pressgang-rest').PressGangCCMS;

exports.checkout = checkout;
exports.getSpecMetadata = getSpecMetadata;
exports.getSpec = getSpec;

var ContentSpecMetadataSchema = [
    {attr : 'specrevision', rule : /^SPECREVISION[ ]*((=.*)|$)/i},
    {attr : 'product',      rule : /^PRODUCT[ ]*((=.*)|$)/i},
    {attr : 'checksum',     rule : /^CHECKSUM[ ]*((=.*)|$)/i},
    {attr : 'subtitle',     rule : /^SUBTITLE[ ]*((=.*)|$)/i},
    {attr : 'title',        rule : /^TITLE[ ]*((=.*)|$)/i},
    {attr : 'edition',      rule : /^EDITION[ ]*((=.*)|$)/i},
    {attr : 'bookversion',  rule : /^BOOK VERSION[ ]*((=.*)|$)/i},
    {attr : 'pubsnumber',   rule : /^PUBSNUMBER[ ]*((=.*)|$)/i},
    {attr : 'description',  rule : /^(DESCRIPTION|ABSTRACT)[ ]*((=.*)|$)/i},
    {attr : 'copyright',    rule : /^COPYRIGHT HOLDER[ ]*((=.*)|$)/i},
    {attr : 'debug',        rule : /^DEBUG[ ]*((=.*)|$)/i},
    {attr : 'version',      rule : /^VERSION[ ]*((=.*)|$)/i},
    {attr : 'brand',        rule : /^BRAND[ ]*((=.*)|$)/i},
    {attr : 'buglinks',     rule : /^BUG[ ]*LINKS[ ]*((=.*)|$)/i},
    {attr : 'bzproduct',    rule : /^BZPRODUCT[ ]*((=.*)|$)/i},
    {attr : 'bzcomponent',  rule : /^BZCOMPONENT[ ]*((=.*)|$)/i},
    {attr : 'bzversion',    rule : /^BZVERSION[ ]*((=.*)|$)/i},
    {attr : 'surveylinks',  rule : /^SURVEY[ ]*LINKS[ ]*((=.*)|$)/i},
    {attr : 'translocale',  rule : /^TRANSLATION LOCALE[ ]*((=.*)|$)/i},
    {attr : 'type',         rule : /^TYPE[ ]*((=.*)|$)/i},
    {attr : 'outputstyle',  rule : /^OUTPUT STYLE[ ]*((=.*)|$)/i},
    {attr : 'publican.cfg', rule : /^PUBLICAN\\.CFG[ ]*((=.*)|$)/i},
    {attr : 'inlineinject', rule : /^INLINE INJECTION[ ]*((=.*)|$)/i},
    {attr : 'space',        rule : /^spaces[ ]*((=.*)|$)/i},
    {attr : 'dtd',          rule : /^DTD[ ]*((=.*)|$)/i},
    {attr : 'id',           rule : /^ID[ ]*((=.*)|$)/i},
//  {attr: 'bookdir',       rule : injected}     
//  {attr: 'serverurl',     rule : injected}
]

function getSpec(pg, id, cb)
{
    var pressgang = new PressGangCCMS(pg); 
    pressgang.isContentSpec(id, function (err, is){
        if (err) {cb(err)} else
        {
            if (!is) {
                cb(new Error('Requested ID is not a Content Specification'));
            } else {
                pressgang.getTopicData('xml', id, function(err, result)
                {
                    cb(err, result);
				});
			}
		}
	});
}

function getSpecMetadata(pg, id, cb)
{
	var pressgang = new PressGangCCMS(pg);
	getSpec(pg, id, function(err, result){
		if (err) {cb(err, result)} else
		{stripMetadata(pressgang.url, result, function (err, md){cb(err, md);});}
	});
}
 
// cylonprocessor.checkout 
// Checks out Content Specification to local file system
// Returns metadata record for persistence to database

// Arguments:
// pg : PressGang URL or Configuration Object
// id : Content Spec Topic ID
// dir : Local file system directory to check out into
// cb : Callback function cb(err, md)

// Returns: Content Spec metadata object

function checkout(pg, id, dir, cb){
    var pressgang = new PressGangCCMS(pg); 
    getSpecMetadata(pg, id, function(err, md)
    {
		if (err) {cb(err)}
		else 
		{
		 	checkoutSpec(md, dir, function(err){
		    	cb(err, md);});
	    }
    });
}

// Assemble a metadata record
// for Content Spec 'spec'

// Based on lnewson's Content Spec Parser
// https://github.com/lnewson/csprocessor/blob/master/csprocessor/src/main/java/com/redhat/contentspec/processor/ContentSpecParser.java

// Arguments: 
// spec : string containing spec to be mined
// cb : callback function, signature: cb(err, md)

// Returns:
// md: Content Spec Metadata object

function stripMetadata(url, spec, cb){

    // Content Spec Metadata object
    var md = {'serverurl': url};   
    var err;
    
    // Put the spec into a line-by-line array
    var array = spec.split("\n");
    
    // Iterate over the lines in the array and match against our regex patterns
    for (var i = 0; i < array.length; i ++){
       for (var j = 0; j < ContentSpecMetadataSchema.length; j++){
            if (array[i].match(ContentSpecMetadataSchema[j].rule))
            {  
                // remove trailing and leading whitespaces with regex
                md[ContentSpecMetadataSchema[j].attr] = array[i].split('=')[1].replace(/^\s+|\s+$/g,'');
            }
       }
    }    
    
//    console.log(md);
    cb(err, md);
}

function checkoutSpec(md, dir, cb) {
    console.log('checkout operation');
    if (!md) {
        cb('No Content Spec metadata found for checkout');
    }
    else {
        fs.exists(dir, function(exists) {
            if (!exists) {
                cb('The specified checkout working directory does not exist', md);
            }
            else {
                var productdir = dir + '/' + md.product.replace(/ /g, "_");
                md.bookdir = productdir + '/' + md.id + '-' + md.title.replace(/ /g, "_") + '-' + md.version;
                createDir(productdir, function(err) {
                    if (err) {
                        cb(err, md)
                    }
                    else {
                        createDir(md.bookdir, function(err) {
                            if (err) {
                                cb(err, md)
                            }
                            else {

                                var conffile = md.bookdir + '/csprocessor.cfg';

                                var conf = [
                                    '#SPEC_TITLE=' + md.title.replace(/ /g, "_"),
                                    'SPEC_ID=' + md.id, 
                                    'SERVER_URL=' + md.serverurl,
                                    ''
                                    ].join('\n');

                                fs.writeFile(conffile,
                                conf, function(err) {
                                    cb(err, md);
                                });
                            }
                        });
                    }
                });
            }
        });
    }
}

function createDir(dir, cb)
{
    fs.exists(dir, function(exists){
        if (exists) {cb();} else
        {
            fs.mkdir(dir, cb);
        }
    });
}
