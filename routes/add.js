


exports.add = function (req, res) {
   // var resturl= '/rest/1/addbook?url=' + url + '&id=' + id;
    res.render('add',{defaultURL: 'http://skynet.usersys.redhat.com:8080/TopicIndex', mode: 'add'});
}