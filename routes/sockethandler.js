var fs=require('fs'),
    spawn = require('child_process').spawn,
    carrier = require('carrier'),
    builder = require('./build.js');

exports.socketHandler = socketHandler;

var cmd_running = false;    

function socketHandler(client){

    console.log('Client connected');
    client.send('{"success": 1}');
    client.on('msg', function(data) {
        console.log('Client just sent:', data); 
    }); 
    client.on('pushspec', function(data){pushSpec(data, client);});
    client.on('getBuildLog', function(data) {getBuildLog(data, client);})
    
    client.on('disconnect', function() {
        console.log('Bye client :(');
    }); 
}

function getBuildLog(data, client){
    console.log('Build Log requested via websocket for ' + data.buildID);
    if (! builder.streams[data.buildID]) {
        console.log('Stream does not exist - job finished?');
        client.emit('cmdoutput', 'No output stream for this job. Has it completed?');
    } else {
       builder.streams[data.buildID].on('line', function(line){client.emit('cmdoutput',line); console.log(line); }); 
    }
}

function pushSpec(data, client) {
    console.log('Received content spec push request: ' + data.command);
    var filenumber=1;
    while (fs.existsSync("/tmp/cspec"+ filenumber))
        filenumber++;
    var filename="/tmp/cspec"+filenumber;

    console.log('Creating local file: ' + filename);
    console.log('Client pushed: ' + data);
    
    fs.writeFile(filename, data.spec, function(err){
        if(err) {
                console.log(err);
                client.emit('cmdoutput', 'Failed to create file on server');
                cmd_running = false;
        } else {
            console.log("Saved spec file" + filename);
            var command = 'csprocessor';
            var server = data.server;
            client.emit('cmdstart','started');
            console.log('Commencing ' + data.command + ' operation');
            var msg = 'Commencing ' + data.command;
			if (data.opts) msg = msg + data.opts;
			msg = msg + ' operation against ' + server;
            client.emit('cmdoutput', msg);
            client.emit('cmdoutput','');
			var cmd = [];
			cmd.push(data.command);
			if (data.opts) cmd.push(data.opts);
			cmd.push('-u');
			cmd.push('jwulf');
			cmd.push('-H');
			cmd.push(server);
			cmd.push(filename);
            var push = spawn(command, cmd);
            push.stdout.setEncoding('utf8');
            // add a 'data' event listener for the spawn instance
            var linereader = carrier.carry(push.stdout);
            linereader.on('line', function(line){client.emit('cmdoutput',line); });
         
            //push.stdout.on('data', function(data) { client.emit('cmdoutput',data); console.log(data); });
            // add an 'end' event listener to close the writeable stream
            push.stdout.on('end', function(data) {
                client.emit('cmdfinish','done');
            });
            // when the spawn child process exits, check if there were any errors 
            push.on('exit', function(code) {
                client.emit('cmdexit', code);
                cmd_running = false;         
                fs.unlink(filename, function(err)
                {
                    if (err) {console.log(err);}
                    else{console.log("Successfully deleted "+ filename);}
                });
            });
        }
    });
}
