var oldBookList, currentURL, currentID;

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

function indexRefresh (){
 window.refreshTimer = setInterval(function() {
     $.get(window.sourceURL, {}, function(result) {
         if (result != oldBookList) {
             $('#booklist').html(result);
             oldBookList = result;
         }
     });
    }, 1000);   
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
}

function publish (e) {
    var args = $('.signin').serialize();
    $.get('/rest/1/publish?url=' + currentURL + '&id=' + currentID + '&' + args, function (result) {
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
    $.get('/rest/1/rebuildAll', {}, function(result){
        console.log(result);
    });
    return false;
}