var _PG;

//$(function () {
    // TODO: check if jQuery, EJS, and Knockout are loaded. If not, async load them and do setup in a callback
    // Also relies on bootstrap.js
    //pgIdentity_setup();
//});


/**
 * Called from a new account pop-up to populate the identity box
 * @param username   PressGang username of new account
 */
function pgInjectIdentity (username) {
   if (_PG) {
       _PG.identity.username(username);
       _PG.doIdentityLookup();
   }
}

/**
 *  Return the identity if we have one, or challenge for one if not
 *
 * @param {function} callback Function to execute on successful identification
 * To pass arguments through authentication, construct the callback like this:
 *   clientsideAuthenticate(function(identity) {if (identity.identified) callbackFunction(arg1, arg2, ...); });
 *   Otherwise
 */
function clientsideIdentify(callback, url) {
    _PG = _PG || new PGIdentity(url);
    _PG.getIdentity(callback);
}

function PGIdentity (url) {
    var _identified;
    self = this;
    self.url = url || skynetURL;
    if (self.url && self.url.length > 0) {
        self.url = (self.url.indexOf('http') === 0) ?  self.url : 'http://' + self.url;
    }
    self.identity = {
        something: ko.observable("Hello"),
        username: ko.observable(),
        userid: ko.observable(),
        firstname: ko.observable(),
        surname: ko.observable(),
        username: ko.observable(),
        email: ko.observable(),
        identified: ko.observable()
    };

    self.identity.username(getCookie('pguser_username'));
    self.identity.userid(getCookie('pguser_userid'));
    self.identity.firstname(getCookie('pguser_firstname'));
    self.identity.surname(getCookie('pguser_surname'));
    self.identity.email(getCookie('pguser_email'));
    _identified = (self.identity.username() !== undefined && self.identity.userid() !== undefined);
    self.identity.identified(_identified);

    $('body').append('<div id="pg-identity-div"></div>');
    // REFACTOR:  can go in a plain ajax call to remove EJS dep
    new EJS({url: '/ejs/identify.ejs'}).update('pg-identity-div', {});
    ko.applyBindings(self.identity, document.getElementById('modal-identity-dialog'));
    $('#pg-identify-button').click(self.doIdentityLookup);
    $('.modal-identity-close').click(self.closeModal);
    $('#pg-identity-thats-me').click(function () {self.acceptIdentity(); });
    $('#pg-identity-create-new-account').click(self.openNewAccount);
    return self;
}

/**
 * Return an identity, if one exists, or challenge for one if not
 * @param callback The callback function that wants identity
 * @returns {*} A PGIdentity transport
 */
PGIdentity.prototype.getIdentity = function (callback) {
    if (callback) { self.callback = callback; }

    if (_PG.identity.identified()) {
        return _PG.returnIdentity(callback);
    } else {
        self.showModal();
    }
}

PGIdentity.prototype.showModal = function () {
    $('#modal-identity-dialog').modal({keyboard: true, backdrop: true});
}

PGIdentity.prototype.closeModal = function () {
    $('#modal-identity-dialog').modal('hide');
}

PGIdentity.prototype.openNewAccount = function (e) {
    window.open('/newaccount.html?url=' + self.url, '_blank');
    if (e && e.preventDefault) { e.preventDefault(); }
    return false;
}

PGIdentity.prototype.doIdentityLookup = function () {
    var _url = self.url;
    _url += '/seam/resource/rest/1/users/get/json/query;username=';
    _url += self.identity.username();
    _url += '?expand=%7B%22branches%22%3A%5B%7B%22trunk%22%3A%20%7B%22name%22%3A%20%22users%22%7D%7D%5D%7D'
    $.get(_url, function (result) {
        if (result.items && result.items.length > 0) {
            self.identity.userid(result.items[0].item.id);
            _pgauthor = result.items[0].item.description;
            _author = _pgauthor.split(' ');
            _firstname = _author[0] || '';
            self.identity.firstname(_firstname);
            _surname = _author[1] || '';
            self.identity.surname(_surname);
            _email =  _author[2] || '';
            self.identity.email(_email);
            self.identity.identified(true);
            return true;
        } else {
            self.identity.firstname('');
            self.identity.surname('');
            self.identity.userid('');
            self.identity.email('');
            alert('User ' + self.identity.username() + ' not found.');
            return false;
        }
    }, 'json');
};


PGIdentity.prototype.acceptIdentity = function () {
    self.setCookie('pguser_username', self.identity.username(), 365);
    self.setCookie('pguser_userid', self.identity.userid(), 365);
    self.setCookie('pguser_firstname', self.identity.firstname(), 365);
    self.setCookie('pguser_surname', self.identity.surname(), 365);
    self.setCookie('pguser_email', self.identity.email(), 365);
    self.returnIdentity();
    self.closeModal();
};


PGIdentity.prototype.setCookie = function (c_name,value,exdays)
{
    var exdate=new Date();
    exdate.setDate(exdate.getDate() + exdays);
    var c_value=escape(value) + ((exdays==null) ? "" : "; expires="+exdate.toUTCString());
    document.cookie=c_name + "=" + c_value;
};


PGIdentity.prototype.getCookie = function (c_name)
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
};

PGIdentity.prototype.returnIdentity = function (callback) {
    var _callback;
    _callback = (callback) ? callback : self.callback;
    if (_callback) _callback(self.identityTransport());
};

    /**
     * Construct an identity object to return to the callback
     * @returns {*}  Identity object
     */
PGIdentity.prototype.identityTransport = function () {
    var _transport, _pgusername, _pguserid, _firstname, _surname, _email, _identified;

    _pgusername = getCookie('pguser_username');
    _pguserid = getCookie('pguser_userid');
    _firstname = getCookie('pguser_firstname');
    _surname = getCookie('pguser_surname');
    _email = getCookie('pguser_email');
    _identified = (_pgusername && _pguserid);
    _transport = {
        identified: _identified,
        username: _pgusername,
        userid: _pguserid,
        firstname: _firstname,
        surname: _surname,
        email: _email
    }
    return _transport;
};