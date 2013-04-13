var flash, original, bookmd, buildLinkURL = 'rebuild';

function url_query( query, url ) {
  // Parse URL Queries
  // from http://www.kevinleary.net/get-url-parameters-javascript-jquery/
  // Will parse the current window location if not passed a url
	query = query.replace(/[\[]/,"\\\[").replace(/[\]]/,"\\\]");
	var expr = "[\\?&]"+query+"=([^&#]*)";
	var regex = new RegExp( expr );
	var results = regex.exec( url) || regex.exec( window.location.href );
	if( results !== null ) {
		return results[1];
		return decodeURIComponent(results[1].replace(/\+/g, " "));
	} else {
		return false;
	}
}

function deathstarItUp()
{
    var editorURL, injectorURL, buildData, endLoc, topicID, socket;

    $('#rebuild-link').click(clickBuild);
    $('#edit-structure').click(clickEditStructure);
    $('#click-publish').click(clickPublish);
    $('#go-home').click(clickGoHome);
    
    socket || (socket = io.connect()); 
    
    socket.on('connect', function () { // TIP: you can avoid listening on `connect` and listen on events directly too!
        console.log('Websocket connected to server');
        socket.emit('patchSubscribe', {skynetURL: skynetURL, id: thisBookID})
    });
    
    socket.on('patchBookinBrowser', patchTopic);
    socket.on('bookRebuiltNotification', bookRebuiltNotification); 
    socket.on('notification', routeNotification);

    getBookmd();
    
    $('.notifier').click(clearNotifier);
}

function getBookmd () {
    $.get('/rest/1/getBookmd', {url: skynetURL, id: thisBookID},
        function (result) {
            if (result.md) bookmd = result.md; 
            if (bookmd.buildID) {
                $('#rebuild-link').html('Rebuilding...');
                $('#rebuild-link').addClass('css3-blink');
                buildLinkURL = '/buildlog.html?buildid=' + bookmd.buildID;
            }
    });  
}

function clickGoHome (e) {
    e.preventDefault();
    window.open('/', '_deathstar'); 
    return false;    
}

function routeNotification (data) {
    if (data.buildnotification) {
        buildNotification(data); 
    } else {
        displayNotification(data);
    }
}

function buildNotification (data) {
    if (data.linkURL) buildLinkURL = data.linkURL;
    $('#rebuild-link').html(data.msg);    
    if (data.blink) {
        $('#rebuild-link').addClass('css3-blink');
    } else {
        $('#rebuild-link').removeClass('css3-blink');
    }
}

function clickBuild (e) {
    e.preventDefault();
    if (buildLinkURL == 'rebuild') {
        $.get('/rest/1/build', {url: skynetURL, id: thisBookID}, function (result){
            console.log(result);
            return false;
        });
    } else 
        if (buildLinkURL == 'reload') { location.reload(true); }
        else
    {
     window.open(buildLinkURL, '_blank');
     return false;
    }
}

function clickPublish (e) {
    e.preventDefault();
    window.open('/publish','_deathstar');
    return false;
}

function clickEditStructure (e) {
    e.preventDefault();
    window.open('/cspec-editor.html?skyneturl=' + skynetURL + '&topicid=' + thisBookID);
    return false;
}

function displayNotification (data) {
   flashTitle(data.title);
   $('.notifier').html(data.msg);
   $('.notifier').removeClass('invisible');
}

function clearNotifier () {
    clearInterval(flash);
    document.title = original;
    $('.notifier').addClass('invisible');
    return true;
}

function flashTitle (msg) {
    original = document.title;  

    flash = setInterval(function () { 
        document.title = (document.title == original) ? msg : original; 
        }, 500);    
}

function bookRebuiltNotification () {
    flashTitle('Updated');
    $('.notify-rebuilt').removeClass('invisible');   
    buildLinkURL = 'reload';
    $('#rebuild-link').html('Reload');
}

function reload () {
    location.reload(true);
}

// Invoked via websocket from the server
function patchTopic (msg) {
    console.log('Received patch for Topic ' + msg.topicID);
    if (msg.topicID && msg.html) {
        
        // Locate the sectionTopic
        var target = $('.sectionTopic' + msg.topicID);
    
        if (!target) return;
    
        // Locate and preserve its .prereqs-list child, if it exists
        var prereq = target.children('.prereqs-list').detach();
        
        // Locate and preserve its .see-also-list child, if it exists
        var seealso = target.children('.see-also-list').detach();
        
        // Locate and preserve the bug link / edit child
        var buglink = target.children('.bug-link').detach();
        
        // Get the title from the existing topic - this gets us the TOC anchor and correct section number
        var title = target.find('.title')[0];
        
        // Update the content
        target.html(msg.html);
        
        // Now replace the title to get the TOC anchor and the correct section numbering
        $(target.find('.title')[0]).replaceWith(title);
        
        // Restore injected content
        if (prereq) prereq.insertAfter(target.find('hr'));
        if (seealso) seealso.appendTo(target);
        if (buglink) buglink.appendTo(target);
            
    }    
}
    
