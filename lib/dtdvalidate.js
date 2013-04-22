var fs = require('fs'),
    exec = require('child_process').exec,
    jsdom = require('jsdom').jsdom,
    uuid = require('node-uuid'),
    topicdriver = require('./topicdriver'),
    kateURL = "http://search.cpan.org/~szabgab/Syntax-Highlight-Engine-Kate-0.06/lib/Syntax/Highlight/Engine/Kate.pm#ATTRIBUTES";

exports.dtdvalidate = dtdvalidate;

function dtdvalidate (req, res){
    
    /* The handler for the xmllint results */
    function onXMLLintComplete (error, stdout, stderr){
        var errorDetails, errorSummary;
    
        errorDetails = stderr;
        
        if (errorDetails) { // occurs when topic fails DTD validation
        
            // Remove the parser error number from the error message. This is irrelevant to the user
           if (errorDetails.indexOf('element section') != -1)
                errorDetails = errorDetails.substr(errorDetails.indexOf('element section'));
        
            // Extract the essence of the validation message. Most errors can be located just from this part 
            if (errorDetails.indexOf('got (') == -1) {
                // for example: "Content at end of document"
                errorSummary = errorDetails; 
            } else { // we can extract the last, essential part
               errorSummary = "Invalid: <strong>" + errorDetails.substr(errorDetails.indexOf('got (') + 3) + '</strong>.';
            }  
            
            // return an error result
           return res.send({errorSummary: errorSummary, errorDetails: errorDetails});
           
        } else { 
            // dtdvalidation passed, so let's check now for the programlisting language attributes
            // this function will pass any programlisting language attributes that can be adjusted on save
            // and will only return an error for programlisting language attributes that are
            // irreparable
            topicdriver.adjustProgramlistingLanguages(xml, function (err, xml) {
               if (err) {
                   res.send({errorSummary: '"' + err + '" is not an <a href="' + kateURL + '" target="_blank">allowed &lt;programlisting&gt; language</a>', 
                        errorDetails: 'The &lt;programlisting&gt; language attribute must be one of the <a href="' + kateURL + '" target="_blank">Kate Syntax Highlighter languages</a>. ' +
                        '(Take it from the first column in the list)'}); 
               } else {
                   return res.send('0');
               }
            });
        } 
    }
        
    console.log("topicValidate handler called");
    if (!req.body.xml){
        res.send("Body format: {'xml' : '<xmltovalidate>'}");
        console.log('No XML in that request!');
    }
    else
    {
        var command,
            _dtd,
            xml = req.body.xml;
        
        // We can handle section (topics) or appendix (Revision Histories)
        var _dtdtype = (xml.indexOf('<appendix') !== -1) ? 'appendix' : 'section';
        
        var dtdstring=('<?xml version="1.0" encoding="UTF-8"?>\n' +
        '<!DOCTYPE ' + _dtdtype + ' PUBLIC "-//OASIS//DTD DocBook XML V4.5//EN"\n' +
        '"http://www.oasis-open.org/docbook/xml/4.5/docbookx.dtd\" []>');
        
        // We add the DTD definition definition to the topic xml, but only if it doesn't already have one
        // A Revision_History.xml, for example, might have one already
        _dtd = (xml.indexOf('<!DOCTYPE ') == -1) ? dtdstring : ''; 
    
        // An included DTD definition is necessary for the --valid switch to know what xmllint is validating against
        
        
        // We need to escape any apostrophes with '\''
        // http://stackoverflow.com/questions/1250079/bash-escaping-single-quotes-inside-of-single-quoted-strings
        // http://stackoverflow.com/questions/1144783/replacing-all-occurrences-of-a-string-in-javascript
        xml = xml.replace(/'/g, "'\\''");
        
        
        // We echo the DTD and topic xml into xmllint. No temporary files means it is *fast*
        command = "echo '" + dtdstring + xml + "' | xmllint --noout --valid - " ;
        
        // Execute!
        exec(command, onXMLLintComplete);
    }        
}
