var xslt = require('node_xslt'),
    sectionNum,
    stylesheet = xslt.readXsltFile("xsl/html-single.xsl");

exports.xmlPreview = function (req, res){
     
     
     // http://stackoverflow.com/questions/1144783/replacing-all-occurrences-of-a-string-in-javascript
    function replaceAll(find, replace, str) {
        return str.replace(new RegExp(find, 'g'), replace);
    }

    console.log("xmlPreview handler called");
    var preview="<p>Could not transform</p>";
    //console.log("Message was: " + req.body.xml);
    try {
        
        var xml = req.body.xml;
        
        // Check if the topic has any skynet images in it
        if (xml.indexOf('imagedata fileref="images/') != -1)   {
            // Rewrite the URLs to grab the actual image from skynet
            xml = replaceAll('imagedata fileref="images/',
                'imagedata fileref="http://skynet.usersys.redhat.com:8080/TopicIndex/seam/resource/rest/1/image/get/raw/',
                xml);
            xml = replaceAll('.png"', '"', xml);
        }
        
        // This deals with the &nbsp; entity
        
        xml = "<?xml version='1.0' encoding='UTF-8'?>" +
                "<!DOCTYPE article PUBLIC '-//OASIS//DTD DocBook XML V4.5//EN'" +
                " '../../DocBook/docbook-xml/docbookx.dtd' [" +
                "<!-- HTML-like character entities -->" + 
                "    <!ENTITY nbsp '&#160;'>" +
                "] >" + xml;

        var xmldocument = xslt.readXmlString(xml);

        if (req.body.sectionNum) {
            sectionNum = req.body.sectionNum;
            if (sectionNum.charAt(sectionNum.length -1) == '.')
                sectionNum = sectionNum.substr(0, sectionNum.length - 1);
        }
        //preview = xslt.transform(req.app.settings.xslt, xmldocument, ['body.only', '1', 'tablecolumns.extension', '0']); }
        if (sectionNum) {
        //if (false) {
            preview = xslt.transform(stylesheet, xmldocument, ['show.comments' , '1', 'body.only', '1', 'tablecolumns.extension', '0', 'start.numbering.at',
                                        "'" + sectionNum + "'"]); 
        } else {
            preview = xslt.transform(stylesheet, xmldocument, ['show.comments' , '1', 'body.only', '1', 'tablecolumns.extension', '0']);        
        }  
    }
    catch (err) {   
        console.log(err);
        preview="<p>Could not transform</p>"; }
    
    //console.log("Transformed: " + preview);
    
     // http://stackoverflow.com/questions/8863179/enyo-is-giving-me-a-not-allowed-by-access-control-allow-origin-and-will-not-lo
    // http://www.wilsolutions.com.br/content/fix-request-header-field-content-type-not-allowed-access-control-allow-headers
    
    res.send(preview);
}