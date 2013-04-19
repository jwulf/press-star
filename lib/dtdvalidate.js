var fs = require('fs'),
    exec = require('child_process').exec,
    jsdom = require('jsdom').jsdom,
    uuid = require('node-uuid'),
    topicdriver = require('./topicdriver'),
    dtdstring=('<?xml version="1.0" encoding="UTF-8"?>\n' +
        '<!DOCTYPE section PUBLIC "-//OASIS//DTD DocBook XML V4.5//EN"\n' +
        '"http://www.oasis-open.org/docbook/xml/4.5/docbookx.dtd\" []>'),
    kateURL = "http://search.cpan.org/~szabgab/Syntax-Highlight-Engine-Kate-0.06/lib/Syntax/Highlight/Engine/Kate.pm#ATTRIBUTES";

exports.dtdvalidate = function (req, res){
    
    console.log("topicValidate handler called");
    if (!req.body.xml){
        res.send("Body format: {'xml' : '<xmltovalidate>'}");
        console.log('No XML in that request!');
    }
    else
    {
        var xml = req.body.xml,
            errorDetails, errorSummary;
    
        function onXMLLintComplete (error, stdout, stderr){
            // We don't need the temporary file any more, so delete it
            console.log('On Finish');
            
            errorDetails = stderr;
            
            if (errorDetails) { // occurs when topic fails DTD validation
            
                // Remove the temporary file name from the error message. This is irrelevant to the user
              //  if (errorDetails.indexOf('element section') != -1)
                //    errorDetails = errorDetails.substr(errorDetails.indexOf('element section'));
            
                // Extract the essence of the validation message. Most errors can be located just from this part 
                if (errorDetails.indexOf('got (') == -1) {
                    errorSummary = errorDetails; // Not sure what kind of error message this is, so give the whole thing
                } else { // we can extract the last, essential part
                   errorSummary = " Error: <strong>" + errorDetails.substr(errorDetails.indexOf('got (') + 3) + '</strong>. [<a href="#">Click for more detail</a>]';
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
        var command="echo '" + dtdstring + xml + "' | xmllint --noout --valid - " ;
    
        var child = exec(command, onXMLLintComplete);
    }        
}
