
/**
 * Module dependencies.
 */

//var memwatch = require('memwatch');
//memwatch.on('leak', function(info) { console.log(info)});

var express = require('express'),
    routes = require('./routes'),
    user = require('./routes/user'),
    http = require('http'),
    path = require('path'),
    sockethandler = require('./routes/sockethandler'),
    initJsondb = require('./lib/Books').initialize(),
    initTopicDependencies = require('./lib/livePatch').initialize(),
    jsondb = require('./lib/Books'),
    restapi = require('./routes/restapi'),
    state = require('./lib/appstate'),
    initializeAppState = require('./lib/appstate').initialize();


var app = express();

/*
console.log('Starting XSL stylesheet load');
var stylesheet = xslt.readXsltFile("xsl/html-single.xsl");
console.log('Completed XSL stylesheet load');
*/

app.configure(function(){
  app.set('port', process.env.PORT || 3000);
  app.set('views', __dirname + '/views');
  app.set('view engine', 'ejs');
//  app.use(express.favicon());
  app.use(express.logger('dev'));
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(express.cookieParser('your secret here'));
//  app.use(express.session());
  app.use(app.router);
  app.use(require('stylus').middleware(__dirname + '/public'));
  app.use(express.static(path.join(__dirname, 'public')));
});

app.configure('development', function(){
  app.use(express.errorHandler());
});

// Enable CORS 
app.all('/*', function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "X-Requested-With");
  next();
});

app.get('/', routes.index);
app.get('/users', user.list);
app.post('/rest/:version/:operation', restapi.restroute);
app.get('/rest/:version/:operation', restapi.restroute);

app.get('/edit', function (req, res) {
    res.render('topic-editor', {layout:false, 
        alwaysUseServerToLoadTopics: state.appstate.alwaysUseServerToLoadTopics || false, 
        offline: state.appstate.offline || false,
    });    
});

app.get('/publish', function (req, res) {
    console.log('publish requested');
    res.render('index', { books: jsondb.sortedBooks, data: jsondb.Books, title: 'Death Star 2.0', mode: 'publish'});
});

app.get('/add', function (req, res) {
   // var resturl= '/rest/1/addbook?url=' + url + '&id=' + id;
    res.render('add',{defaultURL: 'http://skynet.usersys.redhat.com:8080/TopicIndex', mode: 'add'});
});

app.get('/about', function (req,res){
    res.render('about', { mode: 'about'});    
});

app.get('/booklist', function (req, res) {
    //console.log(jsondb.sortedBooks);
    res.render('booklist-partial', {layout: false, books: jsondb.sortedBooks, data: jsondb.Books, app: state.appstate, title: 'Death Star 2.0' });
});

app.get('/remove', function(req, res){
    res.render('index', { books: jsondb.sortedBooks, data: jsondb.Books, title: 'Death Star 2.0', mode: 'remove' });    
});

app.get('/publishlist', function (req, res){
    res.render('booklist-publish', {layout: false, books: jsondb.sortedBooks, data: jsondb.Books});    
});

app.get('/removelist', function (req, res){
    res.render('booklist-remove', {layout: false, books: jsondb.sortedBooks, data: jsondb.Books, title: 'Remove Books'})
});

var server = http.createServer(app).listen(app.get('port'), function(){
  console.log("Express server listening on port " + app.get('port'));
});

var io = require('socket.io').listen(server, {'log level':1});
io.on('connection', sockethandler.socketHandler);
