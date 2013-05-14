Deathstar Brand
Author: Joshua Wulf <jwulf@redhat.com>

== Deathstar Editor Brand ==

Forked from the redhat-video brand. The deathstar brand is used to inject editor links into a PressGang topic-based book.

Build a PressGang topic-based book with this brand, then open the html-single version, passing a deathstar editor url to it, like this:

file:///tmp/html-single/index.html?editorurl=http://deathstar/editor/index.html

When the page loads up, javascript will write editor links into the book to open each of the topics in the deathstar editor provided.

You can get the deathstar editor from https://github.com/jwulf/deathstar-editor

== Additional features ==

This brand has a number of outstanding features:

1. Support for embedded video in Firefox
2. Open Sans Webfont
3. Simple target xrefs in HTML output
4. "Codetabs" display
5. Support for livepatching

== Support for embedded video in Firefox ==
This brand allows Firefox to display videos embedded using <videoobject> using any codecs installed on the users computer. 
This gives users on Google Chrome and Mozilla Firefox the same experience.

== Open Sans Webfont ==
The Google web fonts 'Open Sans' and 'PT Mono' are downloaded and used to render the page if the user's browser supports it.
These are Apache-licensed modern fonts designed for web browsers.

== Simple target xrefs in HTML output ==
This type of <xref>:
  <xref xrefstyle="simpletarget" linkend="some id..."/> 

will render in html and html-single without the section and chapter number in front of it. So instead of:
  Section 3.1.5, “Python "Hello World" Program Listing”

you get:
  Python "Hello World" Program Listing

You can rewrite your existing xrefs with this handy perl line:
  perl -p -i -e 's/xref linkend=/xref xrefstyle="simpletarget" linkend=/g' *.xml

Note that PDF output will retain the navigation metadata. It is only HTML output that is affected by this customization.

== "Codetabs" display ==
When you have multiple programlistings in different languages, you can format them like this:

  <variablelist role="codetabs">
  <varlistentry>
<!-- Other language terms: C#/.NET, Ruby, JavaScript, Node.js, HTML -->
    <term>Python</term>
    <listitem>
      <programlisting language="Python">      </programlisting>
    </listitem>
  </varlistentry>
  <varlistentry>
    <term>C++</term>
    <listitem>
      <programlisting language="C++">      </programlisting>
    </listitem>
  </varlistentry>
  <varlistentry>
    <term>Java</term>
    <listitem>
      <programlisting language="Java">      </programlisting>
    </listitem>
  </varlistentry>
</variablelist>

Obviously with the code in each programlisting. In HTML this will be rendered as a standard variablelist, 
which is an acceptable way to present this information.

Additionally, however, in browsers with JavaScript enabled, these multi-lingual code samples will appear
as a set of tabs that allow the user to select which programming language they wish to see, and to set the default from
anywhere in the book.

== Support for Live Patching ==

This brand listens on a websocket, and can patch its own HTML when a topic is edited in Press Star.