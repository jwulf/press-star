
 
var docCookies = {
    
    /*\
 |*|
 |*|  :: cookies.js ::
 |*|
 |*|  A complete cookies reader/writer framework with full unicode support.
 |*|
 |*|  https://developer.mozilla.org/en-US/docs/DOM/document.cookie
 |*|
 |*|  Syntaxes:
 |*|
 |*|  * docCookies.setItem(name, value[, end[, path[, domain[, secure]]]])
 |*|  * docCookies.getItem(name)
 |*|  * docCookies.removeItem(name[, path])
 |*|  * docCookies.hasItem(name)
 |*|  * docCookies.keys()
 |*|
 \*/
 
  getItem: function (sKey) {
    if (!sKey || !this.hasItem(sKey)) { return null; }
    return unescape(document.cookie.replace(new RegExp("(?:^|.*;\\s*)" + escape(sKey).replace(/[\-\.\+\*]/g, "\\$&") + "\\s*\\=\\s*((?:[^;](?!;))*[^;]?).*"), "$1"));
  },
  setItem: function (sKey, sValue, vEnd, sPath, sDomain, bSecure) {
    if (!sKey || /^(?:expires|max\-age|path|domain|secure)$/i.test(sKey)) { return; }
    var sExpires = "";
    if (vEnd) {
      switch (vEnd.constructor) {
        case Number:
          sExpires = vEnd === Infinity ? "; expires=Tue, 19 Jan 2038 03:14:07 GMT" : "; max-age=" + vEnd;
          break;
        case String:
          sExpires = "; expires=" + vEnd;
          break;
        case Date:
          sExpires = "; expires=" + vEnd.toGMTString();
          break;
      }
    }
    document.cookie = escape(sKey) + "=" + escape(sValue) + sExpires + (sDomain ? "; domain=" + sDomain : "") + (sPath ? "; path=" + sPath : "") + (bSecure ? "; secure" : "");
  },
  removeItem: function (sKey, sPath) {
    if (!sKey || !this.hasItem(sKey)) { return; }
    document.cookie = escape(sKey) + "=; expires=Thu, 01 Jan 1970 00:00:00 GMT" + (sPath ? "; path=" + sPath : "");
  },
  hasItem: function (sKey) {
    return (new RegExp("(?:^|;\\s*)" + escape(sKey).replace(/[\-\.\+\*]/g, "\\$&") + "\\s*\\=")).test(document.cookie);
  },
  keys: /* optional method: you can safely remove it! */ function () {
    var aKeys = document.cookie.replace(/((?:^|\s*;)[^\=]+)(?=;|$)|^\s*|\s*(?:\=[^;]*)?(?:\1|$)/g, "").split(/\s*(?:\=[^;]*)?;\s*/);
    for (var nIdx = 0; nIdx < aKeys.length; nIdx++) { aKeys[nIdx] = unescape(aKeys[nIdx]); }
    return aKeys;
  }
};


function parseURL (url) {
    // Parse URL into an object
    var parse_url = /^(?:([A-Za-z]+):)?(\/{0,3})([0-9.\-A-Za-z]+)(?::(\d+))?(?:\/([^?#]*))?(?:\?([^#]*))?(?:#(.*))?$/;
    
    var result = parse_url.exec(url);
    var names = ['url', 'scheme', 'slash', 'host', 'port', 'path', 'query', 'hash'];
    var blanks = '       ';
    var i;
    var parsed_url = {};
    for (i = 0; i < names.length; i += 1) {
        parsed_url[names[i]] =  result[i];
    }   
    return parsed_url;
}

/*  
    Example URLs:
    
    http://documentation-devel.engineering.redhat.com/docs/en-US/Red_Hat_Enterprise_MRG/2/html/Messaging_Installation_and_Configuration_Guide/Enable_SSL_in_Python_Clients.html
    https://access.redhat.com/knowledge/docs/en-US/Red_Hat_Enterprise_MRG/2/html/Messaging_Installation_and_Configuration_Guide/index.html
    https://access.redhat.com/knowledge/docs/en-US/Red_Hat_Enterprise_MRG/2/html-single/Messaging_Installation_and_Configuration_Guide/index.html

*/

function getBookPath (){
    // set cookie for entire book in both html and html-single, not just for this page
    var path,
        url = document.URL;
    
    if (url.indexOf('/html-single/') != -1) { // html-single url
        path = '/' + parseURL(url.substring(0, url.indexOf('/html-single/')) + '/').path;
    } else {
        if (url.indexOf('/html/') != -1) { // html url
            path = '/' + parseURL(url.substring(0, url.indexOf('/html/')) + '/').path;
        } else { // unknown url
            path = null;
        }
    }   
    return path;
}

function setDefaultProgrammingLanguageViaCookie (programmingLanguage) {
    // setCookie('defaultProgrammingLanguage', programmingLanguage, getCookiePath(), expiryDate);
    docCookies.setItem('defaultProgrammingLanguage', programmingLanguage, Infinity, getBookPath())
}

function getDefaultProgrammingLanguageFromCookie () {
    return docCookies.getItem('defaultProgrammingLanguage');
}