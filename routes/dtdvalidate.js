var fs = require('fs'),
    exec = require('child_process').exec;

exports.dtdvalidate = function (req, res){
    console.log("topicValidate handler called");
    if (!req.body.xml){res.send("Body format: {'xml' : '<xmltovalidate>'}");}
    else
    {
        //console.log(req.body.xml);
        var dtdstring=('<?xml version="1.0" encoding="UTF-8"?>\n' +
            '<!DOCTYPE section PUBLIC "-//OASIS//DTD DocBook XML V4.5//EN"\n' +
            '"http://www.oasis-open.org/docbook/xml/4.5/docbookx.dtd\" []>');
        var filenumber=1;
        while (fs.existsSync("/tmp/topic"+ filenumber))
            filenumber++;
        var filename="/tmp/topic"+filenumber;
        var errorText="";
        var exitcode;
    
        fs.writeFile(filename, dtdstring + req.body.xml, function(err){
            if(err) {
                    console.log(err);
            } else {
                console.log("Saved topic file" + filename);
        }});
        
        var onFinish=function (error, stdout, stderr){
           errorText=errorText+stderr;
           console.log('stderr:' + errorText);
           console.log("sending response");
        
            if (exitcode===0)
            {
                res.send('0');
                console.log('sent: 0');
            }
            else
            {
                res.send(errorText);
                console.log('sent: ' + errorText);
            }
        }
        var command="xmllint --noout --valid " + filename;
        
        var child = exec(command, onFinish);
        child.on("exit", function(code,signal){
            console.log("Exit code: "+ code);
            exitcode = code;
             fs.unlink(filename, function(err)
            {
                if (err) {console.log(err);}
                else{console.log("Successfully deleted "+ filename);}
            });
        
            
        });
    }        
}