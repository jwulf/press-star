var cheerio = require('cheerio'),
    rest = require('restler'),
    Library = require('./Library'),
    pressgang = require('pressgang-rest'),
    livePatch = require('./livePatch'),
    pushSpec = require('./../routes/sockethandler').pushSpec,
    pressgang_rest_v1_url = '/seam/resource/rest/1/',
    pressgang_rest_get_topic_url = pressgang_rest_v1_url + 'topic/get/json/';
    pressgang_rest_get_spec_url = pressgang_rest_v1_url + 'contentspec/get/text/';

exports.topicupdate = topicupdate;
exports.getTopic = getTopic;
exports.gettopicRESTEndpoint = gettopicRESTEndpoint;
exports.adjustProgramlistingLanguages = adjustProgramlistingLanguages;
exports.updateTopicInPressGang = updateTopicInPressGang;


function gettopicRESTEndpoint (req, res) {
    /* REST endpoint for getting Topics */

    getTopic(req.query.url, req.query.id, req.query.specid, req.query.revision, function (response) {
        //console.log('sending topic');
        res.send(response);
    });
}

function getTopic (url, id, specid, revision, cb) {
    // Disambiguate online and offline operation

    // if online
    return getTopicFromPressGang(url, id, specid, revision, cb);
}

function getTopicFromPressGang (url, id, specid, revision, cb) {
    var _url, _cb, _rev;

    _cb = (typeof revision == 'function') ? revision: cb;
    _rev = (typeof revision != 'function' ) ? revision : null;
    _url = (url.indexOf('http://') == -1) ? 'http://' + url : url;
    if (id) {
    	_url += pressgang_rest_get_topic_url + id;
    } else
    {
    	_url += pressgang_rest_get_spec_url + specid;
    }
    if (_rev) _url += '/r/' + _rev;

    console.log('Requesting topic from ' + _url);
    rest.get(_url).on('complete', function (response) {
      console.log('topic response from Pressgang');
      console.log(response);
        _cb(response);
    });
}


function topicupdate (req, res) {
    /* REST endpoint for posting topics */
    var url, xml, log_level, log_msg, userid, id, specid, html, _req, newRevision, revision, mytitle;


    id = req.body.id;
    url = req.body.url;
    xml = req.body.xml;
    html = req.body.html;
    log_level = (req.body.log_level) ? req.body.log_level : 1;
    log_msg = req.body.log_msg;
    specid = req.body.specid;
    userid = (req.body.userid) ? req.body.userid : 89; // default to the unknown user
    revision = req.body.revision;

    if (id && url && xml) {
        if (!req.body.forceoverwrite) { // forceoverwrite skips the check

         console.log('forceoverwrite not specified - checking revision');

            // Do a check to see if save.revision == current.revision
            // if not return return res.send({revisionconflict: current.revision})
            getTopic(url, id, specid, function (response) {
                console.log('Checking latest revision: %s against my revision: %s', response.revision, revision);
                if (response.revision == revision) {
                    // We will compare the current title with the new one, and add the title change if needed
                    var $ = cheerio.load(xml, {xmlMode: true});
                    if ($('section>title').length > 0) mytitle =  $($('section>title')[0]).html();
                    if (mytitle !== response.title) req.body.title = mytitle;
                    doTopicPost(req, res);
                } else {
                    response.revisionconflict = true;
                    return res.send(response);
                }
            });
        } else { // force overwrite
            doTopicPost(req, res);
        }
    } else {
        return res.send({code: 1, msg: "Didn't get an ID, a URL, and some XML"});
    }
    return;
}

function doTopicPost(req,res) {
    var url, xml, log_level, log_msg, userid, id, specid, html, newRevision, revision, save;

    id = req.body.id;
    url = req.body.url;
    xml = req.body.xml;
    html = req.body.html;
    log_level = (req.body.log_level) ? req.body.log_level : 1;
    log_msg = req.body.log_msg;
    specid = req.body.specid;
    userid = (req.body.userid) ? req.body.userid : 89; // default to the unknown user
    revision = req.body.revision;

    adjustProgramlistingLanguages(xml, function(err, result) {
        xml = result;

        save = {
            id: id,
            url: url,
            html: html,
            xml: xml,
            log_level: log_level,
            log_msg: log_msg,
            specid: specid,
            userid: userid,
            revision: revision
        };

        if (req.body.title) save.title = req.body.title;
        // Here is where we disambiguate about online or offline operation

        // Operating online? Send it to the PressGang server
        updateTopicInPressGang(save, function (result) {
            return res.send(result);
        });
    });
}

/**
 *
 * @param  {
            id: number: Topic ID,
            url: url,
            html: html,
            xml: xml,
            log_level: log_level,
            log_msg: log_msg,
            specid: specid,
            userid: userid,
            revision: revision
        }  save
 * @param cb
 */
