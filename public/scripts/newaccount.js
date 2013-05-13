var Model;

$(function () {
    Model = new AppViewModel();
    ko.applyBindings(Model);
    $('#do-create-user').click(createUser);
});

function AppViewModel() {
    var self = this;

    self.username = ko.observable('');
    self.firstname = ko.observable('');
    self.surname = ko.observable('');
    self.email = ko.observable('');
    self.created = ko.observable(false);
    self.errormsg = ko.observable();
    self.successmsg = ko.observable();
    self.description = ko.computed(function() {
        return self.firstname() + " " + self.surname() + ' ' + self.email();
    });
    self.complete = ko.computed(function() {
        return self.firstname().length > 1 && self.surname().length > 1 && self.email().length > 1
            && self.username().length > 1 && !self.created();
    })
}

function createUser (e) {

    var url, _url, _req_url, _req_JSON;

    if (e) { e.preventDefault(); }
    Model.errormsg('');
    url = location.href;
    var qs = url.substring(url.indexOf('?') + 1).split('&');
    for(var i = 0, params = {}; i < qs.length; i++){
        qs[i] = qs[i].split('=');
        params[qs[i][0]] = decodeURIComponent(qs[i][1]);
    }

    _url = params.url;
    // First check if the specified user already exists

     _req_url = _url + '/seam/resource/rest/1/users/get/json/query;username=';
    _req_url += Model.username();
    _req_url += '?expand=%7B%22branches%22%3A%5B%7B%22trunk%22%3A%20%7B%22name%22%3A%20%22users%22%7D%7D%5D%7D'
    $.get(_req_url, function (result) {
        if (result.items  && result.items.length > 0) {
            Model.errormsg('User ' + Model.username() + ' already exists');
        }  else {   // Create the user
            _req_url = _url + '/seam/resource/rest/1/user/create/json/';
            var _req_JSON = {"name": Model.username(), "description": Model.description(), "configuredParameters": ["name", "description"]};
            $.ajax ({
                url: _req_url,
                type: "POST",
                data: JSON.stringify(_req_JSON),
                dataType: "json",
                contentType: "application/json; charset=utf-8",
                success:  function (result) {
                    if (result.id && result.name) {
                        Model.created(true);
                        Model.successmsg('User ' + Model.username() + ' successfully created. Close this window now.')
                        window.opener.pgInjectIdentity(result.name);
                    }  else {
                        Model.errormsg('Something went wrong there. Sorry. I suggest you try again with the browser console open and watch for errors to help debug.');
                    }
                }
            });
        }
    });


    return false;



}