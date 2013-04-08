var xslt = require('node_xslt'),
    sectionNum,
    stylesheet = xslt.readXsltFile("xsl/html-single.xsl");

exports.xmlPreview = function (req, res){
     
    console.log("xmlPreview handler called");
    var preview="<p>Could not transform</p>";
    //console.log("Message was: " + req.body.xml);
    try {
        var xmldocument = xslt.readXmlString(req.body.xml);

        if (req.body.sectionNum) {
            sectionNum = req.body.sectionNum;
            if (sectionNum.charAt(sectionNum.length -1) == '.')
                sectionNum = sectionNum.substr(0, sectionNum.length - 1);
        }
        //preview = xslt.transform(req.app.settings.xslt, xmldocument, ['body.only', '1', 'tablecolumns.extension', '0']); }
        //if (sectionNum) {
        if (false) {
            preview = xslt.transform(stylesheet, xmldocument, ['body.only', '1', 'tablecolumns.extension', '0', 'start.numbering.at', sectionNum]); 
        } else {
            preview = xslt.transform(stylesheet, xmldocument, ['body.only', '1', 'tablecolumns.extension', '0']);        
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