/* jslint tabs 4 */

/* node_xslt settings  for node 0.8 */
var xslt = require('node_xslt'),
    stylesheet = xslt.readXsltFile("xsl/html-single.xsl"),
    cheerio = require('cheerio');

/* node_xslt doesn't work on node 0.10. libxsltjs is a pure JavaScript implementation that works 
    with node 0.10, but it doesn't have readXsltFile and can't deal with modular stylesheets...
    
    See:    https://github.com/bsuh/node_xslt/issues/16
    
    The reason we're doing this on the server, and not on the client, is because Google Chrome and Safari (webkit-based) can't do 
    xsl:include over http.
    
    See:    https://code.google.com/p/chromium/issues/detail?id=8441
            https://bugs.webkit.org/show_bug.cgi?id=60276
    
    This means that we can only reliably load the modular Docbook stylesheets on the server, and only using node 0.8 atm...
*/

/* libxsltjs for testing for node 0.10 support*/
/* var xslt = require("libxsltjs"),
    sectionNum,
    fs = require('fs'),
    stylesheetXSL = fs.readFileSync('xsl/html-single.xsl', 'utf8');
    console.log(stylesheetXSL);
    stylesheet = xslt.readXsltString(stylesheetXSL); */

exports.xmlPreview = function (req, res){    
    
     // http://stackoverflow.com/questions/1144783/replacing-all-occurrences-of-a-string-in-javascript
    function replaceAll(find, replace, str) {
        return str.replace(new RegExp(find, 'g'), replace);
    }
    
    var _url, xml, sectionNum, i, imageTags, imageTag, fileref;
    var preview="<p>Could not transform</p>";

    xml = req.body.xml; // the xml to transform to html
    sectionNum = req.body.sectionNum; // allows a caller to specify a section number for the preview
    _url = req.body.url; // the primary purpose of this is to rewrite the images tags

    // Add a leading 'http://' if the url doesn't already have one
    _url = (_url.indexOf('http://') === 0) ? _url : _url = 'http://' + _url;

    var pressGangImagesRESTURL = _url + '/seam/resource/rest/1/image/get/raw/';

    try {    
        xml = req.body.xml;

        /*
        var imageTags = ['imagedata fileref="images/', 'imagedata align="center" fileref="images/' ];

        // Check if the topic has any PressGang images in it
        if (xml.indexOf('imagedata fileref="images/') != -1)   {
            // Rewrite the URLs to grab the actual image from skynet
            xml = replaceAll('imagedata fileref="images/' + pressGangImagesRESTURL,
                'imagedata fileref="',
                xml);
            xml = replaceAll('.png"', '"', xml);
        } */


        // by default we validate it as a section within an article
        // if we are passed something that looks like an appendix (like a Revision History)
        // we can handle that too
        var _doctype = (xml.indexOf('<appendix') !== -1) ?  'appendix' : 'article';
        
        // This check allows the editor to submit topics that already have a DOCTYPE set
        // allowing, eg: an <appendix> in the case of the Revision_History topic
        if (xml.indexOf('<!DOCTYPE') == -1)        
            // This deals with the &nbsp; entity
            xml = "<?xml version='1.0' encoding='UTF-8'?>" +
                    "<!DOCTYPE " + _doctype + " PUBLIC '-//OASIS//DTD DocBook XML V4.5//EN'" +
                    " '../../DocBook/docbook-xml/docbookx.dtd' [" +
                    "<!-- HTML-like character entities -->" + 
                    /* &nbsp; entity definition */
                    "    <!ENTITY nbsp '&#160;'>" +
                    "] >" + xml;

        var xmldocument = xslt.readXmlString(xml);

        /* Specific section number support */
        
        if (sectionNum) {
            if (sectionNum.charAt(sectionNum.length -1) == '.')
                sectionNum = sectionNum.substr(0, sectionNum.length - 1);
        }

        if (sectionNum) { // If the requester specified a section number, set it as a parameter
            // escaping the sectionNum with quotes forces the type to string - otherwise xslt will
            // interpret it as a number, and anything with more than two decimal points in it will fail
            var _sectionNum = "'" + sectionNum + "'";
            
            preview = xslt.transform(stylesheet, xmldocument, [
                                                            'show.comments' , '1', 
                                                            'body.only', '1', 
                                                            'tablecolumns.extension', '0', 
                                                            'start.numbering.at', _sectionNum]); 
        } else { // No sectionNum specified
            preview = xslt.transform(stylesheet, xmldocument, [
                                                            'show.comments' , '1', 
                                                            'body.only', '1', 
                                                            'tablecolumns.extension', '0']);        
        }

        /* PressGang image URL rewrite */

        // Remove the xml and DOCTYPE declaration - first two lines - on *some* systems
        var splicer = 0;
        var arraylines = preview.split("\n");
        if (arraylines[0].indexOf('<?xml') !== -1) {splicer ++};
        if (arraylines[1].indexOf('DOCTYPE') !== -1) {splicer ++}
        arraylines.splice(0, splicer);
        preview = arraylines.join("\n");

        $ = cheerio.load(preview);

        $('[xmlns]').removeAttr('xmlns'); // all  xml must die!
        // Rewrite image src for PressGang-hosted images
        imageTags = $('img');
        for (i = 0; i < imageTags.length; i ++) {
            imageTag = $(imageTags[i]);
            fileref = imageTag.attr('src');
            if (fileref.substr(0,6) === 'images') {
                imageTag.attr('src', pressGangImagesRESTURL + fileref.substr(7, fileref.length - 11));
                console.log('replacing with:' + imageTag.attr('src'));
            }
        }
        preview = $.html();
    }
    catch (err) {   
        console.log(err);
        preview="<p>Could not transform</p>"; 
    }
    
     // http://stackoverflow.com/questions/8863179/enyo-is-giving-me-a-not-allowed-by-access-control-allow-origin-and-will-not-lo
    // http://www.wilsolutions.com.br/content/fix-request-header-field-content-type-not-allowed-access-control-allow-headers
    
    res.send(preview);
}