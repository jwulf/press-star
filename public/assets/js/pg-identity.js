var _identification_callback;

$(function () {
    $('body').append('<div id="pg-identity-div"></div>');
    new EJS({url: '/ejs/identify.ejs'}).update('pg-identity-div', {});
    $('#pg-identify-button').click(doIdentityLookup);
    $('.close').click(closeMask);
    $('#cancel-log-msg').click(closeMask)
});

function doIdentityLookup (){
    var _pgusername, _pgauthor, _pguserid, _firstname, _surname, _email, _author, _url;

    // Do the identity lookup
    _pgusername = $('#pg-username').val();

    if (!_pgusername) { return null; }
    _url = (skynetURL.indexOf('http') === 0) ?  skynetURL : 'http://' + skynetURL;
    _url += '/seam/resource/rest/1/users/get/json/query;username=';
    _url += _pgusername;
    _url += '?expand=%7B%22branches%22%3A%5B%7B%22trunk%22%3A%20%7B%22name%22%3A%20%22users%22%7D%7D%5D%7D'
    $.get(_url, function (result) {
        if (result.items.length > 0) {
            _pguserid = result.items[0].item.id;
            _pgauthor = result.items[0].item.description;
            _author = _pgauthor.split(' ');
            _firstname =  _author[0] || '';
            _surname =  _author[1] || '';
            _email  =  _author[2] || '';

            if (confirm('Identify as ' + _pgauthor + '?')) {
                setCookie('username', _pgusername, 365);
                setCookie('pressgang_userid', _pguserid, 365);
                setCookie('userfirstname', _firstname, 365);
                setCookie('usersurname', _surname, 365);
                setCookie('useremail', _email, 365);
                closeMask();
                if (_identification_callback) { _identification_callback(); }
            }
        } else {
            alert('User ' + _pgusername + ' not found.');
        }
    });
}

/**
 *  Immediately call the callback if we have a clientside identity for the user
 *  If there is not one already, display a login dialog and get their user identity
 *  then invoke the callback.
 *
 * @param {function} callback Function to execute on successful identification
 * To pass arguments through authentication, construct the callback like this:
 *   clientsideAuthenticate(function() {callbackFunction(arg1, arg2, ...); });
 */
function clientsideIdentify(callback) {
    if (getCookie('pressgang_userid')) { // We are already identified
        if (callback) { return callback(); }
    } else {
        _identification_callback = callback;

        var loginBox = $('#pg-identify-dialog');
        //Fade in the Popup
        $(loginBox).fadeIn(300);

        //Set the center alignment padding + border see css style
        var popMargTop = ($(loginBox).height() + 24) / 2;
        var popMargLeft = ($(loginBox).width() + 24) / 2;

        $(loginBox).css({
            'margin-top' : -popMargTop,
            'margin-left' : -popMargLeft
        });

        $("#pg-username").keypress(function(event) {
            if (event.which == 13) {
                event.preventDefault();

            }
        });
        $("input").keypress(function(event) {
            if (event.keyCode == 27) {
                closeMask ();
            }
        });
        // Add the mask to body
        $('body').append('<div id="mask"></div>');
        $('#mask').click(closeMask);
        $('#mask').fadeIn(300);
        // Show identity dialog
    }
}

function closeMask () {
    $('#mask , .login-popup').fadeOut(300 , function() {
        $('#mask').remove();
    });
    return false;
}