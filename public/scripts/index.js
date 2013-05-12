var oldBookList, currentURL, currentID, socketConnected, beenConnected, retries;

// Login dialog from http://www.alessioatzeni.com/blog/login-box-modal-dialog-window-with-css-and-jquery/
function clickToPublish(url, id) {
     
    currentURL = url;
    currentID = id;
    
            //Getting the variable's value from a link 
    var loginBox = '#login-box';

    //Fade in the Popup
    $(loginBox).fadeIn(300);
    
    //Set the center alignment padding + border see css style
    var popMargTop = ($(loginBox).height() + 24) / 2; 
    var popMargLeft = ($(loginBox).width() + 24) / 2; 
    
    $(loginBox).css({ 
        'margin-top' : -popMargTop,
        'margin-left' : -popMargLeft
    });
    
    $("input").keypress(function(event) {
        if (event.which == 13) {
            event.preventDefault();
            publish();
        }
    });
    // Add the mask to body
    $('body').append('<div id="mask"></div>');
    $('#mask').click(closeMask);
    $('.close').click(closeMask);
    $('#mask').fadeIn(300);
    
    return false;
}

function indexRefreshTimer () {
    window.refreshTimer = setInterval(function() {
        indexRefresh();
    }, 10000);   // refresh every 10 seconds
}

function indexRefresh () {
    $.get(window.sourceURL, {}, function(result) {
        if (result != oldBookList) {
            $('#booklist').html(result);
            oldBookList = result;
        }
    });
}

function closeMask () {
    $('#mask , .login-popup').fadeOut(300 , function() {
        $('#mask').remove();  
    }); 
    return false;
}

function pageSetup () {
    indexRefresh();
    
    // Publishing Kerberos password dialog
    // When clicking on the button close or the mask layer the popup closed
    $(document).on('a.close, #mask', 'click', function() { 
        $('#mask , .login-popup').fadeOut(300 , function() {
            $('#mask').remove();  
        }); 
        return false;
    });
    
    $('#publish-button').click(publish);

    connectSocket();

    checkMOTD();
}

// Show one MOTD per day
function checkMOTD () {
    var messages = {},
        numMsgs,
        msg,
        key,
        new_MOTD_seen,
        last_MOTD_day,
        last_MOTD_seen,
        today;

    today = new Date().getDay();
    last_MOTD_day = getCookie('last_MOTD_day');
    if (today === last_MOTD_day) { return }

    setCookie('last_MOTD_day', today, 365);
    last_MOTD_seen = ( getCookie('last_MOTD_seen')) ? last_MOTD_seen : 0;
    $.ajax({
        url: '/motd.json',
        dataType: 'json',
        data: '',
        method: 'GET',
        complete: function (result) {
            var motds = JSON.parse(result.responseText);
            numMsgs = 0;
            for (msg in motds.messages) {
                key = motds.messages[msg].key;
                if (key > last_MOTD_seen) {
                    messages[key] = motds.messages[msg];
                    new_MOTD_seen = key;
                    numMsgs++;
                    break;
                }
            }
            if (new_MOTD_seen > last_MOTD_seen) {
                setCookie('last_MOTD_seen', new_MOTD_seen, 365);
            }
            if (numMsgs > 0) {
                new EJS({url: 'motd.ejs'}).update('motd', {messages: messages});
                $('.global-warning').click(function() {
                    $('.global-warning').css('display', 'none');
                });
            }
        }});


}

function publish(e) {
    clientsideIdentify(_publish);
}

function _publish (e) {

    var args = $('.signin').serialize(), // kerb details
        pguserid = getCookie('pressgang_userid');
    $.get('/rest/1/publish?url=' + currentURL + '&id=' + currentID + '&pguserid=' + pguserid + '&' + args, function (result) {
        console.log(result);  
        if (1 == result.code) { 
            alert(result.msg); 
        }
        else {
            $('#mask , .login-popup').fadeOut(300 , function() {
                $('#mask').remove();  
            });  
            $('.wipe-me').each(function(){console.log(this.value='')});
            
        }
    });       
}

function rebuild (url, id) {
    $.get('/rest/1/build', {url: url, id: id}, function (result){
        console.log(result);
        return false;
    });
}

function rebuildAll () {
    if (confirm("This will rebuild *all* the books. That's really what you want to do?"))
        $.get('/rest/1/rebuildAll', {}, function(result){
            console.log(result);
        });
    return false;
}

function connectSocket () {
    var socket;
    
    // This code handles disconnection events (for example a server bounce, or the client switching networks)
    if (! socketConnected) {
        if (!beenConnected) {
            socket = io.connect(); 
        
            socket.on('connect', function () { // TIP: you can avoid listening on `connect` and listen on events directly too!
                socketConnected = true;
                console.log('Websocket connected to server');
                socket.emit('subscribeToLibrary');
                
                socket.on('disconnect', function () { 
                    socketConnected = false;
                });
            });
                        
            /* State change is sent every time the book's metadata structure changes on the
             server. It is used to update client-side views of building / publishing / error status
             
             The Death Star Control Panel uses client-side Embedded JavaScript Templating in 
             conjunction with this event to maintain a real-time view of the book's activity on the
             server.
             */
             
            socket.on('librarychange', function (data) {
                console.log('Library Notification: ');
                console.log(data);
                indexRefresh();
            });
        }
    }
}


function setCookie(c_name,value,exdays)
{
    var exdate=new Date();
    exdate.setDate(exdate.getDate() + exdays);
    var c_value=escape(value) + ((exdays==null) ? "" : "; expires="+exdate.toUTCString());
    document.cookie=c_name + "=" + c_value;
}

function getCookie(c_name)
{
    var i,x,y,ARRcookies=document.cookie.split(";");
    for (i=0;i<ARRcookies.length;i++)
    {
        x=ARRcookies[i].substr(0,ARRcookies[i].indexOf("="));
        y=ARRcookies[i].substr(ARRcookies[i].indexOf("=")+1);
        x=x.replace(/^\s+|\s+$/g,"");
        if (x==c_name)
        {
            return unescape(y);
        }
    }
}