// REFACTOR: This should probably go into the pressgang-rest npm module
function updateTopicInPressGang (save, cb) {
    var _log_msg, _url,
        configured_params,
        postData;
    console.log("Saving topic URL: %s  ID : %s", save.url, save.id);
    var DEFAULT_LOG_MSG = (save.specid && Library.Books[save.url] && Library.Books[save.url][save.specid]) ? 'Updated from "' + Library.Books[save.url][save.specid].title + '" Spec ID: ' + save.specid  : "Updated from Press Star";

    // Default log level 1, no default log message yet
    // We will make the default log message 'Edited by <username> in <book title>
    _log_msg = (save.log_msg) ? save.log_msg : DEFAULT_LOG_MSG;

    _url = save.url + pressgang_rest_v1_url + 'topic/update/json';

    /* The post message to save a topic in PressGang puts the "userId" (the actual table id of a user), the "flag" (1= minor, 2 = major)
        and the "message" (the log message) into the URL parameters for the POST request.
    */

    configured_params = (save.title) ? ['xml', 'title'] : ['xml'];
    postData = {   id: save.id,
                    configuredParameters: configured_params,
                    xml: save.xml    };

    if (save.title) postData.title = save.title;

    // console.log(postData);

    rest.postJson(_url, postData,  {  query: {
            message: _log_msg,
            flag: save.log_level,
            userId: save.userid
        }
    }).on('complete', function (data, response) {
        cb (data);
        if (response.statusCode == 200) {
            if (data.revision) {// if we got back a topic
                if (data.revision !== save.revision) { // if the revision number changed
                  // Patch the topic in books on the server
                  console.log('Client posted %s, new revision on server is %s', save.revision, data.revision);
                  console.log('Patching %s %s rev %s', save.url, save.id, data.revision);
                  var _newrevision = data.revision;
                  livePatch.patch(save.url, save.id, save.html, _newrevision);

                  // if it was a topic title-changing edit, we will silently realign the spec
                  if (save.title) {
                      _url = (save.url.indexOf('http://') == -1) ? 'http://' + save.url : save.url;
                      _url += pressgang_rest_get_topic_url + save.specid;


                      rest.get(_url).on('complete', function (response) {
                          //console.log(response.xml);
                          pushSpec({command: 'push', opts: '-p', spec: response.xml, server: save.url});
                      });
                  }
                }
            }
        }
    });
}

function adjustProgramlistingLanguages (xml, cb) {
/* adjust the language attribute of any <programlisting> elements to make it
  Kate Language Syntax Highlighting compliant. Publican will barf on "incorrectly"
  capitalized programlisting language attributes.
  
  This function can be used during validation. In this case the user will be informed only
  when we can't fix it during save.
  
  This function is also called during the topic save, and we adjust the programlisting language
  attributes transparently.
  
  See:
// Kate Syntax Highlighting Languages: 
// http://search.cpan.org/~szabgab/Syntax-Highlight-Engine-Kate-0.06/lib/Syntax/Highlight/Engine/Kate.pm#PLUGINS

// Publican enforces strict capitalization
// https://bugzilla.redhat.com/show_bug.cgi?id=919474

// PressGang doesn't deal with it: 
// https://bugzilla.redhat.com/show_bug.cgi?id=912959
*/

    var lang,
        lowercaseLang,
        _hasCDATA = (xml.indexOf('<![CDATA[') !== -1);

    /* Both jsdom and cheerio do not handle CDATA tags
      jsdom: https://github.com/tmpvar/jsdom/pull/333
      cheerio: https://github.com/MatthewMueller/cheerio/issues/197
      We should be able to reimplement this check using string parsing, 
      rather than DOM parsing. In the meantime, don't rewrite anything with CDATA in it 
    */

    var $ = cheerio.load(xml, {xmlMode: true});

    var iterations = $('programlisting').length;

    if (iterations) {
        console.log('Checking ' + iterations + ' <programlisting> elements for language');
    } else {
        console.log('No programlisting elements found');
    }

    if (iterations === 0 && cb) {
        $ = null;
        return cb (null, xml);
    }

    var counter = 0,
        err = null,
        _html = '';

    $('programlisting').each (function (){
        lang = $(this).attr('language');
        if (lang) {
            lowercaseLang = lang.toLowerCase();
            if (KateSyntaxHighlightingLanguages[lowercaseLang]) { // we found a language
                if (lang != KateSyntaxHighlightingLanguages[lowercaseLang]) {// it wasn't correctly capitalized
                    if (_hasCDATA) { // we can't rewrite this, return a warning for the validator
                        err = {lang: lang, shouldbe: KateSyntaxHighlightingLanguages[lowercaseLang]};
                    } else {
                        // So we replaced it with the correctly capitalized one
                        $(this).attr('language', KateSyntaxHighlightingLanguages[lowercaseLang]);
                    }
                }
            } else { // the language is unrecognizable
                err = {unrecognized: lang};
            }
        }
        counter ++;

        // When we've done our dash
        if (counter >= iterations && cb ) {
            if (_hasCDATA) { // don't rewrite it if it has CDATA, we'll lose it then
                $ = null;
                return cb(err, xml);
            } else { // rewrite if it has no CDATA
                _html = $.html();
                $ = null;
                return cb(err, _html);
            }
        }
    });
}

