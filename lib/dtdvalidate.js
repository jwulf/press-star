var fs = require('fs'),
    exec = require('child_process').exec,
    jsdom = require('jsdom').jsdom,
    dtdstring=('<?xml version="1.0" encoding="UTF-8"?>\n' +
        '<!DOCTYPE section PUBLIC "-//OASIS//DTD DocBook XML V4.5//EN"\n' +
        '"http://www.oasis-open.org/docbook/xml/4.5/docbookx.dtd\" []>'),
        kateLanguages = ['Bash', 'C', 'C++', 'C#', 'Java', 'Python', 'Javascript', 'Perl', 'Ruby', 'HTML', 'XML'],
        kateLangSupport = { 
            'bash' : 'Bash',
            'c' : 'C',
            'c++': 'C++',
            'c#': 'C#',
            'java': 'Java',
            'python': 'Python',
            'javascript': 'Javascript',
            'perl': 'Perl',
            'ruby': 'Ruby',
            'html': 'HTML',
            'xml': 'XML'
        },
        kateURL = "http://search.cpan.org/~szabgab/Syntax-Highlight-Engine-Kate-0.06/lib/Syntax/Highlight/Engine/Kate.pm#ATTRIBUTES";

//on save
// if (kateLangSupport[langToLowerCase])
//      programlisting

// Kate Syntax Highlighting Languages: 
// http://search.cpan.org/~szabgab/Syntax-Highlight-Engine-Kate-0.06/lib/Syntax/Highlight/Engine/Kate.pm#PLUGINS

// Publican enforces strict capitalization
// https://bugzilla.redhat.com/show_bug.cgi?id=919474

// PressGang doesn't deal with it: 
// https://bugzilla.redhat.com/show_bug.cgi?id=912959

exports.dtdvalidate = function (req, res){
    
    console.log("topicValidate handler called");
    if (!req.body.xml){
        res.send("Body format: {'xml' : '<xmltovalidate>'}");
        console.log('No XML in that request!');
    }
    else
    {
        //console.log(req.body.xml);
 
        var filenumber=1;
        while (fs.existsSync("/tmp/topic"+ filenumber))
            filenumber++;
        var filename="/tmp/topic"+filenumber;
        var errorText="";
        var exitcode;
        
        var onFinish=function (error, stdout, stderr){
           errorText=errorText+stderr;
           console.log('stderr:' + errorText);
           console.log("sending response");
        
            if (exitcode===0)
            {
                // dtdvalidation passed, so let's check now for the programlisting languages
                jsdom.env(filename, [process.cwd() + '/public/scripts/jquery-1.9.1.min.js'], function (err, window){
                    if (err) { 
                        console.log('Error loading topic as DOM: ' + err);
                        res.send('0');
                         deleteTempFile(filename);     
                    } else {
                        var $ = window.$,
                        lang,
                            count = 0,
                            total = $('programlisting').length;
                            console.log(total + ' programlistings found');
                        if (total == 0) { // no programlistings to check
                            res.send('0');
                            deleteTempFile(filename);  
                        }   else { 
                        // Kate Syntax Highlighting check
                            $('programlisting').each( function () {
                                lang = $(this).attr('language');
                                console.log(lang);
                                if (lang) {
                                    if (kateLanguages.indexOf(lang) == -1) {
                                        res.send('&lt;programlisting language="<span class="text-error"><strong>' 
                                            + lang + '</strong></span>"&gt; is not a recognized ' +
                                            'Kate Highlighting Syntax language. Is it ' +
                                            '<a href="'+kateURL+'" target="_blank">capitalized correctly?</a>');
                                            return false;
                                    } else {
                                        count++;
                                        console.log(count + ' programlistings checked');    
                                       
                                    }
                                } else {
                                    count ++
                                }
                                if ( count >= total - 1) {
                                    console.log('Sending success');
                                    res.send('0');
                                }
                            });     
                            deleteTempFile(filename);
                        }
                    }
                });
            }
            else
            {
                res.send(errorText);
                deleteTempFile(filename);
                console.log('sent: ' + errorText);
            }
        }
        
        fs.writeFile(filename, dtdstring + req.body.xml, function(err){
            if(err) {
                    console.log(err);
            } else {
                console.log("Saved topic file" + filename);
                var command="xmllint --noout --valid " + filename;
        
                var child = exec(command, onFinish);
                child.on("exit", function(code,signal){
                    console.log("Exit code: "+ code);
                    exitcode = code;
                });
        }});
       
    }        
}

function deleteTempFile (filename) {
    fs.unlink(filename, function(err)
        {
            if (err) {console.log(err);}
            else{console.log("Successfully deleted "+ filename);}
        });
}