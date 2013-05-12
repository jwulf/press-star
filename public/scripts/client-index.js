var viewModel,
    socketConnected = false;

function PressStarViewModel() {
    // Data
    var self = this;
    self.defaultURL = 'http://skynet.usersys.redhat.com:8080/TopicIndex';
    self.pages = ['Home','Create New Book', 'Add Book', 'Remove Book', '"Publish and be Damned!"', 'Issues / Features'];
    self.templates = {
        'Issues / Features' : 'issues.ejs',
        'Home' : 'home.ejs',
        'Create New Book': 'create.ejs',
        'Add Book' : 'add.ejs',
        'Remove Book': 'remove.ejs',
        '"Publish and be Damned!"' : 'publish.ejs'};
    self.pageURLs = {
        'Home' : '',
        'Add Book' : 'add',
        'Remove Book': 'remove',
        '"Publish and be Damned!"' : 'publish',
        'Issues / Features': 'issues'
    };
    self.URLs = {
        '': 'Home',
        'create': 'Create New Book',
        'add': 'Add Book',
        'remove': 'Remove Book',
        'publish': '"Publish and be Damned!"',
        'Issues / Features': 'issues'
    };
    self.chosenPageData = ko.observable();
    self.chosenPageId = ko.observable();
    self.Books = {};
    self.sortedBooks = [];

    // Behaviours
    self.goToPage = function(page, pop_event) {
        self.chosenPageId(page);

        if (pop_event !== true) { history.pushState({page: page}, page, '/' + self.pageURLs[page]); }

        self.template = 'ejs/' + self.templates[page];
        new EJS({url: self.template}).update('page-view', {
                                                    books: self.sortedBooks,
                                                    data: self.Books,
                                                    defaultURL: self.defaultURL
        });
        if (page === 'Add Book') { addPageSetup(); }
        if (page === '"Publish and be Damned!"') {    $('#publish-button').click(publish); }
    };

    //self.goToPage('Issues / Features');

};


function connectSocket() {
    var socket;

    // This code handles disconnection events (for example a server bounce, or the client switching networks)
    if (! socketConnected) {
        socket = io.connect();

        socket.on('connect', function () { // TIP: you can avoid listening on `connect` and listen on events directly too!
            console.log('Websocket connected to server');
            socketconnected = true;
            socket.emit('subscribeToLibrary');

            socket.on('disconnect', function () {
                displayNotification('Lost connection to server...', NO_FLASH);
                setTimeout(disconnectedNotifier, 5000);
                socketConnected = false;
                retries = 0;
            });
        });

        socket.on('librarychange', echo);
        //socket.on('bookRebuiltNotification', echo);
        //socket.on('notification', echo);
    }
}
function echo (data) {
    console.log(data);
    console.log(data);
    if (data.id && data.url && data._name) {
        viewModel.Books[data.url][data.id][data._name] = data._value;
        new EJS({url: viewModel.template}).update('page-view', {
            books: viewModel.sortedBooks,
            data: viewModel.Books,
            defaultURL: viewModel.defaultURL
        });
    }
}

function onLoad(){
    var _url;
    viewModel = new PressStarViewModel();
    ko.applyBindings(viewModel);
    renovateBookList(function () {
        _url = window.location.pathname.substr(1);
        if (viewModel.URLs[_url]) { viewModel.goToPage(viewModel.URLs[_url]); }
    });

    checkMOTD();

    window.onpopstate = function (event) {
        var POP_EVENT = true;
        if (event.state && event.state.page) {
            viewModel.goToPage(event.state.page, POP_EVENT);
        }
    };

  connectSocket();
}

function renovateBookList (callback) {

    $.get('/rest/1/getbooks', function (md) {
        var url, id, thisTitle, sortedBooks;

        viewModel.Books = md;
        sortedBooks = [ ];

        for (url in md) {
            for (id in md[url]) {
                thisTitle = md[url][id].product + ' - ' +  md[url][id].title;
                sortedBooks.push({ title : thisTitle, url: url, id: id});
            }
        }
        sortedBooks.sort( function (a, b){
            var titleA = a.title.toLowerCase(), titleB = b.title.toLowerCase();
            if (titleA < titleB)
                return -1;
            if (titleA > titleB)
                return 1;
            return 0;
        });
        viewModel.sortedBooks = sortedBooks;
        if (callback) { return callback(); }
    });
}

function addPageSetup () {
    // Bind event handlers

    // Disable the Add Book button when the Content Spec field is empty
    // Enable it when there is something in there
    $('#specid-input').keyup(function(){
        if ($('#specid-input').val() === '') {
            $('#add-button').attr('disabled', 'disabled');
        } else {
            $('#add-button').removeAttr('disabled');
        }
    });

    $("#add-button").click(function() {
        $('#result').html('Checking out book on server').removeClass('alert-success').removeClass('alert-error').addClass('alert alert-info');
        $.get('/rest/1/addbook', {url: $('input[name="serverURL"]').val(), id: $('input[name="specID"]').val() },
            function(response){
                $('#result').html(response.msg);
                if (response.code === 0) {
                    $('#result').removeClass('alert-error').removeClass('alert-info').addClass('alert alert-success');
                    renovateBookList();
                }
                if (response.code === 1) {
                    $('#result').removeClass('alert-info').removeClass('alert-success').addClass('alert');
                }
            }).fail(function (err) {
                $('#result').html('There is a disturbance in the force. Error communicating with the server.');
                $('#result').addClass('alert alert-error');
            });
        return false;
    });
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

    var pgusername = getCookie('username');

    if ($('#username').val() === '' && pgusername) {
        $('#username').val(pgusername);
    }

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

function closeMask () {
    $('#mask , .login-popup').fadeOut(300 , function() {
        $('#mask').remove();
    });
    return false;
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