// http://search.cpan.org/~szabgab/Syntax-Highlight-Engine-Kate-0.06/lib/Syntax/Highlight/Engine/Kate.pm#ATTRIBUTES
var KateSyntaxHighlightingLanguages = { '.desktop': '.desktop',
  '4gl': '4GL',
  '4gl-per': '4GL-PER',
  abc: 'ABC',
  ahdl: 'AHDL',
  'ansi c89': 'ANSI C89',
  asp: 'ASP',
  'avr assembler': 'AVR Assembler',
  awk: 'AWK',
  ada: 'Ada',
  ansys: 'Ansys',
  'apache configuration apache_configuration': 'Apache Configuration Apache_Configuration',
  asm6502: 'Asm6502',
  bash: 'Bash',
  bibtex: 'BibTeX',
  c: 'C',
  'c#': 'C#',
  'c++': 'C++',
  cgis: 'CGiS',
  cmake: 'CMake',
  css: 'CSS',
  'cue sheet': 'CUE Sheet',
  cg: 'Cg',
  changelog: 'ChangeLog',
  cisco: 'Cisco',
  clipper: 'Clipper',
  coldfusion: 'ColdFusion',
  'common lisp': 'Common Lisp',
  'component-pascal': 'Component-Pascal',
  d: 'D',
  'debian changelog': 'Debian Changelog',
  'debian control': 'Debian Control',
  diff: 'Diff',
  doxygen: 'Doxygen',
  'e language': 'E Language',
  eiffel: 'Eiffel',
  email: 'Email',
  euphoria: 'Euphoria',
  fortran: 'Fortran',
  freebasic: 'FreeBASIC',
  gdl: 'GDL',
  glsl: 'GLSL',
  'gnu assembler': 'GNU Assembler',
  'gnu gettext': 'GNU Gettext',
  html: 'HTML',
  haskell: 'Haskell',
  idl: 'IDL',
  ilerpg: 'ILERPG',
  'ini files': 'INI Files',
  inform: 'Inform',
  'intel x86 (nasm)': 'Intel x86 (NASM)',
  jsp: 'JSP',
  java: 'Java',
  javascript: 'JavaScript',
  javadoc: 'Javadoc',
  kbasic: 'KBasic',
  'kate file template': 'Kate File Template',
  ldif: 'LDIF',
  lpc: 'LPC',
  latex: 'LaTeX',
  'lex/flex': 'Lex/Flex',
  lilypond: 'LilyPond',
  'literate haskell': 'Literate Haskell',
  lua: 'Lua',
  m3u: 'M3U',
  'mab-db': 'MAB-DB',
  'mips assembler': 'MIPS Assembler',
  makefile: 'Makefile',
  mason: 'Mason',
  matlab: 'Matlab',
  'modula-2': 'Modula-2',
  'music publisher': 'Music Publisher',
  octave: 'Octave',
  'php (html)': 'PHP (HTML)',
  'pov-ray': 'POV-Ray',
  pascal: 'Pascal',
  perl: 'Perl',
  picasm: 'PicAsm',
  pike: 'Pike',
  postscript: 'PostScript',
  prolog: 'Prolog',
  purebasic: 'PureBasic',
  python: 'Python',
  'quake script': 'Quake Script',
  'r script': 'R Script',
  rexx: 'REXX',
  'rpm spec': 'RPM Spec',
  'rsi idl': 'RSI IDL',
  'renderman rib': 'RenderMan RIB',
  ruby: 'Ruby',
  sgml: 'SGML',
  sml: 'SML',
  sql: 'SQL',
  'sql (mysql)': 'SQL (MySQL)',
  'sql (postgresql)': 'SQL (PostgreSQL)',
  sather: 'Sather',
  scheme: 'Scheme',
  sieve: 'Sieve',
  spice: 'Spice',
  stata: 'Stata',
  'ti basic': 'TI Basic',
  taskjuggler: 'TaskJuggler',
  'tcl/tk': 'Tcl/Tk',
  unrealscript: 'UnrealScript',
  vhdl: 'VHDL',
  vrml: 'VRML',
  velocity: 'Velocity',
  verilog: 'Verilog',
  'wine config': 'WINE Config',
  wikimedia: 'Wikimedia',
  xml: 'XML',
  'xml (debug)': 'XML (Debug)',
  'yacc/bison': 'Yacc/Bison',
  de_de: 'de_DE',
  en_en: 'en_EN',
  ferite: 'ferite',
  nl: 'nl',
  progress: 'progress',
  scilab: 'scilab',
  txt2tags: 'txt2tags',
  'x.org configuration': 'x.org Configuration',
  xharbour: 'xHarbour',
  xslt: 'xslt',
  yacas: 'yacas' },
  kateURL = "http://search.cpan.org/~szabgab/Syntax-Highlight-Engine-Kate-0.06/lib/Syntax/Highlight/Engine/Kate.pm#ATTRIBUTES";
