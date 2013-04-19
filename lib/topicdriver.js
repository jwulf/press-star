var cheerio = require('cheerio');

exports.topicupdate = topicupdate;
exports.adjustProgramlistingLanguages = adjustProgramlistingLanguages;

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

function topicupdate (req, res) {
    return;
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
 
    console.log('adjustProgramListing');
    var lang, lowercaseLang;
    var $ = cheerio.load(xml, {xmlMode: true});
    
    var iterations = $('programlisting').length;
    
    console.log(iterations + ' programlistings found');
    
    if (iterations === 0 && cb) cb (null, xml);
    
    var counter = 0;
    var err = null;
    
    $('programlisting').each (function (){
        lang = $(this).attr('language');
        if (lang) {
            lowercaseLang = lang.toLowerCase();
            if (KateSyntaxHighlightingLanguages[lowercaseLang]) { // we found a language
                if (lang != KateSyntaxHighlightingLanguages[lowercaseLang]) // it wasn't correctly capitalized
                // So we replaced it with the correctly capitalized one
                    $(this).attr('language', KateSyntaxHighlightingLanguages[lowercaseLang]); 
            } else { // the language is unrecognizable
                err = lang;
            }
        }
        counter ++;
        if (counter >= iterations && cb ) return cb(err, $.html());
    });
}

function updateTopicInPressGang (userid, url, id, xml, log_level, log_msg, cb) {
    var _cb, _log_level, _log_msg;
    
    if (typeof log_level == 'function') _cb = log_level;
    if (typeof log_msg == 'function') _cb = log_msg;
    if (typeof cb == 'function') _cb = cb;
    
    _log_level = (log_level && 'function' != typeof log_level) ? log_level : 1;
    _log_msg = (log_msg && 'function' != typeof log_msg) ? log_msg : 1;
    
    if (_log_msg) {
        
    }
    
}